/**
 * Postgres constraint violations → `AppError`s, classified by SQLSTATE and
 * never by matching substrings against a driver message.
 *
 * Zod catches bad input first, so most of these are unreachable. The one that
 * is not is `UNIQUE`: a collision depends on rows that already exist, which no
 * input schema can see.
 */
import { AppError, ConflictError, ValidationError } from "@/lib/api/errors";

/** https://www.postgresql.org/docs/current/errcodes-appendix.html */
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";
const CHECK_VIOLATION = "23514";
const NOT_NULL_VIOLATION = "23502";

/**
 * Walks the `cause` chain: Drizzle wraps every driver error in a
 * `DrizzleQueryError`, so the SQLSTATE is one level down, not on the error
 * you catch. Reading only the top level silently classifies nothing.
 */
function sqlState(error: unknown): string | undefined {
  for (let current = error, depth = 0; current && depth < 5; depth++) {
    if (typeof current !== "object") return undefined;
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/**
 * Anything unrecognised is rethrown as-is, so it surfaces as a real 500
 * rather than being flattened into a misleading 400.
 */
export async function withPgErrors<T>(
  operation: () => Promise<T>,
  messages: Partial<Record<"conflict" | "check" | "foreignKey", string>> = {},
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) throw error;

    switch (sqlState(error)) {
      case UNIQUE_VIOLATION:
        throw new ConflictError(messages.conflict ?? "That already exists.");
      case CHECK_VIOLATION:
        throw new ValidationError(
          messages.check ?? "That value is outside the allowed range.",
        );
      case FOREIGN_KEY_VIOLATION:
        throw new ValidationError(
          messages.foreignKey ?? "That refers to something that no longer exists.",
        );
      case NOT_NULL_VIOLATION:
        throw new ValidationError("A required field was missing.");
      default:
        throw error;
    }
  }
}
