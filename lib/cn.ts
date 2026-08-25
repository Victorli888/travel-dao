/** Joins conditional class names. Keeps `className` passthrough readable. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
