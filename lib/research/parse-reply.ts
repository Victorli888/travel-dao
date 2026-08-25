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

/** Latin letters, CJK, spaces and ampersands joined by at least two ">". */
const PATH_PATTERN =
  /([A-Za-z\u3000-\u9fff\s&]+(?:\s*>\s*[A-Za-z\u3000-\u9fff\s&]+){2,})/;

export function parseNotionPath(message: string): ParsedReply {
  const path = message.match(PATH_PATTERN)?.[0].trim() ?? null;
  if (!path) return { path: null, body: message };

  const body = message.replace(path, "").replace(/[`'"]/g, "").trim();

  // A reply that was nothing but the path still needs something to show.
  return { path, body: body || message };
}
