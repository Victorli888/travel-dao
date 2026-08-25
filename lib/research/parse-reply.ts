/**
 * Claude's reply usually contains the Notion location it wrote to, e.g.
 * "Kyoto > Good Eats > Dessert > Patisserie Rau". Pull it out so the UI can
 * render it as a breadcrumb instead of leaving it inline in the prose.
 *
 * Pure — no React, no DOM. The view receives the result, never the raw text.
 */
export interface ParsedReply {
  /** The breadcrumb, or null when the reply contains no recognizable path. */
  path: string | null;
  /** The reply with the breadcrumb removed. Never empty. */
  body: string;
}

/**
 * Preferred form. The system prompt asks for the path in backticks, and the
 * delimiters tell us exactly where it starts and ends.
 */
const FENCED_PATH = /`([^`\n]+?(?:\s*>\s*[^`\n]+?){2,})`/;

/**
 * Fallback for replies that drop the backticks: Latin letters, CJK, spaces
 * and ampersands joined by at least two ">". Unavoidably greedy at the edges
 * — it can pull a word or two of surrounding prose into the first and last
 * segments — which is why the fenced form is tried first.
 */
const LOOSE_PATH =
  /([A-Za-z\u3000-\u9fff\s&]+(?:\s*>\s*[A-Za-z\u3000-\u9fff\s&]+){2,})/;

export function parseNotionPath(message: string): ParsedReply {
  const fenced = message.match(FENCED_PATH);
  if (fenced) return strip(message, fenced[0], fenced[1].trim());

  const loose = message.match(LOOSE_PATH);
  if (loose) return strip(message, loose[0], loose[0].trim());

  return { path: null, body: message };
}

/** Removes the matched path from the prose and tidies what remains. */
function strip(message: string, matched: string, path: string): ParsedReply {
  const body = message.replace(matched, "").replace(/[`'"]/g, "").trim();

  // A reply that was nothing but the path still needs something to show.
  return { path, body: body || message };
}
