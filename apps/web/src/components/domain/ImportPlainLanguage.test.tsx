import { describe, expect, it } from "vitest";

import type { MappingTemplate, TemplateDryRun } from "@/lib/data/import-templates";
import { IMPORT_ERROR_MESSAGES, VALIDATION_HINTS, type ImportBatch, type ImportImage, type ImportLog, type ImportRow } from "@/lib/data/imports";
import { draftFromScratch } from "@/lib/data/mapping-editor";
import { render, visibleText } from "@/test/render";

import { ImportConflictModal } from "./ImportConflictModal";
import { MappingEditor } from "./ImportMappingEditor";
import { ImportPhotosView } from "./ImportPhotosPanel";
import { DryRunPanel, FormatProblemPanel } from "./ImportTemplatePanels";
import { UploadPanel } from "./ImportUpload";
import { ApprovalPanel, BatchHeader, FormatBar, ImageReviewPanel, ImportLogPanel, ImportRowCard, ImportSteps, ProgressPanel, RollbackPanel, RowFilters, TenureBanner } from "./ImportWizard";

// Spec importacion-datos — Lenguaje llano sin identificadores de requisitos. Ningún texto que la
// persona lee en el asistente de importación puede traer RF-, RN-, RNF- ni RIA-. Datos sintéticos.

const REQUIREMENT_ID = /\b(RF|RN|RNF|RIA)-\d+/;
const noop = () => {};

const BATCH = { id: "batch-1", file_name: "lote_demo_sabana.xlsx", source_name: "Sábana", status: "IN_PREVIEW", status_reason: null, processing: false, progress: null, counts: {}, sheet_names: ["LOTE"], sheet_name: "LOTE", header_row: 1, headers: ["DENOMINACIÓN"] } as unknown as ImportBatch;

const TEMPLATE: MappingTemplate = {
  id: "tpl-1",
  name: "Sábana de la consultoría",
  source_name: "Consultoría",
  header_signature: "a".repeat(64),
  columns: [],
  defaults: {},
  description: "Columnas de la sábana sintética.",
  created_at: "2026-10-22T10:00:00Z",
};

function row(overrides: Partial<ImportRow> = {}): ImportRow {
  return {
    id: "row-1",
    batch_id: "batch-1",
    source_row_number: 4,
    raw_data: { DENOMINACIÓN: "Retablo" },
    mapped_data: null,
    classification: "CONFLICT",
    has_validation_errors: true,
    validation_errors: [{ code: "loan_for_use_with_inventory_code", message: "Una pieza en comodato no puede tener código I (RN-003)." }],
    matches: [{ kind: "piece", piece_id: "p-1", identifiers: [{ identifier_type: "I", value: "I-0236", via: "current" }], denomination: "Retablo", available: true }],
    diff: [{ field: "provenance", current_value: "Ayacucho", incoming_value: "Huamanga", default_action: "accept" }],
    decision: "PENDING",
    decision_reason: null,
    target_piece_id: null,
    resolution: null,
    action: "SKIP",
    images: [],
    ...overrides,
  };
}

const LOG = { batch: { uploaded_by: "ana@matp.local" }, applied_rows: 3, rejected_rows: 1, entries: [{ source_row_number: 4, action: "SKIP", decision: "REJECTED", reason: "Duplicado." }] } as unknown as ImportLog;
const IMAGE = { id: "img-1", image_number: 1, anchor_row_number: 2, import_row_id: "row-1", status: "PENDING", content_type: "image/jpeg" } as unknown as ImportImage;
const DRY_RUN = { sampled_rows: 1, total_rows: 1, missing_columns: [], columns: [] } as unknown as TemplateDryRun;

function texts(): Record<string, string> {
  const problem = { loading: false, busy: false, error: null, onUse: noop, onAdjust: noop, suggestions: [], templates: [TEMPLATE] };
  return {
    subida: visibleText(render(<UploadPanel busy={false} templates={[TEMPLATE]} loadingTemplates={false} onUpload={noop} />)),
    pasos: visibleText(render(<ImportSteps current={1} />)),
    estado: visibleText(render(<BatchHeader batch={BATCH} />)) + visibleText(render(<ProgressPanel batch={BATCH} />)),
    formato: visibleText(render(<FormatBar formatName="Sábana" busy={false} onChange={noop} />)),
    formatoNoEncaja:
      visibleText(render(<FormatProblemPanel {...problem} issue={{ kind: "unrecognized" }} />)) +
      visibleText(render(<FormatProblemPanel {...problem} issue={{ kind: "missing", template: TEMPLATE, missing: ["FOTO"] }} />)) +
      visibleText(render(<FormatProblemPanel {...problem} issue={{ kind: "change", current: TEMPLATE }} />)),
    regimen: visibleText(render(<TenureBanner count={3} complete busy={false} canAdjust onApply={noop} />)),
    editor: visibleText(
      render(
        <MappingEditor batch={BATCH} draft={draftFromScratch(BATCH)} vocabularies={[]} errors={{}} nameError={null} busy={false} saving={false} previewBusy={false} onChange={noop} onSave={noop} onPreview={noop} onApply={noop} onBack={noop} />,
      ),
    ),
    vistaPrevia: visibleText(render(<DryRunPanel result={DRY_RUN} />)),
    filtros: visibleText(render(<RowFilters active={null} onlyErrors={false} counts={{}} onChange={noop} />)),
    fila: visibleText(render(<ImportRowCard row={row()} canDecide busy={false} onDecide={noop} />)),
    filaAntigua: visibleText(render(<ImportRowCard row={row({ classification: "NEW", matches: [] })} canDecide busy={false} onDecide={noop} />)),
    aprobacion:
      visibleText(render(<ApprovalPanel summary={{ create: 2, update: 1, skip: 3, summary_token: "t" }} canApprove busy={false} onConfirm={noop} />)) +
      visibleText(render(<ApprovalPanel summary={null} canApprove={false} busy={false} onConfirm={noop} />)),
    bitacora: visibleText(render(<ImportLogPanel log={LOG} downloading={false} onDownload={noop} />)),
    reversion:
      visibleText(render(<RollbackPanel canRevert busy={false} conflicts={null} onRevert={noop} />)) +
      visibleText(render(<RollbackPanel canRevert={false} busy={false} conflicts={null} onRevert={noop} />)) +
      visibleText(render(<RollbackPanel canRevert busy={false} conflicts={[{ entityType: "piece", entityId: "p-1", field: "provenance", message: "Cambió después." }]} onRevert={noop} />)),
    imagenes: visibleText(render(<ImageReviewPanel images={[{ image: IMAGE, rowNumber: 2 }]} applied canAssociate busyId={null} onAssociate={noop} />)),
    fotos: visibleText(render(<ImportPhotosView progress={[]} ignored={null} running={false} message={null} error={null} onPick={noop} onResume={noop} />)),
    dialogo: visibleText(render(<ImportConflictModal row={row()} open={false} onClose={noop} onDecide={noop} />)),
  };
}

describe("lenguaje llano en el asistente de importación", () => {
  for (const [name, text] of Object.entries(texts())) {
    it(`«${name}» no muestra identificadores de requisitos`, () => {
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toMatch(REQUIREMENT_ID);
    });
  }

  it("los mensajes de error y las sugerencias tampoco los traen", () => {
    for (const message of Object.values(IMPORT_ERROR_MESSAGES)) expect(message).not.toMatch(REQUIREMENT_ID);
    for (const { hint } of Object.values(VALIDATION_HINTS)) expect(hint).not.toMatch(REQUIREMENT_ID);
  });

  it("una fila con un error guardado antes del cambio se muestra sin la referencia", () => {
    expect(texts().fila).toContain("Una pieza en comodato no puede tener código I.");
  });
});
