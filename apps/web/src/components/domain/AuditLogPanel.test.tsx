import { afterEach, describe, expect, it, vi } from "vitest";

import { toEntryView, type AuditEntryView } from "@/lib/data/audit";
import { ids } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import { AUDIT_INTRO, AuditLogPanel } from "./AuditLogPanel";
import { CSV_DEMO_NOTICE } from "./AuditLogExport";

const SET_A = ids.changeSet(1);

function entry(partial: Partial<AuditEntryView> = {}): AuditEntryView {
  return toEntryView({
    id: ids.audit(1),
    change_set_id: SET_A,
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

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AuditLogPanel", () => {
  it("en la demostración muestra filtros y carga sin llamar a la red; la descarga queda desactivada", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const html = render(<AuditLogPanel demoEntries={[entry()]} />);
    const text = visibleText(html);

    expect(text).toContain("Consulta de auditoría");
    expect(text).toContain(AUDIT_INTRO);
    expect(text).toContain("Tipo de registro");
    expect(text).toContain("Cargando la auditoría…");
    expect(text).toContain(CSV_DEMO_NOTICE);
    expect(html).toContain('role="status"');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ofrece como personas del filtro a quienes aparecen en el historial de la demostración", () => {
    const text = visibleText(
      render(<AuditLogPanel demoEntries={[entry(), entry({ id: ids.audit(2), user_id: ids.user(1), actor_label: "Administrador MATP (sintético)" })]} />),
    );

    expect(text).toContain("Gabriela Curadora (sintética)");
    expect(text).toContain("Administrador MATP (sintético)");
  });

  it("en modo live ofrece las descargas CSV y muestra el estado de carga antes de tener respuesta", () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
    vi.stubEnv("API_INTERNAL_URL", "http://api.test");

    const html = render(<AuditLogPanel />);
    const text = visibleText(html);

    expect(text).toContain("Cargando la auditoría…");
    expect(text).not.toContain(CSV_DEMO_NOTICE);
    expect(html).toContain('href="http://api.test/api/v1/audit-logs?group_by=change_set&amp;format=csv"');
    expect(html).toContain('href="http://api.test/api/v1/audit-logs?format=csv"');
  });
});
