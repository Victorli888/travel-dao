import { describe, expect, it } from "vitest";
import { loginMessage } from "./login-messages";

describe("loginMessage", () => {
  it("maps known codes and ignores the rest", () => {
    expect(loginMessage("invalid")).toMatch(/incorrect or has expired/);
    expect(loginMessage("nonsense")).toBeNull();
    expect(loginMessage(undefined)).toBeNull();
    expect(loginMessage(["invalid", "email"])).toBeNull();
  });

  it("never says whether an account exists", () => {
    for (const code of ["email", "unavailable", "expired", "code", "invalid", "rate_limited"]) {
      expect(loginMessage(code)).not.toMatch(/no account|not found|not registered|not allowed/i);
    }
  });
});
