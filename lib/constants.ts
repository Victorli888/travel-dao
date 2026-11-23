/** Where access requests and support mail go. */
export const CONTACT_EMAIL = "victorli7462@gmail.com";

/** Builds the "request access" mailto, optionally naming the signed-in account. */
export function requestAccessMailto(email?: string): string {
  const subject = "Dao Access Request";
  const body = email
    ? `Hi, I'd like to request access to Dao. My Google account email is: ${email}`
    : "Hi, I'd like to request access to Dao.";

  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}
