import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((request) => {
  if (request.auth) {
    if (request.nextUrl.pathname === "/login") return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }
  if (request.nextUrl.pathname === "/login") return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
});

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"] };
