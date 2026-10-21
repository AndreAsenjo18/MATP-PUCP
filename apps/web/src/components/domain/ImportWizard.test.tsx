import { describe, expect, it } from "vitest";

import type { ImportBatch, ImportImage, ImportLog, ImportRow } from "@/lib/data/imports";
import { render, visibleText } from "@/test/render";

import { ApprovalPanel, ImageReviewPanel, ImportLogPanel, ImportRowCard, MappingPanel, RowFilters } from "./ImportWizard";

const noop = () => {};
const acceptButton = /<button[^>]*>(?:(?!<\/button>)[\s\S])*Aceptar<\/button>/;

function row(overrides: Partial<ImportRow> = {}): ImportRow {
  return {
    id: "row-1",
    batch_id: "batch-1",
    source_row_number: 4,
    raw_data: { DENOMINACIÓN: "Retablo", __merged: ["X"] },
    mapped_data: null,
    classification: "UPDATE",
    has_validation_errors: false,
    validation_errors: [],
    matches: [],
    diff: [],
    decision: "PENDING",
    decision_reason: null,
    target_piece_id: "p-1",
    resolution: null,
    action: "UPDATE",
    images: [],
    ...overrides,
  };
}

const BATCH = {
  id: "batch-1",
  file_name: "sabana.xlsx",
  status: "UPLOADED",
  sheet_names: ["Resumen", "Inventario"],
  sheet_name: "Resumen",
  header_row: 1,
  headers: ["DENOMINACIÓN"],
} as ImportBatch;

function image(overrides: Partial<ImportImage> = {}): ImportImage {
  return {
    id: "img-1",
    image_number: 1,
    anchor_row_number: 2,
    import_row_id: "row-1",
    status: "PENDING",
    content_type: "image/jpeg",
    size_bytes: 100,
    media_asset_id: null,
    preview_url: null,
    ...overrides,
  };
}

describe("fila de la previsualización (RF-026)", () => {
  it("muestra el diff y avisa cuando la celda vacía conserva el valor actual", () => {
    const html = render(
      <ImportRowCard
        row={row({
          diff: [
            { field: "provenance", current_value: "Ayacucho", incoming_value: "Huamanga", default_action: "accept" },
            { field: "author", current_value: "Taller", incoming_value: null, default_action: "keep" },
          ],
        })}
        canDecide
        busy={false}
        onDecide={noop}
      />,
    );
    const text = visibleText(html);
    expect(text).toContain("provenance : Ayacucho → Huamanga");
    expect(text).toContain("la celda está vacía: se conserva el valor actual");
    expect(text).toContain("Actualizará una pieza existente");
    expect(text).not.toContain("__merged");
  });

  it("un conflicto sin resolver no se acepta y ofrece elegir la pieza o crearla", () => {
    const html = render(
      <ImportRowCard
        row={row({
          classification: "CONFLICT",
          action: "SKIP",
          matches: [{ kind: "piece", piece_id: "0192aaaa-0000", identifiers: [{ identifier_type: "I", value: "I-0236", via: "current" }] }, { kind: "batch_row", row_number: 9 }],
        })}
        canDecide
        busy={false}
        onDecide={noop}
      />,
    );
    const text = visibleText(html);
    expect(html.match(acceptButton)?.[0]).toContain("disabled");
    expect(text).toContain("¿A qué pieza corresponde esta fila?");
    expect(text).toContain("Código I I-0236 (vigente)");
    expect(text).toContain("Es una pieza nueva");
    expect(text).toContain("El mismo código I aparece en la fila 9");
  });

  it("una fila con errores muestra el motivo y no se puede aceptar", () => {
    const html = render(
      <ImportRowCard
        row={row({ classification: "NEW", has_validation_errors: true, validation_errors: [{ message: "Una pieza en comodato no puede tener código I (RN-003)." }] })}
        canDecide
        busy={false}
        onDecide={noop}
      />,
    );
    expect(visibleText(html)).toContain("(RN-003)");
    expect(html.match(acceptButton)?.[0]).toContain("disabled");
  });

  it("sin permiso solo muestra la fila", () => {
    expect(visibleText(render(<ImportRowCard row={row()} canDecide={false} busy={false} onDecide={noop} />))).not.toContain("Rechazar");
  });
});

describe("filtros, mapeo y aprobación", () => {
  it("filtra por clasificación con los conteos del lote", () => {
    const text = visibleText(render(<RowFilters active="CONFLICT" onlyErrors={false} counts={{ CONFLICT: 3, NEW: 2, ERRORS: 1 }} onChange={noop} />));
    expect(text).toContain("Conflictos (3)");
    expect(text).toContain("Nuevas (2)");
    expect(text).toContain("Con errores (1)");
  });

  it("permite elegir hoja, fila de cabeceras y el destino de cada columna", () => {
    const html = render(
      <MappingPanel
        batch={BATCH}
        draft={{ columns: [{ source_column: "DENOMINACIÓN", target_field: "denomination", identifier_type_code: null, split_compound: false }], sheetName: null, headerRow: null, tenureDefault: "" }}
        busy={false}
        errors={{ "": "Debe indicar la columna de la denominación." }}
        onChange={noop}
        onSubmit={noop}
      />,
    );
    const text = visibleText(html);
    expect(text).toContain("Inventario");
    expect(text).toContain("Fila de cabeceras");
    expect(html).toMatch(/<option value="denomination" selected="">Denominación<\/option>/);
    expect(text).toContain("Debe indicar la columna de la denominación.");
  });

  it("muestra el resumen que se aprueba o el aviso de permiso", () => {
    const summary = { create: 2, update: 1, skip: 4, summary_token: "t" };
    expect(visibleText(render(<ApprovalPanel summary={summary} canApprove busy={false} onConfirm={noop} />))).toContain(
      "Se crearán 2 piezas nuevas, se actualizarán 1 pieza y 4 filas no se aplicarán.",
    );
    expect(visibleText(render(<ApprovalPanel summary={summary} canApprove={false} busy={false} onConfirm={noop} />))).toContain("no aprobarla (RF-027)");
  });
});

describe("bitácora e imágenes (RF-028, RF-029)", () => {
  it("lista las filas no aplicadas con su motivo", () => {
    const log: ImportLog = {
      batch: { uploaded_by: "Catalogadora sintética", approved_by: "Curadora sintética", status_reason: null },
      applied_rows: 2,
      rejected_rows: 1,
      entries: [{ source_row_number: 4, classification: "CONFLICT", decision: "REJECTED", action: "SKIP", reason: "Códigos de dos piezas", resolution: null, target_piece_id: null }],
      download_url: null,
    };
    const text = visibleText(render(<ImportLogPanel log={log} downloading={false} onDownload={noop} />));
    expect(text).toContain("Fila 4 — No se aplicará: Códigos de dos piezas");
    expect(text).toContain("Curadora sintética");
    expect(text).toContain("Descargar bitácora (Excel)");
  });

  it("propone cada imagen para su fila y deja las demás sin asignar", () => {
    const html = render(
      <ImageReviewPanel
        images={[
          { image: image(), rowNumber: 2 },
          { image: image({ id: "img-3", image_number: 3, anchor_row_number: 50, import_row_id: null }), rowNumber: null },
        ]}
        applied
        canAssociate
        busyId={null}
        onAssociate={noop}
      />,
    );
    const text = visibleText(html);
    expect(text).toContain("Imagen 1 · fila 2");
    expect(text).toContain("Imagen 3 · sin asignar (anclada en la fila 50, sin datos)");
    expect(text).toContain("Identificador de la pieza");
  });

  it("antes de aplicar no ofrece asociar", () => {
    const text = visibleText(render(<ImageReviewPanel images={[{ image: image(), rowNumber: 2 }]} applied={false} canAssociate busyId={null} onAssociate={noop} />));
    expect(text).toContain("Podrá asociarlas cuando el lote esté aplicado.");
    expect(text).not.toContain("Asociar a la pieza");
  });
});
