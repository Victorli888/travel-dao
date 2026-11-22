/**
 * Holds the address between "email me a code" and "here is the code". Not a
 * credential — knowing it gets you nothing without the code — but httpOnly
 * anyway, and scoped to `/login` so it is never sent anywhere else.
 */
export const PENDING_EMAIL_COOKIE = "tao-otp-email";
