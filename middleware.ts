import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/unauthorized"];

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const isPublic = PUBLIC_PATHS.some((p) => nextUrl.pathname.startsWith(p));

  if (!session && !isPublic) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (session && !isPublic) {
    const isAllowed = (session.user as Record<string, unknown>)?.isAllowed;
    if (!isAllowed) {
      return NextResponse.redirect(new URL("/unauthorized", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
