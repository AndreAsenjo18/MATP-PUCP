import { NextResponse, type NextRequest } from "next/server";

import { guardDecision, SESSION_COOKIE } from "@/lib/auth/guard";

/**
 * Sends people without a session cookie to the login screen (ADR-009, decision D9). Light check
 * only; see `lib/auth/guard.ts`. Off in the simulated mode and when the API is on another domain.
 */
export function proxy(request: NextRequest) {
  const decision = guardDecision({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    hasSession: request.cookies.has(SESSION_COOKIE),
    live: process.env.NEXT_PUBLIC_API_MODE === "live",
    crossDomain: Boolean(process.env.NEXT_PUBLIC_API_URL),
  });
  if (decision.action === "redirect") {
    return NextResponse.redirect(new URL(decision.location, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
