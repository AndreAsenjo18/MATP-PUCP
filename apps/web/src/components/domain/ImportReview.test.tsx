import { describe, expect, it } from "vitest";

import type { PhotoProgress } from "@/lib/data/importPhotos";
import type { ErrorGroup } from "@/lib/data/import-review";
import type { ImportRow } from "@/lib/data/imports";
import { render, visibleText } from "@/test/render";

import { ImportPhotosView, photosOneLine } from "./ImportPhotosPanel";
import { RepeatedErrorBlock, ReviewSummaryPanel } from "./ImportReview";
import { ApprovalPanel, ImportRowCard } from "./ImportWizard";

// Spec importacion-datos — Resumen de la revisión, Errores repetidos agrupados, Aprobación siempre
// visible. Datos sintéticos (RNF-014).

const noop = () => {};
const ALL = { classification: null, onlyErrors: false } as const;

function group(count: number, overrides: Partial<ErrorGroup> = {}): ErrorGroup {
  return {
    key: "tenure_required|Falta el régimen de tenencia.",
    code: "tenure_required",
    message: "Falta el régimen de tenencia.",
    rowIds: Array.from({ length: count }, (_, i) => `row-${i}`),
    rowNumbers: Array.from({ length: count }, (_, i) => i + 2),
    undecided: count,
    ...overrides,
  };
}

function row(overrides: Partial<ImportRow> = {}): ImportRow {
  return {
    id: "row-1",
    batch_id: "batch-1",
    source_row_number: 4,
    raw_data: { DENOMINACIÓN: "Retablo" },
    mapped_data: null,
    classification: "UPDATE",
    has_validation_errors: true,
    validation_errors: [{ code: "tenure_required", message: "Falta el régimen de tenencia." }],
    matches: [],
    diff: [],
    decision: "PENDING",
    decision_reason: null,
    target_piece_id: null,
    resolution: null,
    action: "SKIP",
    images: [],
    ...overrides,
  } as ImportRow;
}

describe("resumen de la revisión", () => {
  it("dice el total y reparte las filas sin contarlas dos veces", () => {
    const html = render(
      <ReviewSummaryPanel summary={{ total: 30, errors: 30, conflicts: 0, duplicates: 0, updates: 0, news: 0 }} filter={ALL} onFilter={noop} sentence="Falta decidir: 30 filas con error sin decidir." />,
    );
    const text = visibleText(html);
    expect(text).toContain("30 filas");
    expect(text).toContain("Con errores (30)");
    expect(text).toContain("Conflictos (0)");
    expect(text).toContain("Falta decidir: 30 filas con error sin decidir.");
    // Cada cifra filtra la lista: son botones; las que están en 0 no se pueden pulsar.
    expect(html).toContain('aria-pressed="true"');
    expect(html.match(/<button[^>]*disabled=""/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("marca como activa la cifra filtrada", () => {
    const html = render(
      <ReviewSummaryPanel summary={{ total: 10, errors: 0, conflicts: 2, duplicates: 0, updates: 3, news: 5 }} filter={{ classification: "CONFLICT", onlyErrors: false }} onFilter={noop} sentence="x" />,
    );
    expect(html).toMatch(/aria-pressed="true"[^>]*>(?:(?!<\/button>)[\s\S])*Conflictos \(2\)/);
  });

  it("con el lote vacío lo dice y no ofrece filtros", () => {
    const html = render(<ReviewSummaryPanel summary={{ total: 0, errors: 0, conflicts: 0, duplicates: 0, updates: 0, news: 0 }} filter={ALL} onFilter={noop} sentence="El archivo no trajo filas: no hay nada que aprobar." />);
    expect(visibleText(html)).toContain("El archivo no trajo filas");
    expect(html).not.toContain("<button");
  });

  it("mientras no se puede calcular lo dice, sin inventar cifras", () => {
    const text = visibleText(render(<ReviewSummaryPanel summary={null} filter={ALL} onFilter={noop} sentence="Calculando el resumen…" />));
    expect(text).toContain("Calculando el resumen…");
    expect(text).not.toContain("Conflictos");
  });
});

describe("bloque de un error repetido", () => {
  const props = { totalRows: 30, canDecide: true, busy: false, progress: null, onChangeFormat: noop, onExcludeAll: noop };

  it("muestra una sola vez el mensaje y el número de filas, con las filas plegadas", () => {
    const html = render(
      <RepeatedErrorBlock group={group(30)} cause={null} {...props}>
        <span>filas</span>
      </RepeatedErrorBlock>,
    );
    const text = visibleText(html);
    expect(text).toContain("30 filas: Falta el régimen de tenencia");
    expect(text).toContain("Ver las 30 filas");
    expect(text).toContain("Elija un régimen para las filas que no lo traen");
    expect(html).not.toMatch(/<details[^>]*\bopen\b/);
    // Las filas no se montan hasta abrir el desplegable.
    expect(html).not.toContain("<span>filas</span>");
  });

  it("ofrece dejar fuera todas las filas sin decidir", () => {
    const text = visibleText(render(<RepeatedErrorBlock group={group(30)} cause={null} {...props}>{null}</RepeatedErrorBlock>));
    expect(text).toContain("Dejar fuera las 30 filas");
  });

  it("no ofrece dejar fuera si ya están todas decididas, ni acciones sin permiso", () => {
    const decided = visibleText(render(<RepeatedErrorBlock group={group(30, { undecided: 0 })} cause={null} {...props}>{null}</RepeatedErrorBlock>));
    expect(decided).not.toContain("Dejar fuera las");
    const noPermission = visibleText(render(<RepeatedErrorBlock group={group(30)} cause={null} {...props} canDecide={false}>{null}</RepeatedErrorBlock>));
    expect(noPermission).not.toContain("Dejar fuera las");
    expect(noPermission).not.toContain("Cambiar formato");
  });

  it("nombra el formato y la columna y ofrece cambiar de formato primero", () => {
    const text = visibleText(
      render(
        <RepeatedErrorBlock group={group(30)} cause={{ formatName: "Plantilla sábana sintética v1", columnLabel: "régimen de tenencia" }} {...props}>
          {null}
        </RepeatedErrorBlock>,
      ),
    );
    expect(text).toContain("El formato «Plantilla sábana sintética v1» no trae la columna de régimen de tenencia.");
    expect(text).toContain("Cambiar formato");
  });

  it("sin relación con el formato no lo menciona", () => {
    const text = visibleText(
      render(
        <RepeatedErrorBlock group={group(30, { code: "title_required", message: "Falta la denominación." })} cause={null} {...props}>
          {null}
        </RepeatedErrorBlock>,
      ),
    );
    expect(text).toContain("Falta la denominación");
    expect(text).not.toContain("El formato");
    expect(text).not.toContain("Cambiar formato");
  });

  it("muestra el avance de «dejar fuera»", () => {
    const text = visibleText(render(<RepeatedErrorBlock group={group(30)} cause={null} {...props} progress={{ done: 10, total: 30 }}>{null}</RepeatedErrorBlock>));
    expect(text).toContain("Dejando fuera… 10 de 30");
  });
});

describe("fila compacta", () => {
  it("ocupa una línea con la etiqueta corta y no repite la sugerencia", () => {
    const html = render(<ImportRowCard row={row()} compact canDecide busy={false} onDecide={noop} />);
    const text = visibleText(html);
    expect(html).toMatch(/<details/);
    expect(text).toContain("Sin régimen");
    expect(text).not.toContain("Elija un régimen para las filas");
    // Al abrirla conserva sus tres acciones.
    expect(text).toContain("Aceptar");
    expect(text).toContain("Dejar fuera");
    expect(text).toContain("Rechazar");
  });

  it("una fila normal sigue mostrando su error con su sugerencia", () => {
    const text = visibleText(render(<ImportRowCard row={row()} canDecide busy={false} onDecide={noop} />));
    expect(text).toContain("Falta el régimen de tenencia.");
    expect(text).toContain("Elija un régimen para las filas que no lo traen");
  });
});

describe("barra de aprobación", () => {
  const summary = { create: 12, update: 18, skip: 2, summary_token: "t" };

  it("va pegada al pie y dice qué se aplicará y qué falta", () => {
    const html = render(<ApprovalPanel summary={summary} canApprove busy={false} onConfirm={noop} pendingText="No hay nada pendiente: puede aprobar la carga." />);
    expect(html).toContain("sticky");
    expect(html).toContain("bottom-0");
    const text = visibleText(html);
    expect(text).toContain("Aprobar y aplicar");
    expect(text).toContain("No hay nada pendiente");
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Aprobar y aplicar/);
  });

  it("sin nada que aplicar desactiva el botón y dice por qué", () => {
    const html = render(<ApprovalPanel summary={{ create: 0, update: 0, skip: 30, summary_token: "t" }} canApprove busy={false} onConfirm={noop} />);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Aprobar y aplicar/);
    expect(visibleText(html)).toContain("No hay filas para aplicar");
  });

  it("sin permiso de aprobar dice quién puede hacerlo", () => {
    const text = visibleText(render(<ApprovalPanel summary={summary} canApprove={false} busy={false} onConfirm={noop} />));
    expect(text).toContain("La aprueba un Gestor de colecciones o un Administrador");
  });
});

function photos(count: number, status: PhotoProgress["status"], from = 0): PhotoProgress[] {
  return Array.from({ length: count }, (_, i) => ({ relativePath: `fotos/I ${9100 + from + i}.jpg`, size: 1000, loaded: status === "uploaded" ? 1000 : 0, status }));
}

describe("fotografías del lote en resumen", () => {
  it("80 fotos subidas: una línea y la lista plegada", () => {
    const progress = [...photos(78, "uploaded"), ...photos(2, "registered", 78)];
    expect(photosOneLine(progress)).toBe("80 fotos: 78 subidas, 2 ya estaban");
    const html = render(<ImportPhotosView progress={progress} ignored={null} running={false} message={null} error={null} />);
    const text = visibleText(html);
    expect(text).toContain("80 fotos: 78 subidas, 2 ya estaban");
    expect(text).toContain("Ver los archivos");
    expect(html).toMatch(/<details(?![^>]*open)/);
  });

  it("las rechazadas se cuentan y aparecen primero al abrir la lista", () => {
    const progress = [...photos(5, "uploaded"), ...photos(3, "rejected", 5).map((item) => ({ ...item, reason: "tipo de archivo" }))];
    expect(photosOneLine(progress)).toBe("8 fotos: 5 subidas, 3 rechazadas");
    const html = render(<ImportPhotosView progress={progress} ignored={null} running={false} message={null} error={null} />);
    expect(html.indexOf("Rechazada: tipo de archivo")).toBeLessThan(html.indexOf("Subida"));
  });

  it("una subida interrumpida dice cuántas van y deja Reanudar a la vista", () => {
    const progress = [...photos(40, "uploaded"), ...photos(40, "pending", 40)];
    expect(photosOneLine(progress)).toBe("40 de 80 fotos subidas");
    const html = render(<ImportPhotosView progress={progress} ignored={null} running={false} message={null} error={null} onResume={noop} />);
    expect(visibleText(html)).toContain("Reanudar");
  });
});
