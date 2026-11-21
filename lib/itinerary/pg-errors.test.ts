import { describe, expect, it } from "vitest";
import { ConflictError, ValidationError } from "@/lib/api/errors";
import { withPgErrors } from "./pg-errors";

/** Drizzle wraps driver errors in a `DrizzleQueryError` carrying `cause`. */
function wrapped(code: string): Error {
  const driverError = Object.assign(new Error("duplicate key value"), { code });
  return Object.assign(new Error("Failed query"), { cause: driverError });
}

function rejecting(error: unknown) {
  return () => Promise.reject(error);
}

describe("withPgErrors", () => {
  it("finds the SQLSTATE on a wrapped driver error", async () => {
    // The bug this exists to prevent: reading `error.code` at the top level
    // classifies nothing, because Drizzle never throws the driver's error
    // directly. Every builder-issued query arrives wrapped.
    await expect(withPgErrors(rejecting(wrapped("23505")))).rejects.toThrow(
      ConflictError,
    );
  });

  it("finds it on an unwrapped error too", async () => {
    const bare = Object.assign(new Error("duplicate"), { code: "23505" });
    await expect(withPgErrors(rejecting(bare))).rejects.toThrow(ConflictError);
  });

  it("maps check and foreign key violations to a 400", async () => {
    await expect(withPgErrors(rejecting(wrapped("23514")))).rejects.toThrow(
      ValidationError,
    );
    await expect(withPgErrors(rejecting(wrapped("23503")))).rejects.toThrow(
      ValidationError,
    );
  });

  it("uses the caller's message", async () => {
    const error = await withPgErrors(rejecting(wrapped("23505")), {
      conflict: "That activity is already on that day.",
    }).catch((e) => e);

    expect(error.message).toBe("That activity is already on that day.");
    expect(error.status).toBe(409);
  });

  it("rethrows an unrecognised error rather than flattening it to a 400", async () => {
    const connectionFailure = new Error("connection terminated");
    await expect(withPgErrors(rejecting(connectionFailure))).rejects.toThrow(
      connectionFailure,
    );
  });

  it("passes an AppError through untouched", async () => {
    const already = new ValidationError("Already classified.");
    await expect(withPgErrors(rejecting(already))).rejects.toThrow(already);
  });
});
