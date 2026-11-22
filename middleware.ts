import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { routeAccess } from "@/lib/auth/route-access";

export default auth((req) => {
  const access = routeAccess(req.nextUrl.pathname, req.auth);
  if (access === "allow") return NextResponse.next();
  return NextResponse.redirect(new URL(access, req.nextUrl));
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
