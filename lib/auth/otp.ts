import { z } from "zod";

/**
 * The pure half of email one-time-passcode sign-in: code generation, hashing,
 * comparison, the policy numbers and the input schemas. No I/O, so it is unit
 * tested directly; `otp-service.ts` is the half that talks to a store.
 *
 * Web Crypto only, not `node:crypto`. `auth.ts` imports this through the
 * Credentials provider, and `auth.ts` is bundled into middleware, which runs
 * on the edge runtime.
 */

/** How long a code is valid for. */
export const OTP_TTL_MS = 10 * 60 * 1000;

/** Guesses allowed against one code. The fifth wrong one kills it. */
export const OTP_MAX_ATTEMPTS = 5;

/** The rate-limit window for requesting codes. */
export const OTP_RATE_WINDOW_MS = 15 * 60 * 1000;

/** Codes one email may request per window. */
export const OTP_MAX_PER_EMAIL = 5;

/** Codes one client address may request per window, across all emails. */
export const OTP_MAX_PER_IP = 20;

export const OTP_LENGTH = 6;

/**
 * Trimmed and lower-cased, because `allowed_emails` stores lower-case and
 * the same address must always resolve to the same user — the one Google
 * signs in as, too. The 254 cap is RFC 5321's path limit.
 */
export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email());

/** Spaces are stripped so a code pasted as "123 456" still works. */
export const OtpCodeSchema = z
  .string()
  .transform((s) => s.replace(/\s+/g, ""))
  .pipe(z.string().regex(/^\d{6}$/));

export const OtpVerifySchema = z.object({
  email: EmailSchema,
  code: OtpCodeSchema,
});

/**
 * A uniformly random six-digit string, leading zeros included. Rejection
 * sampling rather than `% 1_000_000`: 2^32 is not a multiple of a million,
 * so a bare modulo makes the low codes very slightly likelier.
 */
export function generateOtpCode(): string {
  const range = 10 ** OTP_LENGTH;
  const limit = Math.floor(0x1_0000_0000 / range) * range;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) {
      return (buf[0] % range).toString().padStart(OTP_LENGTH, "0");
    }
  }
}

const encoder = new TextEncoder();

/**
 * HMAC-SHA256 over `email:code`, keyed by the server secret, as hex. A plain
 * hash would not do: there are only a million codes, so anyone holding a dump
 * of the table could hash all of them in well under a second. Binding the
 * email in means a hash is useless against any other address.
 */
export async function hashOtp(
  email: string,
  code: string,
  secret: string,
): Promise<string> {
  if (!secret) throw new Error("hashOtp needs a non-empty secret.");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${email}:${code}`));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compares two strings in time that depends only on their length, never on
 * where they first differ. Both sides here are fixed-length hex digests, so
 * the length check leaks nothing.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** What the store knows about the newest code issued to an email. */
export interface OtpRecord {
  id: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
}

export type OtpUsability = "usable" | "missing" | "consumed" | "expired" | "exhausted";

/**
 * Whether a code may still be guessed at, before looking at the guess. Kept
 * separate from the comparison so expiry and the attempt cap are tested
 * without a clock or a database.
 */
export function otpUsability(record: OtpRecord | null, now: Date): OtpUsability {
  if (!record) return "missing";
  if (record.consumedAt) return "consumed";
  if (record.expiresAt.getTime() <= now.getTime()) return "expired";
  if (record.attempts >= OTP_MAX_ATTEMPTS) return "exhausted";
  return "usable";
}
