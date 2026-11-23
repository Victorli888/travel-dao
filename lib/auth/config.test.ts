import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import NextAuth from "next-auth";
import { NextRequest } from "next/server";
import { createAuthConfig, EMAIL_OTP_PROVIDER, type AuthDeps } from "./config";
import { SESSION_MAX_AGE_SECONDS, sessionCookie } from "./cookies";
import type { SessionStore } from "./sessions";
import { routeAccess } from "./route-access";

/**
 * Runs real sign-ins through Auth.js with fake deps, and reads the cookies it
 * actually sets — the flags are asserted on the `Set-Cookie` header, not on
 * our config object, so an Auth.js upgrade that drops one fails here.
 */

const ORIGIN = "https://tao.test";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-auth-secret-at-least-32-characters-long";
  process.env.AUTH_TRUST_HOST = "true";
  process.env.AUTH_URL = `${ORIGIN}/api/auth`;
});

interface FakeSessions extends SessionStore {
  live: Set<string>;
  created: { email: string; provider: string }[];
}

/** Stands in for `allowed_emails`, shared by `isEmailAllowed` and `status`. */
let allowList: Set<string>;

/** Mirrors `neonSessionStore`: `status` LEFT JOINs the allow-list. */
function fakeSessions(): FakeSessions {
  let n = 0;
  const live = new Set<string>();
  const owner = new Map<string, string>();
  const created: { email: string; provider: string }[] = [];
  return {
    live,
    created,
    async create(email, provider) {
      created.push({ email, provider });
      const id = `sid-${++n}`;
      live.add(id);
      owner.set(id, email);
      return id;
    },
    async status(id) {
      if (!live.has(id)) return null;
      return { allowed: allowList.has(owner.get(id)!) };
    },
    async revoke(id) {
      live.delete(id);
    },
  };
}

let sessions: FakeSessions;

function build(secureCookies: boolean, over: Partial<AuthDeps> = {}) {
  return NextAuth(
    createAuthConfig({
      isEmailAllowed: async (email) => allowList.has(email),
      verifyOtp: async (_email, code) => code === "123456",
      sessions,
      secureCookies,
      ...over,
    }),
  );
}

/** Pulls the name=value pairs out of a set of Set-Cookie headers. */
function jar(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function signInWithCode(
  handlers: ReturnType<typeof NextAuth>["handlers"],
  email: string,
  code: string,
) {
  const csrfRes = await handlers.GET(new NextRequest(`${ORIGIN}/api/auth/csrf`));
  const { csrfToken } = await csrfRes.json();
  return handlers.POST(
    new NextRequest(`${ORIGIN}/api/auth/callback/${EMAIL_OTP_PROVIDER}`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: jar(csrfRes),
      },
      body: new URLSearchParams({ csrfToken, email, code, callbackUrl: `${ORIGIN}/` }),
    }),
  );
}

function sessionSetCookie(res: Response, secure: boolean): string | undefined {
  const name = sessionCookie(secure).name;
  return res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
}

beforeEach(() => {
  sessions = fakeSessions();
  allowList = new Set(["a@example.com", "mixed@example.com"]);
});

describe("session cookie", () => {
  it("is httpOnly, Secure, SameSite=Lax, Path=/ and persistent for 30 days in production", async () => {
    const { handlers } = build(true);
    const res = await signInWithCode(handlers, "A@Example.com", "123456");
    const cookie = sessionSetCookie(res, true);

    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/^__Secure-authjs\.session-token=[^;]+/);
    expect(cookie).toMatch(/;\s*HttpOnly/i);
    expect(cookie).toMatch(/;\s*Secure/i);
    expect(cookie).toMatch(/;\s*SameSite=Lax/i);
    expect(cookie).toMatch(/;\s*Path=\/(;|$)/);
    expect(cookie).toMatch(new RegExp(`;\\s*Max-Age=${SESSION_MAX_AGE_SECONDS}(;|$)`, "i"));

    const expires = /;\s*Expires=([^;]+)/i.exec(cookie!)?.[1];
    expect(expires).toBeDefined();
    const days = (new Date(expires!).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
  });

  it("drops Secure (and the __Secure- prefix) outside production", async () => {
    const { handlers } = build(false);
    const res = await signInWithCode(handlers, "a@example.com", "123456");
    const cookie = sessionSetCookie(res, false);

    expect(cookie).toMatch(/^authjs\.session-token=/);
    expect(cookie).not.toMatch(/;\s*Secure/i);
    expect(cookie).toMatch(/;\s*HttpOnly/i);
    expect(cookie).toMatch(/;\s*Max-Age=/i);
  });

  it("is not set for a wrong code", async () => {
    const { handlers } = build(true);
    const res = await signInWithCode(handlers, "a@example.com", "000000");
    expect(sessionSetCookie(res, true)).toBeUndefined();
    expect(sessions.created).toEqual([]);
  });

  it("is not set for malformed input, and the verifier is never asked", async () => {
    let asked = false;
    const { handlers } = build(true, {
      verifyOtp: async () => {
        asked = true;
        return true;
      },
    });
    const res = await signInWithCode(handlers, "not-an-email", "123456");
    expect(sessionSetCookie(res, true)).toBeUndefined();
    expect(asked).toBe(false);
  });
});

describe("server-side session", () => {
  it("records a session row under the lower-cased email and provider", async () => {
    const { handlers } = build(true);
    await signInWithCode(handlers, "  Mixed@Example.COM ", "123456");
    expect(sessions.created).toEqual([{ email: "mixed@example.com", provider: EMAIL_OTP_PROVIDER }]);
  });

  it("is honoured while live and cleared once revoked", async () => {
    const { handlers } = build(true);
    const signedIn = await signInWithCode(handlers, "a@example.com", "123456");
    const cookie = jar(signedIn);

    const read = () =>
      handlers.GET(new NextRequest(`${ORIGIN}/api/auth/session`, { headers: { cookie } }));

    const before = await read();
    expect((await before.json())?.user?.email).toBe("a@example.com");

    sessions.live.clear(); // revoke every session server-side

    const after = await read();
    expect(await after.json()).toBeNull();
    // Auth.js clears the cookie on the response when the jwt callback refuses it.
    const cleared = sessionSetCookie(after, true);
    expect(cleared).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });

  it("revokes the row on sign-out", async () => {
    const { handlers } = build(true);
    const signedIn = await signInWithCode(handlers, "a@example.com", "123456");
    const cookie = jar(signedIn);
    expect(sessions.live.size).toBe(1);

    const csrfRes = await handlers.GET(
      new NextRequest(`${ORIGIN}/api/auth/csrf`, { headers: { cookie } }),
    );
    const { csrfToken } = await csrfRes.json();
    const out = await handlers.POST(
      new NextRequest(`${ORIGIN}/api/auth/signout`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: `${cookie}; ${jar(csrfRes)}`,
        },
        body: new URLSearchParams({ csrfToken, callbackUrl: `${ORIGIN}/login` }),
      }),
    );

    expect(sessions.live.size).toBe(0);
    expect(sessionSetCookie(out, true)).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });
});

describe("allow-list", () => {
  it("refuses a correct code for an address not on the list, and creates no session", async () => {
    const verified: string[] = [];
    const { handlers } = build(true, {
      verifyOtp: async (email, code) => {
        verified.push(email);
        return code === "123456";
      },
    });
    const res = await signInWithCode(handlers, "stranger@example.com", "123456");

    expect(verified).toEqual(["stranger@example.com"]); // the code was spent
    expect(sessionSetCookie(res, true)).toBeUndefined();
    expect(sessions.created).toEqual([]);
    // The same generic failure as a wrong code.
    const wrong = await signInWithCode(handlers, "a@example.com", "000000");
    expect(res.headers.get("location")).toBe(wrong.headers.get("location"));
  });

  it("re-reads the list on every request: removal and re-adding take effect at once", async () => {
    const { handlers } = build(true);
    const cookie = jar(await signInWithCode(handlers, "a@example.com", "123456"));
    const read = async () =>
      (
        await handlers.GET(new NextRequest(`${ORIGIN}/api/auth/session`, { headers: { cookie } }))
      ).json();

    expect((await read())?.user?.isAllowed).toBe(true);

    allowList.delete("a@example.com");
    const removed = await read();
    // Still signed in (so /unauthorized can say who they are), but not allowed.
    expect(removed?.user?.email).toBe("a@example.com");
    expect(removed?.user?.isAllowed).toBe(false);
    expect(routeAccess("/plan", removed)).toBe("/unauthorized");
    expect(routeAccess("/", removed)).toBe("allow");

    allowList.add("a@example.com");
    expect((await read())?.user?.isAllowed).toBe(true);
  });
});
