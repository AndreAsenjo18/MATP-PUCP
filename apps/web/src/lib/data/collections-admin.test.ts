import { afterEach, describe, expect, it, vi } from "vitest";

import {
  collectionFieldError,
  fetchRetiredCollections,
  keepAcronymAsHistorical,
  notEmptyMessage,
  previousAcronymToKeep,
  restoreCollection,
  retireCollection,
  updateCollection,
} from "./admin";

// Edición y retiro de colecciones (crud-manual-completo 2.2). Modo `live` con `fetch` simulado; datos sintéticos (RNF-014).
const BASE_URL = "http://api.test";
const DEV_USER = "admin@matp.local";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function useLive(handler: (request: Request) => Promise<Response>) {
  vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
  vi.stubEnv("API_INTERNAL_URL", BASE_URL);
  const fetchMock = vi.fn(handler);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("reglas de la edición de colecciones", () => {
  it("ofrece la sigla anterior como histórica solo si había una y cambia de verdad", () => {
    expect(previousAcronymToKeep("ABC", "ABD")).toBe("ABC");
    expect(previousAcronymToKeep("M.M.Z.", "mmz")).toBeNull();
    expect(previousAcronymToKeep(null, "ABD")).toBeNull();
    expect(previousAcronymToKeep("  ", "ABD")).toBeNull();
  });

  it("explica el retiro impedido con los conteos, como pide el escenario", () => {
    expect(notEmptyMessage({ pieces: 35, subcollections: 0 })).toBe("La colección tiene 35 piezas activas; reasígnalas antes de retirarla.");
    expect(notEmptyMessage({ pieces: 1, subcollections: 2 })).toBe("La colección tiene 1 pieza activa y 2 subcolecciones; reasígnalas antes de retirarla.");
    expect(notEmptyMessage({ pieces: 0, subcollections: 1 })).toBe("La colección tiene 1 subcolección; reasígnalas antes de retirarla.");
  });

  it("lleva cada error de la API a su campo", () => {
    expect(collectionFieldError({ code: "duplicate_acronym", message: "Ya existe" })).toEqual({ field: "acronym", message: "Ya existe" });
    expect(collectionFieldError({ code: "collection_hierarchy_cycle", message: "Ciclo" })?.field).toBe("parentId");
    expect(collectionFieldError({ code: "otro", message: "x" })).toBeNull();
  });
});

describe("modo live", () => {
  it("edita con PATCH el nombre, la sigla, la madre y el régimen por defecto", async () => {
    const fetchMock = useLive(async (request) => {
      expect(request.method).toBe("PATCH");
      expect(new URL(request.url).pathname).toBe("/api/v1/collections/col-1");
      expect(await request.json()).toEqual({ name: "Colección RA", acronym: null, default_tenure_regime: "Comodato", parent_id: "col-0" });
      return json(200, { id: "col-1", name: "Colección RA" });
    });
    const result = await updateCollection("col-1", { name: " Colección RA ", acronym: " ", tenure: "Comodato", parentId: "col-0" }, DEV_USER);
    expect(result.status).toBe("ok");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("retira con el motivo y entiende la respuesta sin cuerpo", async () => {
    useLive(async (request) => {
      expect(request.method).toBe("DELETE");
      expect(new URL(request.url).searchParams.get("reason")).toBe("Duplicada");
      return new Response(null, { status: 204 });
    });
    expect(await retireCollection("col-1", " Duplicada ", DEV_USER)).toEqual({ status: "ok", value: null });
  });

  it("con piezas, el retiro trae los conteos para el mensaje", async () => {
    useLive(async () => json(409, { code: "collection_not_empty", message: "No se puede", details: { pieces: 35, subcollections: 0 } }));
    const result = await retireCollection("col-1", "Duplicada", DEV_USER);
    expect(result).toMatchObject({ status: "rejected", code: "collection_not_empty", details: { pieces: 35, subcollections: 0 } });
  });

  it("lista las retiradas de la papelera y restaura por la papelera", async () => {
    const fetchMock = useLive(async (request) => {
      const url = new URL(request.url);
      if (request.method === "GET") {
        expect(url.pathname).toBe("/api/v1/trash");
        expect(url.searchParams.get("entity_type")).toBe("collection");
        return json(200, { items: [{ entity_id: "col-9", entity_label: "Colección vieja" }], total: 1, page: 1, page_size: 100 });
      }
      expect(url.pathname).toBe("/api/v1/trash/collection/col-9/restore");
      return json(200, { entity_type: "collection", entity_id: "col-9", entity_label: "Colección vieja", type_label: "Colección" });
    });
    const retired = await fetchRetiredCollections(DEV_USER);
    expect(retired.status === "ok" && retired.value.map((entry) => entry.entity_id)).toEqual(["col-9"]);
    expect((await restoreCollection("col-9", "Por error", DEV_USER)).status).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("guarda la sigla anterior como histórica", async () => {
    useLive(async (request) => {
      expect(new URL(request.url).pathname).toBe("/api/v1/collection-acronym-aliases");
      expect(await request.json()).toEqual({ collection_id: "col-1", alias: "ABC" });
      return json(201, { id: "a-1" });
    });
    expect((await keepAcronymAsHistorical("col-1", "ABC", DEV_USER)).status).toBe("ok");
  });

  it("en modo mock no llama a la API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await retireCollection("col-1", "Duplicada")).status).toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
