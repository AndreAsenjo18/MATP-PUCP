import { describe, expect, it } from "vitest";

import type { AuditChangeSetSummary } from "@/lib/data/audit";
import { systemActorLabel } from "@/lib/data/audit-query";
import type { TrashEntry } from "@/lib/data/trash";
import { ids } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import { ADMIN_SECTIONS, AdminNav } from "./AdminShell";
import { AUDIT_INTRO } from "./AuditLogPanel";
import { AuditLogChangeSetList } from "./AuditLogChangeSetList";
import { CSV_INTRO } from "./AuditLogExport";
import { TrashEntryList } from "./TrashEntryList";
import { TRASH_INTRO, TRASH_VIEW_ONLY_NOTICE } from "./TrashPanel";
import { restoreDescription } from "./TrashRestorePanel";

// Change `administracion-control` (C23). Datos sintéticos (RNF-014). La regex busca identificadores reales
// de requisitos (un código de pieza como «RN-004521» no lo es) y nombres técnicos que se veían en pantalla.
const REQUIREMENT = /\b(RF-0\d{2}|RNF-0\d{2}|RN-0\d{2}|RIA-0\d)\b/;
const TECHNICAL = /auth\.login|user_session|registros? de tipo|conjuntos? de cambios|plantilla de mapeo|término de vocabulario/i;
const noop = () => {};

const LOGIN: AuditChangeSetSummary = {
  change_set_id: ids.changeSet(7),
  actions: ["CREATE"],
  actor_label: "auth.login",
  user_id: null,
  occurred_at: "2026-11-10T06:12:05Z",
  last_occurred_at: "2026-11-10T06:12:05Z",
  origin: "SYSTEM",
  origin_ref: null,
  reason: null,
  entity_counts: { user_session: 1 },
  entity_count: 1,
  field_count: 3,
  reverted: false,
  reverted_by_change_set_id: null,
} as unknown as AuditChangeSetSummary;

const TEMPLATE: TrashEntry = {
  entity_type: "import_mapping_template",
  entity_id: ids.term(950),
  entity_label: "Inventario 2024 (sintético)",
  type_label: "Plantilla de mapeo",
  deleted_at: "2026-10-27T19:11:45Z",
  deleted_by_id: ids.user(1),
  deleted_by_name: "Administrador (sintético)",
  deletion_reason: "Prueba del recorrido con el lote demo (sintético)",
};

describe("Administración › Control en lenguaje llano", () => {
  it("un inicio de sesión se lee como tal, sin nombres técnicos", () => {
    const text = visibleText(render(<AuditLogChangeSetList changeSets={[LOGIN]} onToggleDetail={noop} />));
    expect(text).toContain("Inicio de sesión");
    expect(text).toContain("1 sesión");
    expect(text).not.toMatch(TECHNICAL);
    expect(systemActorLabel(null)).toBe("Sistema");
    expect(systemActorLabel("Ana García (sintética)")).toBe("Ana García (sintética)");
  });

  it("la papelera usa el nombre del museo aunque la API mande otro", () => {
    const html = render(<TrashEntryList entries={[TEMPLATE]} canRestore onRestore={noop} />);
    expect(visibleText(html)).toContain("Formato de archivo");
    expect(html).toContain('aria-label="Restaurar formato de archivo «Inventario 2024 (sintético)»"');
    expect(visibleText(html)).not.toMatch(TECHNICAL);
  });

  it("las introducciones y avisos no citan requisitos ni nombres técnicos", () => {
    for (const text of [TRASH_INTRO, TRASH_VIEW_ONLY_NOTICE, AUDIT_INTRO, CSV_INTRO, restoreDescription(TEMPLATE)]) {
      expect(text).not.toMatch(REQUIREMENT);
      expect(text).not.toMatch(TECHNICAL);
    }
    expect(restoreDescription(TEMPLATE)).toContain("(formato de archivo)");
  });
});

describe("filas compactas y pestañas táctiles", () => {
  it("cada registro es una fila de rejilla desde lg, dentro de una sola tarjeta", () => {
    const audit = render(<AuditLogChangeSetList changeSets={[LOGIN]} onToggleDetail={noop} />);
    expect(audit).toMatch(/^<ol[^>]*class="[^"]*divide-y/);
    expect(audit).toContain("lg:grid");
    const trash = render(<TrashEntryList entries={[TEMPLATE]} canRestore onRestore={noop} />);
    expect(trash).toMatch(/^<ul[^>]*class="[^"]*divide-y/);
    expect(trash).toContain("lg:grid");
  });

  it("las pestañas de Administración miden 44 px en todos los anchos (remodelacion-visual)", () => {
    const html = render(<AdminNav sections={ADMIN_SECTIONS} current="papelera" onSelect={noop} />);
    const tabs = html.match(/<button[^>]*role="tab"[^>]*>/g) ?? [];
    expect(tabs.length).toBeGreaterThan(0);
    for (const tab of tabs) {
      expect(tab).toMatch(/\bmin-h-11\b/);
      expect(tab).not.toMatch(/md:min-h-9/);
    }
  });
});
