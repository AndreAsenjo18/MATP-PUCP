/**
 * Route guard rules (ADR-009, decision D9). Pure functions so they can be tested without Next.
 *
 * The check is deliberately light: it only looks for the *presence* of the session cookie to
 * save a round trip for people who are plainly signed out. The real authorization is the API's.
 * It can only see the cookie when web and API share a domain (the VM, behind the reverse proxy);
 * in the free-tier contingency, with the API on another domain, the guard is off and the
 * pages rely on the 401 handling of the client instead.
 */
export const SESSION_COOKIE = "matp_session";
export const LOGIN_PATH = "/";

/** Paths anybody may open without a session. */
const PUBLIC_PREFIXES = ["/_next", "/api", "/health", "/favicon", "/icon"];

export interface GuardInput {
  pathname: string;
  search?: string;
  hasSession: boolean;
  /** `NEXT_PUBLIC_API_MODE === "live"`: the simulated mode has no cookie at all. */
  live: boolean;
  /** The API lives on another domain, so its cookie is invisible to this server. */
  crossDomain: boolean;
}

export type GuardDecision = { action: "allow" } | { action: "redirect"; location: string };

export function isPublicPath(pathname: string): boolean {
  return pathname === LOGIN_PATH || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Only same-site relative paths may be used as a post-login destination (no open redirect). */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (value === LOGIN_PATH) return null;
  return value;
}

export function loginUrl(returnTo?: string | null, expired = false): string {
  const params = new URLSearchParams();
  if (expired) params.set("expired", "1");
  const safe = safeReturnTo(returnTo);
  if (safe) params.set("returnTo", safe);
  const query = params.toString();
  return query ? `${LOGIN_PATH}?${query}` : LOGIN_PATH;
}

export function guardDecision({ pathname, search = "", hasSession, live, crossDomain }: GuardInput): GuardDecision {
  if (!live || crossDomain || hasSession || isPublicPath(pathname)) return { action: "allow" };
  return { action: "redirect", location: loginUrl(`${pathname}${search}`) };
}
