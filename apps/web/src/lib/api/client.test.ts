import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  apiErrorMessage,
  createApiClient,
  CSRF_HEADER,
  DEV_USER_HEADER,
  isNotImplemented,
  setSessionLostHandler,
  type PieceSummary,
} from "./client";

const repoRoot = path.resolve(__dirname, "..", "..", "..", "..", "..");

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("generated schema", () => {
  it("was generated from the committed OpenAPI contract", () => {
    const contract = readFileSync(path.join(repoRoot, "docs", "api", "openapi.json"), "utf8");
    const expected = createHash("sha256").update(contract.replace(/\r\n/g, "\n")).digest("hex");
    const schema = readFileSync(path.join(__dirname, "schema.d.ts"), "utf8");
    expect(schema).toContain(`openapi-sha256: ${expected}`);
  });
});

describe("createApiClient", () => {
  it("sends the development identity header and types the page of pieces", async () => {
    const seen: Request[] = [];
    const summary: PieceSummary = {
      id: "01920000-0000-7000-8000-000000000101",
      denomination: "Vasija (sintética)",
      collection: null,
      tenure_regime: "Propiedad",
      code_i: "I-0236",
      codes: [],
      category: null,
      conservation_status: null,
      period_text: null,
      location_label: null,
      media_count: 0,
      has_location: false,
      updated_at: "2026-09-17T10:30:00Z",
    };
    const client = createApiClient({
      baseUrl: "http://api.test/",
      devUser: "catalogador@matp.local",
      fetch: async (input) => {
        seen.push(input as Request);
        return jsonResponse(200, { items: [summary], total: 1, page: 1, limit: 20 });
      },
    });

    const { data, error } = await client.GET("/api/v1/pieces", {
      params: { query: { has_inventory_code: false, limit: 20 } },
    });

    expect(error).toBeUndefined();
    expect(data?.items[0].code_i).toBe("I-0236");
    expect(seen[0].headers.get(DEV_USER_HEADER)).toBe("catalogador@matp.local");
    expect(seen[0].url).toBe(
      "http://api.test/api/v1/pieces?has_inventory_code=false&limit=20",
    );
  });

  it("exposes stub responses as not implemented with a Spanish message", async () => {
    const client = createApiClient({
      baseUrl: "http://api.test",
      fetch: async () =>
        jsonResponse(501, {
          code: "not_implemented",
          message: "Operación del contrato aún no implementada.",
          details: {},
          change: "importacion-pipeline-reconciliacion",
          example: null,
        }),
    });

    const { error } = await client.POST("/api/v1/imports/{batch_id}/rollback", {
      params: { path: { batch_id: "01920000-0000-7000-8000-000000000601" } },
      body: { reason: "Lote sintético" },
    });

    expect(isNotImplemented(error)).toBe(true);
    expect(apiErrorMessage(error)).toContain("importacion-pipeline-reconciliacion");
  });

  it("falls back to a generic message for unknown errors", () => {
    expect(apiErrorMessage(undefined)).toBe(
      "No se pudo completar la operación. Intente nuevamente.",
    );
    expect(apiErrorMessage({ code: "duplicate_acronym", message: "La sigla ya existe." })).toBe(
      "La sigla ya existe.",
    );
  });
});

describe("session cookie and CSRF (ADR-009)", () => {
  function clientWith(token: string | null, seen: Request[]) {
    return createApiClient({
      baseUrl: "http://api.test",
      csrfToken: () => token,
      fetch: async (input) => {
        seen.push(input as Request);
        return jsonResponse(200, {});
      },
    });
  }

  it("sends cookies and echoes the CSRF token on writes only", async () => {
    const seen: Request[] = [];
    const client = clientWith("token-csrf", seen);

    await client.GET("/api/v1/auth/me");
    await client.POST("/api/v1/auth/logout");

    expect(seen[0].credentials).toBe("include");
    expect(seen[0].headers.get(CSRF_HEADER)).toBeNull();
    expect(seen[1].credentials).toBe("include");
    expect(seen[1].headers.get(CSRF_HEADER)).toBe("token-csrf");
  });

  it("does not invent a CSRF header when there is no token", async () => {
    const seen: Request[] = [];
    await clientWith(null, seen).POST("/api/v1/auth/logout");
    expect(seen[0].headers.get(CSRF_HEADER)).toBeNull();
  });

  it("reads the token from the matp_csrf cookie by default", async () => {
    vi.stubGlobal("document", { cookie: "otra=1; matp_csrf=desde-la-cookie" });
    const seen: Request[] = [];
    const client = createApiClient({
      baseUrl: "http://api.test",
      fetch: async (input) => {
        seen.push(input as Request);
        return jsonResponse(200, {});
      },
    });
    await client.POST("/api/v1/auth/logout");
    expect(seen[0].headers.get(CSRF_HEADER)).toBe("desde-la-cookie");
    vi.unstubAllGlobals();
  });
});

describe("lost session (ADR-009)", () => {
  function clientAnswering(status: number, body: unknown) {
    return createApiClient({
      baseUrl: "http://api.test",
      fetch: async () => jsonResponse(status, body),
    });
  }

  it("tells the handler when the API says the session expired", async () => {
    const lost: string[] = [];
    setSessionLostHandler((code) => lost.push(code));
    const { error } = await clientAnswering(401, {
      code: "session_expired",
      message: "Su sesión expiró por inactividad.",
      details: {},
    }).GET("/api/v1/pieces");
    setSessionLostHandler(null);

    expect(lost).toEqual(["session_expired"]);
    expect(apiErrorMessage(error)).toBe("Su sesión expiró por inactividad.");
  });

  it("ignores wrong credentials and other statuses", async () => {
    const lost: string[] = [];
    setSessionLostHandler((code) => lost.push(code));
    await clientAnswering(401, { code: "invalid_credentials", message: "x", details: {} }).GET("/api/v1/pieces");
    await clientAnswering(403, { code: "permission_denied", message: "x", details: {} }).GET("/api/v1/pieces");
    setSessionLostHandler(null);

    expect(lost).toEqual([]);
  });
});
