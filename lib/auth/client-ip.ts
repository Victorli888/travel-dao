/**
 * The requesting client's address, for the per-IP OTP rate limit.
 *
 * Trusts `x-forwarded-for`'s first hop, which is right behind a proxy that
 * sets it (Vercel does, and overwrites what the client sent) and spoofable
 * anywhere else. That is acceptable here because the per-IP limit is the
 * secondary one: the per-email limit and the attempt cap hold regardless.
 * Null when nothing usable is present, which skips the IP limit rather than
 * lumping every such request into one shared bucket.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim();
  return ip ? ip.slice(0, 64) : null;
}
