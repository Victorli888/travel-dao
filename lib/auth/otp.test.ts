import { describe, expect, it, vi } from "vitest";
import {
  EmailSchema,
  OTP_MAX_ATTEMPTS,
  OtpCodeSchema,
  constantTimeEqual,
  generateOtpCode,
  hashOtp,
  otpUsability,
  type OtpRecord,
} from "./otp";

describe("generateOtpCode", () => {
  it("is always exactly six digits", () => {
    for (let i = 0; i < 2000; i++) expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });

  it("draws from crypto.getRandomValues, keeping leading zeros", () => {
    const spy = vi
      .spyOn(crypto, "getRandomValues")
      .mockImplementationOnce((buf) => {
        (buf as Uint32Array)[0] = 42;
        return buf;
      });
    expect(generateOtpCode()).toBe("000042");
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("rejects draws in the biased tail instead of folding them", () => {
    const values = [0xffff_ffff, 7];
    const spy = vi.spyOn(crypto, "getRandomValues").mockImplementation((buf) => {
      (buf as Uint32Array)[0] = values.shift()!;
      return buf;
    });
    expect(generateOtpCode()).toBe("000007");
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it("does not repeat itself in practice", () => {
    const seen = new Set(Array.from({ length: 500 }, generateOtpCode));
    expect(seen.size).toBeGreaterThan(490);
  });
});

describe("hashOtp", () => {
  it("is a deterministic 64-char hex HMAC that never contains the code", async () => {
    const a = await hashOtp("a@x.com", "123456", "s3cret");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(await hashOtp("a@x.com", "123456", "s3cret"));
    expect(a).not.toContain("123456");
  });

  it("changes with the code, the email and the secret", async () => {
    const base = await hashOtp("a@x.com", "123456", "s3cret");
    expect(await hashOtp("a@x.com", "123457", "s3cret")).not.toBe(base);
    expect(await hashOtp("b@x.com", "123456", "s3cret")).not.toBe(base);
    expect(await hashOtp("a@x.com", "123456", "other")).not.toBe(base);
  });

  it("refuses an empty secret", async () => {
    await expect(hashOtp("a@x.com", "123456", "")).rejects.toThrow();
  });
});

describe("constantTimeEqual", () => {
  it("compares by value", () => {
    expect(constantTimeEqual("abcd", "abcd")).toBe(true);
    expect(constantTimeEqual("abcd", "abce")).toBe(false);
    expect(constantTimeEqual("abcd", "abc")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });
});

describe("otpUsability", () => {
  const now = new Date("2026-11-22T12:00:00Z");
  const record = (over: Partial<OtpRecord> = {}): OtpRecord => ({
    id: "1",
    codeHash: "h",
    attempts: 0,
    expiresAt: new Date(now.getTime() + 60_000),
    consumedAt: null,
    ...over,
  });

  it("is usable when fresh", () => {
    expect(otpUsability(record(), now)).toBe("usable");
  });
  it("is missing with no record", () => {
    expect(otpUsability(null, now)).toBe("missing");
  });
  it("expires at the instant of expiresAt, not after", () => {
    expect(otpUsability(record({ expiresAt: now }), now)).toBe("expired");
    expect(otpUsability(record({ expiresAt: new Date(now.getTime() + 1) }), now)).toBe("usable");
  });
  it("is exhausted at the attempt cap", () => {
    expect(otpUsability(record({ attempts: OTP_MAX_ATTEMPTS - 1 }), now)).toBe("usable");
    expect(otpUsability(record({ attempts: OTP_MAX_ATTEMPTS }), now)).toBe("exhausted");
  });
  it("is single-use", () => {
    expect(otpUsability(record({ consumedAt: now }), now)).toBe("consumed");
  });
});

describe("input schemas", () => {
  it("normalizes email case and whitespace", () => {
    expect(EmailSchema.parse("  Victor@Example.COM ")).toBe("victor@example.com");
  });
  it("rejects a non-email", () => {
    expect(EmailSchema.safeParse("not-an-email").success).toBe(false);
    expect(EmailSchema.safeParse("").success).toBe(false);
  });
  it("accepts a six-digit code, spaces stripped", () => {
    expect(OtpCodeSchema.parse("123 456")).toBe("123456");
    expect(OtpCodeSchema.parse("012345")).toBe("012345");
  });
  it("rejects anything else as a code", () => {
    for (const bad of ["12345", "1234567", "12a456", ""]) {
      expect(OtpCodeSchema.safeParse(bad).success).toBe(false);
    }
  });
});
