import { getSql } from "@/lib/db";
import { SESSION_MAX_AGE_SECONDS } from "./cookies";

/**
 * Server-side sessions, one `auth_sessions` row per signed-in browser. The
 * Auth.js JWT carries the row id as `sid`; `auth.ts` checks it on every
 * `auth()` call, so revoking the row signs that browser out on its next
 * request. Each function is one statement.
 */

/** A live session, and whether its email is on the allow-list right now. */
export interface SessionStatus {
  allowed: boolean;
}

export interface SessionStore {
  create(email: string, provider: string): Promise<string>;
  /**
   * Null when the session is revoked, expired or unknown. Otherwise the
   * allow-list is read in the same statement, so removing an email takes
   * effect on that user's next request rather than when the JWT expires.
   */
  status(id: string): Promise<SessionStatus | null>;
  revoke(id: string): Promise<void>;
}

export const neonSessionStore: SessionStore = {
  async create(email, provider) {
    const sql = getSql();
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
    const rows = await sql`
      INSERT INTO auth_sessions (user_email, provider, expires_at)
      VALUES (${email}, ${provider}, ${expiresAt})
      RETURNING id
    `;
    return String(rows[0].id);
  },

  async status(id) {
    const sql = getSql();
    // LEFT JOIN: a session whose email has left the list is still a session —
    // it comes back `allowed: false` and lands on /unauthorized, the same as
    // a Google sign-in that was never on the list.
    const rows = await sql`
      SELECT (a.email IS NOT NULL) AS allowed
      FROM auth_sessions s
      LEFT JOIN allowed_emails a ON a.email = s.user_email
      WHERE s.id = ${id} AND s.revoked_at IS NULL AND s.expires_at > now()
      LIMIT 1
    `;
    return rows[0] ? { allowed: rows[0].allowed === true } : null;
  },

  async revoke(id) {
    const sql = getSql();
    await sql`
      UPDATE auth_sessions SET revoked_at = now()
      WHERE id = ${id} AND revoked_at IS NULL
    `;
  },
};
