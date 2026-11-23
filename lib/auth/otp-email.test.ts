import { describe, expect, it } from "vitest";
import { otpEmail } from "./otp-email";

describe("otpEmail", () => {
  it("carries a fresh idempotency key per OTP request", () => {
    const a = otpEmail("u@example.com", "123456");
    const b = otpEmail("u@example.com", "123456");
    expect(a.idempotencyKey).toMatch(/^otp-code\/[0-9a-f-]{36}$/);
    expect(a.idempotencyKey).not.toBe(b.idempotencyKey);
    expect(a.idempotencyKey).not.toContain("123456");
  });
});
