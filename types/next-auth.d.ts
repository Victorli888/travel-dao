import type { DefaultSession } from "next-auth";

/**
 * Access is gated by an allow-list table, and the result rides along on the
 * session. Declaring it here removes the `as unknown as Record<...>` casts
 * that auth.ts and middleware.ts previously needed to read it.
 */
declare module "next-auth" {
  interface Session {
    user: {
      isAllowed: boolean;
    } & DefaultSession["user"];
  }
}

/**
 * The JWT interface is declared in @auth/core/jwt; `next-auth/jwt` only
 * re-exports it, and augmenting a re-export does not merge.
 */
declare module "@auth/core/jwt" {
  interface JWT {
    /** Undefined until the first sign-in populates it. */
    isAllowed?: boolean;
    /**
     * The `auth_sessions` row this token belongs to. The token is honoured
     * only while that row is unrevoked and unexpired.
     */
    sid?: string;
  }
}
