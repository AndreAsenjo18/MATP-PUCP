import { describe, expect, it } from "vitest";

import { toEntryView, type AuditChangeSetSummary, type AuditEntryView } from "@/lib/data/audit";
import { ids } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import { MASKED_VALUE_NOTICE } from "./AuditChangeSetList";
import {
  AUDIT_EMPTY_MESSAGE,
  AUDIT_NO_MATCH_MESSAGE,
  auditScopeSentence,
  AuditLogChangeSetList,
  AuditLogEntryList,
  DETAIL_EMPTY_MESSAGE,
  emptyMessage,
  NO_REASON_RECORDED,
  shortId,
} from "./AuditLogChangeSetList";

const SET_A = ids.changeSet(1);
const SET_B = ids.changeSet(2);
const PIECE = ids.piece(1);

function summary(partial: Partial<AuditChangeSetSummary> = {}): AuditChangeSetSummary {
  return {
    change_set_id: SET_A,
    actions: ["CREATE"],
    actor_label: "Practicante Catalogador (sintético)",
    user_id: ids.user(3),
    occurred_at: "2026-09-10T09:00:00Z",
    last_occurred_at: "2026-09-10T09:05:00Z",
    origin: "IMPORT",
    origin_ref: "Lote de importación 2026-09-10 (sintético)",
    reason: "Carga de la sábana 2024",
    entity_counts: { piece: 54 },
    entity_count: 54,
    field_count: 486,
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
    occurred_at: "2026-09-10T09:00:00Z",
    user_id: ids.user(3),
    actor_label: "Practicante Catalogador (sintético)",
    origin: "IMPORT",
    origin_ref: null,
    reason: null,
    ...partial,
  } as AuditEntryView);
}

describe("textos de la consulta global", () => {
  it("resume el alcance con los nombres que escribe la API", () => {
    expect(auditScopeSentence(summary())).toBe("54 piezas · 486 campos registrados");
    expect(auditScopeSentence(summary({ entity_counts: { piece: 1, media_asset: 2, term: 1 }, field_count: 1 }))).toBe(
      "1 pieza, 2 fotografías o documentos y 1 término de vocabulario · 1 campo registrado",
    );
    expect(auditScopeSentence(summary({ entity_counts: {}, entity_count: 3, field_count: 0 }))).toBe("3 registros · 0 campos registrados");
  });

  it("acorta los identificadores y distingue «nada registrado» de «nada con estos filtros»", () => {
    expect(shortId(ids.piece(1))).toHaveLength(9);
    expect(shortId("abc")).toBe("abc");
    expect(emptyMessage(false)).toBe(AUDIT_EMPTY_MESSAGE);
    expect(emptyMessage(true)).toBe(AUDIT_NO_MATCH_MESSAGE);
  });
});

describe("AuditLogChangeSetList", () => {
  it("muestra quién, cuándo, origen, alcance, motivo y lote de cada conjunto", () => {
    const html = render(<AuditLogChangeSetList changeSets={[summary()]} onToggleDetail={() => {}} />);
    const text = visibleText(html);

    expect(html).toContain('aria-label="Conjuntos de cambios"');
    expect(text).toContain("Creación");
    expect(text).toContain("Practicante Catalogador (sintético)");
    expect(text).toContain("carga masiva de Excel");
    expect(text).toContain("54 piezas · 486 campos registrados");
    expect(text).toContain("Carga de la sábana 2024");
    expect(text).toContain("Lote o sugerencia de origen: Lote de importación 2026-09-10 (sintético)");
    expect(text).toContain("Ver los campos cambiados");
    expect(html).toContain('aria-expanded="false"');
  });

  it("un conjunto sin motivo ni autor lo dice en lugar de dejar huecos", () => {
    const text = visibleText(
      render(<AuditLogChangeSetList changeSets={[summary({ reason: null, actor_label: null, origin_ref: null, origin: "SYSTEM" })]} onToggleDetail={() => {}} />),
    );

    expect(text).toContain(NO_REASON_RECORDED);
    expect(text).toContain("Sistema");
    expect(text).toContain("proceso del sistema");
    expect(text).not.toContain("Lote o sugerencia de origen");
  });

  it("el conjunto abierto muestra su detalle y cambia el texto del botón", () => {
    const html = render(
      <AuditLogChangeSetList
        changeSets={[summary(), summary({ change_set_id: SET_B })]}
        openChangeSetId={SET_A}
        detail={<p>Detalle del conjunto</p>}
        onToggleDetail={() => {}}
      />,
    );
    const text = visibleText(html);

    expect(text).toContain("Detalle del conjunto");
    expect(text).toContain("Ocultar los campos cambiados");
    expect(html).toContain('aria-expanded="true"');
    // Solo el conjunto abierto lleva detalle.
    expect(html.match(/Detalle del conjunto/g)).toHaveLength(1);
  });

  it("un conjunto revertido lo avisa y permite ir a su reversión", () => {
    const withLink = render(
      <AuditLogChangeSetList
        changeSets={[summary({ reverted: true, reverted_by_change_set_id: SET_B })]}
        onToggleDetail={() => {}}
        onOpenChangeSet={() => {}}
      />,
    );
    const withoutLink = visibleText(render(<AuditLogChangeSetList changeSets={[summary({ reverted: true, reverted_by_change_set_id: SET_B })]} onToggleDetail={() => {}} />));

    expect(visibleText(withLink)).toContain("Ya revertido");
    expect(visibleText(withLink)).toContain("Este cambio ya fue revertido.");
    expect(visibleText(withLink)).toContain("Ver la reversión");
    expect(withoutLink).toContain("Este cambio ya fue revertido.");
    expect(withoutLink).not.toContain("Ver la reversión");
  });

  it("la consulta nunca ofrece revertir: eso se hace desde la ficha de la pieza", () => {
    const text = visibleText(render(<AuditLogChangeSetList changeSets={[summary()]} onToggleDetail={() => {}} />));

    expect(text).not.toContain("Revertir este cambio");
  });

  it("sin conjuntos explica por qué", () => {
    expect(visibleText(render(<AuditLogChangeSetList changeSets={[]} onToggleDetail={() => {}} />))).toBe(AUDIT_EMPTY_MESSAGE);
    expect(visibleText(render(<AuditLogChangeSetList changeSets={[]} hasFilters onToggleDetail={() => {}} />))).toBe(AUDIT_NO_MATCH_MESSAGE);
  });
});

describe("AuditLogEntryList", () => {
  it("muestra cada campo con su registro, antes y después", () => {
    const html = render(<AuditLogEntryList entries={[entry()]} total={1} />);
    const text = visibleText(html);

    expect(html).toContain('aria-label="Campos cambiados en el conjunto"');
    expect(text).toContain("Pieza");
    expect(text).toContain(shortId(PIECE));
    expect(text).toContain("procedencia: Ayacucho → Huancavelica");
  });

  it("un valor sensible se muestra como cambiado pero sin el valor (RF-041)", () => {
    const text = visibleText(
      render(
        <AuditLogEntryList
          entries={[entry({ field: "lender_name", values_masked: true, old_value: "Comodante A", new_value: "Comodante B" })]}
          total={1}
        />,
      ),
    );

    expect(text).toContain("comodante");
    expect(text).toContain(MASKED_VALUE_NOTICE);
    expect(text).not.toContain("Comodante A");
    expect(text).not.toContain("Comodante B");
  });

  it("usa el nombre en español de identificadores y fotos", () => {
    const text = visibleText(
      render(<AuditLogEntryList entries={[entry({ entity_type: "piece_identifier", entity_id: ids.identifier(108), field: "is_current" }), entry({ id: ids.audit(2), entity_type: "media_asset", entity_id: ids.media(1) })]} total={2} />),
    );

    expect(text).toContain("Identificador de pieza");
    expect(text).toContain("Fotografía o documento");
  });

  it("cuando faltan filas ofrece cargar más y dice cuántas se ven", () => {
    const html = render(<AuditLogEntryList entries={[entry()]} total={120} onLoadMore={() => {}} />);
    const text = visibleText(html);

    expect(text).toContain("Se muestran 1 de 120 campos.");
    expect(text).toContain("Mostrar más campos");
  });

  it("con todas las filas cargadas no ofrece cargar más", () => {
    const text = visibleText(render(<AuditLogEntryList entries={[entry()]} total={1} onLoadMore={() => {}} />));

    expect(text).not.toContain("Mostrar más campos");
  });

  it("muestra la carga, el error y el vacío", () => {
    expect(visibleText(render(<AuditLogEntryList entries={[]} total={0} loading />))).toContain("Cargando los campos…");
    expect(render(<AuditLogEntryList entries={[]} total={0} error="No se pudo conectar con el servidor." />)).toContain('role="alert"');
    expect(visibleText(render(<AuditLogEntryList entries={[]} total={0} />))).toContain(DETAIL_EMPTY_MESSAGE);
  });
});
