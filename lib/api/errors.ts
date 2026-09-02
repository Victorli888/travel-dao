/**
 * Errors that know their own HTTP status. Lets route handlers stay free of
 * status-code branching, and replaces sniffing substrings out of messages.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Malformed or missing request input. */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "invalid_request");
  }
}

/** A required environment variable is missing or unusable. */
export class ConfigError extends AppError {
  constructor(message: string) {
    super(message, 500, "misconfigured");
  }
}

/** A third-party service rejected our credentials. */
export class UpstreamAuthError extends AppError {
  constructor(message: string) {
    super(message, 500, "upstream_auth");
  }
}

/**
 * The row does not exist, or is not this user's to see. The two are the same
 * error on purpose: every query is scoped by `user_email`, so a miss and a
 * trip belonging to someone else are indistinguishable, and answering them
 * differently would leak whether another user's trip exists.
 */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, "not_found");
  }
}

/** The write collides with a row that is already there. */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "conflict");
  }
}
