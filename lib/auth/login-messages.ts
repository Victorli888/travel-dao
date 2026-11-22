/**
 * What `/login` and `/login/verify` say for each `?error=`. One place, so the
 * wording stays generic: nothing here may distinguish an address that can
 * sign in from one that cannot.
 */
const MESSAGES: Record<string, string> = {
  email: "Enter a valid email address.",
  unavailable: "Email sign-in isn't available right now. Try again shortly.",
  expired: "That sign-in has expired. Enter your email to get a new code.",
  code: "Enter the 6-digit code from the email.",
  invalid: "That code is incorrect or has expired. Check it, or send a new one.",
  rate_limited: "Too many codes requested. Wait a few minutes, then use the newest code you have.",
};

export function loginMessage(error: string | string[] | undefined): string | null {
  return typeof error === "string" ? (MESSAGES[error] ?? null) : null;
}
