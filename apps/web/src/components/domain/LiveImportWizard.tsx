"use client";

/**
 * Asistente de importación en modo `live` (changes `importacion-pipeline-reconciliacion`, tareas
 * 6.1 y 6.2, y `rediseno-ux-importacion`): subida con formato elegido, revisión de filas, resumen y
 * aprobación, bitácora e imágenes. El paso visible sale del estado del lote (`progressStep`);
 * mientras una etapa corre en el servidor se consulta su avance.
 *
 * El lote en curso se recuerda en la URL (`?lote=`) para poder volver a él. Un lote aplicado se
 * puede revertir desde aquí (tarea 5.2; solo el Administrador).
 *
 * Al terminar de leerse el archivo, el formato elegido —o la plantilla que mejor coincide con las
 * cabeceras— se aplica y el lote se valida sin un paso de mapeo. Si el formato no encaja, el
 * asistente se detiene y ofrece otro formato o «Ajustar columnas» (el editor de mapeo, con
 * destino y transformaciones por columna, vista previa y guardado como plantilla).
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ApprovalPanel,
  BatchHeader,
  ErrorNotice,
  FormatBar,
  ImageReviewPanel,
  ImportLogPanel,
  ImportRowCard,
  ImportSteps,
  ProgressPanel,
  RollbackPanel,
  RowFilters,
  TenureBanner,
  type ReviewImage,
} from "@/components/domain/ImportWizard";
import { MappingEditor } from "@/components/domain/ImportMappingEditor";
import { ImportPhotosPanel } from "@/components/domain/ImportPhotosPanel";
import { ImportPhotoTray } from "@/components/domain/ImportPhotoTray";
import { DryRunPanel, FormatProblemPanel, type FormatIssue } from "@/components/domain/ImportTemplatePanels";
import { UploadPanel, type UploadOptions } from "@/components/domain/ImportUpload";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSession } from "@/lib/auth/session";
import {
  createTemplate,
  dryRunTemplate,
  fetchTemplates,
  mappingFailureMessage,
  missingColumns,
  saveBatchMapping,
  suggestTemplates,
  updateTemplate,
  type BatchMappingSource,
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
  countTenureErrors,
  decideImportRow,
  downloadImportLog,
  fetchImportBatch,
  fetchImportDiffs,
  fetchImportLog,
  isProcessing,
  progressStep,
  revertConflicts,
  rollbackImportBatch,
  startImportValidation,
  uploadImportFile,
  wizardStep,
  type ImportBatch,
  type ImportDiffs,
  type ImportLog,
  type RevertConflict,
  type RowClassification,
  type RowDecisionInput,
} from "@/lib/data/imports";
import {
  applySource,
  associateTerm,
  columnErrors,
  draftFromScratch,
  draftFromTemplate,
  fetchVocabularies,
  fetchVocabularyTerms,
  pendingTerm,
  previewBlocker,
  saveErrors,
  templateCreateBody,
  templateUpdateBody,
  termsVocabulary,
  type EditorDraft,
  type SaveKind,
  type TemplateFormValues,
  type TermOption,
  type Vocabulary,
} from "@/lib/data/mapping-editor";

export function LiveImportWizard() {
  const { currentUser, hasPermission } = useSession();
  const devUser = currentUser?.email;
  const router = useRouter();
  const params = useSearchParams();
  const batchId = params.get("lote");

  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState<{ classification: RowClassification | null; onlyErrors: boolean }>({ classification: null, onlyErrors: false });
  const [page, setPage] = useState(1);
  const [diffs, setDiffs] = useState<ImportDiffs | null>(null);
  const [allImages, setAllImages] = useState<ReviewImage[]>([]);
  const [log, setLog] = useState<ImportLog | null>(null);
  const [reload, setReload] = useState(0);
  const [busyImage, setBusyImage] = useState<string | null>(null);
  // Reversión (RNF-007): conflictos del último intento y su motivo, para la segunda confirmación.
  const [rollbackConflicts, setRollbackConflicts] = useState<RevertConflict[] | null>(null);
  const [rollbackReason, setRollbackReason] = useState<string | null>(null);
  // Paso «Mapeo» (4.1A, 4.1B): elegir punto de partida o editar el mapeo.
  const [mappingMode, setMappingMode] = useState<"pick" | "edit">("pick");
  const [suggestions, setSuggestions] = useState<TemplateSuggestion[] | null>(null);
  const [templates, setTemplates] = useState<MappingTemplate[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState<TemplateDryRun | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  // Editor de mapeo (4.1B): borrador, vocabularios para `terms:` y errores del último guardado.
  const [editorDraft, setEditorDraft] = useState<EditorDraft | null>(null);
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
  const [editorErrors, setEditorErrors] = useState<Record<string, string>>({});
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Términos activos por vocabulario de las columnas `terms:` del borrador (4.1C).
  const [termsByVocabulary, setTermsByVocabulary] = useState<Record<string, TermOption[]>>({});

  // Formato: opciones de la subida, lo que impidió aplicarlo solo y el último mapeo aplicado.
  const [uploadOptions, setUploadOptions] = useState<UploadOptions>({ templateId: null, tenureDefault: "" });
  const [formatIssue, setFormatIssue] = useState<FormatIssue | null>(null);
  const [changingFormat, setChangingFormat] = useState(false);
  const [appliedSource, setAppliedSource] = useState<BatchMappingSource | null>(null);
  const [tenureCount, setTenureCount] = useState<{ count: number; complete: boolean } | null>(null);
  const autoApplied = useRef<string | null>(null);

  const step = wizardStep(batch);
  const processing = isProcessing(batch);

  const vocabulariesKey = [...new Set((editorDraft?.columns ?? []).map(termsVocabulary).filter((code): code is string => code !== null))].sort().join(",");
  useEffect(() => {
    let active = true;
    const missing = vocabulariesKey.split(",").filter((code) => code && !(code in termsByVocabulary));
    if (missing.length === 0) return;
    Promise.all(missing.map((code) => fetchVocabularyTerms(code, devUser))).then((results) => {
      if (!active) return;
      setTermsByVocabulary((current) => {
        const next = { ...current };
        missing.forEach((code, i) => {
          const result = results[i];
          next[code] = result.status === "ok" ? result.value : [];
        });
        return next;
      });
    });
    return () => {
      active = false;
    };
  }, [vocabulariesKey, termsByVocabulary, devUser]);

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

  // Plantillas para las cabeceras del archivo, en cuanto el lote está leído (design D3).
  const headersKey = batch && batch.status === "UPLOADED" && !processing && batch.headers?.length ? JSON.stringify(batch.headers) : "";
  useEffect(() => {
    let active = true;
    if (!headersKey) return;
    Promise.all([suggestTemplates(JSON.parse(headersKey) as string[], devUser), fetchTemplates(devUser), fetchVocabularies(devUser)]).then(([suggested, all, vocabularyList]) => {
      if (!active) return;
      setSuggestions(suggested.status === "ok" ? suggested.value : []);
      setTemplates(all.status === "ok" ? all.value : []);
      setVocabularies(vocabularyList.status === "ok" ? vocabularyList.value : []);
      const failure = suggested.status !== "ok" ? suggested : all.status !== "ok" ? all : null;
      setTemplatesError(failure ? failure.message : null);
    });
    return () => {
      active = false;
    };
  }, [headersKey, devUser]);

  // Formatos guardados, para elegirlos antes de subir el archivo.
  useEffect(() => {
    let active = true;
    if (batchId) return;
    fetchTemplates(devUser).then((result) => {
      if (active) setTemplates(result.status === "ok" ? result.value : []);
    });
    return () => {
      active = false;
    };
  }, [batchId, devUser]);

  // Con el archivo leído, aplica el formato elegido (o el que mejor coincide) y valida el lote.
  useEffect(() => {
    if (!batch || batch.status !== "UPLOADED" || processing || suggestions === null || templates === null) return;
    if (autoApplied.current === batch.id) return;
    autoApplied.current = batch.id;
    const chosen = uploadOptions.templateId ? templates.find((template) => template.id === uploadOptions.templateId) : undefined;
    const suggestion = uploadOptions.templateId ? undefined : suggestions[0];
    const candidate = chosen ?? suggestion?.template;
    const missing = !candidate ? [] : suggestion ? suggestion.missing_columns : missingColumns(candidate, batch.headers ?? []);
    void (async () => {
      if (!candidate) return setFormatIssue({ kind: "unrecognized" });
      if (missing.length > 0) return setFormatIssue({ kind: "missing", template: candidate, missing });
      await applyFormat(candidate, uploadOptions.tenureDefault);
    })();
    // `applyFormat` depende de `batch`, que ya es una dependencia; se ejecuta una vez por lote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch, processing, suggestions, templates, uploadOptions]);

  function resetTemplates() {
    setFormatIssue(null);
    setChangingFormat(false);
    setAppliedSource(null);
    setTenureCount(null);
    setMappingMode("pick");
    setSuggestions(null);
    setTemplates(null);
    setTemplatesError(null);
    setDryRun(null);
    closeEditor();
  }

  function closeEditor() {
    setEditorDraft(null);
    setEditorErrors({});
    setNameError(null);
  }

  // Un archivo que no se pudo leer no llega a tener filas: solo se muestra su motivo.
  const showRows = batch != null && !processing && step >= 3 && batch.status !== "FAILED_INGESTION";
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

  // Filas sin régimen de tenencia, para ofrecer asignarlo a todas (se omite si no hay errores).
  const errorRows = (batch?.counts as Record<string, number> | undefined)?.ERRORS ?? 0;
  useEffect(() => {
    let active = true;
    if (!batchId || !showRows || step !== 3 || errorRows === 0) return;
    countTenureErrors(batchId, devUser).then((result) => {
      if (active && result.status === "ok") setTenureCount(result.value);
    });
    return () => {
      active = false;
    };
  }, [batchId, showRows, step, errorRows, devUser, reload]);

  useEffect(() => {
    let active = true;
    if (!batchId || step !== 5 || processing || batch?.status === "FAILED_INGESTION") return;
    fetchImportLog(batchId, devUser).then((result) => {
      if (active && result.status === "ok") setLog(result.value);
    });
    return () => {
      active = false;
    };
  }, [batchId, step, processing, batch?.status, devUser, reload]);

  const counts = useMemo(() => (batch?.counts ?? {}) as Record<string, number>, [batch]);

  async function handleUpload(file: File, options: UploadOptions) {
    setBusy(true);
    const result = await uploadImportFile(file, file.name, devUser);
    setBusy(false);
    if (result.status !== "ok") return setError(result.message);
    setError(null);
    resetTemplates();
    setUploadOptions(options);
    router.replace(`/importacion?lote=${result.value.batch_id}`);
  }

  /** Guarda el mapeo y valida el lote; `onFailure` recibe el motivo si algo no se pudo. */
  async function applySourceAndValidate(source: BatchMappingSource, onFailure: (message: string) => void) {
    if (!batch) return;
    setBusy(true);
    const saved = await saveBatchMapping(batch.id, source, devUser);
    if (saved.status !== "ok") {
      setBusy(false);
      return onFailure(mappingFailureMessage(saved));
    }
    const started = await startImportValidation(batch.id, devUser);
    setBusy(false);
    if (started.status !== "ok") return onFailure(started.message);
    setAppliedSource(source);
    setFormatIssue(null);
    setChangingFormat(false);
    setError(null);
    setPage(1);
    closeEditor();
    setMappingMode("pick");
    setReload((n) => n + 1);
    await loadBatch();
  }

  /** Aplica una plantilla (con el régimen por defecto, si hay) y valida el lote. */
  async function applyFormat(template: MappingTemplate, tenureDefault: string) {
    await applySourceAndValidate({ kind: "template", templateId: template.id, tenureDefault: tenureDefault || null }, (message) =>
      setFormatIssue({ kind: "failed", template, message }),
    );
  }

  /** «Usar este formato»: aplica la plantilla elegida sin pasar por el editor. */
  async function handleUseFormat(template: MappingTemplate) {
    if (!batch) return;
    const missing = missingColumns(template, batch.headers ?? []);
    if (missing.length > 0) return setFormatIssue({ kind: "missing", template, missing });
    setError(null);
    await applySourceAndValidate({ kind: "template", templateId: template.id, tenureDefault: uploadOptions.tenureDefault || null }, setError);
  }

  /** Mismo mapeo con un régimen por defecto, para las filas que no lo traen; luego a validar. */
  async function handleApplyTenure(tenure: string) {
    const source: BatchMappingSource | null = appliedSource
      ? { ...appliedSource, tenureDefault: tenure }
      : batch?.template_id
        ? { kind: "template", templateId: batch.template_id, tenureDefault: tenure }
        : null;
    if (!source) return handleStartFromScratch();
    await applySourceAndValidate(source, setError);
  }

  function handleUseTemplate(template: MappingTemplate) {
    if (!batch) return;
    closeEditor();
    setEditorDraft(draftFromTemplate(template, batch));
    setDryRun(null);
    setError(null);
    setMappingMode("edit");
  }

  function handleStartFromScratch() {
    if (!batch) return;
    closeEditor();
    setEditorDraft(draftFromScratch(batch));
    setDryRun(null);
    setError(null);
    setMappingMode("edit");
  }

  // La vista previa ya calculada se conserva marcada como desactualizada (`stale`), para poder
  // asociar varios valores sin término seguidos (4.1C); se vuelve a pedir al guardar.
  function handleEditorChange(next: EditorDraft) {
    setEditorDraft(next);
  }

  function handleAssociateTerm(source: string, text: string, code: string) {
    if (editorDraft) handleEditorChange(associateTerm(editorDraft, source, text, code));
  }

  async function handleSaveTemplate(kind: SaveKind, values: TemplateFormValues) {
    if (!batch || !editorDraft) return;
    const headers = batch.headers ?? [];
    setSaving(true);
    const result =
      kind === "update" && editorDraft.base
        ? await updateTemplate(editorDraft.base.id, templateUpdateBody(editorDraft, values, headers), devUser)
        : await createTemplate(templateCreateBody(editorDraft, values, headers), devUser);
    setSaving(false);
    if (result.status !== "ok") {
      const failed = saveErrors(result);
      setNameError(failed.name);
      setEditorErrors(failed.columns);
      return setError(failed.name ?? mappingFailureMessage(result));
    }
    const saved = result.value;
    setTemplates((current) => [...(current ?? []).filter((item) => item.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)));
    setSuggestions((current) => current?.map((item) => (item.template.id === saved.id ? { ...item, template: saved } : item)) ?? current);
    // El régimen es del lote: guardar la plantilla no lo cambia.
    setEditorDraft({ ...draftFromTemplate(saved, batch), tenureDefault: editorDraft.tenureDefault, sheetName: editorDraft.sheetName, headerRow: editorDraft.headerRow });
    setDryRun(null); // era de la versión anterior de la plantilla
    setEditorErrors({});
    setNameError(null);
    setError(null);
  }

  async function handlePreview() {
    const templateId = editorDraft?.base?.id;
    if (!batch || !templateId) return;
    setPreviewBusy(true);
    const result = await dryRunTemplate(templateId, batch.id, devUser);
    setPreviewBusy(false);
    if (result.status !== "ok") return setError(result.message);
    setError(null);
    setDryRun(result.value);
  }

  async function handleApplyTemplate() {
    if (!batch || !editorDraft) return;
    setBusy(true);
    const saved = await saveBatchMapping(batch.id, applySource(editorDraft, batch), devUser);
    if (saved.status !== "ok") {
      setBusy(false);
      setEditorErrors(columnErrors(saved));
      return setError(mappingFailureMessage(saved));
    }
    setEditorErrors({});
    const started = await startImportValidation(batch.id, devUser);
    setBusy(false);
    if (started.status !== "ok") return setError(started.message);
    setAppliedSource(applySource(editorDraft, batch));
    setFormatIssue(null);
    setChangingFormat(false);
    setError(null);
    setPage(1);
    closeEditor();
    setMappingMode("pick");
    setReload((n) => n + 1);
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

  async function handleRollback(reason: string | null, confirmConflicts: boolean) {
    // La segunda confirmación (ediciones posteriores) reutiliza el motivo de la primera.
    const motive = reason ?? rollbackReason;
    if (!batch || !motive) return;
    setBusy(true);
    const result = await rollbackImportBatch(batch.id, motive, confirmConflicts, devUser);
    setBusy(false);
    if (result.status !== "ok") {
      const conflicts = revertConflicts(result);
      if (conflicts) {
        setRollbackReason(motive);
        setRollbackConflicts(conflicts);
      }
      return setError(result.message);
    }
    setError(null);
    setRollbackConflicts(null);
    setRollbackReason(null);
    setBatch(result.value);
    setReload((n) => n + 1);
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

  const adjusting = mappingMode === "edit" && editorDraft !== null;
  const formatPanel: FormatIssue | null = formatIssue ?? (changingFormat ? { kind: "change", current: templates?.find((template) => template.id === batch?.template_id) ?? null } : null);
  const applyingFormat = batch != null && !processing && batch.status === "UPLOADED" && formatIssue === null && !adjusting;
  const reviewing = showRows && step === 3 && !adjusting && !changingFormat;
  const formatName = batch?.template_id ? (templates?.find((template) => template.id === batch.template_id)?.name ?? null) : null;
  const canReapply = appliedSource !== null || Boolean(batch?.template_id);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-tinta">Importar piezas</h1>
        <p className="text-base text-gris-texto">Suba un Excel o CSV, revise lo que cambiará y apruebe.</p>
      </header>
      <ImportSteps current={progressStep(batch)} complete={batch?.status === "APPLIED"} />
      {batch && <BatchHeader batch={batch} />}
      <ErrorNotice message={error} />

      {!batchId && <UploadPanel busy={busy} templates={templates} loadingTemplates={templates === null} onUpload={handleUpload} />}
      {batch && processing && <ProgressPanel batch={batch} />}
      {batch && !processing && !adjusting && formatPanel && (
        <FormatProblemPanel
          issue={formatPanel}
          suggestions={suggestions}
          templates={templates}
          loading={templates === null}
          busy={busy}
          error={templatesError}
          decided={counts.DECIDED ?? 0}
          onCancel={changingFormat && !formatIssue ? () => setChangingFormat(false) : undefined}
          onUse={handleUseFormat}
          onAdjust={(template) =>
            // Con una plantilla de la que el archivo no trae ninguna columna, el editor saldría vacío: se parte de los títulos.
            template && missingColumns(template, batch.headers ?? []).length < template.columns.length ? handleUseTemplate(template) : handleStartFromScratch()
          }
        />
      )}
      {applyingFormat && !processing && !formatPanel && (
        <Card as="section" aria-live="polite">
          <p className="text-base text-gris-texto">{busy ? "Aplicando el formato y validando el lote…" : "Buscando el formato del archivo…"}</p>
        </Card>
      )}
      {batch && !processing && adjusting && editorDraft && (
        <>
          <MappingEditor
            batch={batch}
            draft={editorDraft}
            vocabularies={vocabularies}
            terms={termsByVocabulary}
            errors={editorErrors}
            nameError={nameError}
            busy={busy}
            saving={saving}
            previewBusy={previewBusy}
            onChange={handleEditorChange}
            onSave={handleSaveTemplate}
            onPreview={handlePreview}
            onApply={handleApplyTemplate}
            onBack={() => {
              setMappingMode("pick");
              setDryRun(null);
              closeEditor();
            }}
          />
          {dryRun && (
            <DryRunPanel
              result={dryRun}
              stale={previewBlocker(editorDraft, batch) !== null}
              association={{
                terms: termsByVocabulary,
                pending: (source, text) => pendingTerm(editorDraft, source, text),
                onAssociate: handleAssociateTerm,
              }}
            />
          )}
        </>
      )}
      {batch && !processing && !adjusting && step === 2 && (
        <Card as="section" className="flex flex-col gap-3">
          <p className="text-base text-gris-texto">Las columnas están asignadas. Valide el lote para ver qué cambiará.</p>
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
      {batch && !processing && !adjusting && !formatPanel && <ImportPhotosPanel batch={batch} devUser={devUser} />}
      {batch && !processing && !adjusting && !formatPanel && <ImportPhotoTray batch={batch} devUser={devUser} />}

      {reviewing && (
        <FormatBar
          formatName={formatName}
          busy={busy}
          onChange={() => {
            setError(null);
            setChangingFormat(true);
          }}
        />
      )}
      {reviewing && (batch?.counts as Record<string, number> | undefined)?.ERRORS ? (
        <TenureBanner
          count={tenureCount?.count ?? 0}
          complete={tenureCount?.complete ?? true}
          decided={counts.DECIDED ?? 0}
          busy={busy}
          canAdjust={canReapply}
          onApply={handleApplyTenure}
        />
      ) : null}
      {reviewing && diffs && (
        <Card as="section" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-tinta">Revise las filas</h2>
          <details className="text-sm text-gris-texto">
            <summary className="cursor-pointer">Cómo se clasifican las filas</summary>
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
      {reviewing && batch && (
        <ApprovalPanel summary={batch.approval_summary ?? null} canApprove={hasPermission("imports.approve")} busy={busy} onConfirm={handleConfirm} />
      )}

      {batch && step === 5 && !processing && batch.status !== "FAILED_INGESTION" && log && <ImportLogPanel log={log} downloading={busy} onDownload={handleDownload} />}
      {batch && batch.status === "APPLIED" && !processing && (
        <RollbackPanel canRevert={hasPermission("imports.revert")} busy={busy} conflicts={rollbackConflicts} onRevert={handleRollback} />
      )}
      {showRows && !adjusting && !changingFormat && (
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
            setDiffs(null);
            setLog(null);
            setAllImages([]);
            setError(null);
            setRollbackConflicts(null);
            setRollbackReason(null);
            resetTemplates();
            setUploadOptions({ templateId: null, tenureDefault: "" });
            autoApplied.current = null;
            router.replace("/importacion");
          }}
        >
          Importar otro archivo
        </Button>
      )}
    </div>
  );
}
