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

/** Rotating placeholder examples for the research input. */
export const PLACE_EXAMPLES = [
  "Tokyo Tower, 4 Chome-2-8 Shibakoen, Minato City, Tokyo 105-0011, Japan",
  "Patisserie Rau, 169 Higashiyama, Yamashina Ward, Kyoto 607-8322, Japan",
  "Blue Lagoon, 240 Grindavíkurvegur, 240 Grindavík, Iceland",
];
