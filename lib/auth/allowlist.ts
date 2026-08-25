import { getSql } from "@/lib/db";

/** True when the email appears in the allowed_emails table. */
export async function isEmailAllowed(email: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM allowed_emails
    WHERE email = ${email.toLowerCase()}
    LIMIT 1
  `;
  return rows.length > 0;
}
