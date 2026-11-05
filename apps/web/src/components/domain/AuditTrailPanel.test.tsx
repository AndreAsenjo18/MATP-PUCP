import { afterEach, describe, expect, it, vi } from "vitest";

import { toEntryView, type AuditEntryView } from "@/lib/data/audit";
import { ids } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import { AuditTrailPanel, TRAIL_INTRO } from "./AuditTrailPanel";
import { type RevertAccess } from "./AuditChangeSetList";

const SET_A = ids.changeSet(1);
const SET_B = ids.changeSet(2);
const PIECE = ids.piece(1);

const ADMIN: RevertAccess = { hasPermission: () => true, isAdmin: true };

function entry(partial: Partial<AuditEntryView> = {}): AuditEntryView {
  return toEntryView({
    id: ids.audit(1),
    change_set_id: SET_A,
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
    reason: "Corrección según el libro de inventario",
    ...partial,
  } as AuditEntryView);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuditTrailPanel", () => {
  it("con las filas de la demostración agrupa el historial sin llamar a la red", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const html = render(
      <AuditTrailPanel
        pieceId={PIECE}
        access={ADMIN}
        demoEntries={[entry(), entry({ id: ids.audit(2), change_set_id: SET_B, action: "CREATE", field: null, origin: "IMPORT" })]}
      />,
    );
    const text = visibleText(html);

    expect(text).toContain(TRAIL_INTRO);
    expect(text).toContain("Corrección según el libro de inventario");
    expect(text).toContain("carga masiva de Excel");
    expect(text).toContain("Revertir este cambio");
    expect(html).toContain('aria-label="Conjuntos de cambios"');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sin filas en la demostración explica que no hay registros", () => {
    const html = render(<AuditTrailPanel pieceId={PIECE} access={ADMIN} demoEntries={[]} />);

    expect(visibleText(html)).toContain("Sin registros de auditoría para esta pieza.");
  });

  it("en modo live avisa que está cargando antes de tener respuesta", () => {
    const html = render(<AuditTrailPanel pieceId={PIECE} access={ADMIN} />);

    expect(visibleText(html)).toContain("Cargando el historial de cambios…");
    expect(html).toContain('role="status"');
  });

  it("la vista previa de reversión no se muestra hasta que se pide", () => {
    const html = render(<AuditTrailPanel pieceId={PIECE} access={ADMIN} demoEntries={[entry()]} />);

    expect(visibleText(html)).not.toContain("Antes de confirmar, esto es lo que va a pasar");
    expect(visibleText(html)).not.toContain("Motivo de la reversión (obligatorio)");
  });
});
