"use client";

/**
 * Asistente de importación en modo `live` (change `importacion-pipeline-reconciliacion`, tareas
 * 6.1 y 6.2): subida, hoja y cabeceras, mapeo, progreso, previsualización con filtros, diff y
 * decisiones, resumen y aprobación, bitácora e imágenes. El paso visible sale del estado del lote
 * (`wizardStep`); mientras una etapa corre en el servidor se consulta su avance.
 *
 * El lote en curso se recuerda en la URL (`?lote=`) para poder volver a él.
 *
 * En el paso «Mapeo» se ofrecen primero las plantillas guardadas (change
 * `plantillas-mapeo-y-normalizacion`, tarea 4.1A): las sugeridas por las cabeceras del archivo,
 * la lista completa y «Empezar desde cero», que por ahora abre el panel de mapeo por columnas.
 * Con una plantilla se puede ver la vista previa por columna y validar con `template_id`.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ApprovalPanel,
  BatchHeader,
  ErrorNotice,
  ImageReviewPanel,
  ImportLogPanel,
  ImportRowCard,
  ImportSteps,
  MappingPanel,
  ProgressPanel,
  RowFilters,
  UploadPanel,
  type MappingDraft,
  type ReviewImage,
} from "@/components/domain/ImportWizard";
import { AppliedTemplatePanel, DryRunPanel, TemplatePicker } from "@/components/domain/ImportTemplatePanels";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSession } from "@/lib/auth/session";
import {
  applyBlocker,
  dryRunTemplate,
  fetchTemplates,
  mappingFailureMessage,
  saveBatchMapping,
  suggestTemplates,
  type MappingTemplate,
  type TemplateDryRun,
  type TemplateSuggestion,
} from "@/lib/data/import-templates";
import {
  IMPORT_PAGE_SIZE,
  IMPORT_POLL_MS,
  associateImportImage,
  changedSummary,
  confirmImportBatch,
  decideImportRow,
  downloadImportLog,
  fetchImportBatch,
  fetchImportDiffs,
  fetchImportLog,
  isProcessing,
  mappingRequest,
  saveImportMapping,
  startImportValidation,
  suggestMapping,
  uploadImportFile,
  wizardStep,
  type ImportBatch,
  type ImportDiffs,
  type ImportLog,
  type RowClassification,
  type RowDecisionInput,
} from "@/lib/data/imports";

function draftFor(batch: ImportBatch): MappingDraft {
  return { columns: suggestMapping(batch.headers ?? []), sheetName: batch.sheet_name ?? null, headerRow: batch.header_row ?? null, tenureDefault: "" };
}

function mappingErrors(details: Record<string, unknown> | undefined): Record<string, string> {
  const errors: Record<string, string> = {};
  const list = Array.isArray(details?.errors) ? details.errors : [];
  for (const item of list) {
    if (typeof item === "object" && item !== null) {
      const { column, message } = item as { column?: string | null; message?: string };
      const key = column ?? "";
      errors[key] = errors[key] ? `${errors[key]} ${message ?? ""}` : (message ?? "");
    }
  }
  return errors;
}

export function LiveImportWizard() {
  const { currentUser, hasPermission } = useSession();
  const devUser = currentUser?.email;
  const router = useRouter();
  const params = useSearchParams();
  const batchId = params.get("lote");

  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<MappingDraft | null>(null);
  const [mapErrors, setMapErrors] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<{ classification: RowClassification | null; onlyErrors: boolean }>({ classification: null, onlyErrors: false });
  const [page, setPage] = useState(1);
  const [diffs, setDiffs] = useState<ImportDiffs | null>(null);
  const [allImages, setAllImages] = useState<ReviewImage[]>([]);
  const [log, setLog] = useState<ImportLog | null>(null);
  const [reload, setReload] = useState(0);
  const [busyImage, setBusyImage] = useState<string | null>(null);
  // Paso «Mapeo» con plantillas (4.1A): elegir, usar una plantilla o mapear desde cero.
  const [mappingMode, setMappingMode] = useState<"pick" | "template" | "scratch">("pick");
  const [suggestions, setSuggestions] = useState<TemplateSuggestion[] | null>(null);
  const [templates, setTemplates] = useState<MappingTemplate[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [chosenTemplate, setChosenTemplate] = useState<MappingTemplate | null>(null);
  const [templateTenure, setTemplateTenure] = useState("");
  const [dryRun, setDryRun] = useState<TemplateDryRun | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const step = wizardStep(batch);
  const processing = isProcessing(batch);

  const loadBatch = useCallback(async () => {
    if (!batchId) return;
    const result = await fetchImportBatch(batchId, devUser);
    if (result.status === "ok") {
      setBatch(result.value);
      setError(null);
    } else setError(result.message);
  }, [batchId, devUser]);

  useEffect(() => {
    let active = true;
    if (!batchId) return;
    fetchImportBatch(batchId, devUser).then((result) => {
      if (!active) return;
      if (result.status === "ok") setBatch(result.value);
      else setError(result.message);
    });
    return () => {
      active = false;
    };
  }, [batchId, devUser, reload]);

  // Avance de la etapa en segundo plano (RF-021).
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(loadBatch, IMPORT_POLL_MS);
    return () => clearInterval(timer);
  }, [processing, loadBatch]);

  // Until the person edits it, the mapping is the one suggested from the headers.
  const mappingDraft = draft ?? (batch && batch.status === "UPLOADED" && !processing ? draftFor(batch) : null);

  // Plantillas para las cabeceras del archivo, en cuanto el lote está leído (design D3).
  const headersKey = batch && batch.status === "UPLOADED" && !processing && batch.headers?.length ? JSON.stringify(batch.headers) : "";
  useEffect(() => {
    let active = true;
    if (!headersKey) return;
    Promise.all([suggestTemplates(JSON.parse(headersKey) as string[], devUser), fetchTemplates(devUser)]).then(([suggested, all]) => {
      if (!active) return;
      setSuggestions(suggested.status === "ok" ? suggested.value : []);
      setTemplates(all.status === "ok" ? all.value : []);
      const failure = suggested.status !== "ok" ? suggested : all.status !== "ok" ? all : null;
      setTemplatesError(failure ? failure.message : null);
    });
    return () => {
      active = false;
    };
  }, [headersKey, devUser]);

  function resetTemplates() {
    setMappingMode("pick");
    setSuggestions(null);
    setTemplates(null);
    setTemplatesError(null);
    setChosenTemplate(null);
    setDryRun(null);
  }

  const showRows = batch != null && !processing && step >= 3;
  useEffect(() => {
    let active = true;
    if (!batchId || !showRows) return;
    fetchImportDiffs(batchId, { ...filters, page, pageSize: IMPORT_PAGE_SIZE }, devUser).then((result) => {
      if (!active) return;
      if (result.status === "ok") setDiffs(result.value);
      else setError(result.message);
    });
    return () => {
      active = false;
    };
  }, [batchId, showRows, filters, page, devUser, reload]);

  // Todas las imágenes del lote para la revisión manual (RF-029), sin depender del filtro.
  useEffect(() => {
    let active = true;
    if (!batchId || !showRows) return;
    fetchImportDiffs(batchId, { page: 1, pageSize: 100 }, devUser).then((result) => {
      if (!active || result.status !== "ok") return;
      const anchored = result.value.items.flatMap((row) => (row.images ?? []).map((image) => ({ image, rowNumber: row.source_row_number })));
      setAllImages([...anchored, ...result.value.unassignedImages.map((image) => ({ image, rowNumber: null }))]);
    });
    return () => {
      active = false;
    };
  }, [batchId, showRows, devUser, reload]);

  useEffect(() => {
    let active = true;
    if (!batchId || step !== 5 || processing) return;
    fetchImportLog(batchId, devUser).then((result) => {
      if (active && result.status === "ok") setLog(result.value);
    });
    return () => {
      active = false;
    };
  }, [batchId, step, processing, devUser, reload]);

  const counts = useMemo(() => (batch?.counts ?? {}) as Record<string, number>, [batch]);

  async function handleUpload(file: File) {
    setBusy(true);
    const result = await uploadImportFile(file, file.name, devUser);
    setBusy(false);
    if (result.status !== "ok") return setError(result.message);
    setError(null);
    setDraft(null);
    resetTemplates();
    router.replace(`/importacion?lote=${result.value.batch_id}`);
  }

  async function handleMapping() {
    if (!batch || !mappingDraft) return;
    setBusy(true);
    const saved = await saveImportMapping(batch.id, mappingRequest(mappingDraft.columns, mappingDraft), devUser);
    if (saved.status !== "ok") {
      setBusy(false);
      setMapErrors(saved.status === "rejected" ? mappingErrors(saved.details) : {});
      return setError(saved.message);
    }
    setMapErrors({});
    const started = await startImportValidation(batch.id, devUser);
    setBusy(false);
    if (started.status !== "ok") return setError(started.message);
    setError(null);
    await loadBatch();
  }

  function handleUseTemplate(template: MappingTemplate) {
    setChosenTemplate(template);
    setTemplateTenure(template.defaults?.tenure_regime ?? "");
    setDryRun(null);
    setError(null);
    setMappingMode("template");
  }

  async function handlePreview() {
    if (!batch || !chosenTemplate) return;
    setPreviewBusy(true);
    const result = await dryRunTemplate(chosenTemplate.id, batch.id, devUser);
    setPreviewBusy(false);
    if (result.status !== "ok") return setError(result.message);
    setError(null);
    setDryRun(result.value);
  }

  async function handleApplyTemplate() {
    if (!batch || !chosenTemplate) return;
    setBusy(true);
    const saved = await saveBatchMapping(batch.id, { kind: "template", templateId: chosenTemplate.id, tenureDefault: templateTenure }, devUser);
    if (saved.status !== "ok") {
      setBusy(false);
      return setError(mappingFailureMessage(saved));
    }
    const started = await startImportValidation(batch.id, devUser);
    setBusy(false);
    if (started.status !== "ok") return setError(started.message);
    setError(null);
    await loadBatch();
  }

  async function handleDecision(rowId: string, input: RowDecisionInput) {
    if (!batch) return;
    setBusy(true);
    const result = await decideImportRow(batch.id, rowId, input, devUser);
    setBusy(false);
    if (result.status !== "ok") return setError(result.message);
    setError(null);
    setReload((n) => n + 1);
  }

  async function handleConfirm(comment: string) {
    const summary = batch?.approval_summary;
    if (!batch || !summary) return;
    setBusy(true);
    const result = await confirmImportBatch(batch.id, summary, comment, devUser);
    setBusy(false);
    if (result.status !== "ok") {
      const current = changedSummary(result);
      if (current) setBatch({ ...batch, approval_summary: current });
      return setError(result.message);
    }
    setError(null);
    setBatch(result.value);
  }

  async function handleDownload() {
    if (!batch) return;
    setBusy(true);
    const result = await downloadImportLog(batch.id, devUser);
    setBusy(false);
    if (result.status !== "ok") return setError(result.message);
    const url = URL.createObjectURL(result.value);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bitacora-${batch.id}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleAssociate(imageId: string, pieceId: string | null) {
    if (!batch) return;
    setBusyImage(imageId);
    const result = await associateImportImage(batch.id, imageId, pieceId, devUser);
    setBusyImage(null);
    if (result.status !== "ok") return setError(result.message);
    setError(null);
    setReload((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-tinta">Asistente de importación</h1>
        <p className="text-base text-gris-texto">Nada llega al catálogo sin la aprobación de una persona autorizada (RF-027).</p>
      </header>
      <ImportSteps current={step} />
      {batch && <BatchHeader batch={batch} />}
      <ErrorNotice message={error} />

      {!batchId && <UploadPanel busy={busy} onUpload={handleUpload} />}
      {batch && processing && <ProgressPanel batch={batch} />}
      {batch && !processing && step === 1 && mappingMode === "pick" && (
        <TemplatePicker
          suggestions={suggestions}
          templates={templates}
          loading={suggestions === null}
          error={templatesError}
          onUse={handleUseTemplate}
          onStartFromScratch={() => setMappingMode("scratch")}
        />
      )}
      {batch && !processing && step === 1 && mappingMode === "template" && chosenTemplate && (
        <>
          <AppliedTemplatePanel
            template={chosenTemplate}
            batch={batch}
            tenureDefault={templateTenure}
            blocker={applyBlocker(chosenTemplate, batch)}
            busy={busy}
            previewBusy={previewBusy}
            onTenureChange={setTemplateTenure}
            onPreview={handlePreview}
            onApply={handleApplyTemplate}
            onChooseAnother={() => {
              setMappingMode("pick");
              setChosenTemplate(null);
              setDryRun(null);
            }}
          />
          {dryRun && <DryRunPanel result={dryRun} />}
        </>
      )}
      {batch && !processing && step === 1 && mappingMode === "scratch" && mappingDraft && (
        <>
          <MappingPanel batch={batch} draft={mappingDraft} busy={busy} errors={mapErrors} onChange={setDraft} onSubmit={handleMapping} />
          <Button variant="secondary" className="self-start" disabled={busy} onClick={() => setMappingMode("pick")}>
            Volver a las plantillas
          </Button>
        </>
      )}
      {batch && !processing && step === 2 && (
        <Card as="section" className="flex flex-col gap-3">
          <p className="text-base text-gris-texto">Las columnas están mapeadas. Valide el lote para ver la previsualización.</p>
          <Button
            className="self-start"
            disabled={busy}
            onClick={async () => {
              const started = await startImportValidation(batch.id, devUser);
              if (started.status !== "ok") setError(started.message);
              else await loadBatch();
            }}
          >
            Validar
          </Button>
        </Card>
      )}

      {showRows && step === 3 && diffs && (
        <Card as="section" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-tinta">Previsualización</h2>
          <details className="text-sm text-gris-texto">
            <summary className="cursor-pointer">Cómo se clasificaron las filas</summary>
            <ol className="mt-2 list-decimal pl-5">
              {diffs.rules.map((rule) => (
                <li key={rule.order}>{rule.description}</li>
              ))}
            </ol>
          </details>
          <RowFilters
            active={filters.classification}
            onlyErrors={filters.onlyErrors}
            counts={counts}
            onChange={(value) => {
              setFilters(value);
              setPage(1);
            }}
          />
          <div className="flex flex-col gap-3">
            {diffs.items.map((row) => (
              <ImportRowCard
                key={`${row.id}-${row.decision}-${JSON.stringify(row.resolution)}`}
                row={row}
                canDecide={hasPermission("imports.prepare")}
                busy={busy}
                onDecide={(input) => handleDecision(row.id, input)}
              />
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <span className="text-sm text-gris-texto">
              Página {diffs.page} de {Math.max(1, Math.ceil(diffs.total / diffs.pageSize))}
            </span>
            <Button variant="secondary" disabled={diffs.page * diffs.pageSize >= diffs.total} onClick={() => setPage((p) => p + 1)}>
              Siguiente
            </Button>
          </div>
        </Card>
      )}
      {showRows && step === 3 && batch && (
        <ApprovalPanel summary={batch.approval_summary ?? null} canApprove={hasPermission("imports.approve")} busy={busy} onConfirm={handleConfirm} />
      )}

      {batch && step === 5 && !processing && log && <ImportLogPanel log={log} downloading={busy} onDownload={handleDownload} />}
      {showRows && (
        <ImageReviewPanel
          images={allImages}
          applied={batch?.status === "APPLIED"}
          canAssociate={hasPermission("media.upload")}
          busyId={busyImage}
          onAssociate={handleAssociate}
        />
      )}
      {batchId && (
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => {
            setBatch(null);
            setDraft(null);
            setDiffs(null);
            setLog(null);
            setAllImages([]);
            setError(null);
            resetTemplates();
            router.replace("/importacion");
          }}
        >
          Importar otro archivo
        </Button>
      )}
    </div>
  );
}
