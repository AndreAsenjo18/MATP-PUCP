/**
 * Typed client of the MATP API (contract: docs/api/openapi.json, change contratos-api-borrador).
 *
 * Types come from ./schema.d.ts, generated with `npm run openapi:client`. The provisional
 * development identity header (ADR-005) is added when `devUser` is given; it is replaced by
 * JWT in the change autenticacion-y-matriz-permisos.
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

export interface ApiClientOptions {
  /** API origin, e.g. http://localhost:8000 (without /api/v1). */
  baseUrl: string;
  /** E-mail or UUID of a synthetic user (development only). */
  devUser?: string;
  fetch?: typeof globalThis.fetch;
}

export function createApiClient({ baseUrl, devUser, fetch }: ApiClientOptions): ApiClient {
  const client = createClient<paths>({
    baseUrl: baseUrl.replace(/\/+$/, ""),
    ...(fetch ? { fetch } : {}),
  });
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
