import { describe, expect, it } from "vitest";

import type { ImportBatch, ImportImage, ImportLog, ImportRow } from "@/lib/data/imports";
import { render, visibleText } from "@/test/render";

import { ApprovalPanel, BatchHeader, FormatBar, ImageReviewPanel, ImportLogPanel, ImportRowCard, ImportSteps, ProgressPanel, RollbackPanel, RowFilters, TenureBanner } from "./ImportWizard";

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
    expect(text).toContain("Cambios sobre la pieza del catálogo");
    expect(text).toContain("Procedencia");
    expect(text).toContain("Ayacucho");
    expect(text).toContain("Huamanga");
    expect(text).toContain("Celda vacía: se conserva el valor actual.");
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
    expect(text).toContain("Mismo código: I-0236 (vigente)");
    expect(text).toContain("Ninguna: es una pieza nueva");
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
    const text = visibleText(html);
    expect(text).toContain("Una pieza en comodato no puede tener código I.");
    expect(text).not.toMatch(/\bRN-\d+/);
    expect(html.match(acceptButton)?.[0]).toContain("disabled");
  });

  it("una fila con errores se puede dejar fuera o rechazar, y solo aceptar queda bloqueada con su motivo", () => {
    const html = render(
      <ImportRowCard
        row={row({ classification: "NEW", has_validation_errors: true, validation_errors: [{ code: "tenure_required", message: "Falta el régimen de tenencia." }] })}
        canDecide
        busy={false}
        onDecide={noop}
      />,
    );
    const text = visibleText(html);
    expect(text).toContain("Falta el régimen de tenencia.");
    expect(text).toContain("Elija un régimen para las filas que no lo traen");
    expect(text).toContain("Esta fila tiene errores y no se puede aceptar. Puede dejarla fuera o rechazarla.");
    expect(html.match(acceptButton)?.[0]).toContain("disabled");
    expect(html).toMatch(/<button(?![^>]*\sdisabled="")[^>]*>(?:(?!<\/button>)[\s\S])*Dejar fuera/);
    expect(html).toMatch(/<button(?![^>]*\sdisabled="")[^>]*>(?:(?!<\/button>)[\s\S])*Rechazar/);
    expect(html).toContain("aria-describedby");
  });

  it("explica en una línea qué hace cada decisión y no usa «Excluir»", () => {
    const text = visibleText(render(<ImportRowCard row={row()} canDecide busy={false} onDecide={noop} />));
    expect(text).toContain("Se importa al aprobar el lote.");
    expect(text).toContain("No se importa. Puede cambiar de idea.");
    expect(text).toContain("Queda en la bitácora con su motivo.");
    expect(text).not.toContain("Excluir");
  });

  it("muestra la denominación de la fila, pliega los datos del archivo y alinea los cambios en tres columnas", () => {
    const html = render(
      <ImportRowCard
        row={row({
          mapped_data: { fields: { denomination: "Retablo ayacuchano" } },
          diff: [{ field: "provenance", current_value: "Ayacucho", incoming_value: "Huamanga", default_action: "accept" }],
        })}
        canDecide
        busy={false}
        onDecide={noop}
      />,
    );
    expect(visibleText(html)).toContain("Retablo ayacuchano");
    expect(html).toContain("<details");
    expect(visibleText(html)).toContain("Ver datos del archivo");
    expect(html).toContain("sm:grid-cols-[minmax(8rem,1fr)_2fr_2fr]");
    expect(html).not.toContain("<fieldset");
  });

  it("distingue los candidatos de un duplicado por su colección y código I", () => {
    const toro = { denomination: "Toro de Pucará", available: true };
    const html = render(
      <ImportRowCard
        row={row({
          classification: "POSSIBLE_DUPLICATE",
          action: "SKIP",
          matches: [
            { kind: "similar_piece", piece_id: "p-1", score: 0.9, ...toro, collection_name: "Cerámica de Puno", inventory_code: "I-0236" },
            { kind: "similar_piece", piece_id: "p-2", score: 0.9, ...toro, collection_name: "Colección Cusco", inventory_code: null },
          ],
        })}
        canDecide
        busy={false}
        onDecide={noop}
      />,
    );
    const text = visibleText(html);
    expect(text).toContain("Toro de Pucará · Cerámica de Puno · Código I-0236");
    expect(text).toContain("Toro de Pucará · Colección Cusco · Sin código I");
    expect(html.match(/<option/g)).toHaveLength(4);
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

  it("muestra el resumen que se aprueba o el aviso de permiso", () => {
    const summary = { create: 2, update: 1, skip: 4, summary_token: "t" };
    expect(visibleText(render(<ApprovalPanel summary={summary} canApprove busy={false} onConfirm={noop} />))).toContain(
      "Se crearán 2 piezas nuevas, se actualizarán 1 pieza y 4 filas no se aplicarán.",
    );
    expect(visibleText(render(<ApprovalPanel summary={summary} canApprove={false} busy={false} onConfirm={noop} />))).toContain("no aprobarla");
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

  it("ofrece revertir un lote aplicado con motivo solo al Administrador", () => {
    const admin = visibleText(render(<RollbackPanel canRevert busy={false} conflicts={null} onRevert={noop} />));
    expect(admin).toContain("Revertir lote");
    expect(admin).toContain("Motivo de la reversión");
    expect(admin).toContain("nada se borra");

    const other = visibleText(render(<RollbackPanel canRevert={false} busy={false} conflicts={null} onRevert={noop} />));
    expect(other).toContain("Solo un Administrador puede revertir");
    expect(other).not.toContain("Revertir lote");
  });

  it("lista las ediciones posteriores y pide confirmarlas antes de pisarlas", () => {
    const conflicts = [{ entityType: "piece", entityId: "p-1", field: "provenance", message: "La procedencia cambió después del lote." }];

    const text = visibleText(render(<RollbackPanel canRevert busy={false} conflicts={conflicts} onRevert={noop} />));

    expect(text).toContain("La procedencia cambió después del lote.");
    expect(text).toContain("Revertir también estas ediciones");
  });
});

function batch(overrides: Partial<ImportBatch> = {}): ImportBatch {
  return {
    id: "batch-1",
    file_name: "lote_demo_sabana.xlsx",
    source_name: "Sábana",
    status: "IN_PREVIEW",
    status_reason: null,
    processing: false,
    progress: null,
    counts: {},
    ...overrides,
  } as ImportBatch;
}

describe("avance en cuatro pasos", () => {
  it("marca el paso actual, los completados y dice el estado en texto", () => {
    const html = render(<ImportSteps current={1} />);
    const text = visibleText(html);
    expect(text).toContain("Archivo (completado)");
    expect(text).toContain("Revisión (paso actual)");
    expect(text).toContain("Aprobación");
    expect(text).toContain("Resultado");
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
  });

  it("en móvil se reduce a «Paso x de 4» con su barra", () => {
    const html = render(<ImportSteps current={1} />);
    expect(visibleText(html)).toContain("Paso 2 de 4 · Revisión");
    expect(html).toContain("sm:hidden");
    expect(html).toContain("width:50%");
  });

  it("un lote aplicado deja los cuatro pasos completados", () => {
    const html = render(<ImportSteps current={3} complete />);
    expect(visibleText(html)).toContain("Resultado (completado)");
    expect(html).not.toContain('aria-current="step"');
    expect(html).toContain("width:100%");
  });
});

describe("estado del lote", () => {
  it("muestra el archivo, la etiqueta de estado y el estado en palabras de todos los días", () => {
    const text = visibleText(render(<BatchHeader batch={batch()} />));
    expect(text).toContain("lote_demo_sabana.xlsx");
    expect(text).toContain("Listo para revisar");
  });

  it("explica el motivo cuando el lote falló", () => {
    const text = visibleText(render(<BatchHeader batch={batch({ status: "FAILED_APPLY", status_reason: "Falló una fila al aplicar." })} />));
    expect(text).toContain("No se pudo aplicar: revise las filas");
    expect(text).toContain("Falló una fila al aplicar.");
  });

  it("durante una etapa en segundo plano muestra el avance en filas y su barra", () => {
    const processing = batch({ status: "UPLOADED", processing: true, progress: { stage: "VALIDATE", done: 2000, total: 8000 } });
    expect(visibleText(render(<BatchHeader batch={processing} />))).toContain("Validando y buscando coincidencias");
    const html = render(<ProgressPanel batch={processing} />);
    expect(html).toContain("width:25%");
    expect(visibleText(html)).toContain("Puede salir de esta pantalla");
  });
});

describe("filas sin régimen de tenencia", () => {
  it("cuenta las filas y ofrece un régimen para todas con validar de nuevo", () => {
    const html = render(<TenureBanner count={30} complete busy={false} canAdjust onApply={noop} />);
    const text = visibleText(html);
    expect(text).toContain("30 filas no traen régimen de tenencia");
    expect(text).toContain("las filas que ya lo traen no cambian");
    expect(text).toContain("Aplicar y validar de nuevo");
    expect(html).toContain('<option value="Comodato"');
  });

  it("si el recuento quedó incompleto lo dice y si no hay filas no aparece", () => {
    expect(visibleText(render(<TenureBanner count={2000} complete={false} busy={false} canAdjust onApply={noop} />))).toMatch(/2[.,]000 o más/);
    expect(render(<TenureBanner count={0} complete busy={false} canAdjust onApply={noop} />)).toBe("");
  });

  it("avisa que validar de nuevo descarta las decisiones ya tomadas", () => {
    const text = visibleText(render(<TenureBanner count={30} complete decided={4} busy={false} canAdjust onApply={noop} />));
    expect(text).toContain("las 4 decisiones que ya tomó se pierden");
    expect(visibleText(render(<TenureBanner count={30} complete decided={1} busy={false} canAdjust onApply={noop} />))).toContain("la decisión que ya tomó se pierde");
    expect(visibleText(render(<TenureBanner count={30} complete decided={0} busy={false} canAdjust onApply={noop} />))).not.toContain("se pierde");
  });

  it("sin mapeo que reaplicar lleva a «Ajustar columnas» en vez de pedir el régimen", () => {
    const html = render(<TenureBanner count={1} complete busy={false} canAdjust={false} onApply={noop} />);
    const text = visibleText(html);
    expect(text).toContain("1 fila no trae régimen de tenencia");
    expect(text).toContain("Ajustar columnas");
    expect(html).not.toContain("<select");
  });
});

describe("formato aplicado", () => {
  it("dice con qué formato se leyó el archivo y deja cambiarlo", () => {
    const text = visibleText(render(<FormatBar formatName="Sábana de la consultoría" busy={false} onChange={noop} />));
    expect(text).toContain("Formato aplicado: Sábana de la consultoría");
    expect(text).toContain("Cambiar formato");
  });

  it("sin plantilla indica que las columnas se ajustaron a mano", () => {
    expect(visibleText(render(<FormatBar formatName={null} busy={false} onChange={noop} />))).toContain("columnas ajustadas a mano");
  });
});
