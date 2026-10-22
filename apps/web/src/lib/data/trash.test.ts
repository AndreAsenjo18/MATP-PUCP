import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ids } from "@/lib/fixtures";

import { CONNECTION_MESSAGE } from "./audit";
import {
  blockerDestination,
  dayEndIso,
  dayStartIso,
  DATE_INVALID,
  DATE_RANGE_INVERTED,
  EMPTY_TRASH_FILTERS,
  fetchTrash,
  filterTrashEntries,
  hasActiveTrashFilters,
  isCalendarDate,
  mergePeople,
  NOT_DELETED_MESSAGE,
  parseRestoreBlockers,
  resetDemoTrash,
  restoreFromTrash,
  RESTORE_DEPENDENCY,
  RESTORE_FORBIDDEN_MESSAGE,
  TRASH_ENTITY_TYPES,
  TRASH_FORBIDDEN_MESSAGE,
  trashPeople,
  trashQuery,
  trashTypeLabel,
  validateDateRange,
  type RestoreBlocker,
  type TrashEntry,
} from "./trash";

// Modo `mock` es el valor por defecto sin NEXT_PUBLIC_API_MODE; `useLive` sustituye `fetch` por un
// simulacro (sin API real ni red) y fija la URL base, igual que en audit.test.ts.

const BASE_URL = "http://api.test";
const PIECE = ids.piece(901);
const MEDIA = ids.media(901);
const TERM = ids.term(901);

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

function blocker(partial: Partial<RestoreBlocker> = {}): RestoreBlocker {
  return { entityType: "piece", entityId: PIECE, label: "Retablo", message: "Restáurela primero.", ...partial };
}

function entry(partial: Partial<TrashEntry> = {}): TrashEntry {
  return {
    entity_type: "term",
    entity_id: TERM,
    entity_label: "Totora",
    type_label: "Término de vocabulario",
    deleted_at: "2026-10-14T16:20:00Z",
    deleted_by_id: ids.user(1),
    deleted_by_name: "Administrador MATP (sintético)",
    deletion_reason: "Duplicado del término Totora",
    ...partial,
  };
}

beforeEach(() => {
  resetDemoTrash();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("filtros de la papelera", () => {
  it("hay un nombre en español para cada tipo restaurable y se conserva el desconocido", () => {
    expect(TRASH_ENTITY_TYPES.map((type) => type.value)).toEqual([
      "piece",
      "piece_identifier",
      "media_asset",
      "collection",
      "term",
      "vocabulary",
      "location",
      "import_mapping_template",
    ]);
    expect(trashTypeLabel("media_asset")).toBe("Fotografía o documento");
    expect(trashTypeLabel("tabla_nueva")).toBe("tabla_nueva");
  });

  it("las fechas se interpretan en hora de Lima, sin depender del navegador", () => {
    expect(dayStartIso("2026-10-14")).toBe("2026-10-14T00:00:00-05:00");
    expect(dayEndIso("2026-10-14")).toBe("2026-10-14T23:59:59.999-05:00");
    expect(isCalendarDate("2026-10-14")).toBe(true);
    expect(isCalendarDate("14/10/2026")).toBe(false);
    expect(isCalendarDate("2026-13-45")).toBe(false);
  });

  it("valida el rango de fechas con mensajes en español", () => {
    expect(validateDateRange("", "")).toEqual({});
    expect(validateDateRange("2026-10-01", "2026-10-14")).toEqual({});
    expect(validateDateRange("2026-10-14", "2026-10-14")).toEqual({});
    expect(validateDateRange("2026-10-14", "2026-10-01")).toEqual({ to: DATE_RANGE_INVERTED });
    expect(validateDateRange("ayer", "")).toEqual({ from: DATE_INVALID });
  });

  it("detecta si hay filtros activos", () => {
    expect(hasActiveTrashFilters(EMPTY_TRASH_FILTERS)).toBe(false);
    expect(hasActiveTrashFilters({ ...EMPTY_TRASH_FILTERS, entityType: "piece" })).toBe(true);
  });

  it("arma los parámetros de GET /trash omitiendo los filtros vacíos", () => {
    expect(trashQuery(EMPTY_TRASH_FILTERS, 1, 20)).toEqual({
      entity_type: undefined,
      deleted_by: undefined,
      from: undefined,
      to: undefined,
      page: 1,
      page_size: 20,
    });
    expect(trashQuery({ entityType: "term", deletedBy: ids.user(1), from: "2026-10-01", to: "2026-10-14" }, 3, 20)).toEqual({
      entity_type: "term",
      deleted_by: ids.user(1),
      from: "2026-10-01T00:00:00-05:00",
      to: "2026-10-14T23:59:59.999-05:00",
      page: 3,
      page_size: 20,
    });
  });

  it("suma personas sin repetirlas y ordenadas por nombre", () => {
    const people = mergePeople([{ id: ids.user(2), name: "Gabriela" }], [
      { id: ids.user(1), name: "Administrador" },
      { id: ids.user(2), name: "Gabriela otra vez" },
      { id: null, name: "Sistema" },
    ]);

    expect(people).toEqual([
      { id: ids.user(1), name: "Administrador" },
      { id: ids.user(2), name: "Gabriela" },
    ]);
    expect(trashPeople([entry()])).toEqual([{ id: ids.user(1), name: "Administrador MATP (sintético)" }]);
  });
});

describe("a dónde lleva «Ir a»", () => {
  it("una dependencia eliminada se resuelve en la papelera", () => {
    expect(blockerDestination({ entity_type: "media_asset" }, blocker())).toEqual({ kind: "trash", entityType: "piece", entityId: PIECE });
    expect(blockerDestination({ entity_type: "term" }, blocker({ entityType: "vocabulary", entityId: ids.vocabulary(901) }))).toEqual({
      kind: "trash",
      entityType: "vocabulary",
      entityId: ids.vocabulary(901),
    });
  });

  it("una pieza que bloquea a otra pieza es el código I de una pieza activa: se abre su ficha", () => {
    expect(blockerDestination({ entity_type: "piece" }, blocker({ entityId: ids.piece(2) }))).toEqual({ kind: "piece", href: `/piezas/${ids.piece(2)}` });
  });

  it("sin identificador no hay a dónde ir", () => {
    expect(blockerDestination({ entity_type: "media_asset" }, blocker({ entityId: null }))).toEqual({ kind: "none" });
  });
});

describe("parseRestoreBlockers", () => {
  it("lee la lista completa del 409", () => {
    const blockers = parseRestoreBlockers({
      code: RESTORE_DEPENDENCY,
      message: "No se puede restaurar: la pieza «Retablo» (Pieza) también está eliminada. Restáurela primero.",
      details: {
        dependency_entity_type: "piece",
        dependency_entity_id: PIECE,
        blockers: [
          { dependency_entity_type: "piece", dependency_entity_id: PIECE, dependency_label: "Retablo", message: "Restáurela primero." },
          { dependency_entity_type: "collection", dependency_entity_id: ids.collection(1), dependency_label: "MMZ", message: "Restáurela también." },
        ],
      },
    });

    expect(blockers).toEqual([
      { entityType: "piece", entityId: PIECE, label: "Retablo", message: "Restáurela primero." },
      { entityType: "collection", entityId: ids.collection(1), label: "MMZ", message: "Restáurela también." },
    ]);
  });

  it("si falta la lista usa los campos dependency_* y el mensaje general", () => {
    const blockers = parseRestoreBlockers({
      code: RESTORE_DEPENDENCY,
      message: "Restaure primero la pieza.",
      details: { dependency_entity_type: "piece", dependency_entity_id: PIECE },
    });

    expect(blockers).toEqual([{ entityType: "piece", entityId: PIECE, label: "Pieza", message: "Restaure primero la pieza." }]);
  });

  it("un cuerpo sin dependencias da una lista vacía", () => {
    expect(parseRestoreBlockers({ code: RESTORE_DEPENDENCY, message: "x" })).toEqual([]);
    expect(parseRestoreBlockers(undefined)).toEqual([]);
  });
});

describe("papelera en modo mock", () => {
  it("lista los registros sintéticos sin llamar a la red, del más reciente al más antiguo", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchTrash(EMPTY_TRASH_FILTERS);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.data.total).toBe(result.data.entries.length);
      expect(result.data.entries[0]?.entity_label).toBe("Totora");
      const dates = result.data.entries.map((row) => row.deleted_at ?? "");
      expect(dates).toEqual([...dates].sort().reverse());
      expect(result.data.entries.every((row) => row.deletion_reason)).toBe(true);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("filtra por tipo, por quién eliminó y por rango de fechas", async () => {
    const all = await fetchTrash(EMPTY_TRASH_FILTERS);
    if (all.status !== "ok") throw new Error("la papelera de demostración debe estar disponible");

    const locations = await fetchTrash({ ...EMPTY_TRASH_FILTERS, entityType: "location" });
    const byManager = await fetchTrash({ ...EMPTY_TRASH_FILTERS, deletedBy: ids.user(2) });
    const october = await fetchTrash({ ...EMPTY_TRASH_FILTERS, from: "2026-10-01", to: "2026-10-31" });

    expect(locations.status === "ok" && locations.data.entries.every((row) => row.entity_type === "location")).toBe(true);
    expect(locations.status === "ok" && locations.data.total).toBe(2);
    expect(byManager.status === "ok" && byManager.data.entries.every((row) => row.deleted_by_id === ids.user(2))).toBe(true);
    expect(october.status === "ok" && october.data.entries.every((row) => (row.deleted_at ?? "") >= "2026-10-01")).toBe(true);
    expect(october.status === "ok" && october.data.total).toBeLessThan(all.data.total);
  });

  it("pagina los resultados", async () => {
    const first = await fetchTrash(EMPTY_TRASH_FILTERS, 1, 4);
    const second = await fetchTrash(EMPTY_TRASH_FILTERS, 2, 4);

    expect(first.status === "ok" && first.data.entries).toHaveLength(4);
    expect(second.status === "ok" && second.data.entries[0]?.entity_id).not.toBe(first.status === "ok" ? first.data.entries[0]?.entity_id : "");
    expect(second.status === "ok" && second.data.page).toBe(2);
  });

  it("filterTrashEntries usa el día completo en hora de Lima", () => {
    const rows = [entry({ deleted_at: "2026-10-14T04:59:59Z" }), entry({ entity_id: ids.term(2), deleted_at: "2026-10-14T05:00:00Z" })];

    // 04:59:59Z son las 23:59:59 del 13 en Lima; 05:00:00Z son las 00:00 del 14.
    expect(filterTrashEntries(rows, { ...EMPTY_TRASH_FILTERS, from: "2026-10-14" }).map((row) => row.entity_id)).toEqual([ids.term(2)]);
    expect(filterTrashEntries(rows, { ...EMPTY_TRASH_FILTERS, to: "2026-10-13" }).map((row) => row.entity_id)).toEqual([TERM]);
  });

  it("restaura un término cuyas dependencias están activas y lo saca de la lista", async () => {
    const outcome = await restoreFromTrash({ entity_type: "term", entity_id: TERM }, "Se eliminó por error");
    const after = await fetchTrash({ ...EMPTY_TRASH_FILTERS, entityType: "term" });

    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok") {
      expect(outcome.simulated).toBe(true);
      expect(outcome.result.entity_label).toBe("Totora");
      expect(outcome.result.previous_deletion_reason).toBe("Duplicado del término Totora");
    }
    expect(after.status === "ok" && after.data.entries.map((row) => row.entity_id)).not.toContain(TERM);
  });

  it("una foto cuya pieza sigue eliminada se rechaza indicando qué restaurar primero", async () => {
    const outcome = await restoreFromTrash({ entity_type: "media_asset", entity_id: MEDIA });

    expect(outcome.status).toBe("blocked");
    if (outcome.status === "blocked") {
      expect(outcome.blockers).toHaveLength(1);
      expect(outcome.blockers[0]).toMatchObject({ entityType: "piece", entityId: PIECE });
      expect(outcome.message).toContain("sigue en la papelera");
      expect(blockerDestination({ entity_type: "media_asset" }, outcome.blockers[0])).toEqual({ kind: "trash", entityType: "piece", entityId: PIECE });
    }
  });

  it("recorre el camino completo: bloqueo, ir a la pieza, restaurarla y luego la foto", async () => {
    const blocked = await restoreFromTrash({ entity_type: "media_asset", entity_id: MEDIA });
    if (blocked.status !== "blocked") throw new Error("la foto debía estar bloqueada");
    const destination = blockerDestination({ entity_type: "media_asset" }, blocked.blockers[0]);
    if (destination.kind !== "trash") throw new Error("la dependencia debía estar en la papelera");

    const listed = await fetchTrash({ ...EMPTY_TRASH_FILTERS, entityType: destination.entityType });
    expect(listed.status === "ok" && listed.data.entries.some((row) => row.entity_id === destination.entityId)).toBe(true);

    expect((await restoreFromTrash({ entity_type: destination.entityType, entity_id: destination.entityId })).status).toBe("ok");
    expect((await restoreFromTrash({ entity_type: "media_asset", entity_id: MEDIA })).status).toBe("ok");
  });

  it("restaurar dos veces el mismo registro avisa que ya no está en la papelera", async () => {
    await restoreFromTrash({ entity_type: "term", entity_id: TERM });

    const again = await restoreFromTrash({ entity_type: "term", entity_id: TERM });

    expect(again).toEqual({ status: "not_deleted", message: NOT_DELETED_MESSAGE });
  });

  it("un registro desconocido no existe", async () => {
    const outcome = await restoreFromTrash({ entity_type: "term", entity_id: ids.term(999) });

    expect(outcome.status).toBe("not_found");
  });
});

describe("papelera en modo live", () => {
  it("pide GET /trash con los filtros, en hora de Lima, y devuelve la página", async () => {
    const row = entry();
    const fetchMock = useLive(async () => json(200, { items: [row], total: 41, page: 2, page_size: 20 }));

    const result = await fetchTrash({ entityType: "term", deletedBy: ids.user(1), from: "2026-10-01", to: "2026-10-14" }, 2);

    const url = new URL(requestAt(fetchMock, 0).url);
    expect(requestAt(fetchMock, 0).method).toBe("GET");
    expect(url.pathname).toBe("/api/v1/trash");
    expect(url.searchParams.get("entity_type")).toBe("term");
    expect(url.searchParams.get("deleted_by")).toBe(ids.user(1));
    expect(url.searchParams.get("from")).toBe("2026-10-01T00:00:00-05:00");
    expect(url.searchParams.get("to")).toBe("2026-10-14T23:59:59.999-05:00");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("page_size")).toBe("20");
    expect(result).toEqual({ status: "ok", data: { entries: [row], total: 41, page: 2, pageSize: 20 } });
  });

  it("sin filtros no envía parámetros de filtro", async () => {
    const fetchMock = useLive(async () => json(200, { items: [], total: 0, page: 1, page_size: 20 }));

    await fetchTrash(EMPTY_TRASH_FILTERS);

    const url = new URL(requestAt(fetchMock, 0).url);
    expect([...url.searchParams.keys()].sort()).toEqual(["page", "page_size"]);
  });

  it("un 403 se traduce a «sin permiso para abrir la papelera»", async () => {
    useLive(async () => json(403, { code: "forbidden", message: "El rol no tiene el permiso requerido." }));

    expect(await fetchTrash(EMPTY_TRASH_FILTERS)).toEqual({ status: "forbidden", message: TRASH_FORBIDDEN_MESSAGE });
  });

  it("un fallo del servidor o de la conexión se informa sin lanzar", async () => {
    useLive(async () => json(500, { code: "internal_error", message: "Error interno." }));
    expect(await fetchTrash(EMPTY_TRASH_FILTERS)).toEqual({ status: "unavailable", message: "Error interno." });

    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    expect(await fetchTrash(EMPTY_TRASH_FILTERS)).toEqual({ status: "unavailable", message: CONNECTION_MESSAGE });
  });

  it("restaura con POST y envía el motivo solo si lo hay", async () => {
    const restored = { entity_type: "term", entity_id: TERM, entity_label: "Totora", type_label: "Término de vocabulario", restored: true, previous_deletion_reason: null };
    const fetchMock = useLive(async () => json(200, restored));

    const withReason = await restoreFromTrash({ entity_type: "term", entity_id: TERM }, "  Se eliminó por error  ");
    const withoutReason = await restoreFromTrash({ entity_type: "term", entity_id: TERM }, "   ");

    const first = requestAt(fetchMock, 0);
    expect(first.method).toBe("POST");
    expect(new URL(first.url).pathname).toBe(`/api/v1/trash/term/${TERM}/restore`);
    expect(new URL(first.url).searchParams.get("reason")).toBe("Se eliminó por error");
    expect(new URL(requestAt(fetchMock, 1).url).searchParams.has("reason")).toBe(false);
    expect(withReason).toEqual({ status: "ok", result: restored, simulated: false });
    expect(withoutReason.status).toBe("ok");
  });

  it("un 409 restore_dependency devuelve qué restaurar primero", async () => {
    useLive(async () =>
      json(409, {
        code: RESTORE_DEPENDENCY,
        message: "No se puede restaurar: la pieza «Retablo» (Pieza) también está eliminada. Restáurela primero.",
        details: {
          dependency_entity_type: "piece",
          dependency_entity_id: PIECE,
          dependency_label: "Retablo",
          blockers: [{ dependency_entity_type: "piece", dependency_entity_id: PIECE, dependency_label: "Retablo", message: "Restáurela primero." }],
        },
      }),
    );

    const outcome = await restoreFromTrash({ entity_type: "media_asset", entity_id: MEDIA });

    expect(outcome).toEqual({
      status: "blocked",
      message: "No se puede restaurar: la pieza «Retablo» (Pieza) también está eliminada. Restáurela primero.",
      blockers: [{ entityType: "piece", entityId: PIECE, label: "Retablo", message: "Restáurela primero." }],
    });
  });

  it("traduce los demás rechazos a mensajes en español llano", async () => {
    useLive(async () => json(409, { code: "not_deleted", message: "not_deleted" }));
    expect(await restoreFromTrash({ entity_type: "term", entity_id: TERM })).toEqual({ status: "not_deleted", message: NOT_DELETED_MESSAGE });

    vi.unstubAllGlobals();
    useLive(async () => json(403, { code: "admin_required", message: "x" }));
    expect(await restoreFromTrash({ entity_type: "term", entity_id: TERM })).toEqual({ status: "forbidden", message: RESTORE_FORBIDDEN_MESSAGE });

    vi.unstubAllGlobals();
    useLive(async () => json(404, { code: "not_found", message: "x" }));
    expect((await restoreFromTrash({ entity_type: "term", entity_id: TERM })).status).toBe("not_found");

    vi.unstubAllGlobals();
    useLive(async () => json(422, { code: "unknown_entity_type", message: "El tipo de entidad no se gestiona desde la papelera." }));
    expect(await restoreFromTrash({ entity_type: "otro", entity_id: TERM })).toEqual({
      status: "rejected",
      code: "unknown_entity_type",
      message: "El tipo de entidad no se gestiona desde la papelera.",
    });
  });

  it("recorre el camino completo contra la API: 409, restaurar la dependencia y reintentar", async () => {
    const blockedBody = {
      code: RESTORE_DEPENDENCY,
      message: "Restáurela primero.",
      details: { blockers: [{ dependency_entity_type: "piece", dependency_entity_id: PIECE, dependency_label: "Retablo", message: "Restáurela primero." }] },
    };
    let pieceRestored = false;
    const fetchMock = useLive(async (request) => {
      const path = new URL(request.url).pathname;
      if (path.endsWith(`/piece/${PIECE}/restore`)) {
        pieceRestored = true;
        return json(200, { entity_type: "piece", entity_id: PIECE, entity_label: "Retablo", type_label: "Pieza", restored: true, previous_deletion_reason: null });
      }
      if (path.endsWith(`/media_asset/${MEDIA}/restore`)) {
        return pieceRestored
          ? json(200, { entity_type: "media_asset", entity_id: MEDIA, entity_label: "foto.jpg", type_label: "Fotografía o documento", restored: true, previous_deletion_reason: null })
          : json(409, blockedBody);
      }
      return json(404, { code: "not_found", message: "x" });
    });

    const first = await restoreFromTrash({ entity_type: "media_asset", entity_id: MEDIA });
    if (first.status !== "blocked") throw new Error("debía estar bloqueada");
    const destination = blockerDestination({ entity_type: "media_asset" }, first.blockers[0]);
    if (destination.kind !== "trash") throw new Error("la dependencia debía estar en la papelera");
    await restoreFromTrash({ entity_type: destination.entityType, entity_id: destination.entityId });
    const retry = await restoreFromTrash({ entity_type: "media_asset", entity_id: MEDIA });

    expect(retry.status).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
