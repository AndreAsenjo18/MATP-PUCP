import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiSchemas } from "@/lib/api/client";
import { getPieceDetail, ids, toSummary } from "@/lib/fixtures";

import {
  VALIDATION_DEBOUNCE_MS,
  createPiece,
  createPieceValidator,
  fetchPieceCatalogs,
  initialPieceCatalogs,
  PRECONDITION_MESSAGE,
  registerSplitIdentifiers,
  updatePiece,
  validatePiece,
  type PieceCreateInput,
} from "./pieces";

// Modo `mock`: es el valor por defecto sin NEXT_PUBLIC_API_MODE. Modo `live`: se activa con
// `useLive`, que sustituye `fetch` por un simulacro (sin API real ni red) y fija la URL base.

const BASE_URL = "http://api.test";
const NEW_PIECE: PieceCreateInput = { denomination: "  Charango nuevo  ", tenure_regime: "Propiedad", code_i: "I-9999" };
const VALID_RESULT = { is_valid: true, issues: [] };
// Solo se simulan los temporizadores del debounce: `fetch` y los flujos de `Response` siguen reales.
const FAKE_TIMERS: { toFake: Array<"setTimeout" | "clearTimeout"> } = { toFake: ["setTimeout", "clearTimeout"] };

type FetchHandler = (request: Request) => Promise<Response>;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function useLive(handler: FetchHandler) {
  vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
  vi.stubEnv("API_INTERNAL_URL", BASE_URL);
  const fetchMock = vi.fn(handler);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestAt(fetchMock: { mock: { calls: Array<[Request]> } }, index: number): Request {
  const call = fetchMock.mock.calls[index];
  if (!call) throw new Error(`fetch no recibió la llamada ${index}`);
  return call[0];
}

function lastRequest(fetchMock: { mock: { calls: Array<[Request]> } }): Request {
  return requestAt(fetchMock, fetchMock.mock.calls.length - 1);
}

function detailOf(position: number): ApiSchemas["PieceDetail"] {
  const detail = getPieceDetail(ids.piece(position));
  if (!detail) throw new Error(`El fixture de la pieza ${position} no existe`);
  return detail;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("createPiece (modo mock)", () => {
  it("devuelve un resumen sintético sin llamar a la red", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await createPiece(NEW_PIECE);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.piece.denomination).toBe("Charango nuevo");
      expect(result.piece.code_i).toBe("I-9999");
      expect(result.piece.tenure_regime).toBe("Propiedad");
      expect(result.piece.id).toEqual(expect.any(String));
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("updatePiece (modo mock)", () => {
  it("aplica los campos enviados y conserva el resto de la ficha", async () => {
    const original = detailOf(1);

    const result = await updatePiece(original.id, { denomination: "Toro de Pucará (revisado)", notes: null });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.piece.denomination).toBe("Toro de Pucará (revisado)");
      expect(result.piece.notes).toBeNull();
      expect(result.piece.provenance).toBe(original.provenance);
    }
  });

  it("rechaza con not_found una pieza que no existe", async () => {
    const result = await updatePiece("no-existe", { notes: "x" });
    expect(result).toMatchObject({ status: "rejected", code: "not_found" });
  });

  it("aplica autor, época, materiales y estado de conservación sin perder el rango de años", async () => {
    const original = detailOf(1);
    const [wood, clay] = initialPieceCatalogs().materials;
    const [good] = initialPieceCatalogs().conservationStates;
    if (!wood || !clay || !good) throw new Error("Faltan términos de catálogo en los fixtures");

    const result = await updatePiece(original.id, {
      author: "Taller Santos",
      period: { text: "s. XX" },
      material_term_ids: [wood.id, clay.id],
      conservation_state_id: good.id,
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.piece.author).toBe("Taller Santos");
      expect(result.piece.period.text).toBe("s. XX");
      expect(result.piece.period.year_from).toBe(original.period.year_from);
      expect(result.piece.materials.map((material) => material.id)).toEqual([wood.id, clay.id]);
      expect(result.piece.conservation_status?.id).toBe(good.id);
    }
  });

  it("vaciar el estado de conservación y los materiales los quita de la ficha", async () => {
    const result = await updatePiece(detailOf(1).id, { conservation_state_id: null, material_term_ids: [] });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.piece.conservation_status).toBeNull();
      expect(result.piece.materials).toEqual([]);
    }
  });

  it("aplica disponibilidad, comodante y convenio, y conserva lo que no se envía", async () => {
    const original = detailOf(1);
    const [availability] = initialPieceCatalogs().availabilities;
    if (!availability) throw new Error("Faltan términos de disponibilidad en los fixtures");

    const result = await updatePiece(original.id, { availability_term_id: availability.id, lender_name: "Familia Bermúdez" });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.piece.availability?.id).toBe(availability.id);
      expect(result.piece.lender_name).toBe("Familia Bermúdez");
      expect(result.piece.loan_agreement_ref).toBe(original.loan_agreement_ref);
    }
  });
});

describe("catálogos del editor", () => {
  it("en modo mock salen de los fixtures al instante, sin llamar a la red", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const initial = initialPieceCatalogs();
    const result = await fetchPieceCatalogs();

    expect(initial.materials.length).toBeGreaterThan(0);
    expect(initial.conservationStates.length).toBeGreaterThan(0);
    for (const list of [initial.collections, initial.categories, initial.objectTypes, initial.acquisitionMethods, initial.availabilities]) {
      expect(list.length).toBeGreaterThan(0);
    }
    expect(result).toEqual({ status: "ok", catalogs: initial });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("en modo live empiezan vacíos hasta que responde la API", () => {
    useLive(async () => json(200, []));

    expect(initialPieceCatalogs()).toEqual({
      collections: [],
      categories: [],
      objectTypes: [],
      acquisitionMethods: [],
      availabilities: [],
      materials: [],
      conservationStates: [],
    });
  });

  it("en modo live pide colecciones, categorías y los vocabularios del editor, y descarta los inactivos", async () => {
    const term = (vocabulary: string, code: string, label: string, isActive: boolean) => ({
      id: `id-${code}`,
      code,
      name: label,
      label,
      description: null,
      external_uri: null,
      is_active: isActive,
      parent_id: null,
      sort_order: 0,
      vocabulary_code: vocabulary,
    });
    const collection = (id: string, name: string, isActive: boolean) => ({ id, name, acronym: null, is_active: isActive });
    const fetchMock = useLive(async (request) => {
      const path = new URL(request.url).pathname;
      if (path === "/api/v1/collections") return json(200, [collection("col-1", "Colección MMZ", true), collection("col-2", "Cerrada", false)]);
      if (path === "/api/v1/categories") return json(200, [term("CATEGORY", "RETABLO", "Retablo", true)]);
      if (path.endsWith("/MATERIAL/terms")) {
        return json(200, [term("MATERIAL", "MADERA", "Madera", true), term("MATERIAL", "VIEJO", "Obsoleto", false)]);
      }
      if (path.endsWith("/OBJECT_TYPE/terms")) return json(200, [term("OBJECT_TYPE", "BIEN_MUEBLE", "Bien mueble", true)]);
      if (path.endsWith("/ACQUISITION_METHOD/terms")) return json(200, [term("ACQUISITION_METHOD", "DONACION", "Donación", true)]);
      if (path.endsWith("/AVAILABILITY/terms")) return json(200, [term("AVAILABILITY", "EN_SALA", "En sala", true)]);
      return json(200, [term("CONSERVATION_STATUS", "BUENO", "Bueno", true)]);
    });

    const result = await fetchPieceCatalogs();

    const paths = fetchMock.mock.calls.map(([request]) => new URL(request.url).pathname).sort();
    expect(paths).toEqual(
      [
        "/api/v1/categories",
        "/api/v1/collections",
        "/api/v1/vocabularies/ACQUISITION_METHOD/terms",
        "/api/v1/vocabularies/AVAILABILITY/terms",
        "/api/v1/vocabularies/CONSERVATION_STATUS/terms",
        "/api/v1/vocabularies/MATERIAL/terms",
        "/api/v1/vocabularies/OBJECT_TYPE/terms",
      ].sort(),
    );
    expect(result).toEqual({
      status: "ok",
      catalogs: {
        collections: [{ id: "col-1", label: "Colección MMZ" }],
        categories: [{ id: "id-RETABLO", label: "Retablo" }],
        objectTypes: [{ id: "id-BIEN_MUEBLE", label: "Bien mueble" }],
        acquisitionMethods: [{ id: "id-DONACION", label: "Donación" }],
        availabilities: [{ id: "id-EN_SALA", label: "En sala" }],
        materials: [{ id: "id-MADERA", label: "Madera" }],
        conservationStates: [{ id: "id-BUENO", label: "Bueno" }],
      },
    });
  });

  it("en modo live informa unavailable si falla alguna de las listas", async () => {
    useLive(async (request) =>
      new URL(request.url).pathname.endsWith("/MATERIAL/terms")
        ? json(403, { code: "forbidden", message: "Sin permiso." })
        : json(200, []),
    );

    const result = await fetchPieceCatalogs();

    expect(result.status).toBe("unavailable");
  });

  it("en modo live informa unavailable si no hay conexión", async () => {
    useLive(async () => {
      throw new TypeError("fetch failed");
    });

    expect(await fetchPieceCatalogs()).toEqual({
      status: "unavailable",
      message: "No se pudo conectar con el servidor. Intente nuevamente.",
    });
  });
});

describe("validatePiece (modo mock)", () => {
  it("marca como error una denominación vacía", async () => {
    const outcome = await validatePiece({ denomination: "   ", tenure_regime: "Propiedad" });

    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok") {
      expect(outcome.result.is_valid).toBe(false);
      expect(outcome.result.issues.map((issue) => issue.code)).toContain("denomination_required");
    }
  });

  it("detecta un código I de otra pieza, pero no el de la propia pieza en edición", async () => {
    const owner = detailOf(1);
    expect(owner.code_i).toBeTruthy();
    const candidate: PieceCreateInput = { denomination: "Otra pieza", tenure_regime: "Propiedad", code_i: owner.code_i };

    const asNew = await validatePiece(candidate);
    const asOwner = await validatePiece(candidate, { pieceId: owner.id });

    expect(asNew).toMatchObject({ status: "ok", result: { is_valid: false } });
    if (asNew.status === "ok") expect(asNew.result.issues.map((issue) => issue.code)).toContain("duplicate_inventory_code");
    expect(asOwner).toMatchObject({ status: "ok", result: { is_valid: true } });
  });

  it("devuelve aborted si la señal ya estaba abortada", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await validatePiece(NEW_PIECE, { signal: controller.signal })).toEqual({ status: "aborted" });
  });
});

describe("createPiece (modo live)", () => {
  it("envía POST /api/v1/pieces con el cuerpo y devuelve la pieza creada", async () => {
    const summary = toSummary(detailOf(1));
    const fetchMock = useLive(async () => json(201, summary));

    const result = await createPiece(NEW_PIECE);

    const request = lastRequest(fetchMock);
    expect(request.method).toBe("POST");
    expect(new URL(request.url).pathname).toBe("/api/v1/pieces");
    expect(await request.clone().json()).toEqual(NEW_PIECE);
    expect(result).toEqual({ status: "ok", piece: summary });
  });

  it("informa rejected con el código y el mensaje de la API en un 422", async () => {
    useLive(async () => json(422, { code: "validation_failed", message: "La denominación es obligatoria." }));

    expect(await createPiece(NEW_PIECE)).toEqual({
      status: "rejected",
      code: "validation_failed",
      message: "La denominación es obligatoria.",
    });
  });

  it("informa unavailable cuando la operación es un stub 501", async () => {
    useLive(async () => json(501, { code: "not_implemented", message: "Stub.", change: "ficha-pieza-crud" }));

    const result = await createPiece(NEW_PIECE);

    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") expect(result.message).toContain("ficha-pieza-crud");
  });

  it("informa unavailable si no hay conexión", async () => {
    useLive(async () => {
      throw new TypeError("fetch failed");
    });

    expect(await createPiece(NEW_PIECE)).toEqual({
      status: "unavailable",
      message: "No se pudo conectar con el servidor. Intente nuevamente.",
    });
  });
});

describe("updatePiece (modo live)", () => {
  it("envía PUT /api/v1/pieces/{id} con los campos cambiados y devuelve la ficha", async () => {
    const detail = detailOf(1);
    const fetchMock = useLive(async () => json(200, detail));

    const result = await updatePiece(detail.id, { notes: "Revisado" });

    const request = lastRequest(fetchMock);
    expect(request.method).toBe("PUT");
    expect(new URL(request.url).pathname).toBe(`/api/v1/pieces/${detail.id}`);
    expect(await request.clone().json()).toEqual({ notes: "Revisado" });
    expect(result).toEqual({ status: "ok", piece: detail });
  });

  it("informa rejected not_found cuando la API responde 404", async () => {
    useLive(async () => json(404, { code: "not_found", message: "La pieza no existe o fue eliminada." }));

    expect(await updatePiece("no-existe", { notes: "x" })).toEqual({
      status: "rejected",
      code: "not_found",
      message: "La pieza no existe o fue eliminada.",
    });
  });
});

describe("updatePiece (modo live): conflicto de edición", () => {
  it("informa conflict, con el mensaje de la API, cuando el servidor responde 409 edit_conflict", async () => {
    const message = "Otra persona modificó la pieza mientras usted la editaba.";
    useLive(async () => json(409, { code: "edit_conflict", message }));

    expect(await updatePiece(ids.piece(1), { notes: "x" })).toEqual({ status: "conflict", message });
  });

  it("envía la versión de la ficha abierta en If-Match (design D2)", async () => {
    const detail = detailOf(1);
    const fetchMock = useLive(async () => json(200, { ...detail, version: 4 }));

    const result = await updatePiece(detail.id, { notes: "Revisado" }, 3);

    expect(lastRequest(fetchMock).headers.get("If-Match")).toBe("3");
    expect(result.status === "ok" && result.piece.version).toBe(4);
  });

  it("sin versión no inventa la cabecera y el 428 se explica en lenguaje claro", async () => {
    const fetchMock = useLive(async () => json(428, { code: "precondition_required", message: "Falta If-Match." }));

    const result = await updatePiece(ids.piece(1), { notes: "x" });

    expect(lastRequest(fetchMock).headers.has("If-Match")).toBe(false);
    expect(result).toEqual({ status: "rejected", code: "precondition_required", message: PRECONDITION_MESSAGE });
  });

  it("otros 409 (código I inmutable) siguen siendo rejected y no se tratan como conflicto", async () => {
    useLive(async () => json(409, { code: "immutable_inventory_code", message: "El código I está bloqueado." }));

    expect(await updatePiece(ids.piece(1), { notes: "x" })).toEqual({
      status: "rejected",
      code: "immutable_inventory_code",
      message: "El código I está bloqueado.",
    });
  });
});

describe("validatePiece (modo live)", () => {
  it("envía POST /api/v1/pieces/validate con piece_id y devuelve el resultado", async () => {
    const issue = { field: "code_i", code: "duplicate_inventory_code", message: "El código I ya existe.", severity: "error" };
    const fetchMock = useLive(async () => json(200, { is_valid: false, issues: [issue] }));

    const outcome = await validatePiece(NEW_PIECE, { pieceId: ids.piece(2) });

    const url = new URL(lastRequest(fetchMock).url);
    expect(lastRequest(fetchMock).method).toBe("POST");
    expect(url.pathname).toBe("/api/v1/pieces/validate");
    expect(url.searchParams.get("piece_id")).toBe(ids.piece(2));
    expect(outcome).toEqual({ status: "ok", result: { is_valid: false, issues: [issue] } });
  });

  it("no envía piece_id al validar un alta", async () => {
    const fetchMock = useLive(async () => json(200, VALID_RESULT));

    await validatePiece(NEW_PIECE);

    expect(new URL(lastRequest(fetchMock).url).searchParams.has("piece_id")).toBe(false);
  });

  it("informa unavailable mientras el endpoint sea un stub 501", async () => {
    useLive(async () => json(501, { code: "not_implemented", message: "Stub.", change: "ficha-pieza-crud" }));

    const outcome = await validatePiece(NEW_PIECE);

    expect(outcome.status).toBe("unavailable");
  });

  it("aborta la petición cuando se cancela la señal", async () => {
    const fetchMock = useLive(
      (request) =>
        new Promise<Response>((_resolve, reject) => {
          request.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    const controller = new AbortController();

    const pending = validatePiece(NEW_PIECE, { signal: controller.signal });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(pending).resolves.toEqual({ status: "aborted" });
    expect(lastRequest(fetchMock).signal.aborted).toBe(true);
  });
});

describe("createPieceValidator (debounce y AbortController)", () => {
  it("agrupa cambios seguidos y valida una sola vez con el último valor", async () => {
    vi.useFakeTimers(FAKE_TIMERS);
    const fetchMock = useLive(async () => json(200, VALID_RESULT));
    const validator = createPieceValidator();

    const first = validator.validate({ ...NEW_PIECE, denomination: "A" });
    const second = validator.validate({ ...NEW_PIECE, denomination: "Ab" });
    const third = validator.validate({ ...NEW_PIECE, denomination: "Abc" });

    await vi.advanceTimersByTimeAsync(VALIDATION_DEBOUNCE_MS - 1);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    await expect(first).resolves.toEqual({ status: "aborted" });
    await expect(second).resolves.toEqual({ status: "aborted" });
    await expect(third).resolves.toMatchObject({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await lastRequest(fetchMock).clone().json()).toMatchObject({ denomination: "Abc" });
  });

  it("aborta la petición en vuelo cuando llega una validación nueva", async () => {
    vi.useFakeTimers(FAKE_TIMERS);
    const resolvers: Array<(response: Response) => void> = [];
    const fetchMock = useLive(
      (request) =>
        new Promise<Response>((resolve, reject) => {
          resolvers.push(resolve);
          request.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    const validator = createPieceValidator();

    const first = validator.validate({ ...NEW_PIECE, denomination: "Primera" });
    await vi.advanceTimersByTimeAsync(VALIDATION_DEBOUNCE_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const second = validator.validate({ ...NEW_PIECE, denomination: "Segunda" });
    await expect(first).resolves.toEqual({ status: "aborted" });
    expect(requestAt(fetchMock, 0).signal.aborted).toBe(true);

    await vi.advanceTimersByTimeAsync(VALIDATION_DEBOUNCE_MS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const respondSecond = resolvers[1];
    if (!respondSecond) throw new Error("La segunda petición no llegó a fetch");
    respondSecond(json(200, VALID_RESULT));

    await expect(second).resolves.toMatchObject({ status: "ok" });
    expect(requestAt(fetchMock, 1).signal.aborted).toBe(false);
  });

  it("cancel() descarta la validación pendiente sin llamar a la red", async () => {
    vi.useFakeTimers(FAKE_TIMERS);
    const fetchMock = useLive(async () => json(200, VALID_RESULT));
    const validator = createPieceValidator();

    const pending = validator.validate(NEW_PIECE);
    validator.cancel();
    await vi.advanceTimersByTimeAsync(VALIDATION_DEBOUNCE_MS * 2);

    await expect(pending).resolves.toEqual({ status: "aborted" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("en modo mock responde con la validación simulada tras la espera", async () => {
    vi.useFakeTimers(FAKE_TIMERS);
    const validator = createPieceValidator({ delayMs: 50 });

    const result = validator.validate({ denomination: "", tenure_regime: "Propiedad" });
    await vi.advanceTimersByTimeAsync(50);

    await expect(result).resolves.toMatchObject({ status: "ok", result: { is_valid: false } });
  });
});

describe("registerSplitIdentifiers (live)", () => {
  it("envía cada código con confirmed_split y el valor concatenado original en split_from (design D5)", async () => {
    const fetchMock = useLive(async (request) => {
      const body = (await request.clone().json()) as { identifier_type_code: string; value: string };
      return json(201, {
        id: crypto.randomUUID(),
        piece_id: ids.piece(1),
        identifier_type_code: body.identifier_type_code,
        original_value: body.value,
        normalized_value: body.value,
        normalization_status: "NORMALIZED",
        detected_format: null,
        is_current: true,
        is_locked: false,
        source: "manual",
        recorded_at: "2026-10-25T10:00:00Z",
        replaced_by_id: null,
        notes: null,
      });
    });

    const result = await registerSplitIdentifiers(
      ids.piece(1),
      [
        { identifier_type_code: "I", original_value: "I 2362", normalized_value: "I-2362" },
        { identifier_type_code: "COLECCION", original_value: "RA 28", normalized_value: "RA 28" },
      ],
      { splitFrom: "I 2362 / RA 28" },
    );

    expect(result.status).toBe("ok");
    const sent = await Promise.all([0, 1].map((index) => requestAt(fetchMock, index).json()));
    expect(sent).toEqual([
      expect.objectContaining({ value: "I 2362", confirmed_split: true, split_from: "I 2362 / RA 28" }),
      expect.objectContaining({ value: "RA 28", confirmed_split: true, split_from: "I 2362 / RA 28" }),
    ]);
  });
});
