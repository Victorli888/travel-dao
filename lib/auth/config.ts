import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { OtpVerifySchema } from "./otp";
import type { SessionStore } from "./sessions";
import { SESSION_MAX_AGE_SECONDS, sessionCookie } from "./cookies";

/** The Credentials provider id for email + one-time code. */
export const EMAIL_OTP_PROVIDER = "email-otp";

export interface AuthDeps {
  isEmailAllowed: (email: string) => Promise<boolean>;
  /** True exactly once per issued code — `verifyOtp` with the live store. */
  verifyOtp: (email: string, code: string) => Promise<boolean>;
  sessions: SessionStore;
  secureCookies: boolean;
}

/**
 * The Auth.js config, as a factory so `config.test.ts` can run a real sign-in
 * through Auth.js with fake deps and read the `Set-Cookie` it produces.
 * `auth.ts` calls it with the live ones.
 *
 * Two ways in, one identity. Google and the email code both end at the same
 * lower-cased email, which is all a user is here — there is no `users` table,
 * and the allow-list is the user record. Neither provider adds anyone to it:
 * signing in proves who you are, `allowed_emails` decides whether you get in.
 *
 * Sessions stay JWTs (Credentials requires it), but every JWT carries the id
 * of an `auth_sessions` row and is honoured only while that row is live, so
 * sign-out and revocation take effect server-side on the next request.
 */
export function createAuthConfig(deps: AuthDeps): NextAuthConfig {
  return {
    providers: [
      Google,
      Credentials({
        id: EMAIL_OTP_PROVIDER,
        name: "Email code",
        credentials: { email: {}, code: {} },
        async authorize(raw) {
          const parsed = OtpVerifySchema.safeParse(raw);
          if (!parsed.success) return null;
          const { email, code } = parsed.data;
          if (!(await deps.verifyOtp(email, code))) return null;
          return { id: email, email };
        },
      }),
    ],
    pages: { signIn: "/login" },
    session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
    useSecureCookies: deps.secureCookies,
    cookies: { sessionToken: sessionCookie(deps.secureCookies) },
    callbacks: {
      // `user` is present only on the sign-in that mints the token. Every
      // later call re-checks the session row; returning null makes Auth.js
      // clear the cookie, which is how a revoked session signs out.
      async jwt({ token, user, account }) {
        if (user?.email) {
          const email = user.email.toLowerCase();
          token.email = email;
          token.isAllowed = await deps.isEmailAllowed(email);
          token.sid = await deps.sessions.create(email, account?.provider ?? "unknown");
          return token;
        }
        // A token minted before sessions were server-side has no `sid`; it
        // is treated as revoked, which costs everyone one re-sign-in.
        if (!token.sid || !(await deps.sessions.isActive(token.sid))) return null;
        return token;
      },
      async session({ session, token }) {
        session.user.isAllowed = token.isAllowed ?? false;
        return session;
      },
    },
    events: {
      async signOut(message) {
        const sid = "token" in message ? message.token?.sid : undefined;
        if (sid) await deps.sessions.revoke(sid);
      },
    },
  };
}
