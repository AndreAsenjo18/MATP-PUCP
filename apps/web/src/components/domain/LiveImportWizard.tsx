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
  decisionsLostNotice,
  ImportRowCard,
  ImportSteps,
  ProgressPanel,
  revalidateHint,
  RollbackPanel,
  TenureAction,
  TenureBanner,
  type ReviewImage,
} from "@/components/domain/ImportWizard";
import { PageHeader } from "@/components/layout/PageHeader";
import { MappingEditor } from "@/components/domain/ImportMappingEditor";
import { ConfirmButton } from "@/components/domain/ConfirmButton";
import { ImportMappingReview, type AiMappingState } from "@/components/domain/ImportMappingReview";
import { RowDecisionPanel, RowList, RowReviewNotice, type GeminiReviewState } from "@/components/domain/ImportRowReview";
import { geminiOpinion, nextToDecide, toDecide } from "@/lib/data/import-row-review";
import { getApiMode } from "@/lib/data/mode";
import { RepeatedErrorBlock, ReviewSummaryPanel } from "@/components/domain/ImportReview";
import { approvalSentence, formatCause, groupRepeatedErrors, isCompactRow, pendingWork, reviewSummary, toErrorRow, type ErrorGroup } from "@/lib/data/import-review";
import { PHOTO_STEP_NOTE, importHref, type ImportOrigin, originFromParams, showsPhotoStep } from "@/lib/data/import-origin";
import { ImportPhotosPanel } from "@/components/domain/ImportPhotosPanel";
import { ImportRowAiSuggestions } from "@/components/domain/ImportRowAiSuggestions";
import { ImportPhotoTray, RowPhotoStrip } from "@/components/domain/ImportPhotoTray";
import { DryRunPanel, FormatProblemPanel, type FormatIssue } from "@/components/domain/ImportTemplatePanels";
import { UploadPanel } from "@/components/domain/ImportUpload";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { useSession } from "@/lib/auth/session";
import { suggestColumnMapping } from "@/lib/data/ai";
import { confirmRepeatedPhotos, fetchRowPhotos, type TrayPhoto } from "@/lib/data/importPhotos";
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
  decideImportRow,
  downloadImportLog,
  excludeRows,
  fetchImportBatch,
  abandonImportBatch,
  canAbandon,
  correctImportCell,
  fetchImportAiJudgment,
  fetchImportDiffs,
  requestImportAiJudgment,
  type ImportAiJudgment,
  fetchImportLog,
  isProcessing,
  progressStep,
  revertConflicts,
  rollbackImportBatch,
  scanErrorRows,
  skippedHeaderRowsNotice,
  startImportValidation,
  uploadImportFile,
  wizardStep,
  type ImportBatch,
  type ImportRow,
  type ImportDiffs,
  type ImportLog,
  type RevertConflict,
  type RowClassification,
  type RowDecisionInput,
} from "@/lib/data/imports";
import {
  applyAiColumnMapping,
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

// Opciones del selector "Filas por página" (tarea 3.2): el backend acepta de 1 a 100
// (apps/api/app/api/pagination.py, MAX_PAGE_SIZE).
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/** El paso de fotografías del lote: la subida y la bandeja de fotos por revisar. */
function PhotoStep({ batch, origin, devUser }: { batch: ImportBatch; origin: ImportOrigin | null; devUser?: string }) {
  return (
    <>
      {origin === "excel-fotos" && <p className="text-base font-medium text-tinta">{PHOTO_STEP_NOTE}</p>}
      <ImportPhotosPanel batch={batch} devUser={devUser} />
      <ImportPhotoTray batch={batch} devUser={devUser} />
    </>
  );
}

export function LiveImportWizard() {
  const { currentUser, hasPermission } = useSession();
  const devUser = currentUser?.email;
  const router = useRouter();
  const params = useSearchParams();
  const batchId = params.get("lote");
  const origin = originFromParams(params);

  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // `null` = la persona no eligió filtro: se usa el de entrada («Por decidir» si hay filas que lo piden).
  const [chosenFilter, setFilters] = useState<{ classification: RowClassification | null; onlyErrors: boolean; toDecide?: boolean } | null>(null);
  // Revisión compacta con Gemini (importacion-revision-filas-compacta): opiniones por fila y el panel abierto.
  const [aiJudgment, setAiJudgment] = useState<ImportAiJudgment | null>(null);
  const [geminiState, setGeminiState] = useState<GeminiReviewState>("idle");
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  // Tamaño de página editable por el usuario (tarea 3.2): evita el scroll infinito con lotes
  // grandes (p. ej. 200 filas); el backend acepta de 1 a 100 (apps/api/app/api/pagination.py).
  const [pageSize, setPageSize] = useState(IMPORT_PAGE_SIZE);
  // Se incrementa con "Pedir sugerencias de IA para estas filas": cada ImportRowAiSuggestions
  // visible pide la suya al notar el cambio, en paralelo en vez de una por una (tarea 3.2b).
  const [aiBulkSignal, setAiBulkSignal] = useState(0);
  const [diffs, setDiffs] = useState<ImportDiffs | null>(null);
  const [allImages, setAllImages] = useState<ReviewImage[]>([]);
  const [log, setLog] = useState<ImportLog | null>(null);
  const [reload, setReload] = useState(0);
  // Fotos de cada fila para «Revise las filas» (importacion-masiva-fotografias, tarea 6.3).
  const [rowPhotos, setRowPhotos] = useState<Record<string, TrayPhoto[]>>({});
  const [busyImage, setBusyImage] = useState<string | null>(null);
  // Reversión (RNF-007): conflictos del último intento y su motivo, para la segunda confirmación.
  const [rollbackConflicts, setRollbackConflicts] = useState<RevertConflict[] | null>(null);
  const [rollbackReason, setRollbackReason] = useState<string | null>(null);
  // Paso «Mapeo» (4.1A, 4.1B): elegir punto de partida o editar el mapeo.
  const [mappingMode, setMappingMode] = useState<"pick" | "edit">("pick");
  // «Así quedarían las piezas» (importacion-mapeo-asistido): la vista de entrada al ajustar columnas;
  // `advancedMapping` muestra el editor por columna de siempre.
  const [advancedMapping, setAdvancedMapping] = useState(false);
  const [aiMapping, setAiMapping] = useState<AiMappingState>("off");
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

  // Formato: siempre se detecta solo al subir; aquí, lo que impidió aplicarlo y el último mapeo aplicado.
  const [formatIssue, setFormatIssue] = useState<FormatIssue | null>(null);
  const [changingFormat, setChangingFormat] = useState(false);
  const [appliedSource, setAppliedSource] = useState<BatchMappingSource | null>(null);
  // Filas con error del lote: de ellas salen el resumen exclusivo y los errores repetidos.
  const [errorScan, setErrorScan] = useState<{ rows: ImportRow[]; complete: boolean } | null>(null);
  const [excludeProgress, setExcludeProgress] = useState<{ key: string; done: number; total: number } | null>(null);
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

  // Formatos guardados: para elegirlos antes de subir el archivo y, al volver a abrir un lote ya
  // leído, para nombrar su formato y poder aplicarlo otra vez (antes solo se cargaban con el lote
  // recién subido: al volver se veía «columnas ajustadas a mano» y «Cambiar formato» se quedaba
  // en «Buscando formatos…»). El lote recién subido los carga con las sugerencias, arriba.
  const needsTemplates = !batchId || (batch !== null && batch.status !== "UPLOADED");
  useEffect(() => {
    let active = true;
    if (!needsTemplates || templates !== null) return;
    fetchTemplates(devUser).then((result) => {
      if (active) setTemplates(result.status === "ok" ? result.value : []);
    });
    return () => {
      active = false;
    };
  }, [needsTemplates, templates, devUser]);

  // Con el archivo leído, aplica el formato elegido (o el que mejor coincide) y valida el lote.
  useEffect(() => {
    if (!batch || batch.status !== "UPLOADED" || processing || suggestions === null || templates === null) return;
    if (autoApplied.current === batch.id) return;
    autoApplied.current = batch.id;
    const suggestion = suggestions[0];
    const candidate = suggestion?.template;
    const missing = !candidate ? [] : suggestion ? suggestion.missing_columns : missingColumns(candidate, batch.headers ?? []);
    void (async () => {
      // Ninguna plantilla calza con confianza (sea porque no hay candidata o porque a la elegida
      // le faltan columnas): se abre directo «Ajustar columnas» con el mapeo que sugiere la IA,
      // sin mostrar antes la lista de candidatas por parecido (change carga-masiva-con-ia, D2).
      // El régimen de tenencia ya no se elige al subir (importacion-elegir-origen): se decide
      // después, desde el aviso de «Filas sin régimen de tenencia» (TenureBanner).
      if (!candidate) return handleStartFromScratch();
      if (missing.length > 0) {
        return missing.length < candidate.columns.length ? handleUseTemplate(candidate) : handleStartFromScratch();
      }
      await applyFormat(candidate, "");
    })();
    // `applyFormat` depende de `batch`, que ya es una dependencia; se ejecuta una vez por lote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch, processing, suggestions, templates]);

  function resetTemplates() {
    setFormatIssue(null);
    setChangingFormat(false);
    setAppliedSource(null);
    setErrorScan(null);
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
  // La revisión se abre en «Por decidir» cuando hay filas que lo piden (importacion-revision-filas-compacta, D1).
  const toDecideCount = (batch?.counts?.CONFLICT ?? 0) + (batch?.counts?.POSSIBLE_DUPLICATE ?? 0);
  const filters = chosenFilter ?? (toDecideCount > 0 ? { classification: null, onlyErrors: false, toDecide: true } : { classification: null, onlyErrors: false });
  const filtersKey = JSON.stringify(filters);
  useEffect(() => {
    let active = true;
    if (!batchId || !showRows) return;
    fetchImportDiffs(batchId, { ...(JSON.parse(filtersKey) as typeof filters), page, pageSize }, devUser).then((result) => {
      if (!active) return;
      if (result.status === "ok") setDiffs(result.value);
      else setError(result.message);
    });
    return () => {
      active = false;
    };
  }, [batchId, showRows, filtersKey, page, pageSize, devUser, reload]);

  // Lo que opina Gemini de las filas del lote; mientras el análisis corre, se consulta cada 2 s.
  const geminiRunning = geminiState === "running";
  useEffect(() => {
    if (!batchId || !showRows || getApiMode() === "mock") return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () =>
      fetchImportAiJudgment(batchId, devUser).then((result) => {
        if (!active || result.status !== "ok") return;
        setAiJudgment(result.value);
        const running = result.value.run?.status === "RUNNING";
        const judged = (result.value.verdicts ?? []).length > 0;
        setGeminiState((current) => (running ? "running" : judged || current === "running" || current === "asking" ? "ready" : current));
        if (running) timer = setTimeout(load, 2000);
      });
    void load();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [batchId, showRows, devUser, reload, geminiRunning]);

  useEffect(() => {
    let active = true;
    if (!batchId || !showRows) return;
    fetchRowPhotos(batchId, devUser).then((result) => {
      if (active && result.status === "ok") setRowPhotos(result.value);
    });
    return () => {
      active = false;
    };
  }, [batchId, showRows, devUser, reload]);

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

  // Filas con error (se omite si no hay): para el resumen y para agrupar los errores repetidos.
  const errorCount = (batch?.counts as Record<string, number> | undefined)?.ERRORS ?? 0;
  useEffect(() => {
    let active = true;
    if (!batchId || !showRows || step !== 3 || errorCount === 0) return;
    scanErrorRows(batchId, devUser).then((result) => {
      if (active && result.status === "ok") setErrorScan(result.value);
    });
    return () => {
      active = false;
    };
  }, [batchId, showRows, step, errorCount, devUser, reload]);

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

  async function handleUpload(file: File) {
    setBusy(true);
    const result = await uploadImportFile(file, file.name, devUser);
    setBusy(false);
    if (result.status !== "ok") return setError(result.message);
    setError(null);
    resetTemplates();
    router.replace(importHref({ batchId: result.value.batch_id, origin }));
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
    // The batch first, so the screen knows it is validating: raising `reload` before it asked for
    // the rows of a batch still at work (409 «lote trabajando»).
    await loadBatch();
    setReload((n) => n + 1);
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
    await applySourceAndValidate({ kind: "template", templateId: template.id, tenureDefault: null }, setError);
  }

  /**
   * «Validar de nuevo»: el mismo formato del lote, con su régimen por defecto, y otra validación.
   * Sirve tras corregir algo fuera del lote (crear la colección o el término que faltaba).
   */
  async function handleRevalidate() {
    const tenureDefault = typeof batch?.mapping?.defaults === "object" && batch.mapping.defaults !== null ? ((batch.mapping.defaults as Record<string, unknown>).tenure_regime as string | undefined) : undefined;
    const source: BatchMappingSource | null =
      appliedSource ?? (batch?.template_id ? { kind: "template", templateId: batch.template_id, tenureDefault: tenureDefault ?? null } : null);
    if (!source) return setChangingFormat(true);
    setError(null);
    await applySourceAndValidate(source, setError);
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

  /**
   * Carga masiva con IA (change carga-masiva-con-ia, D2): completa con lo que propone la IA las
   * columnas que sigan sin destino tras abrir el editor (por heurística local o por plantilla).
   * No bloquea la apertura del editor, que ya quedó puesta antes de llamar esto; si la IA no está
   * disponible, el editor sigue como ya quedó. `base` identifica el borrador que disparó el
   * pedido, para descartar una respuesta tardía si mientras tanto se abrió otro.
   */
  function requestAiColumnMapping(headers: string[], base: MappingTemplate | null) {
    setAiMapping("loading");
    void suggestColumnMapping(headers, devUser, (batch?.sample_rows ?? []) as Record<string, unknown>[]).then((result) => {
      if (result.status !== "ok") return setAiMapping("unavailable");
      setAiMapping("ready");
      setEditorDraft((current) => (current && current.base === base ? applyAiColumnMapping(current, result.value.mappings) : current));
    });
  }

  function handleUseTemplate(template: MappingTemplate) {
    if (!batch) return;
    closeEditor();
    setEditorDraft(draftFromTemplate(template, batch));
    setDryRun(null);
    setError(null);
    setAdvancedMapping(false);
    setMappingMode("edit");
    requestAiColumnMapping(batch.headers ?? [], template);
  }

  function handleStartFromScratch() {
    if (!batch) return;
    closeEditor();
    setEditorDraft(draftFromScratch(batch));
    setDryRun(null);
    setError(null);
    setAdvancedMapping(false);
    setMappingMode("edit");
    requestAiColumnMapping(batch.headers ?? [], null);
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
    // The batch first, so the screen knows it is validating: raising `reload` before it asked for
    // the rows of a batch still at work (409 «lote trabajando»).
    await loadBatch();
    setReload((n) => n + 1);
  }

  /** Vuelve a la subida de un archivo nuevo; el lote actual queda como está. */
  function startOver() {
    setBatch(null);
    setDiffs(null);
    setLog(null);
    setAllImages([]);
    setError(null);
    setRollbackConflicts(null);
    setRollbackReason(null);
    resetTemplates();
    autoApplied.current = null;
    router.replace(importHref({ origin }));
  }

  /** «Descartar este lote» (change `importacion-descartar-lote`): lo deja como abandonado y vuelve a la subida. */
  async function handleAbandon() {
    if (!batch) return;
    setBusy(true);
    const result = await abandonImportBatch(batch.id, null, devUser);
    setBusy(false);
    if (result.status !== "ok") return setError(result.message);
    startOver();
  }

  /** «Guardar y validar de nuevo» (change `importacion-corregir-celda`): corrige la celda y valida el lote. */
  async function handleCorrect(row: ImportRow, column: string, value: string) {
    if (!batch) return;
    setBusy(true);
    const corrected = await correctImportCell(batch.id, row.id, column, value, devUser);
    if (corrected.status !== "ok") {
      setBusy(false);
      return setError(corrected.message);
    }
    const started = await startImportValidation(batch.id, devUser);
    setBusy(false);
    if (started.status !== "ok") return setError(started.message);
    setError(null);
    setOpenRowId(null);
    setReload((n) => n + 1);
    await loadBatch();
  }

  async function handleDecision(rowId: string, input: RowDecisionInput): Promise<boolean> {
    if (!batch) return false;
    setBusy(true);
    const result = await decideImportRow(batch.id, rowId, input, devUser);
    setBusy(false);
    if (result.status !== "ok") {
      setError(result.message);
      return false;
    }
    setError(null);
    setReload((n) => n + 1);
    return true;
  }

  /** «Aceptar y siguiente» del panel: guarda y abre la siguiente fila por decidir de la página. */
  async function handlePanelDecision(row: ImportRow, input: RowDecisionInput, next: boolean) {
    const ok = await handleDecision(row.id, input);
    if (!ok) return;
    const following = next && diffs ? nextToDecide(diffs.items, row.id, new Set([row.id])) : null;
    setOpenRowId(following?.id ?? null);
  }

  async function handleAskGemini() {
    if (!batch) return;
    setGeminiState("asking");
    const result = await requestImportAiJudgment(batch.id, devUser);
    if (result.status !== "ok") {
      setGeminiState("unavailable");
      return setError(result.message);
    }
    setAiJudgment(result.value);
    setGeminiState(result.value.run?.status === "RUNNING" ? "running" : "ready");
  }

  // Resumen exclusivo y errores repetidos de la revisión (change `importacion-revision-simplificada`).
  const errorRowsData = (errorScan?.rows ?? []).map(toErrorRow);
  const knownErrorRows = errorCount === 0 ? [] : errorScan?.complete ? errorRowsData : null;
  const summary = reviewSummary(counts, knownErrorRows);
  const pending = pendingWork(summary, knownErrorRows);
  const groups = groupRepeatedErrors(knownErrorRows ?? []);
  const tenureGroup = groups.find((group) => group.code === "tenure_required");
  const tenureRows = errorRowsData.filter((row) => row.errors.some((error) => error.code === "tenure_required")).length;

  /** «Dejar fuera las N filas» de un error repetido: la decisión por fila de siempre, por tandas y con avance. */
  async function handleExcludeGroup(group: ErrorGroup) {
    if (!batch) return;
    const undecided = new Set(errorRowsData.filter((row) => row.decision === "PENDING").map((row) => row.id));
    const ids = group.rowIds.filter((id) => undecided.has(id));
    setExcludeProgress({ key: group.key, done: 0, total: ids.length });
    const result = await excludeRows(batch.id, ids, devUser, (done, total) => setExcludeProgress({ key: group.key, done, total }));
    setExcludeProgress(null);
    setError(result.failed > 0 ? `Se dejaron fuera ${result.done} filas, pero ${result.failed} no se pudieron. Vuelva a intentarlo.` : null);
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

  const currentTemplate = templates?.find((template) => template.id === batch?.template_id) ?? null;
  const adjusting = mappingMode === "edit" && editorDraft !== null;
  const formatPanel: FormatIssue | null = formatIssue ?? (changingFormat ? { kind: "change", current: templates?.find((template) => template.id === batch?.template_id) ?? null } : null);
  const applyingFormat = batch != null && !processing && batch.status === "UPLOADED" && formatIssue === null && !adjusting;
  const reviewing = showRows && step === 3 && !adjusting && !changingFormat;
  // `undefined` mientras se cargan los formatos: nunca «a mano» para un lote leído con uno guardado.
  const formatName = batch?.template_id
    ? templates === null
      ? undefined
      : (templates.find((template) => template.id === batch.template_id)?.name ?? "un formato guardado")
    : null;
  const canReapply = appliedSource !== null || Boolean(batch?.template_id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Importar piezas" description="Suba un Excel o CSV, revise lo que cambiará y apruebe." />
      <ImportSteps current={progressStep(batch)} complete={batch?.status === "APPLIED"} />
      {batch && <BatchHeader batch={batch} />}
      <ErrorNotice message={error} />

      {!batchId && <UploadPanel busy={busy} onUpload={handleUpload} />}
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
      {batch && !processing && adjusting && editorDraft && !advancedMapping && (
        <ImportMappingReview
          draft={editorDraft}
          sampleRows={(batch.sample_rows ?? []) as Record<string, unknown>[]}
          vocabularies={Object.fromEntries(vocabularies.map((vocabulary) => [vocabulary.code, vocabulary.name]))}
          ai={aiMapping}
          busy={busy}
          onChange={handleEditorChange}
          onApply={handleApplyTemplate}
          onAdvanced={() => setAdvancedMapping(true)}
          onBack={() => {
            setMappingMode("pick");
            setDryRun(null);
            closeEditor();
          }}
        />
      )}
      {batch && !processing && adjusting && editorDraft && advancedMapping && (
        <>
          <Button variant="secondary" className="self-start" onClick={() => setAdvancedMapping(false)}>
            Ver cómo quedarían las piezas
          </Button>
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
      {/* Fotos del lote: aquí antes de la revisión; durante la revisión van tras el resumen y los errores. */}
      {batch && !reviewing && !processing && !adjusting && !formatPanel && showsPhotoStep(origin) && <PhotoStep batch={batch} origin={origin} devUser={devUser} />}
      {reviewing && (
        <ReviewSummaryPanel
          summary={summary}
          filter={filters}
          onFilter={(value) => {
            setFilters(value);
            setPage(1);
          }}
          sentence={approvalSentence(summary, pending)}
          formatLine={
            <FormatBar
              formatName={formatName}
              busy={busy}
              onChange={() => {
                setError(null);
                setChangingFormat(true);
              }}
              onRevalidate={canReapply ? () => void handleRevalidate() : undefined}
              revalidateHint={revalidateHint(errorCount, counts.DECIDED ?? 0)}
            />
          }
        />
      )}
      {reviewing &&
        groups.map((group) => {
          const isTenure = group === tenureGroup;
          const cause = formatCause(group, currentTemplate, counts.rows ?? 0);
          const groupRows = (errorScan?.rows ?? []).filter((row) => group.rowIds.includes(row.id));
          return (
            <RepeatedErrorBlock
              key={group.key}
              group={group}
              cause={cause}
              totalRows={counts.rows ?? 0}
              canDecide={hasPermission("imports.prepare")}
              busy={busy}
              progress={excludeProgress?.key === group.key ? excludeProgress : null}
              action={isTenure ? <TenureAction decided={counts.DECIDED ?? 0} busy={busy} canAdjust={canReapply} onApply={handleApplyTenure} /> : undefined}
              onChangeFormat={() => {
                setError(null);
                setChangingFormat(true);
              }}
              onExcludeAll={() => handleExcludeGroup(group)}
            >
              {groupRows.slice(0, 25).map((row) => (
                <ImportRowCard
                  key={`${row.id}-${row.decision}-${JSON.stringify(row.resolution)}`}
                  row={row}
                  compact={isCompactRow(row, groups)}
                  canDecide={hasPermission("imports.prepare")}
                  busy={busy}
                  onDecide={(input) => handleDecision(row.id, input)}
                />
              ))}
              {groupRows.length > 25 && <p className="text-sm text-gris-texto">Se muestran 25 de {groupRows.length.toLocaleString("es-PE")} filas. Filtre por «Con errores» para recorrerlas todas.</p>}
            </RepeatedErrorBlock>
          );
        })}
      {reviewing && !tenureGroup && tenureRows > 0 ? (
        <TenureBanner count={tenureRows} complete decided={counts.DECIDED ?? 0} busy={busy} canAdjust={canReapply} onApply={handleApplyTenure} />
      ) : null}
      {batch && reviewing && !processing && !adjusting && !formatPanel && showsPhotoStep(origin) && <PhotoStep batch={batch} origin={origin} devUser={devUser} />}
      {reviewing && diffs && (
        <Card as="section" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-tinta">Revise las filas</h2>
          {skippedHeaderRowsNotice(batch) && <p className="text-sm text-gris-texto">{skippedHeaderRowsNotice(batch)}</p>}
          {summary && (
            <RowReviewNotice
              importedAlone={summary.news + summary.updates}
              toDecideCount={pending.conflicts}
              gemini={geminiState}
              progress={aiJudgment?.run && aiJudgment.run.status === "RUNNING" ? { done: aiJudgment.run.processed_pairs, total: aiJudgment.run.total_pairs } : null}
              // Gemini only judges rows proposed by similarity; since duplicados-solo-por-codigo
              // validation proposes none, so the button only shows for older batches.
              canAsk={hasPermission("ai.request") && getApiMode() !== "mock" && summary.duplicates > 0}
              onAsk={() => void handleAskGemini()}
            />
          )}
          <details className="text-sm text-gris-texto">
            <summary className="cursor-pointer">Cómo se clasifican las filas</summary>
            <ol className="mt-2 list-decimal pl-5">
              {diffs.rules.map((rule) => (
                <li key={rule.order}>{rule.description}</li>
              ))}
            </ol>
          </details>
          <div className="flex flex-wrap items-end justify-end gap-3">
            {batchId && (
              <Button variant="secondary" onClick={() => setAiBulkSignal((n) => n + 1)}>
                Pedir sugerencias de IA para estas filas
              </Button>
            )}
            <Select
              label="Filas por página"
              fieldClassName="w-auto flex-row items-center gap-2"
              className="w-auto"
              value={String(pageSize)}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </div>
          {(() => {
            // Las filas de un error repetido se ven en su bloque, salvo que se pidan «Con errores».
            const visible = diffs.items.filter((row) => filters.onlyErrors || !isCompactRow(row, groups));
            const verdicts = aiJudgment?.verdicts ?? [];
            const opinions = new Map(
              diffs.items.flatMap((row) => {
                const opinion = geminiOpinion(row, verdicts, aiJudgment?.min_confidence ?? 0.85);
                return opinion ? [[row.id, opinion] as const] : [];
              }),
            );
            const openRow = diffs.items.find((row) => row.id === openRowId) ?? null;
            const queue = diffs.items.filter((row) => toDecide(row));
            const renderCard = (row: ImportRow) => (
                <ImportRowCard
                  key={`${row.id}-${row.decision}-${JSON.stringify(row.resolution)}`}
                  row={row}
                  compact={false}
                  canDecide={hasPermission("imports.prepare")}
                  busy={busy}
                  onDecide={(input) => handleDecision(row.id, input)}
                onCorrect={(column, value) => void handleCorrect(row, column, value)}
                correctionNotice={decisionsLostNotice(counts.DECIDED ?? 0)}
                  photos={
                    <RowPhotoStrip
                      photos={rowPhotos[row.id] ?? []}
                      busy={busy}
                      onConfirmRepeated={
                        hasPermission("imports.prepare") && batchId
                          ? async (photoIds) => {
                              const result = await confirmRepeatedPhotos(batchId, photoIds, devUser);
                              if (result.status === "ok") setReload((value) => value + 1);
                              else setError(result.message);
                            }
                          : undefined
                      }
                    />
                  }
                  aiSuggestions={
                    batchId ? (
                      <ImportRowAiSuggestions row={row} batchId={batchId} devUser={devUser} bulkRequestSignal={aiBulkSignal} />
                    ) : undefined
                  }
                />
            );
            return (
              <>
                <RowList rows={visible} opinions={opinions} onOpen={(row) => setOpenRowId(row.id)} />
                {!filters.onlyErrors && diffs.items.length > 0 && visible.length === 0 && (
                  <p className="text-base text-gris-texto">Las filas de esta página tienen un error repetido: están en el bloque de arriba, bajo «Ver las filas».</p>
                )}
                {openRow && (
                  <RowDecisionPanel
                    key={openRow.id}
                    row={openRow}
                    position={toDecide(openRow) ? { index: queue.findIndex((row) => row.id === openRow.id) + 1, total: queue.length } : null}
                    opinion={opinions.get(openRow.id) ?? null}
                    busy={busy}
                    canDecide={hasPermission("imports.prepare")}
                    devUser={devUser}
                    fallback={renderCard(openRow)}
                    onDecide={(input, next) => void handlePanelDecision(openRow, input, next)}
                    onClose={() => setOpenRowId(null)}
                  />
                )}
              </>
            );
          })()}
          <div className="flex flex-wrap items-center justify-center gap-3">
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
        <ApprovalPanel
          summary={batch.approval_summary ?? null}
          canApprove={hasPermission("imports.approve")}
          busy={busy}
          onConfirm={handleConfirm}
          pendingText={approvalSentence(summary, pending)}
        />
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
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={startOver}>
            Importar otro archivo
          </Button>
          {batch && canAbandon(batch) && hasPermission("imports.prepare") && (
            <ConfirmButton
              label="Descartar este lote"
              variant="danger-outline"
              confirmTitle="¿Descartar este lote?"
              confirmDescription="El lote no se importará. No se borra nada: queda en la bitácora como descartado y sus filas dejan de aparecer en la revisión de duplicados."
              confirmLabel="Descartar el lote"
              disabled={busy}
              onConfirm={() => void handleAbandon()}
            />
          )}
        </div>
      )}
    </div>
  );
}
