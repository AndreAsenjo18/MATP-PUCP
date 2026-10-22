import { afterEach, describe, expect, it, vi } from "vitest";

import { ids } from "@/lib/fixtures";

import { CONNECTION_MESSAGE, toEntryView, type AuditEntryView } from "./audit";
import {
  AUDIT_DETAIL_PAGE_SIZE,
  AUDIT_FORBIDDEN_MESSAGE,
  AUDIT_PAGE_SIZE,
  auditCsvUrl,
  auditEntityLabel,
  auditQuery,
  csvDownloadAvailable,
  EMPTY_AUDIT_FILTERS,
  fetchAuditChangeSets,
  fetchAuditEntries,
  filterAuditEntries,
  filterChangeSets,
  hasActiveAuditFilters,
  isUuid,
  UUID_INVALID,
  validateAuditFilters,
  type AuditQueryFilters,
} from "./audit-query";

// Modo `mock`: la pantalla pasa las filas de la sesión de demostración en `demoEntries` y no hay
// red. Modo `live`: se activa con `useLive`, que sustituye `fetch` por un simulacro y fija la URL
// base, igual que en audit.test.ts.

const BASE_URL = "http://api.test";
const SET_A = ids.changeSet(1);
const SET_B = ids.changeSet(2);
const SET_C = ids.changeSet(3);

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

function filters(partial: Partial<AuditQueryFilters> = {}): AuditQueryFilters {
  return { ...EMPTY_AUDIT_FILTERS, ...partial };
}

function entry(partial: Partial<AuditEntryView> & { id: string; change_set_id: string }): AuditEntryView {
  return toEntryView({
    entity_type: "piece",
    entity_id: ids.piece(1),
    action: "UPDATE",
    field: "provenance",
    old_value: "Ayacucho",
    new_value: "Huancavelica",
    occurred_at: "2026-09-17T10:30:00Z",
    user_id: ids.user(2),
    actor_label: "Gabriela Curadora (sintética)",
    origin: "MANUAL",
    origin_ref: null,
    reason: null,
    ...partial,
  } as AuditEntryView);
}

const DEMO: AuditEntryView[] = [
  entry({ id: ids.audit(1), change_set_id: SET_A, occurred_at: "2026-09-17T10:30:00Z" }),
  entry({ id: ids.audit(2), change_set_id: SET_A, field: "author", occurred_at: "2026-09-17T10:31:00Z" }),
  entry({
    id: ids.audit(3),
    change_set_id: SET_B,
    entity_type: "piece_identifier",
    entity_id: ids.identifier(108),
    action: "CORRECTION",
    field: "is_current",
    occurred_at: "2026-10-01T09:15:00Z",
    user_id: ids.user(1),
    actor_label: "Administrador MATP (sintético)",
  }),
  entry({
    id: ids.audit(4),
    change_set_id: SET_C,
    entity_id: ids.piece(14),
    action: "CREATE",
    field: null,
    origin: "IMPORT",
    origin_ref: "Lote de importación 2026-09-10 (sintético)",
    occurred_at: "2026-09-10T09:00:00Z",
    user_id: ids.user(3),
    actor_label: "Practicante Catalogador (sintético)",
  }),
  entry({ id: ids.audit(5), change_set_id: ids.changeSet(4), action: "REVERT", origin_ref: SET_A, occurred_at: "2026-10-05T12:00:00Z" }),
];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("filtros de la consulta de auditoría", () => {
  it("nombra los tipos de registro como los escribe la API y conserva los desconocidos", () => {
    expect(auditEntityLabel("piece", 1)).toBe("pieza");
    expect(auditEntityLabel("piece", 54)).toBe("piezas");
    expect(auditEntityLabel("media_asset", 2)).toBe("fotografías o documentos");
    expect(auditEntityLabel("term", 1)).toBe("término de vocabulario");
    expect(auditEntityLabel("piece_media", 1)).toBe("fotografía o documento");
    expect(auditEntityLabel("tabla_nueva", 3)).toBe("registros de tipo tabla_nueva");
  });

  it("valida los identificadores y el rango de fechas antes de enviarlos", () => {
    expect(isUuid(SET_A)).toBe(true);
    expect(isUuid("01920000-0000-7000-8000-000000000A00")).toBe(true);
    expect(isUuid("12345")).toBe(false);
    expect(validateAuditFilters(filters())).toEqual({});
    expect(validateAuditFilters(filters({ changeSetId: SET_A, entityId: ids.piece(1), from: "2026-09-01", to: "2026-09-30" }))).toEqual({});
    expect(validateAuditFilters(filters({ changeSetId: "abc", entityId: "xyz", from: "2026-10-02", to: "2026-10-01" }))).toEqual({
      changeSetId: UUID_INVALID,
      entityId: UUID_INVALID,
      to: expect.stringContaining("no puede ser anterior"),
    });
  });

  it("detecta si hay filtros activos, sin contar los espacios", () => {
    expect(hasActiveAuditFilters(EMPTY_AUDIT_FILTERS)).toBe(false);
    expect(hasActiveAuditFilters(filters({ originRef: "   " }))).toBe(false);
    expect(hasActiveAuditFilters(filters({ origin: "IMPORT" }))).toBe(true);
  });

  it("arma los parámetros de GET /audit-logs omitiendo los vacíos y usando hora de Lima", () => {
    expect(auditQuery(EMPTY_AUDIT_FILTERS)).toEqual({
      entity_type: undefined,
      origin: undefined,
      action: undefined,
      origin_ref: undefined,
      change_set_id: undefined,
      entity_id: undefined,
      user_id: undefined,
      occurred_from: undefined,
      occurred_to: undefined,
    });
    expect(
      auditQuery(
        filters({ entityType: "piece", origin: "IMPORT", action: "CREATE", originRef: " lote-1 ", userId: ids.user(3), from: "2026-09-01", to: "2026-09-30" }),
      ),
    ).toMatchObject({
      entity_type: "piece",
      origin: "IMPORT",
      action: "CREATE",
      origin_ref: "lote-1",
      user_id: ids.user(3),
      occurred_from: "2026-09-01T00:00:00-05:00",
      occurred_to: "2026-09-30T23:59:59.999-05:00",
    });
  });
});

describe("exportación a CSV", () => {
  it("el enlace lleva los filtros activos y pide al servidor el CSV agrupado", () => {
    vi.stubEnv("API_INTERNAL_URL", `${BASE_URL}/`);

    const url = new URL(auditCsvUrl(filters({ origin: "IMPORT", originRef: ids.importBatch(1), from: "2026-09-01" }), "change_sets"));

    expect(`${url.origin}${url.pathname}`).toBe(`${BASE_URL}/api/v1/audit-logs`);
    expect(url.searchParams.get("format")).toBe("csv");
    expect(url.searchParams.get("group_by")).toBe("change_set");
    expect(url.searchParams.get("origin")).toBe("IMPORT");
    expect(url.searchParams.get("origin_ref")).toBe(ids.importBatch(1));
    expect(url.searchParams.get("occurred_from")).toBe("2026-09-01T00:00:00-05:00");
    expect(url.searchParams.has("page")).toBe(false);
  });

  it("la descarga campo por campo no agrupa y sin filtros solo pide el formato", () => {
    vi.stubEnv("API_INTERNAL_URL", BASE_URL);

    const url = new URL(auditCsvUrl(EMPTY_AUDIT_FILTERS, "entries"));

    expect([...url.searchParams.keys()]).toEqual(["format"]);
    expect(url.searchParams.get("format")).toBe("csv");
  });

  it("solo hay descarga cuando hay servidor (modo live)", () => {
    expect(csvDownloadAvailable()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
    expect(csvDownloadAvailable()).toBe(true);
  });

  it("construir el enlace no llama a la red", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    auditCsvUrl(EMPTY_AUDIT_FILTERS, "entries");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("consulta en modo mock", () => {
  it("filtra las filas por tipo, origen, acción, persona, lote y fechas", () => {
    const ids_of = (rows: AuditEntryView[]) => rows.map((row) => row.id);

    expect(ids_of(filterAuditEntries(DEMO, filters({ entityType: "piece_identifier" })))).toEqual([ids.audit(3)]);
    expect(ids_of(filterAuditEntries(DEMO, filters({ origin: "IMPORT" })))).toEqual([ids.audit(4)]);
    expect(ids_of(filterAuditEntries(DEMO, filters({ action: "REVERT" })))).toEqual([ids.audit(5)]);
    expect(ids_of(filterAuditEntries(DEMO, filters({ userId: ids.user(1) })))).toEqual([ids.audit(3)]);
    expect(ids_of(filterAuditEntries(DEMO, filters({ originRef: "lote de importación" })))).toEqual([ids.audit(4)]);
    expect(ids_of(filterAuditEntries(DEMO, filters({ changeSetId: SET_A })))).toEqual([ids.audit(1), ids.audit(2)]);
    expect(ids_of(filterAuditEntries(DEMO, filters({ from: "2026-10-01" })))).toEqual([ids.audit(3), ids.audit(5)]);
    expect(ids_of(filterAuditEntries(DEMO, filters({ to: "2026-09-17" })))).toEqual([ids.audit(1), ids.audit(2), ids.audit(4)]);
  });

  it("resume el conjunto completo aunque el filtro solo alcance parte de él, y conserva la marca de revertido", () => {
    const [set] = filterChangeSets(DEMO, filters({ entityType: "piece", from: "2026-09-17", to: "2026-09-17", origin: "MANUAL" }));

    expect(set.change_set_id).toBe(SET_A);
    expect(set.field_count).toBe(2);
    expect(set.reverted).toBe(true);
  });

  it("devuelve los conjuntos paginados sin llamar a la red", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const first = await fetchAuditChangeSets({ filters: EMPTY_AUDIT_FILTERS, page: 1, pageSize: 2, demoEntries: DEMO });
    const second = await fetchAuditChangeSets({ filters: EMPTY_AUDIT_FILTERS, page: 2, pageSize: 2, demoEntries: DEMO });

    expect(first.status === "ok" && first.total).toBe(4);
    expect(first.status === "ok" && first.changeSets).toHaveLength(2);
    expect(second.status === "ok" && second.changeSets.map((set) => set.change_set_id)).not.toEqual(
      first.status === "ok" ? first.changeSets.map((set) => set.change_set_id) : [],
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("el detalle de un conjunto trae sus filas, de la más reciente a la más antigua", async () => {
    const result = await fetchAuditEntries({ filters: filters({ changeSetId: SET_A }), page: 1, pageSize: AUDIT_DETAIL_PAGE_SIZE, demoEntries: DEMO });

    expect(result).toMatchObject({ status: "ok", total: 2 });
    if (result.status === "ok") expect(result.entries.map((row) => row.id)).toEqual([ids.audit(2), ids.audit(1)]);
  });
});

describe("consulta en modo live", () => {
  it("pide los conjuntos agrupados con los filtros y la página", async () => {
    const summary = { change_set_id: SET_C, entity_counts: { piece: 54 }, entity_count: 54, field_count: 486, origin: "IMPORT", actions: ["CREATE"], reverted: false };
    const fetchMock = useLive(async () => json(200, { change_sets: [summary], items: [], total: 41, page: 2, page_size: AUDIT_PAGE_SIZE }));

    const result = await fetchAuditChangeSets({ filters: filters({ origin: "IMPORT", originRef: ids.importBatch(1) }), page: 2, pageSize: AUDIT_PAGE_SIZE });

    const url = new URL(requestAt(fetchMock, 0).url);
    expect(requestAt(fetchMock, 0).method).toBe("GET");
    expect(url.pathname).toBe("/api/v1/audit-logs");
    expect(url.searchParams.get("group_by")).toBe("change_set");
    expect(url.searchParams.get("origin")).toBe("IMPORT");
    expect(url.searchParams.get("origin_ref")).toBe(ids.importBatch(1));
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("page_size")).toBe(String(AUDIT_PAGE_SIZE));
    expect(url.searchParams.has("format")).toBe(false);
    expect(result).toEqual({ status: "ok", changeSets: [summary], total: 41 });
  });

  it("el detalle pide las filas del conjunto sin agrupar y deja pasar los valores enmascarados", async () => {
    const masked = { id: ids.audit(1), change_set_id: SET_A, field: "lender_name", old_value: null, new_value: null, values_masked: true };
    const fetchMock = useLive(async () => json(200, { items: [masked], total: 120, page: 1, page_size: AUDIT_DETAIL_PAGE_SIZE }));

    const result = await fetchAuditEntries({ filters: filters({ changeSetId: SET_A }), page: 1, pageSize: AUDIT_DETAIL_PAGE_SIZE });

    const url = new URL(requestAt(fetchMock, 0).url);
    expect(url.searchParams.get("change_set_id")).toBe(SET_A);
    expect(url.searchParams.has("group_by")).toBe(false);
    expect(url.searchParams.get("page_size")).toBe(String(AUDIT_DETAIL_PAGE_SIZE));
    expect(result).toEqual({ status: "ok", entries: [masked], total: 120 });
  });

  it("un 403 se traduce a «sin permiso para consultar la auditoría»", async () => {
    useLive(async () => json(403, { code: "forbidden", message: "El rol no tiene el permiso requerido." }));

    expect(await fetchAuditChangeSets({ filters: EMPTY_AUDIT_FILTERS, page: 1, pageSize: 20 })).toEqual({ status: "forbidden", message: AUDIT_FORBIDDEN_MESSAGE });
    expect(await fetchAuditEntries({ filters: EMPTY_AUDIT_FILTERS, page: 1, pageSize: 20 })).toEqual({ status: "forbidden", message: AUDIT_FORBIDDEN_MESSAGE });
  });

  it("un fallo del servidor o de la conexión se informa sin lanzar", async () => {
    useLive(async () => json(500, { code: "internal_error", message: "Error interno." }));
    expect(await fetchAuditChangeSets({ filters: EMPTY_AUDIT_FILTERS, page: 1, pageSize: 20 })).toEqual({ status: "unavailable", message: "Error interno." });

    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    expect(await fetchAuditEntries({ filters: EMPTY_AUDIT_FILTERS, page: 1, pageSize: 20 })).toEqual({ status: "unavailable", message: CONNECTION_MESSAGE });
  });
});
