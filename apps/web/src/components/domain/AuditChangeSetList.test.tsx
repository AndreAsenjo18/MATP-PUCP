import { describe, expect, it } from "vitest";

import { toEntryView, type AuditChangeSetSummary, type AuditEntryView } from "@/lib/data/audit";
import { ids } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import {
  AuditChangeSetList,
  changeSetAnchor,
  entityLabel,
  fieldChangeSentence,
  fieldLabel,
  formatAuditValue,
  joinWithAnd,
  MASKED_VALUE_NOTICE,
  originLabel,
  revertAvailability,
  revertPermissionFor,
  scopeSentence,
  type RevertAccess,
} from "./AuditChangeSetList";

const SET_A = ids.changeSet(1);
const SET_B = ids.changeSet(2);
const PIECE = ids.piece(1);
const disabledButton = /<button[^>]*\sdisabled=""/;

const ADMIN: RevertAccess = { hasPermission: () => true, isAdmin: true };
const CATALOGUER: RevertAccess = { hasPermission: (code) => code === "pieces.update", isAdmin: false };
const VIEWER: RevertAccess = { hasPermission: () => false, isAdmin: false };

function summary(partial: Partial<AuditChangeSetSummary> = {}): AuditChangeSetSummary {
  return {
    change_set_id: SET_A,
    actions: ["UPDATE"],
    actor_label: "Gabriela Curadora (sintética)",
    user_id: ids.user(2),
    occurred_at: "2026-09-17T10:30:00Z",
    last_occurred_at: "2026-09-17T10:31:00Z",
    origin: "MANUAL",
    origin_ref: null,
    reason: "Corrección de procedencia según el libro de inventario",
    entity_counts: { piece: 1 },
    entity_count: 1,
    field_count: 2,
    reverted: false,
    reverted_by_change_set_id: null,
    ...partial,
  };
}

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
    reason: null,
    ...partial,
  } as AuditEntryView);
}

describe("textos del historial", () => {
  it("nombra el origen y los tipos de registro en español", () => {
    expect(originLabel("IMPORT")).toBe("carga masiva de Excel");
    expect(originLabel("AI")).toContain("inteligencia artificial");
    expect(originLabel("RARO")).toBe("origen RARO");
    expect(entityLabel("piece", 1)).toBe("pieza");
    expect(entityLabel("piece", 54)).toBe("piezas");
    expect(entityLabel("piece_media", 2)).toBe("fotografías");
    expect(entityLabel("tabla_nueva", 2)).toBe("registros de tipo tabla_nueva");
  });

  it("une las partes con «y» y resume el alcance del conjunto", () => {
    expect(joinWithAnd(["1 pieza"])).toBe("1 pieza");
    expect(joinWithAnd(["1 pieza", "2 fotografías"])).toBe("1 pieza y 2 fotografías");
    expect(scopeSentence(summary({ entity_counts: { piece: 54 }, entity_count: 54, field_count: 486 }))).toBe("54 piezas · 486 campos registrados");
    expect(scopeSentence(summary({ entity_counts: { piece: 1, piece_media: 2 }, field_count: 1 }))).toBe("1 pieza y 2 fotografías · 1 campo registrado");
  });

  it("traduce los nombres de campo y los valores sin usar JSON", () => {
    expect(fieldLabel("provenance")).toBe("procedencia");
    expect(fieldLabel("inventory_code")).toBe("código I");
    expect(fieldLabel("campo_nuevo")).toBe("campo_nuevo");
    expect(fieldLabel(null)).toBe("la ficha completa");
    expect(formatAuditValue(null)).toBe("(vacío)");
    expect(formatAuditValue("")).toBe("(vacío)");
    expect(formatAuditValue(true)).toBe("sí");
    expect(formatAuditValue(false)).toBe("no");
    expect(formatAuditValue(12)).toBe("12");
    expect(formatAuditValue({ a: 1 })).not.toContain("{");
  });

  it("una fila enmascarada dice que el campo cambió y nunca inventa el valor", () => {
    const sentence = fieldChangeSentence(entry({ field: "lender_name", values_masked: true, old_value: null, new_value: null }));

    expect(sentence).toContain("comodante");
    expect(sentence).toContain(MASKED_VALUE_NOTICE);
    expect(fieldChangeSentence(entry())).toBe("procedencia: Ayacucho → Huancavelica");
  });
});

describe("permiso de reversión", () => {
  it("depende del origen del conjunto (design D1)", () => {
    expect(revertPermissionFor("MANUAL")).toBe("pieces.update");
    expect(revertPermissionFor("IMPORT")).toBe("imports.revert");
    expect(revertPermissionFor("AI")).toBeNull();
    expect(revertPermissionFor("SYSTEM")).toBeNull();
  });

  it("el Administrador puede revertir cualquier conjunto no revertido", () => {
    expect(revertAvailability(summary({ origin: "SYSTEM" }), ADMIN)).toEqual({ state: "available" });
  });

  it("un rol con pieces.update revierte ediciones manuales pero no cargas ni IA", () => {
    expect(revertAvailability(summary(), CATALOGUER)).toEqual({ state: "available" });
    const importSet = revertAvailability(summary({ origin: "IMPORT" }), CATALOGUER);
    const aiSet = revertAvailability(summary({ origin: "AI" }), CATALOGUER);

    expect(importSet.state).toBe("denied");
    if (importSet.state === "denied") {
      expect(importSet.reason).toContain("carga masiva de Excel");
      expect(importSet.reason).toContain("imports.revert");
    }
    expect(aiSet.state).toBe("denied");
    if (aiSet.state === "denied") expect(aiSet.reason).toContain("Administrador");
  });

  it("un conjunto ya revertido no se vuelve a revertir y señala su reversión", () => {
    expect(revertAvailability(summary({ reverted: true, reverted_by_change_set_id: SET_B }), ADMIN)).toEqual({
      state: "reverted",
      revertedByChangeSetId: SET_B,
    });
  });
});

describe("AuditChangeSetList", () => {
  it("muestra quién, cuándo, origen, alcance y motivo de cada conjunto", () => {
    const html = render(
      <AuditChangeSetList
        changeSets={[summary({ entity_counts: { piece: 54 }, entity_count: 54, field_count: 486, origin: "IMPORT" })]}
        entries={{ [SET_A]: [entry()] }}
        access={ADMIN}
        onRevert={() => {}}
      />,
    );
    const text = visibleText(html);

    expect(text).toContain("Gabriela Curadora (sintética)");
    expect(text).toContain("carga masiva de Excel");
    expect(text).toContain("54 piezas · 486 campos registrados");
    expect(text).toContain("Corrección de procedencia según el libro de inventario");
    expect(text).toContain("procedencia: Ayacucho → Huancavelica");
    expect(text).toContain("Revertir este cambio");
    expect(html).toContain('aria-label="Conjuntos de cambios"');
    expect(html).toContain(`id="${changeSetAnchor(SET_A)}"`);
  });

  it("un valor sensible se muestra como cambiado pero sin el valor (RF-041)", () => {
    const html = render(
      <AuditChangeSetList
        changeSets={[summary()]}
        entries={{ [SET_A]: [entry({ field: "lender_name", values_masked: true, old_value: "Comodante A", new_value: "Comodante B" })] }}
        access={ADMIN}
      />,
    );
    const text = visibleText(html);

    expect(text).toContain("comodante");
    expect(text).toContain(MASKED_VALUE_NOTICE);
    expect(text).not.toContain("Comodante A");
    expect(text).not.toContain("Comodante B");
  });

  it("sin permiso el botón queda desactivado y con el motivo a la vista", () => {
    const html = render(<AuditChangeSetList changeSets={[summary({ origin: "IMPORT" })]} access={VIEWER} onRevert={() => {}} />);

    expect(html).toMatch(disabledButton);
    expect(visibleText(html)).toContain("falta el permiso «imports.revert»");
  });

  it("sin la acción de revertir no se ofrece ningún botón", () => {
    const html = render(<AuditChangeSetList changeSets={[summary()]} access={ADMIN} />);

    expect(visibleText(html)).not.toContain("Revertir este cambio");
  });

  it("un conjunto revertido enlaza a la reversión cuando está en el historial", () => {
    const html = render(
      <AuditChangeSetList
        changeSets={[summary({ reverted: true, reverted_by_change_set_id: SET_B }), summary({ change_set_id: SET_B, actions: ["REVERT"] })]}
        access={ADMIN}
        onRevert={() => {}}
      />,
    );
    const text = visibleText(html);

    expect(text).toContain("Ya revertido");
    expect(text).toContain("Ver la reversión en este historial");
    expect(html).toContain(`href="#${changeSetAnchor(SET_B)}"`);
    // Solo el conjunto de reversión ofrece el botón: la reversión sí puede revertirse, el original no.
    expect(text.match(/Revertir este cambio/g)).toHaveLength(1);
  });

  it("si la reversión no está en este historial lo dice sin enlace roto", () => {
    const html = render(<AuditChangeSetList changeSets={[summary({ reverted: true, reverted_by_change_set_id: SET_B })]} access={ADMIN} onRevert={() => {}} />);

    expect(html).not.toContain(`href="#${changeSetAnchor(SET_B)}"`);
    expect(visibleText(html)).toContain("puede revertirse");
  });

  it("sin conjuntos explica que no hay registros", () => {
    const html = render(<AuditChangeSetList changeSets={[]} access={ADMIN} />);

    expect(visibleText(html)).toContain("Sin registros de auditoría para esta pieza.");
  });
});
