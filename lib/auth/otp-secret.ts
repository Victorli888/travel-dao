import { ConfigError } from "@/lib/api/errors";

/**
 * The key OTP hashes are HMAC'd with. Reuses `AUTH_SECRET`, which Auth.js
 * already requires, rather than adding a second secret to rotate. Rotating
 * it invalidates outstanding codes (and every session JWT), which is fine:
 * codes live ten minutes.
 */
export function getOtpSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new ConfigError("AUTH_SECRET is not set.");
  return secret;
}
