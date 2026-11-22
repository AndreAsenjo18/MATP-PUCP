import { describe, expect, it } from "vitest";

import type { ImportRow } from "@/lib/data/imports";
import { render, visibleText } from "@/test/render";

import { PiecePreview, RowDecisionPanel, RowList, RowReviewNotice } from "./ImportRowReview";

// Change importacion-revision-filas-compacta. Datos sintéticos (RNF-014).

const noop = () => {};

function row(overrides: Partial<ImportRow> = {}): ImportRow {
  return {
    id: "row-1",
    batch_id: "batch-1",
    source_row_number: 2,
    raw_data: { Nombre: "Arpa sintética", Código: "MMZ 2" },
    mapped_data: { fields: { denomination: "Arpa sintética" }, identifiers: [{ type: "COLECCION", original_value: "MMZ 2", normalized_value: "MMZ 2" }] },
    classification: "POSSIBLE_DUPLICATE",
    has_validation_errors: false,
    validation_errors: [],
    matches: [{ kind: "similar_piece", piece_id: "p-1", score: 0.9, denomination: "Arpa" }],
    diff: [],
    decision: "PENDING",
    decision_reason: null,
    target_piece_id: null,
    resolution: null,
    action: "CREATE",
    images: [],
    ...overrides,
  };
}

describe("RowReviewNotice", () => {
  it("dice que las filas sin problemas se importan solas, sin ofrecer Gemini (se retiró con la cola de duplicados)", () => {
    const text = visibleText(render(<RowReviewNotice importedAlone={58} toDecideCount={9} />));
    expect(text).toContain("58 filas no necesitan nada: se importan solas al aprobar.");
    expect(text).toContain("Decida las que tienen el código de una pieza que ya está.");
    expect(text).not.toContain("Gemini");
  });

  it("sin nada que decidir no pide decidir", () => {
    expect(visibleText(render(<RowReviewNotice importedAlone={5} toDecideCount={0} />))).not.toContain("Decida");
  });
});

describe("RowList", () => {
  it("una línea por fila con su código y qué pasa", () => {
    const text = visibleText(render(<RowList rows={[row(), row({ id: "row-2", source_row_number: 3, classification: "NEW", matches: [] })]} onOpen={noop} />));
    expect(text).toContain("Arpa sintética");
    expect(text).toContain("MMZ 2");
    expect(text).toContain("Decidir");
    expect(text).toContain("Se importa como nueva");
    expect(text).not.toContain("Gemini");
  });
});

describe("RowDecisionPanel", () => {
  it("no preselecciona nada y no deja aceptar hasta que la persona elige", () => {
    const html = render(<RowDecisionPanel row={row()} position={{ index: 1, total: 9 }} busy={false} canDecide fallback={null} onDecide={noop} onClose={noop} />);
    const text = visibleText(html);
    expect(text).toContain("¿A qué pieza corresponde? · 1 de 9");
    expect(text).not.toContain("Gemini");
    expect(html).not.toMatch(/<input type="radio"[^>]*checked=""/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Aceptar y siguiente/);
  });

  it("una fila sin pieza que elegir muestra su tarjeta de siempre", () => {
    const text = visibleText(render(<RowDecisionPanel row={row({ classification: "UPDATE" })} position={null} busy={false} canDecide fallback={<p>Tarjeta de la fila</p>} onDecide={noop} onClose={noop} />));
    expect(text).toContain("Tarjeta de la fila");
    expect(text).not.toContain("Aceptar y siguiente");
  });
});

describe("Así quedaría la ficha (change importacion-vista-previa-ficha)", () => {
  const preview = {
    denomination: "Ave sintética",
    collection: "Colección sintética",
    codes: [{ type: "COLECCION", value: "ACG 045" }],
    tenure_regime: "Propiedad",
    object_type: "Escultura",
    materials: ["Madera", "Cuero"],
    conservation_status: "Regular",
    dimensions: [{ dimension: "alto", value: 20, unit: "cm" }],
    location: null,
    location_text: "Deposito N° 1",
  };

  it("cada fila tiene «Ver ficha», también las que no piden decidir", () => {
    const text = visibleText(render(<RowList rows={[row({ id: "n", classification: "NEW", matches: [] })]} onOpen={noop} />));
    expect(text).toContain("Ver ficha");
  });

  it("muestra los grupos de la ficha con nombres, y lo que falta como «Sin registrar»", () => {
    const text = visibleText(render(<PiecePreview preview={preview} />));
    expect(text).toContain("Identificación");
    expect(text).toContain("ACG 045".replace("ACG", "COLECCION ACG"));
    expect(text).toContain("Madera, Cuero");
    expect(text).toContain("Alto 20 cm");
    expect(text).toContain("Regular");
    expect(text).toContain("Procedencia Sin registrar");
    expect(text).toContain("«Deposito N° 1»: no existe en el museo");
  });

  it("un valor del archivo que no está en la lista se muestra con su texto, no como «Sin registrar»", () => {
    const text = visibleText(
      render(
        <PiecePreview
          preview={{ ...preview, object_type: null, materials: ["Madera"], acquisition_method: null, unmatched_terms: { OBJECT_TYPE: ["Escultura"], MATERIAL: ["Piedra sintética"], ACQUISITION_METHOD: ["Donación sintética"] } }}
        />,
      ),
    );
    expect(text).toContain("Tipo de bien «Escultura»: no está en la lista");
    expect(text).toContain("Madera · «Piedra sintética»: no está en la lista");
    expect(text).toContain("Forma de adquisición «Donación sintética»: no está en la lista");
  });

  it("en el panel de una fila nueva aparece abierta", () => {
    const html = render(<RowDecisionPanel row={row({ classification: "NEW", matches: [], preview })} position={null} busy={false} canDecide fallback={null} onDecide={noop} onClose={noop} />);
    expect(html).toMatch(/<details open=""/);
    expect(visibleText(html)).toContain("Así quedaría la ficha");
  });
});

describe("Fotos en la lista de filas (fix importacion-esperar-fotos)", () => {
  it("muestra la miniatura y cuántas fotos tiene cada fila", () => {
    const rows = [row({ id: "a", classification: "NEW", matches: [] }), row({ id: "b", classification: "NEW", matches: [], source_row_number: 3 })];
    const html = render(<RowList rows={rows} onOpen={noop} photos={new Map([["a", { url: "https://example.test/a.webp", count: 2 }]])} />);
    expect(html).toContain('src="https://example.test/a.webp"');
    expect(visibleText(html)).toContain("2 fotos");
    expect(visibleText(html)).toContain("Sin foto");
  });

  it("sin fotos en el lote no agrega la columna", () => {
    expect(visibleText(render(<RowList rows={[row()]} onOpen={noop} />))).not.toContain("Fotos");
  });
});
