import { describe, expect, it } from "vitest";
import { isPublicPath, routeAccess } from "./route-access";

const allowed = { user: { isAllowed: true } };
const notAllowed = { user: { isAllowed: false } };

describe("routeAccess", () => {
  it("shows the landing page to a signed-out visitor", () => {
    expect(routeAccess("/", null)).toBe("allow");
  });

  it("shows the landing page to signed-in users, allowed or not", () => {
    expect(routeAccess("/", allowed)).toBe("allow");
    expect(routeAccess("/", notAllowed)).toBe("allow");
  });

  it.each(["/plan", "/plan/abc-123", "/plan/abc-123/add", "/api/research"])(
    "sends a signed-out visitor on %s to /login",
    (path) => {
      expect(routeAccess(path, null)).toBe("/login");
    },
  );

  it("sends a signed-in user who is not on the allow-list to /unauthorized", () => {
    expect(routeAccess("/plan", notAllowed)).toBe("/unauthorized");
  });

  it("lets an allowed user through to a protected route", () => {
    expect(routeAccess("/plan", allowed)).toBe("allow");
  });

  it("keeps the sign-in pages reachable while signed out", () => {
    expect(routeAccess("/login", null)).toBe("allow");
    expect(routeAccess("/login/verify", null)).toBe("allow");
    expect(routeAccess("/unauthorized", null)).toBe("allow");
  });
});

describe("isPublicPath", () => {
  // The regression this guards: `startsWith("/")` is true for every path.
  it("matches / exactly, not as a prefix", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/plan")).toBe(false);
    expect(isPublicPath("/plan/abc-123/add")).toBe(false);
  });
});
