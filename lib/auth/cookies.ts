/**
 * The session cookie, spelled out rather than left to Auth.js defaults, so
 * the flags are a reviewed decision and `cookies.test.ts` can pin them.
 *
 * Persistent, not session-only: `maxAge` makes Auth.js emit both `Max-Age`
 * and `Expires`, so the browser keeps the cookie across restarts. Auth.js
 * re-issues it with a fresh expiry as the user comes back, but the server-side
 * row in `auth_sessions` has a fixed 30-day life, so a session ends 30 days
 * after sign-in regardless.
 */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface SessionCookie {
  name: string;
  options: {
    httpOnly: true;
    sameSite: "lax";
    path: "/";
    secure: boolean;
    maxAge: number;
  };
}

/**
 * `secure` follows production. The `__Secure-` prefix is what Auth.js itself
 * uses when cookies are secure; browsers refuse a `__Secure-` cookie without
 * the flag, so the name and the flag must change together.
 */
export function sessionCookie(secure: boolean): SessionCookie {
  return {
    name: `${secure ? "__Secure-" : ""}authjs.session-token`,
    options: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure,
      maxAge: SESSION_MAX_AGE_SECONDS,
    },
  };
}

/** Production is the only place a non-HTTPS origin is not expected. */
export function shouldUseSecureCookies(): boolean {
  return process.env.NODE_ENV === "production";
}
