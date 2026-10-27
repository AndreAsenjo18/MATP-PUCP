import { describe, expect, it } from "vitest";

import type { CollectionItem, IdentifierType, NormalizationPreview, VocabularyTerm } from "@/lib/data/admin";
import { render, visibleText } from "@/test/render";

import { ConservationForm, ConservationHistory } from "./ConservationPanel";
import { CollectionsTable, IdentifierTypesTable, RulePreviewPanel, TermList } from "./VocabulariesAdmin";

// Datos sintéticos (RNF-014).

const noop = () => {};

function type(overrides: Partial<IdentifierType> = {}): IdentifierType {
  return {
    code: "PUCP",
    label: "Código PUCP",
    description: null,
    normalization_rule: "GENERIC",
    is_unique_when_current: false,
    locks_on_assignment: false,
    owned_pieces_only: false,
    allowed_for_temporary_loan: true,
    sort_order: 3,
    is_active: true,
    is_system: false,
    ...overrides,
  };
}

function preview(overrides: Partial<NormalizationPreview> = {}): NormalizationPreview {
  return {
    type_code: "PUCP",
    current_rule: "GENERIC",
    proposed_rule: "INVENTORY",
    total_identifiers: 3,
    changed_count: 2,
    unparseable_count: 0,
    collisions: [],
    changed_examples: [
      { identifier_id: "i-1", piece_id: "p-1", original_value: "I-0007", normalized_value: "I-0007", proposed_value: "I-7" },
    ],
    unparseable_examples: [],
    can_confirm: true,
    confirm_token: "abc",
    notes: [],
    ...overrides,
  };
}

const term = (overrides: Partial<VocabularyTerm> = {}): VocabularyTerm => ({
  id: "t-1",
  vocabulary_code: "TECHNIQUE",
  parent_id: null,
  code: "TALLADO",
  name: "Tallado",
  label: "Tallado",
  description: null,
  sort_order: 0,
  is_active: true,
  external_uri: null,
  ...overrides,
});

describe("términos de una lista de valores", () => {
  it("son etiquetas: verde las activas y gris tachada las desactivadas, con su estado en texto, sin un botón por término", () => {
    const html = render(<TermList terms={[term(), term({ id: "t-2", code: "REPUJADO", label: "Repujado", is_active: false })]} busy={false} onToggle={noop} />);
    const text = visibleText(html);
    expect(text).toContain("Tallado (activo)");
    expect(text).toContain("Repujado (desactivado)");
    expect(html).toMatch(/aria-pressed="true"[^>]*bg-verde-bg|bg-verde-bg[^>]*aria-pressed="true"/);
    expect(html).toContain("line-through");
    expect(html).toContain('title="REPUJADO · Pulse para activar"');
    expect(text).not.toContain("Eliminar");
    expect(text).not.toMatch(/Desactivar|Activar/);
    expect(text).toContain("Pulse una etiqueta para cambiarla.");
  });

  it("una lista sin términos invita a agregar el primero desde la barra", () => {
    expect(visibleText(render(<TermList terms={[]} busy={false} onToggle={noop} />))).toContain("Agregue el primero desde la barra de arriba.");
  });

  it("no cita requisitos", () => {
    expect(visibleText(render(<TermList terms={[term()]} busy={false} onToggle={noop} />))).not.toMatch(/(RF|RN)-0/);
  });
});

describe("listado de colecciones", () => {
  const items = [
    { id: "1", name: "Cerámica de Puno", acronym: "M.M.Z.", parent_id: null, is_active: true, piece_count: 3 },
    { id: "2", name: "Retablos de cajón", acronym: "RAB", parent_id: "1", is_active: false, piece_count: 2 },
  ] as unknown as CollectionItem[];

  it("distingue las subcolecciones con el nombre de su colección padre y el estado con texto", () => {
    const text = visibleText(render(<CollectionsTable items={items} all={items} />));
    expect(text).toContain("Cerámica de Puno");
    expect(text).toContain("Subcolección de Cerámica de Puno");
    expect(text).toContain("Activa");
    expect(text).toContain("Inactiva");
  });

  it("sin resultados lo dice y ofrece limpiar los filtros", () => {
    const text = visibleText(render(<CollectionsTable items={[]} all={items} onClearFilters={noop} />));
    expect(text).toContain("No hay colecciones con estos filtros.");
    expect(text).toContain("Limpiar filtros");
  });
});

describe("tipos de código", () => {
  it("muestra el candado y las reglas fijas de un tipo del sistema", () => {
    const html = render(
      <IdentifierTypesTable
        types={[type({ code: "I", label: "Código I", is_system: true, locks_on_assignment: true, is_unique_when_current: true, owned_pieces_only: true }), type()]}
        selected={null}
        onSelect={noop}
      />,
    );
    const text = visibleText(html);
    expect(html).toContain('aria-label="Tipo del sistema"');
    expect(text).toContain("Del sistema");
    expect(text).toContain("se bloquea al asignarse, es único entre los códigos vigentes, solo aplica a piezas en propiedad.");
    expect(text).toContain("Configurable");
    expect(text).not.toMatch(/(RF|RN)-0/);
    expect(html).toContain('aria-label="Editar I"'); // la edición es un botón de icono con su nombre
  });

  it("explica el impacto y permite confirmar cuando no hay colisiones", () => {
    const text = visibleText(render(<RulePreviewPanel type={type()} preview={preview()} busy={false} onConfirm={noop} onCancel={noop} />));
    expect(text).toContain("Cambiar «Código PUCP» de Texto simple");
    expect(text).toContain("De 3 identificadores registrados, 2 cambian su valor normalizado. Los valores originales no cambian.");
    expect(text).toContain("I-0007 I-0007 I-7");
    expect(text).toContain("Confirmar el cambio de regla");
  });

  it("con colisiones no ofrece confirmar y lista los códigos repetidos", () => {
    const text = visibleText(
      render(
        <RulePreviewPanel
          type={type()}
          preview={preview({ collisions: [{ normalized_value: "I-21", piece_ids: ["p-1", "p-2"] }], can_confirm: false })}
          busy={false}
          onConfirm={noop}
          onCancel={noop}
        />,
      ),
    );
    expect(text).toContain("No se puede confirmar");
    expect(text).toContain("I-21: 2 piezas");
    expect(text).not.toContain("Confirmar el cambio de regla");
    expect(text).toContain("Cerrar");
  });
});

describe("conservación de la ficha", () => {
  it("marca la evaluación más reciente como estado actual", () => {
    const text = visibleText(
      render(
        <ConservationHistory
          assessments={[
            { id: "a-2", piece_id: "p-1", status: { id: "t-2", code: "REGULAR", label: "Regular" }, assessed_at: "2026-10-25T12:00:00Z", assessed_by_user_id: "u-1", assessed_by_label: null, notes: "Grietas leves.", is_current: true },
            { id: "a-1", piece_id: "p-1", status: { id: "t-1", code: "BUENO", label: "Bueno" }, assessed_at: "2024-05-03T12:00:00Z", assessed_by_user_id: null, assessed_by_label: "Conservadora (sintética)", notes: null, is_current: false },
          ]}
        />,
      ),
    );
    expect(text).toContain("Regular 25 de octubre de 2026 Estado actual");
    expect(text).toContain("Grietas leves.");
    expect(text).toContain("Bueno 3 de mayo de 2024 Evaluó: Conservadora (sintética)");
  });

  it("sin evaluaciones lo dice; el formulario explica la fecha antigua", () => {
    expect(visibleText(render(<ConservationHistory assessments={[]} />))).toContain("todavía no tiene evaluaciones");
    const form = visibleText(render(<ConservationForm states={[term({ vocabulary_code: "CONSERVATION_STATUS", code: "BUENO", label: "Bueno" })]} busy={false} onSubmit={noop} />));
    expect(form).toContain("Estado de conservación");
    expect(form).toContain("sin cambiar el estado actual");
    expect(form).toContain("Registrar evaluación");
  });
});
