import { afterEach, describe, expect, it, vi } from "vitest";

import { ids } from "@/lib/fixtures";

import {
  ALREADY_REVERTED,
  buildMockRevertPreview,
  CONFLICTS_NOT_CONFIRMED_MESSAGE,
  confirmRevert,
  entriesByChangeSet,
  fetchPieceAuditTrail,
  groupEntriesIntoChangeSets,
  MOVEMENT_NOTE,
  PLAN_CHANGED_MESSAGE,
  previewRevert,
  REVERT_HAS_CONFLICTS,
  REVERT_PLAN_CHANGED,
  toEntryView,
  type AuditEntryView,
} from "./audit";

// Modo `mock` es el valor por defecto sin NEXT_PUBLIC_API_MODE; `useLive` sustituye `fetch` por un
// simulacro (sin API real ni red) y fija la URL base, igual que en pieces-write.test.ts.

const BASE_URL = "http://api.test";
const SET_A = ids.changeSet(1);
const SET_B = ids.changeSet(2);
const PIECE = ids.piece(1);

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

function entry(partial: Partial<AuditEntryView> & { id: string; change_set_id: string }): AuditEntryView {
  return toEntryView({
    entity_type: "piece",
    entity_id: PIECE,
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

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("groupEntriesIntoChangeSets", () => {
  it("resume cada conjunto con su alcance, campos, actor y motivo", () => {
    const [recent, older] = groupEntriesIntoChangeSets([
      entry({ id: ids.audit(1), change_set_id: SET_A, field: "provenance", reason: "Corrección según el libro" }),
      entry({ id: ids.audit(2), change_set_id: SET_A, field: "author", occurred_at: "2026-09-17T10:31:00Z" }),
      entry({ id: ids.audit(3), change_set_id: SET_A, entity_type: "piece_identifier", entity_id: ids.identifier(108), field: "is_current" }),
      entry({ id: ids.audit(4), change_set_id: SET_B, action: "CREATE", field: null, occurred_at: "2026-09-18T08:00:00Z", origin: "IMPORT" }),
    ]);

    expect(recent.change_set_id).toBe(SET_B);
    expect(recent.origin).toBe("IMPORT");
    expect(recent.field_count).toBe(0);
    expect(older.change_set_id).toBe(SET_A);
    expect(older.actions).toEqual(["UPDATE"]);
    expect(older.actor_label).toBe("Gabriela Curadora (sintética)");
    expect(older.reason).toBe("Corrección según el libro");
    expect(older.entity_counts).toEqual({ piece: 1, piece_identifier: 1 });
    expect(older.entity_count).toBe(2);
    expect(older.field_count).toBe(3);
    expect(older.occurred_at).toBe("2026-09-17T10:30:00Z");
    expect(older.last_occurred_at).toBe("2026-09-17T10:31:00Z");
    expect(older.reverted).toBe(false);
  });

  it("marca como revertido el conjunto que otra entrada de reversión referencia", () => {
    const sets = groupEntriesIntoChangeSets([
      entry({ id: ids.audit(1), change_set_id: SET_A }),
      entry({ id: ids.audit(2), change_set_id: SET_B, action: "REVERT", origin_ref: SET_A, reason: "Se aplicó al lote equivocado" }),
    ]);
    const original = sets.find((set) => set.change_set_id === SET_A);
    const reversion = sets.find((set) => set.change_set_id === SET_B);

    expect(original?.reverted).toBe(true);
    expect(original?.reverted_by_change_set_id).toBe(SET_B);
    expect(reversion?.reverted).toBe(false);
  });

  it("entriesByChangeSet ordena las filas de cada conjunto de la más antigua a la más reciente", () => {
    const grouped = entriesByChangeSet([
      entry({ id: ids.audit(2), change_set_id: SET_A, occurred_at: "2026-09-17T10:31:00Z" }),
      entry({ id: ids.audit(1), change_set_id: SET_A, occurred_at: "2026-09-17T10:30:00Z" }),
    ]);

    expect(grouped[SET_A]?.map((row) => row.id)).toEqual([ids.audit(1), ids.audit(2)]);
  });
});

describe("fetchPieceAuditTrail", () => {
  it("en modo mock agrupa los fixtures sin llamar a la red", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchPieceAuditTrail(PIECE);

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.trail.changeSets.length).toBeGreaterThan(0);
      expect(result.trail.entries.every((row) => row.values_masked === false)).toBe(true);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("en modo live pide los conjuntos agrupados y las filas de la pieza", async () => {
    const fetchMock = useLive(async (request) =>
      new URL(request.url).searchParams.has("group_by")
        ? json(200, { change_sets: [{ change_set_id: SET_A, entity_counts: { piece: 1 } }], items: [], total: 3, page: 1, page_size: 50 })
        : json(200, { items: [{ id: ids.audit(1), change_set_id: SET_A, values_masked: true }], total: 1, page: 1, page_size: 100 }),
    );

    const result = await fetchPieceAuditTrail(PIECE);

    const grouped = new URL(requestAt(fetchMock, 0).url);
    expect(grouped.pathname).toBe("/api/v1/audit-logs");
    expect(grouped.searchParams.get("group_by")).toBe("change_set");
    expect(grouped.searchParams.get("entity_id")).toBe(PIECE);
    expect(grouped.searchParams.get("page_size")).toBe("50");
    expect(new URL(requestAt(fetchMock, 1).url).searchParams.has("group_by")).toBe(false);
    expect(result).toEqual({
      status: "ok",
      trail: {
        changeSets: [{ change_set_id: SET_A, entity_counts: { piece: 1 } }],
        entries: [{ id: ids.audit(1), change_set_id: SET_A, values_masked: true }],
        total: 3,
      },
    });
  });

  it("un 403 se traduce a «sin permiso» con el mensaje del servidor", async () => {
    useLive(async () => json(403, { code: "forbidden", message: "Su rol no puede consultar la auditoría." }));

    const result = await fetchPieceAuditTrail(PIECE);

    expect(result).toEqual({ status: "forbidden", message: "Su rol no puede consultar la auditoría." });
  });
});

describe("previewRevert", () => {
  it("en modo live llama a revert-preview del conjunto", async () => {
    const preview = { preview_token: "abc", items: [], applicable_count: 0 };
    const fetchMock = useLive(async () => json(200, preview));

    const result = await previewRevert(SET_A);

    const request = requestAt(fetchMock, 0);
    expect(request.method).toBe("POST");
    expect(new URL(request.url).pathname).toBe(`/api/v1/audit/change-sets/${SET_A}/revert-preview`);
    expect(result).toEqual({ status: "ok", preview });
  });

  it("un conjunto ya revertido indica el conjunto de reversión existente", async () => {
    useLive(async () =>
      json(409, {
        code: ALREADY_REVERTED,
        message: "Este conjunto ya fue revertido.",
        details: { reverted_by_change_set_id: SET_B },
      }),
    );

    const result = await previewRevert(SET_A);

    expect(result).toEqual({
      status: "already_reverted",
      message: "Este conjunto ya fue revertido.",
      revertedByChangeSetId: SET_B,
    });
  });

  it("un 403 de código I se traduce a «sin permiso»", async () => {
    useLive(async () => json(403, { code: "forbidden", message: "Revertir un código I requiere el rol Administrador." }));

    const result = await previewRevert(SET_A);

    expect(result).toEqual({ status: "forbidden", message: "Revertir un código I requiere el rol Administrador." });
  });

  it("en modo mock construye el plan con las filas de la sesión y no llama a la red", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await previewRevert(SET_A, [entry({ id: ids.audit(1), change_set_id: SET_A })]);

    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.preview.preview_token).toContain(SET_A);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("confirmRevert", () => {
  it("envía el token de la vista previa, el motivo y la confirmación de conflictos", async () => {
    const applied = { reverted_change_set_id: SET_A, new_change_set_id: SET_B, reverted_fields: 2, restored_entities: 0, deleted_entities: 0 };
    const fetchMock = useLive(async () => json(200, applied));

    const result = await confirmRevert(SET_A, { previewToken: "token-1", reason: "Se aplicó al lote equivocado", confirmConflicts: true });

    const request = requestAt(fetchMock, 0);
    expect(new URL(request.url).pathname).toBe(`/api/v1/audit/change-sets/${SET_A}/revert`);
    expect(await request.json()).toEqual({ preview_token: "token-1", reason: "Se aplicó al lote equivocado", confirm_conflicts: true });
    expect(result).toEqual({ status: "ok", result: applied, simulated: false });
  });

  it("un plan caducado se explica en español llano y pide volver a calcular", async () => {
    useLive(async () => json(409, { code: REVERT_PLAN_CHANGED, message: "revert_plan_changed" }));

    const result = await confirmRevert(SET_A, { previewToken: "token-1", reason: "x", confirmConflicts: false });

    expect(result).toEqual({ status: "plan_changed", message: PLAN_CHANGED_MESSAGE });
    expect(PLAN_CHANGED_MESSAGE).toContain("editó");
  });

  it("los conflictos sin confirmar piden marcar la casilla", async () => {
    useLive(async () => json(409, { code: REVERT_HAS_CONFLICTS, message: "revert_has_conflicts" }));

    const result = await confirmRevert(SET_A, { previewToken: "token-1", reason: "x", confirmConflicts: false });

    expect(result).toEqual({ status: "needs_conflict_confirmation", message: CONFLICTS_NOT_CONFIRMED_MESSAGE });
  });

  it("en modo mock la reversión se simula y se marca como tal", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await confirmRevert(SET_A, { previewToken: "demostracion", reason: "x", confirmConflicts: false });

    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.simulated).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("buildMockRevertPreview", () => {
  it("convierte cada tipo de fila en el elemento del plan que le corresponde", () => {
    const preview = buildMockRevertPreview(SET_A, [
      entry({ id: ids.audit(1), change_set_id: SET_A }),
      entry({ id: ids.audit(2), change_set_id: SET_A, action: "CREATE", field: null }),
      entry({ id: ids.audit(3), change_set_id: SET_A, action: "SOFT_DELETE", field: null }),
      entry({ id: ids.audit(4), change_set_id: SET_A, entity_type: "piece_movement", entity_id: ids.movement(1), field: "to_location_id" }),
      entry({ id: ids.audit(5), change_set_id: SET_B, field: "author" }),
    ]);

    expect(preview.items.map((item) => item.kind)).toEqual([
      "RESTORE_VALUE",
      "SOFT_DELETE_ENTITY",
      "RESTORE_ENTITY",
      "APPEND_ONLY_NOTE",
    ]);
    expect(preview.applicable_count).toBe(3);
    expect(preview.notes).toEqual([MOVEMENT_NOTE]);
    expect(preview.conflicts).toEqual([]);
    expect(preview.change_set.change_set_id).toBe(SET_A);
  });

  it("una corrección de identificador exige Administrador y avisa que toca el código I", () => {
    const preview = buildMockRevertPreview(SET_A, [
      entry({ id: ids.audit(1), change_set_id: SET_A, entity_type: "piece_identifier", entity_id: ids.identifier(108), action: "CORRECTION", field: "is_current" }),
    ]);

    expect(preview.items[0].kind).toBe("CORRECT_INVENTORY_CODE");
    expect(preview.requires_admin).toBe(true);
    expect(preview.touches_inventory_code).toBe(true);
  });

  it("un conjunto de importación pide el permiso de revertir cargas", () => {
    const preview = buildMockRevertPreview(SET_A, [entry({ id: ids.audit(1), change_set_id: SET_A, origin: "IMPORT", action: "CREATE", field: null })]);

    expect(preview.required_permissions).toEqual(["imports.revert"]);
  });
});
