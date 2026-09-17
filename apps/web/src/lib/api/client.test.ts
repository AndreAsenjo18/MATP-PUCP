import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  apiErrorMessage,
  createApiClient,
  DEV_USER_HEADER,
  isNotImplemented,
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
      title: "Vasija (sintética)",
      collection: null,
      tenure_regime: "OWNED",
      inventory_code: "I-0236",
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
        return jsonResponse(200, { items: [summary], total: 1, page: 1, page_size: 20 });
      },
    });

    const { data, error } = await client.GET("/api/v1/pieces", {
      params: { query: { has_inventory_code: false, page_size: 20 } },
    });

    expect(error).toBeUndefined();
    expect(data?.items[0].inventory_code).toBe("I-0236");
    expect(seen[0].headers.get(DEV_USER_HEADER)).toBe("catalogador@matp.local");
    expect(seen[0].url).toBe(
      "http://api.test/api/v1/pieces?has_inventory_code=false&page_size=20",
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

    const { error } = await client.POST("/api/v1/imports/{batch_id}/approve", {
      params: { path: { batch_id: "01920000-0000-7000-8000-000000000601" } },
      body: { confirm_counts: { rows: 10 } },
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
