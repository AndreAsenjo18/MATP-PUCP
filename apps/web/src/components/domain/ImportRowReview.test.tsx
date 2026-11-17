import { describe, expect, it } from "vitest";

import type { GeminiOpinion } from "@/lib/data/import-row-review";
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

const SAME: GeminiOpinion = { verdict: "same", pieceId: "p-1", reason: "Mismo código y misma denominación.", confidence: 0.95, pick: "p-1" };

describe("RowReviewNotice", () => {
  it("dice que las filas sin problemas se importan solas y ofrece pedir la revisión de Gemini", () => {
    const text = visibleText(render(<RowReviewNotice importedAlone={58} toDecideCount={9} gemini="idle" canAsk onAsk={noop} />));
    expect(text).toContain("58 filas no necesitan nada: se importan solas al aprobar.");
    expect(text).toContain("Pedir a Gemini que revise estas 9");
  });

  it("sin permiso o sin nada que decidir no ofrece Gemini", () => {
    expect(visibleText(render(<RowReviewNotice importedAlone={5} toDecideCount={9} gemini="idle" canAsk={false} onAsk={noop} />))).not.toContain("Pedir a Gemini");
    expect(visibleText(render(<RowReviewNotice importedAlone={5} toDecideCount={0} gemini="idle" canAsk onAsk={noop} />))).not.toContain("Pedir a Gemini");
  });

  it("muestra el avance mientras Gemini revisa", () => {
    expect(visibleText(render(<RowReviewNotice importedAlone={5} toDecideCount={9} gemini="running" progress={{ done: 3, total: 9 }} canAsk onAsk={noop} />))).toContain("Gemini está revisando: 3 de 9");
  });
});

describe("RowList", () => {
  it("una línea por fila con su código y lo que opina Gemini", () => {
    const text = visibleText(render(<RowList rows={[row(), row({ id: "row-2", source_row_number: 3, classification: "NEW", matches: [] })]} opinions={new Map([["row-1", SAME]])} onOpen={noop} />));
    expect(text).toContain("Arpa sintética");
    expect(text).toContain("MMZ 2");
    expect(text).toContain("Gemini: misma pieza");
    expect(text).toContain("Decidir");
    expect(text).toContain("Se importa como nueva");
  });
});

describe("RowDecisionPanel", () => {
  it("muestra la opinión de Gemini, preselecciona su sugerencia y pide confirmar", () => {
    const html = render(<RowDecisionPanel row={row()} position={{ index: 1, total: 9 }} opinion={SAME} busy={false} canDecide fallback={null} onDecide={noop} onClose={noop} />);
    const text = visibleText(html);
    expect(text).toContain("¿A qué pieza corresponde? · 1 de 9");
    expect(text).toContain("Es la misma pieza que «Arpa»");
    expect(text).toContain("Mismo código y misma denominación.");
    expect(text).toContain("Sugerida por Gemini");
    expect(text).toContain("Revise y confirme: nada se guarda sin «Aceptar».");
    expect(html).toMatch(/<input type="radio"[^>]*checked=""/);
    expect(text).toContain("Aceptar y siguiente");
  });

  it("sin Gemini no preselecciona nada y no deja aceptar todavía", () => {
    const html = render(<RowDecisionPanel row={row()} position={null} opinion={null} busy={false} canDecide fallback={null} onDecide={noop} onClose={noop} />);
    expect(visibleText(html)).not.toContain("Sugerida por Gemini");
    expect(html).not.toMatch(/<input type="radio"[^>]*checked=""/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Aceptar y siguiente/);
  });

  it("una fila sin pieza que elegir muestra su tarjeta de siempre", () => {
    const text = visibleText(render(<RowDecisionPanel row={row({ classification: "UPDATE" })} position={null} opinion={null} busy={false} canDecide fallback={<p>Tarjeta de la fila</p>} onDecide={noop} onClose={noop} />));
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
    const text = visibleText(render(<RowList rows={[row({ id: "n", classification: "NEW", matches: [] })]} opinions={new Map()} onOpen={noop} />));
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

  it("en el panel de una fila nueva aparece abierta", () => {
    const html = render(<RowDecisionPanel row={row({ classification: "NEW", matches: [], preview })} position={null} opinion={null} busy={false} canDecide fallback={null} onDecide={noop} onClose={noop} />);
    expect(html).toMatch(/<details open=""/);
    expect(visibleText(html)).toContain("Así quedaría la ficha");
  });
});
