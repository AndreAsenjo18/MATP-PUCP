import { afterEach, describe, expect, it, vi } from "vitest";

import { setTermActive, termLabelError, updateTermLabel } from "./admin";

// Corregir la etiqueta de un término (crud-manual-completo 2.3). Modo `live` con `fetch` simulado; datos sintéticos (RNF-014).
const BASE_URL = "http://api.test";
const DEV_USER = "admin@matp.local";
const TERM_ID = "11111111-1111-4111-8111-111111111111";
const REPEATED = "Ya existe el término «Madera» en esta lista; desactive uno de los dos o use otra etiqueta.";

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

describe("reglas de la etiqueta corregida", () => {
  it("pide una etiqueta distinta de la actual y dentro del tope de la API", () => {
    expect(termLabelError("Ceramica", "  ")).toBe("Escriba la etiqueta nueva.");
    expect(termLabelError("Ceramica", " Ceramica ")).toBe("La etiqueta nueva es igual a la actual.");
    expect(termLabelError("Ceramica", "x".repeat(201))).toBe("La etiqueta admite como máximo 200 caracteres.");
    expect(termLabelError("Ceramica", "Cerámica")).toBeNull();
  });

  it("una mayúscula corregida también es un cambio", () => {
    expect(termLabelError("ceramica", "Ceramica")).toBeNull();
  });
});

describe("modo live", () => {
  it("«Corregir una errata»: envía solo la etiqueta, sin espacios de sobra", async () => {
    const fetchMock = useLive(async (request) => {
      expect(request.method).toBe("PATCH");
      expect(new URL(request.url).pathname).toBe(`/api/v1/vocabularies/MATERIAL/terms/${TERM_ID}`);
      expect(await request.json()).toEqual({ label: "Cerámica" });
      return json(200, { id: TERM_ID, label: "Cerámica", code: "CERAMICA", is_active: true });
    });
    const result = await updateTermLabel("MATERIAL", TERM_ID, " Cerámica ", DEV_USER);
    expect(result).toMatchObject({ status: "ok", value: { label: "Cerámica", code: "CERAMICA" } });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("«Etiqueta repetida»: la persona recibe la sugerencia de desactivar uno de los dos", async () => {
    useLive(async () => json(422, { code: "duplicate_term", message: REPEATED, details: { term_id: "t-2", is_active: true } }));
    const result = await updateTermLabel("MATERIAL", TERM_ID, "Madera", DEV_USER);
    expect(result).toMatchObject({ status: "rejected", code: "duplicate_term", message: REPEATED });
  });

  it("reactivar un término repetido también trae la sugerencia", async () => {
    useLive(async () => json(422, { code: "duplicate_term", message: REPEATED }));
    expect(await setTermActive("MATERIAL", TERM_ID, true, DEV_USER)).toMatchObject({ status: "rejected", message: REPEATED });
  });

  it("en modo mock no llama a la API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await updateTermLabel("MATERIAL", TERM_ID, "Cerámica")).status).toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
