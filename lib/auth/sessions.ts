import { getSql } from "@/lib/db";
import { SESSION_MAX_AGE_SECONDS } from "./cookies";

/**
 * Server-side sessions, one `auth_sessions` row per signed-in browser. The
 * Auth.js JWT carries the row id as `sid`; `auth.ts` checks it on every
 * `auth()` call, so revoking the row signs that browser out on its next
 * request. Each function is one statement.
 */
export interface SessionStore {
  create(email: string, provider: string): Promise<string>;
  isActive(id: string): Promise<boolean>;
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

  async isActive(id) {
    const sql = getSql();
    const rows = await sql`
      SELECT 1 FROM auth_sessions
      WHERE id = ${id} AND revoked_at IS NULL AND expires_at > now()
      LIMIT 1
    `;
    return rows.length > 0;
  },

  async revoke(id) {
    const sql = getSql();
    await sql`
      UPDATE auth_sessions SET revoked_at = now()
      WHERE id = ${id} AND revoked_at IS NULL
    `;
  },
};
