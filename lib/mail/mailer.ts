import { z } from "zod";
import { ConfigError } from "@/lib/api/errors";

/**
 * Outbound email, behind an interface so the provider is a configuration
 * choice. The repo had no email provider before sign-in codes needed one.
 *
 * - `RESEND_API_KEY` + `MAIL_FROM` set → Resend's HTTP API, over `fetch`
 *   (no SDK dependency, and it works on any runtime).
 * - Neither set, outside production → the console mailer, which logs the
 *   message so sign-in works locally with no provider at all.
 * - Neither set, in production → `ConfigError`. Logging a sign-in code to a
 *   production log would hand it to anyone who can read the logs.
 *
 * Adding a provider is one more `Mailer` and one more branch in `getMailer`.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  /**
   * One per logical send, reused across retries, so a retry after a lost
   * response cannot deliver twice. Resend keeps keys for 24 hours and caps
   * them at 256 characters. Defaults to a fresh random key.
   */
  idempotencyKey?: string;
}

export interface SendResult {
  /** The provider's id for the message; null where there is no provider. */
  id: string | null;
}

export interface Mailer {
  send(message: MailMessage): Promise<SendResult>;
}

const MailEnvSchema = z.object({
  RESEND_API_KEY: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(1).optional(),
  NODE_ENV: z.string().optional(),
});

export const consoleMailer: Mailer = {
  async send({ to, subject, text }) {
    console.info(`[mail:console] to=${to} subject=${JSON.stringify(subject)}\n${text}`);
    return { id: null };
  },
};

export interface ResendOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  log?: (line: string) => void;
  /** Total tries, first one included. */
  maxAttempts?: number;
  /** Backoff before retry n is `baseDelayMs * 2^(n-1)`. */
  baseDelayMs?: number;
  /**
   * The longest single wait. A `Retry-After` beyond it ends the retries
   * rather than retrying early — this runs in `after()`, where an open-ended
   * wait would hold the function past its time limit.
   */
  maxDelayMs?: number;
}

/** Seconds or an HTTP date, per RFC 9110. Null when absent or unparseable. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

class MailError extends Error {
  constructor(message: string, readonly retryable: boolean, readonly retryAfterMs: number | null = null) {
    super(message);
    this.name = "MailError";
  }
}

/**
 * Resend's HTTP API over `fetch`, following Resend's sending guidance:
 *
 * - an `Idempotency-Key` on every send, the same one across retries;
 * - retry with exponential backoff on network errors, 5xx and 429, honouring
 *   `Retry-After`; never on any other 4xx (bad sender, bad key, 409
 *   idempotency conflict), which will not succeed the second time;
 * - success is a 2xx **with** an `id` in the body — the HTTP equivalent of
 *   the SDK's `{ data, error }` check — and the id is logged so a message can
 *   be traced in the Resend dashboard. The recipient and body are not logged.
 */
export function resendMailer(
  apiKey: string,
  from: string,
  options: ResendOptions = {},
): Mailer {
  const {
    fetchImpl = fetch,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    log = (line) => console.info(line),
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 5_000,
  } = options;

  async function attempt(message: MailMessage, key: string): Promise<string> {
    let res: Response;
    try {
      res = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
      });
    } catch (error) {
      throw new MailError(`Resend unreachable: ${(error as Error).message}`, true);
    }

    // Resend's error body (`{ name, message, statusCode }`) names the problem
    // and holds nothing secret; the message itself is never echoed.
    const body = (await res.json().catch(() => null)) as
      | { id?: unknown; name?: unknown; message?: unknown }
      | null;

    if (res.ok) {
      if (typeof body?.id !== "string" || !body.id) {
        throw new MailError(`Resend returned ${res.status} without an email id`, false);
      }
      return body.id;
    }

    const detail = `${res.status} ${String(body?.name ?? "")} ${String(body?.message ?? "")}`.trim();
    const retryable = res.status === 429 || res.status >= 500;
    throw new MailError(
      `Resend rejected the message: ${detail}`,
      retryable,
      parseRetryAfter(res.headers.get("retry-after")),
    );
  }

  return {
    async send(message) {
      const key = message.idempotencyKey ?? `mail/${crypto.randomUUID()}`;
      for (let n = 1; ; n++) {
        try {
          const id = await attempt(message, key);
          log(`[mail:resend] sent id=${id} idempotency_key=${key} attempt=${n}`);
          return { id };
        } catch (error) {
          if (!(error instanceof MailError) || !error.retryable || n >= maxAttempts) throw error;
          const wait = error.retryAfterMs ?? baseDelayMs * 2 ** (n - 1);
          if (wait > maxDelayMs) throw error;
          log(`[mail:resend] retrying in ${wait}ms after attempt ${n}: ${error.message}`);
          await sleep(wait);
        }
      }
    },
  };
}

/** Picks the mailer from the environment. See the module comment. */
export function getMailer(
  env: Record<string, string | undefined> = process.env,
): Mailer {
  const parsed = MailEnvSchema.parse(env);
  if (parsed.RESEND_API_KEY) {
    if (!parsed.MAIL_FROM) {
      throw new ConfigError("RESEND_API_KEY is set but MAIL_FROM is not.");
    }
    return resendMailer(parsed.RESEND_API_KEY, parsed.MAIL_FROM);
  }
  if (parsed.NODE_ENV === "production") {
    throw new ConfigError(
      "No mail provider configured: set RESEND_API_KEY and MAIL_FROM.",
    );
  }
  return consoleMailer;
}
