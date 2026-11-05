import { describe, expect, it } from "vitest";

import { PLAN_CHANGED_MESSAGE, type RevertConflictOut, type RevertItemOut, type RevertPreviewOut } from "@/lib/data/audit";
import { ids } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import { changeSetAnchor } from "./AuditChangeSetList";
import {
  CONFLICTS_CONFIRM_LABEL,
  CONFLICTS_CONFIRM_REQUIRED,
  conflictDetailSentence,
  conflictSentence,
  NOTHING_TO_REVERT,
  REVERT_REASON_REQUIRED,
  RevertChangeSetPanel,
  revertConfirmLabel,
  revertPlanSentences,
  revertResultSentence,
  validateRevertForm,
} from "./RevertChangeSetPanel";

const SET_A = ids.changeSet(1);
const SET_B = ids.changeSet(2);
const PIECE = ids.piece(1);
const disabledButton = /<button[^>]*\sdisabled=""/;
const requiredTextarea = /<textarea[^>]*\srequired=""/;
const noop = () => {};

function item(partial: Partial<RevertItemOut> = {}): RevertItemOut {
  return {
    entity_type: "piece",
    entity_id: PIECE,
    field: "provenance",
    kind: "RESTORE_VALUE",
    source_action: "UPDATE",
    applicable: true,
    current_value: "Huancavelica",
    target_value: "Ayacucho",
    description: "Restaurar «provenance» al valor anterior.",
    ...partial,
  };
}

function conflict(partial: Partial<RevertConflictOut> = {}): RevertConflictOut {
  return {
    entity_type: "piece",
    entity_id: PIECE,
    field: "provenance",
    reason: "changed_after",
    message: "La procedencia la volvió a cambiar el Administrador MATP (sintético).",
    changed_at: "2026-10-18T15:00:00Z",
    changed_by_id: ids.user(1),
    current_value: "Puno",
    expected_value: "Huancavelica",
    ...partial,
  };
}

function preview(partial: Partial<RevertPreviewOut> = {}): RevertPreviewOut {
  return {
    change_set: {
      change_set_id: SET_A,
      actions: ["UPDATE"],
      actor_label: "Gabriela Curadora (sintética)",
      user_id: ids.user(2),
      occurred_at: "2026-09-17T10:30:00Z",
      origin: "MANUAL",
      origin_ref: null,
      reason: "Corrección de procedencia",
      entities: [{ entity_type: "piece", entity_id: PIECE, field_count: 1 }],
      entity_count: 1,
      field_count: 1,
      reverted: false,
      reverted_by_change_set_id: null,
    },
    items: [item()],
    conflicts: [],
    notes: [],
    applicable_count: 1,
    preview_token: "token-1",
    required_permissions: ["pieces.update"],
    requires_admin: false,
    touches_inventory_code: false,
    ...partial,
  };
}

describe("el plan en frases", () => {
  it("cuenta cada tipo de efecto y lo dice sin tecnicismos", () => {
    const sentences = revertPlanSentences(
      preview({
        items: [
          item(),
          item({ field: "author" }),
          item({ kind: "SOFT_DELETE_ENTITY", field: null }),
          item({ kind: "RESTORE_ENTITY", field: null }),
          item({ kind: "APPEND_ONLY_NOTE", applicable: false, field: "to_location_id", description: "No se toca." }),
        ],
      }),
    );

    expect(sentences[0]).toBe("Se devolverán 2 campos a su valor anterior.");
    expect(sentences[1]).toContain("Se eliminará lógicamente 1 registro");
    expect(sentences[1]).toContain("puede restaurarse");
    expect(sentences[2]).toContain("Se restaurará 1 registro que este cambio había eliminado.");
    expect(sentences[3]).toContain("movimiento de ubicación");
    expect(sentences.join(" ")).not.toContain("{");
  });

  it("la corrección de código I avisa que hace falta el Administrador (RN-002)", () => {
    const [sentence] = revertPlanSentences(preview({ items: [item({ kind: "CORRECT_INVENTORY_CODE", field: "inventory_code" })] }));

    expect(sentence).toContain("código I");
    expect(sentence).toContain("Administrador");
  });

  it("un conjunto sin nada aplicable lo dice claramente", () => {
    expect(revertPlanSentences(preview({ items: [], applicable_count: 0 }))).toEqual([NOTHING_TO_REVERT]);
  });

  it("el botón nombra cuántos cambios se revierten y cuántos se descartan", () => {
    expect(revertConfirmLabel(preview())).toBe("Revertir 1 cambio");
    expect(revertConfirmLabel(preview({ applicable_count: 3 }))).toBe("Revertir 3 cambios");
    expect(revertConfirmLabel(preview({ applicable_count: 3, conflicts: [conflict()] }))).toBe("Revertir 3 cambios y descartar 1 cambio posterior");
  });

  it("el resultado se resume en una frase", () => {
    const sentence = revertResultSentence({
      reverted_change_set_id: SET_A,
      new_change_set_id: SET_B,
      reverted_fields: 2,
      restored_entities: 1,
      deleted_entities: 0,
    });

    expect(sentence).toContain("2 campos devueltos a su valor anterior");
    expect(sentence).toContain("1 registro restaurado");
    expect(sentence).toContain("puede revertirse");
  });
});

describe("conflictos legibles", () => {
  it("explica quién cambió después, cuándo y qué dice hoy el dato, sin JSON", () => {
    const detail = conflictDetailSentence(conflict());

    expect(conflictSentence(conflict())).toContain("otra persona lo volvió a cambiar después");
    expect(detail).toContain("Modificado el");
    expect(detail).toContain("hoy dice «Puno»");
    expect(detail).toContain("este conjunto lo había dejado en «Huancavelica»");
    expect(detail).not.toContain("{");
  });

  it("los demás motivos de conflicto se explican en una frase propia", () => {
    expect(conflictSentence(conflict({ reason: "entity_missing" }))).toContain("ya no existe");
    expect(conflictSentence(conflict({ reason: "already_deleted" }))).toContain("ya está eliminado");
    expect(conflictSentence(conflict({ reason: "not_deleted" }))).toContain("ya está activo");
    expect(conflictSentence(conflict({ reason: "no_soft_delete" }))).toContain("no admite eliminación lógica");
    expect(conflictDetailSentence(conflict({ reason: "entity_missing" }))).toBeNull();
  });
});

describe("validación de la confirmación", () => {
  it("exige motivo y, con conflictos, la casilla de confirmación", () => {
    expect(validateRevertForm({ reason: "  ", confirmConflicts: false, hasConflicts: false })).toEqual({ reason: REVERT_REASON_REQUIRED });
    expect(validateRevertForm({ reason: "Lote equivocado", confirmConflicts: false, hasConflicts: true })).toEqual({
      confirmConflicts: CONFLICTS_CONFIRM_REQUIRED,
    });
    expect(validateRevertForm({ reason: "Lote equivocado", confirmConflicts: true, hasConflicts: true })).toEqual({});
  });
});

describe("RevertChangeSetPanel", () => {
  it("muestra el plan, el motivo obligatorio y el botón de confirmar", () => {
    const html = render(
      <RevertChangeSetPanel state={{ status: "ready", preview: preview() }} onRecalculate={noop} onCancel={noop} onConfirm={noop} />,
    );
    const text = visibleText(html);

    expect(text).toContain("Antes de confirmar, esto es lo que va a pasar");
    expect(text).toContain("Se devolverá 1 campo a su valor anterior.");
    expect(text).toContain("Huancavelica → Ayacucho");
    expect(text).toContain("Nadie modificó estos datos después de este cambio: no hay conflictos.");
    expect(text).toContain("Motivo de la reversión (obligatorio)");
    expect(text).toContain("Revertir 1 cambio");
    expect(html).toMatch(requiredTextarea);
    expect(html).not.toMatch(disabledButton);
    expect(text).not.toContain(CONFLICTS_CONFIRM_LABEL);
  });

  it("con conflictos los lista de forma legible y pide la casilla de confirmación", () => {
    const html = render(
      <RevertChangeSetPanel
        state={{ status: "ready", preview: preview({ conflicts: [conflict()] }) }}
        onRecalculate={noop}
        onCancel={noop}
        onConfirm={noop}
      />,
    );
    const text = visibleText(html);

    expect(text).toContain("1 cambio posterior en conflicto");
    expect(text).toContain("La procedencia la volvió a cambiar el Administrador MATP (sintético).");
    expect(text).toContain("hoy dice «Puno»");
    expect(text).toContain(CONFLICTS_CONFIRM_LABEL);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("bg-carmin-bg");
    expect(text).toContain("Revertir 1 cambio y descartar 1 cambio posterior");
  });

  it("avisa de los movimientos que no se tocan y del código I", () => {
    const html = render(
      <RevertChangeSetPanel
        state={{
          status: "ready",
          preview: preview({ notes: ["Los movimientos se corrigen con un movimiento correctivo."], requires_admin: true, touches_inventory_code: true }),
        }}
        onRecalculate={noop}
        onCancel={noop}
        onConfirm={noop}
      />,
    );
    const text = visibleText(html);

    expect(text).toContain("Los movimientos se corrigen con un movimiento correctivo.");
    expect(text).toContain("Esta reversión afecta un código I");
    expect(text).toContain("Administrador");
  });

  it("un plan sin nada aplicable no se puede confirmar", () => {
    const soloLectura = render(
      <RevertChangeSetPanel
        state={{ status: "ready", preview: preview({ items: [item({ kind: "APPEND_ONLY_NOTE", applicable: false })], applicable_count: 0 }) }}
        onRecalculate={noop}
        onCancel={noop}
        onConfirm={noop}
      />,
    );
    const vacio = render(
      <RevertChangeSetPanel
        state={{ status: "ready", preview: preview({ items: [], applicable_count: 0 }) }}
        onRecalculate={noop}
        onCancel={noop}
        onConfirm={noop}
      />,
    );

    expect(visibleText(soloLectura)).toContain("no se modificará");
    expect(soloLectura).toMatch(disabledButton);
    expect(visibleText(vacio)).toContain(NOTHING_TO_REVERT);
    expect(vacio).toMatch(disabledButton);
  });

  it("si el plan cambió explica que alguien editó mientras tanto y ofrece volver a calcular", () => {
    const html = render(
      <RevertChangeSetPanel state={{ status: "plan_changed", message: PLAN_CHANGED_MESSAGE }} onRecalculate={noop} onCancel={noop} onConfirm={noop} />,
    );
    const text = visibleText(html);

    expect(text).toContain("Alguien editó estos datos mientras usted revisaba la vista previa");
    expect(text).toContain("Volver a calcular la reversión");
    expect(html).toContain('role="alert"');
  });

  it("un conjunto ya revertido se informa con enlace al conjunto de reversión", () => {
    const html = render(
      <RevertChangeSetPanel
        state={{ status: "blocked", message: "Este conjunto ya fue revertido.", revertedByChangeSetId: SET_B }}
        onRecalculate={noop}
        onCancel={noop}
        onConfirm={noop}
      />,
    );
    const text = visibleText(html);

    expect(text).toContain("Este conjunto ya fue revertido.");
    expect(text).toContain("Ver el conjunto de reversión");
    expect(html).toContain(`href="#${changeSetAnchor(SET_B)}"`);
    expect(text).not.toContain("Motivo de la reversión");
  });

  it("mientras calcula y mientras aplica avisa del progreso", () => {
    const loading = render(<RevertChangeSetPanel state={{ status: "loading" }} onRecalculate={noop} onCancel={noop} onConfirm={noop} />);
    const applying = render(
      <RevertChangeSetPanel state={{ status: "ready", preview: preview() }} busy onRecalculate={noop} onCancel={noop} onConfirm={noop} />,
    );

    expect(visibleText(loading)).toContain("Calculando qué pasaría al revertir");
    expect(loading).toContain('role="status"');
    expect(visibleText(applying)).toContain("Aplicando la reversión…");
    expect(applying).toMatch(disabledButton);
  });

  it("al terminar resume lo aplicado y ofrece actualizar el historial", () => {
    const result = { reverted_change_set_id: SET_A, new_change_set_id: SET_B, reverted_fields: 1, restored_entities: 0, deleted_entities: 0 };
    const html = render(
      <RevertChangeSetPanel
        state={{ status: "done", result, simulated: true }}
        onRecalculate={noop}
        onCancel={noop}
        onConfirm={noop}
        onReload={noop}
      />,
    );
    const text = visibleText(html);

    expect(text).toContain("Reversión registrada");
    expect(text).toContain("Modo demostración: la reversión no modificó ningún dato real.");
    expect(text).toContain("Actualizar el historial");
  });

  it("el mensaje de error de la confirmación queda visible sin perder lo escrito", () => {
    const html = render(
      <RevertChangeSetPanel
        state={{ status: "ready", preview: preview() }}
        error="Revertir un código I requiere el rol Administrador."
        onRecalculate={noop}
        onCancel={noop}
        onConfirm={noop}
      />,
    );

    expect(visibleText(html)).toContain("Revertir un código I requiere el rol Administrador.");
    expect(html).toContain('role="alert"');
    expect(visibleText(html)).toContain("Motivo de la reversión (obligatorio)");
  });
});
