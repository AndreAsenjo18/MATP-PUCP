import { afterEach, describe, expect, it, vi } from "vitest";

import {
  codeError,
  createVocabulary,
  lockedRules,
  previewRuleChange,
  previewSentence,
  recordAssessment,
  suggestCode,
  updateIdentifierType,
} from "./admin";

// Modo `mock` por defecto; `useLive` sustituye `fetch` por un simulacro (sin API real ni red).

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

describe("reglas de la pantalla", () => {
  it("sugiere un código estable desde la etiqueta, sin tildes ni espacios", () => {
    expect(suggestCode("Arte plumario")).toBe("ARTE_PLUMARIO");
    expect(suggestCode("  Código del propietario anterior ")).toBe("CODIGO_DEL_PROPIETARIO_ANTERIOR");
    expect(suggestCode("3 dígitos")).toBe("C_3_DIGITOS");
  });

  it("valida el código como la API", () => {
    expect(codeError("TECNICAS")).toBeNull();
    expect(codeError("")).toBe("Escriba el código.");
    expect(codeError("técnicas")).toContain("mayúsculas");
    expect(codeError("A", { min: 2 })).toContain("al menos 2");
  });

  it("explica las reglas fijas de un tipo del sistema y ninguna de uno configurable", () => {
    const inventory = { is_system: true, is_unique_when_current: true, locks_on_assignment: true, owned_pieces_only: true };
    expect(lockedRules(inventory)).toEqual(["se bloquea al asignarse (RN-002)", "es único entre los códigos vigentes", "solo aplica a piezas en propiedad (RN-003)"]);
    expect(lockedRules({ ...inventory, is_system: false })).toEqual([]);
  });

  it("resume el impacto del cambio de regla en lenguaje claro", () => {
    expect(previewSentence({ total_identifiers: 0, changed_count: 0, unparseable_count: 0, collisions: [] })).toContain("no recalcula nada");
    const text = previewSentence({
      total_identifiers: 140,
      changed_count: 120,
      unparseable_count: 1,
      collisions: [{ normalized_value: "I-21", piece_ids: ["a", "b"] }],
    });
    expect(text).toBe(
      "De 140 identificadores registrados, 120 cambian su valor normalizado; 1 deja de reconocerse y quedarán para revisión; 1 código vigente quedaría repetido en piezas distintas. Los valores originales no cambian.",
    );
  });
});

describe("operaciones en modo live", () => {
  it("sin API (modo mock) responde no disponible", async () => {
    const result = await createVocabulary("TECNICAS", "Técnicas", DEV_USER);
    expect(result.status).toBe("unavailable");
  });

  it("crea un vocabulario y traduce el código repetido", async () => {
    const fetchMock = useLive(async () => json(409, { code: "vocabulary_exists", message: "x", details: {} }));

    const result = await createVocabulary("MATERIAL", " Materiales ", DEV_USER);

    expect(await (fetchMock.mock.calls[0][0] as Request).json()).toEqual({ code: "MATERIAL", name: "Materiales" });
    expect(result.status === "rejected" && result.message).toBe("Ya existe un vocabulario con ese código.");
  });

  it("pide la vista previa y confirma con su token", async () => {
    const fetchMock = useLive(async (request) =>
      request.method === "POST" ? json(200, { confirm_token: "abc", changed_count: 3 }) : json(200, { code: "PUCP", normalization_rule: "INC_RN" }),
    );

    const preview = await previewRuleChange("PUCP", "INC_RN", DEV_USER);
    await updateIdentifierType("PUCP", { rule: "INC_RN", confirmToken: "abc" }, DEV_USER);

    const [first, second] = fetchMock.mock.calls.map((call) => call[0] as Request);
    expect(new URL(first.url).pathname).toBe("/api/v1/identifier-types/PUCP/normalization-preview");
    expect(await first.json()).toEqual({ normalization_rule: "INC_RN" });
    expect(preview.status === "ok" && preview.value.confirm_token).toBe("abc");
    expect(second.method).toBe("PATCH");
    expect(await second.json()).toEqual({ normalization_rule: "INC_RN", confirm_token: "abc" });
  });

  it("traduce la colisión de códigos al confirmar", async () => {
    useLive(async () => json(409, { code: "normalization_collision", message: "x", details: { collisions: [] } }));

    const result = await updateIdentifierType("I", { rule: "GENERIC", confirmToken: "t" }, DEV_USER);

    expect(result.status === "rejected" && result.message).toContain("RN-002");
  });

  it("registra una evaluación con la fecha elegida y notas recortadas", async () => {
    const fetchMock = useLive(async () => json(201, []));

    await recordAssessment("p-1", { statusTermId: "t-1", assessedOn: "2024-05-03", notes: "  Grietas  " }, DEV_USER);

    expect(await (fetchMock.mock.calls[0][0] as Request).json()).toEqual({
      status_term_id: "t-1",
      assessed_at: "2024-05-03T12:00:00Z",
      notes: "Grietas",
    });
  });
});
