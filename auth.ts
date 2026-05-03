import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getSql } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.email) {
        const sql = getSql();
        const rows = await sql`
          SELECT 1 FROM allowed_emails
          WHERE email = ${user.email.toLowerCase()}
          LIMIT 1
        `;
        token.isAllowed = rows.length > 0;
      }
      return token;
    },
    async session({ session, token }) {
      (session.user as unknown as Record<string, unknown>).isAllowed = token.isAllowed;
      return session;
    },
  },
});
