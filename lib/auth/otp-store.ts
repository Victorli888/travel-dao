import { getSql } from "@/lib/db";
import type { OtpStore } from "./otp-service";
import type { OtpRecord } from "./otp";

/**
 * The Neon `OtpStore`. Each method is one statement — see the note on
 * `OtpStore`. Raw `getSql` like `allowlist.ts`, because this module is reached
 * from `auth.ts` and so from middleware.
 *
 * Timestamps are written from the app's clock, not `now()`, so the window
 * maths in `otp-service.ts` and the rows agree on what time it is. They are
 * read back through `new Date(...)`, which accepts the driver's `Date` and a
 * string alike.
 */
export const neonOtpStore: OtpStore = {
  async insertIfUnderLimits(row, limits) {
    const sql = getSql();
    const since = limits.since.toISOString();
    const rows = await sql`
      INSERT INTO email_otps (email, code_hash, request_ip, expires_at, created_at)
      SELECT ${row.email}, ${row.codeHash}, ${row.ip}, ${row.expiresAt.toISOString()}, ${row.now.toISOString()}
      WHERE (
        SELECT count(*) FROM email_otps
        WHERE email = ${row.email} AND created_at > ${since}
      ) < ${limits.maxPerEmail}
      AND (
        ${row.ip}::text IS NULL OR (
          SELECT count(*) FROM email_otps
          WHERE request_ip = ${row.ip} AND created_at > ${since}
        ) < ${limits.maxPerIp}
      )
      RETURNING id
    `;
    return rows.length > 0;
  },

  async findLatest(email) {
    const sql = getSql();
    const rows = await sql`
      SELECT id, code_hash, attempts, expires_at, consumed_at
      FROM email_otps
      WHERE email = ${email}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const r = rows[0];
    if (!r) return null;
    const record: OtpRecord = {
      id: String(r.id),
      codeHash: String(r.code_hash),
      attempts: Number(r.attempts),
      expiresAt: new Date(r.expires_at),
      consumedAt: r.consumed_at ? new Date(r.consumed_at) : null,
    };
    return record;
  },

  async recordAttempt(id, expectedAttempts, success, now) {
    const sql = getSql();
    const rows = await sql`
      UPDATE email_otps
      SET attempts = attempts + 1,
          consumed_at = ${success ? now.toISOString() : null}
      WHERE id = ${id}
        AND attempts = ${expectedAttempts}
        AND consumed_at IS NULL
      RETURNING id
    `;
    return rows.length > 0;
  },
};
