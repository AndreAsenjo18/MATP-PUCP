import { afterEach, describe, expect, it, vi } from "vitest";

import {
  acceptBlocker,
  associateImportImage,
  candidatePieces,
  changedSummary,
  confirmImportBatch,
  conflictingRows,
  decideImportRow,
  downloadImportLog,
  fetchImportDiffs,
  fieldAction,
  isProcessing,
  mappingRequest,
  batchStateText,
  plainMessage,
  progressStep,
  progressText,
  stageFraction,
  revertConflicts,
  rollbackImportBatch,
  suggestMapping,
  summarySentence,
  uploadImportFile,
  validationHint,
  wizardStep,
  type ApprovalSummary,
  type ImportRow,
} from "./imports";

// Modo `mock` por defecto; `useLive` sustituye `fetch` por un simulacro (sin API real ni red).

const BASE_URL = "http://api.test";
const DEV_USER = "curadora@matp.local";
const BATCH = "01920000-0000-7000-8000-000000000601";

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

function row(overrides: Partial<ImportRow> = {}): ImportRow {
  return {
    id: "row-1",
    batch_id: BATCH,
    source_row_number: 4,
    raw_data: { DENOMINACIÓN: "Retablo" },
    mapped_data: null,
    classification: "NEW",
    has_validation_errors: false,
    validation_errors: [],
    matches: [],
    diff: [],
    decision: "PENDING",
    decision_reason: null,
    target_piece_id: null,
    resolution: null,
    action: "CREATE",
    images: [],
    ...overrides,
  };
}

const SUMMARY: ApprovalSummary = { create: 70, update: 1, skip: 15, summary_token: "abc" };

describe("pasos del asistente según el estado del lote (RF-021)", () => {
  it("lleva cada estado a su paso", () => {
    expect(wizardStep(null)).toBe(0);
    expect(wizardStep({ status: "UPLOADED" })).toBe(1);
    expect(wizardStep({ status: "MAPPED" })).toBe(2);
    expect(wizardStep({ status: "IN_PREVIEW" })).toBe(3);
    expect(wizardStep({ status: "FAILED_APPLY" })).toBe(3);
    expect(wizardStep({ status: "APPROVED" })).toBe(4);
    expect(wizardStep({ status: "APPLIED" })).toBe(5);
    expect(wizardStep({ status: "FAILED_INGESTION" })).toBe(5);
  });

  it("consulta el avance mientras una etapa corre o el lote se aplica", () => {
    expect(isProcessing({ processing: true, status: "MAPPED" })).toBe(true);
    expect(isProcessing({ processing: false, status: "APPROVED" })).toBe(true);
    expect(isProcessing({ processing: false, status: "IN_PREVIEW" })).toBe(false);
  });

  it("explica el avance en filas", () => {
    expect(progressText({ stage: "VALIDATE", done: 1200, total: 8000 })).toMatch(/^Validando y buscando coincidencias: 1.?200 de 8.?000 filas$/);
    expect(progressText(null)).toBe("Procesando…");
  });
});

describe("mapeo sugerido por cabecera (RF-022)", () => {
  it("propone los campos habituales y deja el resto como dato de origen", () => {
    const columns = suggestMapping(["DENOMINACIÓN", "CÓDIGOS", "PROCEDENCIA", "ÉPOCA", "OBS. CONSULTORÍA"]);
    expect(columns.map((c) => c.target_field)).toEqual(["denomination", "identifier", "provenance", "epoch_original_text", null]);
    expect(columns[1].split_compound).toBe(true);
  });

  it("no repite un campo de la ficha en dos columnas", () => {
    const columns = suggestMapping(["Nombre", "Denominación"]);
    expect(columns.map((c) => c.target_field)).toEqual(["denomination", null]);
  });

  it("envía solo las columnas mapeadas y el régimen por defecto", () => {
    const body = mappingRequest(suggestMapping(["DENOMINACIÓN", "OBS"]), { sheetName: "SABANA", headerRow: 1, tenureDefault: "Propiedad" });
    expect(body.columns?.map((c) => c.source_column)).toEqual(["DENOMINACIÓN"]);
    expect(body.defaults).toEqual({ tenure_regime: "Propiedad" });
    expect(body.sheet_name).toBe("SABANA");
  });
});

describe("decisiones por fila (D5)", () => {
  it("una fila con errores o un conflicto sin resolver no se puede aceptar", () => {
    expect(acceptBlocker(row({ has_validation_errors: true }))).toMatch(/no se puede aceptar/);
    expect(acceptBlocker(row({ classification: "CONFLICT" }))).toMatch(/elija la pieza destino/);
    expect(acceptBlocker(row({ classification: "CONFLICT", resolution: { target_piece_id: "p-1" } }))).toBeNull();
    expect(acceptBlocker(row({ classification: "POSSIBLE_DUPLICATE", resolution: { as_new: true } }))).toBeNull();
    expect(acceptBlocker(row())).toBeNull();
  });

  it("lista las piezas candidatas con el motivo y las filas en conflicto", () => {
    const conflict = row({
      matches: [
        { kind: "piece", piece_id: "p-1", identifiers: [{ identifier_type: "I", value: "I-0236", via: "current" }] },
        { kind: "similar_piece", piece_id: "p-2", score: 0.82 },
        { kind: "batch_row", row_number: 7, identifier_type: "I", value: "I-0236" },
      ],
    });
    const candidates = candidatePieces(conflict);
    expect(candidates.map((candidate) => [candidate.pieceId, candidate.reason])).toEqual([
      ["p-1", "Mismo código: I-0236 (vigente)"],
      ["p-2", "Se parece 82 %"],
    ]);
    expect(conflictingRows(conflict)).toEqual([7]);
  });

  it("distingue a los candidatos por denominación, colección y código I", () => {
    const toro = { denomination: "Toro de Pucará", available: true };
    const conflict = row({
      matches: [
        { kind: "piece", piece_id: "p-1", identifiers: [{ identifier_type: "I", value: "I-0236", via: "current" }], ...toro, collection_name: "Cerámica de Puno", inventory_code: "I-0236" },
        { kind: "similar_piece", piece_id: "p-2", score: 0.9, ...toro, collection_name: "Colección Cusco", inventory_code: null },
      ],
    });

    const [first, second] = candidatePieces(conflict);

    expect(first.label).toBe("Toro de Pucará · Cerámica de Puno · Código I-0236 — Mismo código: I-0236 (vigente)");
    expect(second.label).toBe("Toro de Pucará · Colección Cusco · Sin código I — Se parece 90 %");
    expect(first.label).not.toBe(second.label);
  });

  it("no repite una pieza que coincide por dos vías y junta sus motivos", () => {
    const conflict = row({
      matches: [
        { kind: "piece", piece_id: "p-1", identifiers: [{ identifier_type: "I", value: "I-0236", via: "current" }], denomination: "Retablo", collection_name: "Ayacucho", inventory_code: "I-0236", available: true },
        { kind: "similar_piece", piece_id: "p-1", score: 0.8, denomination: "Retablo", collection_name: "Ayacucho", inventory_code: "I-0236", available: true },
      ],
    });

    const candidates = candidatePieces(conflict);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].reason).toBe("Mismo código: I-0236 (vigente); Se parece 80 %");
  });

  it("si dos piezas distintas se ven idénticas añade el final de su identificador, porque el principio es la fecha", () => {
    const same = { denomination: "Máscara", collection_name: "Sin clasificar", inventory_code: null, available: true };
    const conflict = row({
      matches: [
        { kind: "similar_piece", piece_id: "aaaaaaaa-1111", score: 0.8, ...same },
        { kind: "similar_piece", piece_id: "bbbbbbbb-2222", score: 0.8, ...same },
      ],
    });

    const [first, second] = candidatePieces(conflict);

    expect(first.label).toContain("(n.º a-1111)");
    expect(second.label).toContain("(n.º b-2222)");
  });

  it("una pieza que ya no está en el catálogo se muestra como no disponible", () => {
    const conflict = row({ matches: [{ kind: "piece", piece_id: "p-9", identifiers: [{ identifier_type: "I", value: "I-1", via: "current" }], available: false, denomination: null }] });

    const [candidate] = candidatePieces(conflict);

    expect(candidate.available).toBe(false);
    expect(candidate.label).toContain("Pieza no disponible · ya no está en el catálogo");
  });

  it("una celda vacía conserva el valor actual salvo que la persona lo acepte [B10]", () => {
    expect(fieldAction(row(), "author", "keep")).toBe("exclude");
    expect(fieldAction(row(), "provenance", "accept")).toBe("accept");
    expect(fieldAction(row({ resolution: { field_decisions: { author: "accept" } } }), "author", "keep")).toBe("accept");
  });

  it("resume la aprobación en lenguaje claro (RNF-010)", () => {
    expect(summarySentence(SUMMARY)).toBe("Se crearán 70 piezas nuevas, se actualizarán 1 pieza y 15 filas no se aplicarán.");
  });
});

describe("modo mock", () => {
  it("no simula guardar: responde que necesita la API", async () => {
    const result = await decideImportRow(BATCH, "row-1", { decision: "ACCEPTED" });
    expect(result.status).toBe("unavailable");
  });
});

describe("modo live", () => {
  it("sube el archivo como formulario con la identidad de la sesión", async () => {
    const fetchMock = useLive(async () => json(202, { batch_id: BATCH, filename: "sabana.xlsx", total_rows: 0, summary: { new_records: 0, updates: 0, conflicts: 0 }, status: "UPLOADED" }));

    const result = await uploadImportFile(new Blob(["A;B\n"]), "sabana.csv", DEV_USER);

    expect(result.status).toBe("ok");
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toBe(`${BASE_URL}/api/v1/imports/upload`);
    expect(request.headers.get("X-MATP-User")).toBe(DEV_USER);
    const form = await request.formData();
    expect((form.get("file") as File).name).toBe("sabana.csv");
  });

  it("envía la decisión con la resolución y traduce el 422", async () => {
    const fetchMock = useLive(async () => json(422, { code: "conflict_unresolved", message: "x", details: {} }));

    const result = await decideImportRow(BATCH, "row-1", { decision: "ACCEPTED", targetPieceId: "p-1", fieldDecisions: { author: "exclude" } }, DEV_USER);

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.method).toBe("PATCH");
    expect(await request.json()).toEqual({ decision: "ACCEPTED", reason: null, target_piece_id: "p-1", as_new: false, field_decisions: { author: "exclude" } });
    expect(result).toMatchObject({ status: "rejected", code: "conflict_unresolved", message: expect.stringContaining("elija la pieza destino") });
  });

  it("aprueba con el summary_token y devuelve el resumen actual si cambió", async () => {
    const current = { create: 69, update: 1, skip: 16, summary_token: "nuevo" };
    const fetchMock = useLive(async () => json(409, { code: "summary_changed", message: "x", details: { summary: current } }));

    const result = await confirmImportBatch(BATCH, SUMMARY, "Revisado", DEV_USER);

    const body = await (fetchMock.mock.calls[0][0] as Request).json();
    expect(body).toEqual({ summary_token: "abc", confirm_counts: { create: 70, update: 1, skip: 15 }, comment: "Revisado" });
    expect(result.status).toBe("rejected");
    if (result.status !== "ok") expect(changedSummary(result)).toEqual(current);
  });

  it("lee la previsualización con filtros, reglas e imágenes sin fila", async () => {
    const fetchMock = useLive(async () =>
      json(200, { items: [row()], total: 1, page: 1, page_size: 25, classification_rules: [{ order: 1, result: "NEW", description: "d" }], unassigned_images: [{ id: "img-3" }] }),
    );

    const result = await fetchImportDiffs(BATCH, { classification: "CONFLICT", onlyErrors: false }, DEV_USER);

    const url = new URL((fetchMock.mock.calls[0][0] as Request).url);
    expect(url.searchParams.get("classification")).toBe("CONFLICT");
    expect(result.status === "ok" && result.value.unassignedImages[0].id).toBe("img-3");
    expect(result.status === "ok" && result.value.rules).toHaveLength(1);
  });

  it("descarga la bitácora en Excel con la identidad de la sesión", async () => {
    const fetchMock = useLive(async () => new Response(new Blob(["xlsx"]), { status: 200, headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } }));

    const result = await downloadImportLog(BATCH, DEV_USER);

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(new URL(request.url).searchParams.get("format")).toBe("xlsx");
    expect(request.headers.get("X-MATP-User")).toBe(DEV_USER);
    expect(result.status === "ok" && (await result.value.text())).toBe("xlsx");
  });

  it("asocia una imagen y explica el 409 antes de aplicar", async () => {
    useLive(async () => json(409, { code: "batch_not_applied", message: "x", details: {} }));

    const result = await associateImportImage(BATCH, "img-1", null, DEV_USER);

    expect(result).toMatchObject({ status: "rejected", message: expect.stringContaining("después de aplicar el lote") });
  });

  it("revierte un lote con motivo y lee los conflictos de un 409", async () => {
    const conflict = { entity_type: "piece", entity_id: "p-1", field: "provenance", reason: "changed_after", message: "Cambió después." };
    const fetchMock = useLive(async () => json(409, { code: "revert_has_conflicts", message: "Hay cambios posteriores.", details: { conflicts: [conflict] } }));

    const result = await rollbackImportBatch(BATCH, "  Hoja equivocada ", false, DEV_USER);

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(new URL(request.url).pathname).toBe(`/api/v1/imports/${BATCH}/rollback`);
    expect(await request.json()).toEqual({ reason: "Hoja equivocada", confirm_conflicts: false });
    expect(result.status).toBe("rejected");
    if (result.status !== "ok") {
      expect(revertConflicts(result)).toEqual([{ entityType: "piece", entityId: "p-1", field: "provenance", message: "Cambió después." }]);
    }
  });

  it("otros fallos de la reversión no traen conflictos", async () => {
    useLive(async () => json(403, { code: "admin_required", message: "x", details: {} }));

    const result = await rollbackImportBatch(BATCH, "Motivo", true, DEV_USER);

    expect(result.status === "rejected" && result.message).toBe("Solo un Administrador puede revertir un lote.");
    if (result.status !== "ok") expect(revertConflicts(result)).toBeNull();
  });
});

describe("lenguaje llano en los mensajes", () => {
  it("quita las referencias a requisitos entre paréntesis y deja el resto", () => {
    expect(plainMessage("El código I no cambia en una importación (RN-002).")).toBe("El código I no cambia en una importación.");
    expect(plainMessage("Resumen del lote (RF-027, RNF-010) listo")).toBe("Resumen del lote listo");
  });

  it("quita una referencia suelta y no toca un mensaje sin ellas", () => {
    expect(plainMessage("Falta el régimen según RN-003 para la fila")).toBe("Falta el régimen según para la fila");
    expect(plainMessage("Falta el régimen de tenencia.")).toBe("Falta el régimen de tenencia.");
  });

  it("los errores de la API llegan sin identificadores de requisitos", async () => {
    useLive(async () => json(422, { code: "otro_error", message: "No se puede (RN-005).", details: {} }));

    const result = await rollbackImportBatch(BATCH, "Motivo", false, DEV_USER);

    expect(result.status === "rejected" && result.message).toBe("No se puede.");
  });
});

describe("avance en cuatro pasos", () => {
  it("agrupa los estados del lote en Archivo, Revisión, Aprobación y Resultado", () => {
    expect(progressStep(null)).toBe(0);
    expect(progressStep({ status: "UPLOADED" })).toBe(0);
    expect(progressStep({ status: "VALIDATED" })).toBe(0);
    expect(progressStep({ status: "IN_PREVIEW" })).toBe(1);
    expect(progressStep({ status: "FAILED_APPLY" })).toBe(1);
    expect(progressStep({ status: "APPROVED" })).toBe(2);
    expect(progressStep({ status: "APPLIED" })).toBe(3);
    expect(progressStep({ status: "ABANDONED" })).toBe(3);
    // Un archivo que no se pudo leer se queda en el primer paso.
    expect(progressStep({ status: "FAILED_INGESTION" })).toBe(0);
  });

  it("dice el estado en palabras de todos los días y, en curso, el avance en filas", () => {
    expect(batchStateText({ status: "IN_PREVIEW", processing: false, progress: null })).toBe("Listo para revisar");
    expect(batchStateText({ status: "UPLOADED", processing: true, progress: { stage: "VALIDATE", done: 1200, total: 8000 } })).toContain("de 8");
  });

  it("calcula la fracción de la etapa en curso y la omite si no hay total", () => {
    expect(stageFraction({ stage: "VALIDATE", done: 50, total: 200 })).toBe(0.25);
    expect(stageFraction({ stage: "INGEST", done: 5 })).toBeNull();
    expect(stageFraction(null)).toBeNull();
  });
});

describe("sugerencias para los errores de validación", () => {
  it("el régimen faltante ofrece la acción de asignarlo", () => {
    expect(validationHint("tenure_required")?.action).toBe("assign_tenure");
  });

  it("los demás códigos conocidos traen una sugerencia sin acción y los desconocidos, nada", () => {
    expect(validationHint("invalid_inventory_code")?.hint).toContain("Corrija esa celda");
    expect(validationHint("invalid_inventory_code")?.action).toBeUndefined();
    expect(validationHint("otro")).toBeNull();
    expect(validationHint(undefined)).toBeNull();
  });
});
