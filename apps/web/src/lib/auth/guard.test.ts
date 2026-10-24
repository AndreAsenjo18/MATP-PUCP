import { describe, expect, it } from "vitest";

import { guardDecision, isPublicPath, loginUrl, safeReturnTo } from "./guard";

const base = { hasSession: false, live: true, crossDomain: false };

describe("guardDecision", () => {
  it("sends a signed-out visitor to the login with the page they wanted", () => {
    expect(guardDecision({ ...base, pathname: "/piezas/123", search: "?tab=fotos" })).toEqual({
      action: "redirect",
      location: "/?returnTo=%2Fpiezas%2F123%3Ftab%3Dfotos",
    });
  });

  it("lets a visitor with a session cookie through", () => {
    expect(guardDecision({ ...base, pathname: "/inicio", hasSession: true })).toEqual({ action: "allow" });
  });

  it("never blocks the login screen, static assets or the API proxy", () => {
    for (const pathname of ["/", "/_next/static/x.js", "/api/v1/auth/login", "/health"]) {
      expect(isPublicPath(pathname)).toBe(true);
      expect(guardDecision({ ...base, pathname })).toEqual({ action: "allow" });
    }
  });

  it("is off in the simulated mode and when the API is on another domain", () => {
    expect(guardDecision({ ...base, pathname: "/inicio", live: false })).toEqual({ action: "allow" });
    expect(guardDecision({ ...base, pathname: "/inicio", crossDomain: true })).toEqual({ action: "allow" });
  });
});

describe("safeReturnTo", () => {
  it("accepts only relative paths of this site", () => {
    expect(safeReturnTo("/piezas/1")).toBe("/piezas/1");
    expect(safeReturnTo("https://evil.example/x")).toBeNull();
    expect(safeReturnTo("//evil.example/x")).toBeNull();
    expect(safeReturnTo("/\\evil.example")).toBeNull();
    expect(safeReturnTo("javascript:alert(1)")).toBeNull();
    expect(safeReturnTo("/")).toBeNull();
    expect(safeReturnTo(null)).toBeNull();
  });
});

describe("loginUrl", () => {
  it("marks an expired session and keeps a safe returnTo", () => {
    expect(loginUrl("/piezas/1/editar", true)).toBe("/?expired=1&returnTo=%2Fpiezas%2F1%2Feditar");
    expect(loginUrl("https://evil.example", false)).toBe("/");
  });
});
