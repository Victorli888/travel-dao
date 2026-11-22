/**
 * Who may see which path: the decision `middleware.ts` acts on, kept pure so
 * it can be tested without Auth.js, a request, or a database.
 *
 * Two kinds of public path. `/` is matched **exactly**: the landing page is
 * public, but a prefix match on "/" would make every route public.
 * The rest match by prefix, so `/login/...` sub-pages stay reachable.
 */
const PUBLIC_EXACT = ["/"];
const PUBLIC_PREFIXES = ["/login", "/unauthorized"];

export type RouteAccess = "allow" | "/login" | "/unauthorized";

export interface SessionLike {
  user?: { isAllowed?: boolean } | null;
}

export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

/**
 * `allow`, or where to redirect. A public path is shown to everyone, signed in
 * or not; anything else needs a session, and the session needs the allow-list.
 */
export function routeAccess(
  pathname: string,
  session: SessionLike | null | undefined,
): RouteAccess {
  if (isPublicPath(pathname)) return "allow";
  if (!session) return "/login";
  if (!session.user?.isAllowed) return "/unauthorized";
  return "allow";
}
