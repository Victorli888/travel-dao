import {
  OTP_MAX_PER_EMAIL,
  OTP_MAX_PER_IP,
  OTP_RATE_WINDOW_MS,
  OTP_TTL_MS,
  constantTimeEqual,
  generateOtpCode,
  hashOtp,
  otpUsability,
  type OtpRecord,
} from "./otp";

/**
 * Requesting and verifying a sign-in code, written against injected deps so
 * the whole flow — rate limits, expiry, the attempt cap, single use — is
 * tested with an in-memory store and a fake clock (`otp-service.test.ts`).
 * `otp-store.ts` is the Neon implementation; `auth.ts` and
 * `app/login/actions.ts` do the wiring. Same shape as `runAgentLoop`'s
 * `AgentDeps`.
 *
 * Every store method is one SQL statement. The rate limit and the insert are
 * one statement so two concurrent requests cannot both read "4 of 5" and
 * both write; an attempt is recorded conditionally on the attempt count read,
 * so two concurrent guesses cannot both spend the same attempt, and two
 * concurrent correct guesses cannot both sign in.
 */
export interface OtpStore {
  /** Inserts the code unless a limit is already reached. False = limited. */
  insertIfUnderLimits(
    row: { email: string; codeHash: string; ip: string | null; now: Date; expiresAt: Date },
    limits: { since: Date; maxPerEmail: number; maxPerIp: number },
  ): Promise<boolean>;
  /** The newest code issued to this email, whatever its state. */
  findLatest(email: string): Promise<OtpRecord | null>;
  /**
   * Spends one attempt, and consumes the code when `success`. Applies only if
   * the row is still unconsumed with exactly `expectedAttempts`; false means
   * another request got there first.
   */
  recordAttempt(id: string, expectedAttempts: number, success: boolean, now: Date): Promise<boolean>;
}

export interface OtpDeps {
  store: OtpStore;
  secret: string;
  now: () => Date;
  isAllowed: (email: string) => Promise<boolean>;
  /** Sends the code. Called only for allowed addresses. */
  sendCode: (email: string, code: string) => Promise<void>;
  /**
   * Runs `task` without making the caller wait for it — `after()` in
   * production. Delivery happens off the response path so an allowed
   * address does not answer measurably slower than an unknown one.
   */
  defer: (task: () => Promise<void>) => void;
  /** Overridable for tests; defaults to `generateOtpCode`. */
  generateCode?: () => string;
}

export type RequestOtpResult = { status: "sent" } | { status: "rate_limited" };

/**
 * Issues a code. Expects an already-normalized email (`EmailSchema`).
 *
 * The row is written for *every* address, allowed or not, and the answer is
 * the same either way — so neither the response, nor the rate limit, nor the
 * timing says whether an account exists. Only the email itself does, and
 * that goes only to an address that can use it.
 */
export async function requestOtp(
  deps: OtpDeps,
  email: string,
  ip: string | null,
): Promise<RequestOtpResult> {
  const now = deps.now();
  const code = (deps.generateCode ?? generateOtpCode)();
  const codeHash = await hashOtp(email, code, deps.secret);

  const inserted = await deps.store.insertIfUnderLimits(
    { email, codeHash, ip, now, expiresAt: new Date(now.getTime() + OTP_TTL_MS) },
    {
      since: new Date(now.getTime() - OTP_RATE_WINDOW_MS),
      maxPerEmail: OTP_MAX_PER_EMAIL,
      maxPerIp: OTP_MAX_PER_IP,
    },
  );
  if (!inserted) return { status: "rate_limited" };

  if (await deps.isAllowed(email)) {
    deps.defer(async () => {
      try {
        await deps.sendCode(email, code);
      } catch (error) {
        // Off the response path, so there is no one to tell but the log.
        console.error("Sending the sign-in code failed:", error);
      }
    });
  }

  return { status: "sent" };
}

/**
 * True exactly once per issued code: the newest code for the email, unexpired,
 * unconsumed, under the attempt cap, and matching. Every wrong guess spends
 * an attempt. Expects already-normalized input (`OtpVerifySchema`).
 */
export async function verifyOtp(
  deps: Pick<OtpDeps, "store" | "secret" | "now">,
  email: string,
  code: string,
): Promise<boolean> {
  const now = deps.now();
  // Hashed before the lookup so a miss costs the same HMAC as a hit.
  const submitted = await hashOtp(email, code, deps.secret);
  const record = await deps.store.findLatest(email);

  if (otpUsability(record, now) !== "usable" || !record) return false;

  const matches = constantTimeEqual(submitted, record.codeHash);
  const applied = await deps.store.recordAttempt(record.id, record.attempts, matches, now);
  return matches && applied;
}
