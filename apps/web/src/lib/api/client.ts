/**
 * Typed client of the MATP API (contract: docs/api/openapi.json, change contratos-api-borrador).
 *
 * Types come from ./schema.d.ts, generated with `npm run openapi:client`.
 *
 * Authentication (ADR-009): the browser holds an opaque `HttpOnly` session cookie that
 * `credentials: "include"` sends with every call, and every write echoes the readable
 * `matp_csrf` cookie in `X-CSRF-Token` (double submit). The old `X-MATP-User` header
 * (`devUser`) is only honoured by an API running with `APP_ENV=test`; it stays here for tests.
 */
import createClient, { type Client, type Middleware } from "openapi-fetch";

import type { components, paths } from "./schema";

export type ApiSchemas = components["schemas"];
export type ErrorResponse = ApiSchemas["ErrorResponse"];
export type NotImplementedResponse = ApiSchemas["NotImplementedResponse"];
export type PieceSummary = ApiSchemas["PieceSummary"];
export type PieceDetail = ApiSchemas["PieceDetail"];
export type ApiClient = Client<paths>;

export const API_PREFIX = "/api/v1";
export const DEV_USER_HEADER = "X-MATP-User";
export const CSRF_HEADER = "X-CSRF-Token";
export const CSRF_COOKIE = "matp_csrf";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface ApiClientOptions {
  /** API origin, e.g. http://localhost:8000 (without /api/v1). */
  baseUrl: string;
  /** E-mail or UUID of a synthetic user (tests only: the API ignores it outside APP_ENV=test). */
  devUser?: string;
  /** Where the CSRF token comes from; by default the `matp_csrf` cookie of the page. */
  csrfToken?: () => string | null;
  fetch?: typeof globalThis.fetch;
}

/** Value of a cookie readable by scripts (the session cookie is `HttpOnly`, so never this one). */
export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function createApiClient({
  baseUrl,
  devUser,
  csrfToken = () => readCookie(CSRF_COOKIE),
  fetch,
}: ApiClientOptions): ApiClient {
  const client = createClient<paths>({
    baseUrl: baseUrl.replace(/\/+$/, ""),
    credentials: "include",
    ...(fetch ? { fetch } : {}),
  });
  const csrf: Middleware = {
    onRequest({ request }) {
      const token = csrfToken();
      if (token && !SAFE_METHODS.has(request.method.toUpperCase())) {
        request.headers.set(CSRF_HEADER, token);
      }
      return request;
    },
  };
  client.use(csrf);
  if (devUser) {
    const identity: Middleware = {
      onRequest({ request }) {
        request.headers.set(DEV_USER_HEADER, devUser);
        return request;
      },
    };
    client.use(identity);
  }
  return client;
}

/** True when the operation is a contract stub (HTTP 501, `x-status: stub`). */
export function isNotImplemented(error: unknown): error is NotImplementedResponse {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "not_implemented"
  );
}

/** Spanish message to show to the user for any API error body. */
export function apiErrorMessage(error: unknown): string {
  if (isNotImplemented(error)) {
    return `Esta función aún no está disponible (se implementa en ${error.change}).`;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return "No se pudo completar la operación. Intente nuevamente.";
}
