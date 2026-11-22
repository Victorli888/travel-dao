import { beforeEach, describe, expect, it, vi } from "vitest";
import { OTP_MAX_ATTEMPTS, OTP_MAX_PER_EMAIL, OTP_MAX_PER_IP, OTP_TTL_MS } from "./otp";
import { requestOtp, verifyOtp, type OtpDeps, type OtpStore } from "./otp-service";

interface Row {
  id: string;
  email: string;
  codeHash: string;
  ip: string | null;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

/** Mirrors the semantics of the SQL in `otp-store.ts`. */
function memoryStore(): OtpStore & { rows: Row[] } {
  const rows: Row[] = [];
  return {
    rows,
    async insertIfUnderLimits(row, limits) {
      const recent = rows.filter((r) => r.createdAt > limits.since);
      if (recent.filter((r) => r.email === row.email).length >= limits.maxPerEmail) return false;
      if (row.ip && recent.filter((r) => r.ip === row.ip).length >= limits.maxPerIp) return false;
      rows.push({
        id: String(rows.length + 1),
        email: row.email,
        codeHash: row.codeHash,
        ip: row.ip,
        attempts: 0,
        expiresAt: row.expiresAt,
        consumedAt: null,
        createdAt: row.now,
      });
      return true;
    },
    async findLatest(email) {
      const r = rows.filter((x) => x.email === email).at(-1);
      return r ? { ...r } : null;
    },
    async recordAttempt(id, expected, success, now) {
      const r = rows.find((x) => x.id === id);
      if (!r || r.attempts !== expected || r.consumedAt) return false;
      r.attempts += 1;
      if (success) r.consumedAt = now;
      return true;
    },
  };
}

const ALLOWED = "allowed@example.com";
let clock: Date;
let store: ReturnType<typeof memoryStore>;
let sent: { email: string; code: string }[];
let codes: string[];
let deps: OtpDeps;

beforeEach(() => {
  clock = new Date("2026-11-22T12:00:00Z");
  store = memoryStore();
  sent = [];
  codes = ["111111", "222222", "333333", "444444", "555555", "666666"];
  deps = {
    store,
    secret: "test-secret",
    now: () => clock,
    isAllowed: async (email) => email === ALLOWED,
    sendCode: async (email, code) => {
      sent.push({ email, code });
    },
    defer: (task) => void task(),
    generateCode: () => codes.shift()!,
  };
});

const advance = (ms: number) => (clock = new Date(clock.getTime() + ms));
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("requestOtp", () => {
  it("stores only a hash and emails the code to an allowed address", async () => {
    expect(await requestOtp(deps, ALLOWED, "1.1.1.1")).toEqual({ status: "sent" });
    await flush();
    expect(sent).toEqual([{ email: ALLOWED, code: "111111" }]);
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0].codeHash).not.toContain("111111");
    expect(store.rows[0].expiresAt.getTime() - clock.getTime()).toBe(OTP_TTL_MS);
  });

  it("answers identically for an unknown address, but sends nothing", async () => {
    expect(await requestOtp(deps, "stranger@example.com", "1.1.1.1")).toEqual({ status: "sent" });
    await flush();
    expect(sent).toEqual([]);
    // Recorded anyway, so the rate limit treats both addresses alike.
    expect(store.rows).toHaveLength(1);
  });

  it("rate-limits per email within the window, then recovers", async () => {
    for (let i = 0; i < OTP_MAX_PER_EMAIL; i++) {
      codes.push("000000");
      expect((await requestOtp(deps, ALLOWED, `10.0.0.${i}`)).status).toBe("sent");
    }
    expect((await requestOtp(deps, ALLOWED, "10.0.0.99")).status).toBe("rate_limited");
    advance(15 * 60 * 1000 + 1);
    codes.push("999999");
    expect((await requestOtp(deps, ALLOWED, "10.0.0.99")).status).toBe("sent");
  });

  it("rate-limits per IP across different emails", async () => {
    for (let i = 0; i < OTP_MAX_PER_IP; i++) {
      codes.push("000000");
      expect((await requestOtp(deps, `u${i}@example.com`, "9.9.9.9")).status).toBe("sent");
    }
    codes.push("000000");
    expect((await requestOtp(deps, "another@example.com", "9.9.9.9")).status).toBe("rate_limited");
    codes.push("000000");
    expect((await requestOtp(deps, "another@example.com", "8.8.8.8")).status).toBe("sent");
  });

  it("does not fail the request when delivery fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    deps.sendCode = async () => {
      throw new Error("smtp down");
    };
    expect((await requestOtp(deps, ALLOWED, null)).status).toBe("sent");
    await flush();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("verifyOtp", () => {
  beforeEach(async () => {
    await requestOtp(deps, ALLOWED, "1.1.1.1"); // issues 111111
  });

  it("accepts the right code once, and only once", async () => {
    expect(await verifyOtp(deps, ALLOWED, "111111")).toBe(true);
    expect(await verifyOtp(deps, ALLOWED, "111111")).toBe(false);
  });

  it("rejects a wrong code and spends an attempt", async () => {
    expect(await verifyOtp(deps, ALLOWED, "999999")).toBe(false);
    expect(store.rows[0].attempts).toBe(1);
    expect(await verifyOtp(deps, ALLOWED, "111111")).toBe(true);
  });

  it(`invalidates the code after ${OTP_MAX_ATTEMPTS} wrong guesses`, async () => {
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      expect(await verifyOtp(deps, ALLOWED, "999999")).toBe(false);
    }
    expect(await verifyOtp(deps, ALLOWED, "111111")).toBe(false);
    expect(store.rows[0].attempts).toBe(OTP_MAX_ATTEMPTS);
  });

  it("still accepts the right code just before expiry", async () => {
    advance(OTP_TTL_MS - 1);
    expect(await verifyOtp(deps, ALLOWED, "111111")).toBe(true);
  });

  it("rejects the right code at expiry", async () => {
    advance(OTP_TTL_MS);
    expect(await verifyOtp(deps, ALLOWED, "111111")).toBe(false);
    expect(store.rows[0].attempts).toBe(0);
  });

  it("kills an older code as soon as a newer one is issued", async () => {
    await requestOtp(deps, ALLOWED, "1.1.1.1"); // issues 222222
    expect(await verifyOtp(deps, ALLOWED, "111111")).toBe(false);
    expect(await verifyOtp(deps, ALLOWED, "222222")).toBe(true);
  });

  it("does not accept one address's code for another", async () => {
    expect(await verifyOtp(deps, "other@example.com", "111111")).toBe(false);
  });

  it("lets only one of two concurrent correct guesses through", async () => {
    const results = await Promise.all([
      verifyOtp(deps, ALLOWED, "111111"),
      verifyOtp(deps, ALLOWED, "111111"),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("does not sign in when the attempt raced and was not recorded", async () => {
    deps.store = { ...store, recordAttempt: async () => false };
    expect(await verifyOtp(deps, ALLOWED, "111111")).toBe(false);
  });
});
