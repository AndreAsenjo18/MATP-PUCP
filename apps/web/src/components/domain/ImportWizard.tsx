"use client";

/**
 * Piezas del asistente de importación conectado a la API (change
 * `importacion-pipeline-reconciliacion`, tareas 6.1 y 6.2; spec importacion-datos, RF-021..RF-029).
 *
 * Son componentes de presentación: reciben el lote, las filas o la bitácora y avisan de cada
 * acción; `LiveImportWizard` hace las llamadas. Todo texto explica el lote en lenguaje claro
 * (RNF-010): qué hará la aplicación con cada fila, por qué una fila no se puede aceptar y el
 * resumen exacto que se aprueba.
 */
import { Check, Download, FileSpreadsheet, ImageIcon, MinusCircle, Undo2 } from "lucide-react";
import { useState } from "react";

import { ConfirmButton } from "@/components/domain/ConfirmButton";
import { StatusBadge } from "@/components/domain/StatusBadges";
import { importBatchStatus, importClassificationStatus, importDecisionStatus } from "@/components/domain/status-intents";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import {
  acceptBlocker,
  actionLabel,
  type ApprovalSummary,
  batchStateText,
  candidatePieces,
  conflictingRows,
  fieldAction,
  type FieldAction,
  fieldLabel,
  type ImportBatch,
  type ImportImage,
  type ImportLog,
  type ImportRow,
  needsResolution,
  plainMessage,
  PROGRESS_STEPS,
  progressText,
  type RevertConflict,
  type RowClassification,
  type RowDecisionInput,
  rowWarnings,
  stageFraction,
  summarySentence,
  TENURE_DEFAULT_OPTIONS,
  validationHint,
} from "@/lib/data/imports";

export function ImportSteps({ current, complete = false }: { current: number; complete?: boolean }) {
  const last = PROGRESS_STEPS.length - 1;
  const percent = Math.round(((complete ? PROGRESS_STEPS.length : current + 1) / PROGRESS_STEPS.length) * 100);
  return (
    <nav aria-label="Avance de la importación" className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:hidden">
        <p className="text-sm font-medium text-tinta">
          Paso {current + 1} de {PROGRESS_STEPS.length} · {PROGRESS_STEPS[current]}
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-crema" role="presentation">
          <div className="h-full rounded-full bg-terracota transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <ol className="hidden items-center sm:flex">
        {PROGRESS_STEPS.map((label, index) => {
          const done = index < current || (complete && index === current);
          const active = index === current && !done;
          return (
            <li key={label} aria-current={active ? "step" : undefined} className={cn("flex items-center gap-3", index < last && "flex-1")}>
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
                  done ? "border-verde-exito bg-verde-exito text-white" : active ? "border-terracota bg-terracota text-white" : "border-borde bg-white text-gris-texto",
                )}
              >
                {done ? <Check size={16} aria-hidden="true" /> : index + 1}
              </span>
              <span className={cn("text-sm font-medium", active ? "text-tinta" : done ? "text-verde-exito" : "text-gris-texto")}>
                {label}
                <span className="sr-only">{done ? " (completado)" : active ? " (paso actual)" : ""}</span>
              </span>
              {index < last && <span aria-hidden="true" className={cn("h-0.5 flex-1 rounded-full", done ? "bg-verde-exito" : "bg-borde")} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function ErrorNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-carmin-bg p-3 text-base text-carmin-texto">
      {message}
    </p>
  );
}

export function ProgressPanel({ batch }: { batch: ImportBatch }) {
  const fraction = stageFraction(batch.progress);
  return (
    <Card as="section" className="flex flex-col gap-3" aria-live="polite">
      <h2 className="text-lg font-semibold text-tinta">{progressText(batch.progress)}</h2>
      <div className="h-2 overflow-hidden rounded-full bg-crema" role="presentation">
        <div
          className={cn("h-full rounded-full bg-terracota transition-[width] duration-300 motion-reduce:transition-none", fraction === null && "w-1/3 animate-pulse motion-reduce:animate-none")}
          style={fraction === null ? undefined : { width: `${Math.max(4, Math.round(fraction * 100))}%` }}
        />
      </div>
      <p className="text-sm text-gris-texto">Puede salir de esta pantalla: el proceso sigue en el servidor.</p>
    </Card>
  );
}

/** Archivo y estado del lote, en una banda bajo el título. */
export function BatchHeader({ batch }: { batch: ImportBatch }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-crema-light px-4 py-3">
      <FileSpreadsheet size={20} aria-hidden="true" className="shrink-0 text-terracota" />
      <span className="min-w-0 font-medium break-all text-tinta">{batch.file_name}</span>
      <StatusBadge status={importBatchStatus(batch.status)} />
      <span className="text-sm text-gris-texto">{batchStateText(batch)}</span>
      {batch.status_reason && <span className="w-full text-sm text-carmin-texto">{batch.status_reason}</span>}
    </div>
  );
}

export const CLASSIFICATION_FILTERS: { value: RowClassification | null; label: string }[] = [
  { value: null, label: "Todas" },
  { value: "NEW", label: "Nuevas" },
  { value: "UPDATE", label: "Actualizaciones" },
  { value: "POSSIBLE_DUPLICATE", label: "Posibles duplicados" },
  { value: "CONFLICT", label: "Conflictos" },
];

export function RowFilters({
  active,
  onlyErrors,
  counts,
  onChange,
}: {
  active: RowClassification | null;
  onlyErrors: boolean;
  counts: Record<string, number>;
  onChange: (value: { classification: RowClassification | null; onlyErrors: boolean }) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar filas">
      {CLASSIFICATION_FILTERS.map((filter) => (
        <Button
          key={filter.label}
          variant={active === filter.value && !onlyErrors ? "primary" : "outline"}
          aria-pressed={active === filter.value && !onlyErrors}
          onClick={() => onChange({ classification: filter.value, onlyErrors: false })}
        >
          {filter.label}
          {filter.value && ` (${counts[filter.value] ?? 0})`}
        </Button>
      ))}
      <Button variant={onlyErrors ? "primary" : "outline"} aria-pressed={onlyErrors} onClick={() => onChange({ classification: null, onlyErrors: true })}>
        Con errores ({counts.ERRORS ?? 0})
      </Button>
    </div>
  );
}

function display(value: unknown): string {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.map(display).join(", ");
  return String(value);
}

/** Denominación de la fila tal como quedó mapeada, o la primera celda del archivo. */
function rowTitle(row: ImportRow): string {
  const fields = isRecordLike(row.mapped_data) && isRecordLike(row.mapped_data.fields) ? row.mapped_data.fields : null;
  const denomination = fields?.denomination;
  if (typeof denomination === "string" && denomination.trim()) return denomination.trim();
  const first = Object.entries(row.raw_data).find(([key, value]) => !key.startsWith("__") && value != null && value !== "");
  return first ? display(first[1]) : "Sin denominación";
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const ACTION_HELP = {
  accept: "Se importa al aprobar el lote.",
  exclude: "No se importa. Puede cambiar de idea.",
  reject: "Queda en la bitácora con su motivo.",
} as const;

export function ImportRowCard({
  row,
  canDecide,
  busy,
  onDecide,
}: {
  row: ImportRow;
  canDecide: boolean;
  busy: boolean;
  onDecide: (input: RowDecisionInput) => void;
}) {
  const candidates = candidatePieces(row);
  const resolvable = needsResolution(row);
  const resolution = (row.resolution ?? {}) as { target_piece_id?: string; as_new?: boolean };
  const [target, setTarget] = useState<string>(resolution.as_new ? "new" : (resolution.target_piece_id ?? ""));
  const [fields, setFields] = useState<Record<string, FieldAction>>(() =>
    Object.fromEntries(row.diff.map((change) => [change.field, fieldAction(row, change.field, change.default_action)])),
  );
  const blocker = acceptBlocker(row);
  const choosing = resolvable && target !== "";
  const acceptBlocked = busy || (Boolean(blocker) && !choosing) || row.has_validation_errors;
  const others = conflictingRows(row);
  const errors = row.validation_errors
    .filter(isRecordLike)
    .map((error) => ({ message: plainMessage(String(error.message ?? "")), hint: validationHint(error.code)?.hint ?? null }))
    .filter((error) => error.message);
  const warnings = rowWarnings(row);
  const blockerId = `fila-${row.id}-bloqueo`;
  const dataEntries = Object.entries(row.raw_data).filter(([key]) => !key.startsWith("__"));

  const accept = () =>
    onDecide({
      decision: "ACCEPTED",
      targetPieceId: resolvable && target && target !== "new" ? target : null,
      asNew: resolvable && target === "new",
      fieldDecisions: row.diff.length > 0 ? fields : undefined,
    });

  return (
    <article className="flex flex-col gap-3 rounded-md border border-borde p-4" aria-label={`Fila ${row.source_row_number}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-gris-texto">Fila {row.source_row_number}</p>
          <h3 className="text-base font-semibold break-words text-tinta">{rowTitle(row)}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={importClassificationStatus(row.classification)} />
          <StatusBadge status={importDecisionStatus(row.decision)} />
        </div>
      </div>
      <p className="text-sm text-gris-texto">{actionLabel(row.action)}</p>

      {errors.length > 0 && (
        <ul className="flex flex-col gap-1.5 rounded-md bg-carmin-bg p-3 text-sm text-carmin-texto" aria-label="Errores de la fila">
          {errors.map((error) => (
            <li key={error.message}>
              <span className="font-medium">{error.message}</span>
              {error.hint && <span className="block text-tinta">{error.hint}</span>}
            </li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <ul className="flex flex-col gap-1.5 rounded-md bg-ambar-bg p-3 text-sm text-ambar-texto" aria-label="Advertencias de la fila">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      {others.length > 0 && <p className="text-sm text-ambar-texto">El mismo código I aparece en la fila {others.join(", ")} de este lote.</p>}
      {row.decision_reason && <p className="text-sm text-gris-texto">Motivo: {row.decision_reason}</p>}

      {row.diff.length > 0 && (
        <section role="group" aria-labelledby={`${blockerId}-cambios`} className="rounded-md bg-ambar-bg p-3 text-sm text-ambar-texto">
          <h4 id={`${blockerId}-cambios`} className="mb-2 text-left font-semibold">
            Cambios sobre la pieza del catálogo
          </h4>
          <div className="hidden grid-cols-[minmax(8rem,1fr)_2fr_2fr] gap-x-4 pb-1 text-xs font-medium sm:grid">
            <span>Campo</span>
            <span>Ahora en el catálogo</span>
            <span>En el archivo</span>
          </div>
          <ul className="flex flex-col divide-y divide-ambar-alerta/30">
            {row.diff.map((change) => (
              <li key={change.field} className="py-2 first:pt-0 last:pb-0">
                <label className="grid cursor-pointer grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-[minmax(8rem,1fr)_2fr_2fr] sm:items-baseline">
                  <span className="flex items-center gap-2 font-medium">
                    <input
                      type="checkbox"
                      className="size-4 accent-terracota"
                      disabled={!canDecide}
                      checked={fields[change.field] === "accept"}
                      onChange={(event) => setFields({ ...fields, [change.field]: event.target.checked ? "accept" : "exclude" })}
                    />
                    {fieldLabel(change.field)}
                  </span>
                  <span className="break-words">
                    <span className="sm:hidden">Ahora: </span>
                    {display(change.current_value)}
                  </span>
                  <span className="font-medium break-words">
                    <span className="font-normal sm:hidden">En el archivo: </span>
                    {display(change.incoming_value)}
                    {change.default_action === "keep" && <span className="block font-normal">Celda vacía: se conserva el valor actual.</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {resolvable && canDecide && (
        <Select label="¿A qué pieza corresponde esta fila?" value={target} onChange={(event) => setTarget(event.target.value)}>
          <option value="">Elegir…</option>
          {candidates.map((candidate) => (
            <option key={candidate.pieceId} value={candidate.pieceId} disabled={!candidate.available}>
              {candidate.label}
            </option>
          ))}
          <option value="new">Ninguna: es una pieza nueva</option>
        </Select>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-gris-texto">Ver datos del archivo</summary>
        <dl className="mt-2 grid grid-cols-1 gap-2 text-tinta sm:grid-cols-2 lg:grid-cols-4">
          {dataEntries.map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="font-medium text-gris-texto">{key}</dt>
              <dd className="break-words">{display(value)}</dd>
            </div>
          ))}
        </dl>
      </details>

      {row.images && row.images.length > 0 && (
        <p className="flex items-center gap-1 text-sm text-gris-texto">
          <ImageIcon size={16} aria-hidden="true" />
          {row.images.length === 1 ? "1 imagen anclada en esta fila" : `${row.images.length} imágenes ancladas en esta fila`} (se asocian después de aplicar).
        </p>
      )}

      {canDecide && (
        <div className="grid gap-3 border-t border-borde pt-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Button variant="outline" icon={Check} className="w-full" disabled={acceptBlocked} aria-describedby={blocker && !choosing ? blockerId : undefined} onClick={accept}>
              Aceptar
            </Button>
            {blocker && !choosing ? (
              <p id={blockerId} className="text-xs text-carmin-texto">
                {blocker}
              </p>
            ) : (
              <p className="text-xs text-gris-texto">{ACTION_HELP.accept}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Button variant="secondary" icon={MinusCircle} className="w-full" disabled={busy} onClick={() => onDecide({ decision: "EXCLUDED" })}>
              Dejar fuera
            </Button>
            <p className="text-xs text-gris-texto">{ACTION_HELP.exclude}</p>
          </div>
          <div className="flex flex-col gap-1">
            <ConfirmButton
              label="Rechazar"
              variant="danger"
              className="w-full"
              disabled={busy}
              dialogSize="lg"
              confirmTitle="Rechazar la fila"
              confirmDescription="La fila no se importa y queda en la bitácora del lote como rechazada, con el motivo que indique."
              requireReason
              reasonLabel="Motivo del rechazo"
              onConfirm={(reason) => onDecide({ decision: "REJECTED", reason })}
            />
            <p className="text-xs text-gris-texto">{ACTION_HELP.reject}</p>
          </div>
        </div>
      )}
    </article>
  );
}

/** Filas sin régimen de tenencia: elegir uno para todas y validar de nuevo. */
/** Aviso de que validar de nuevo recalcula todas las filas y descarta las decisiones tomadas. */
export function decisionsLostNotice(decided: number): string | null {
  if (decided <= 0) return null;
  return `Al validar de nuevo se recalculan las filas: ${decided === 1 ? "la decisión que ya tomó se pierde" : `las ${decided.toLocaleString("es-PE")} decisiones que ya tomó se pierden`}.`;
}

export function TenureBanner({
  count,
  complete,
  decided = 0,
  busy,
  canAdjust,
  onApply,
}: {
  count: number;
  complete: boolean;
  /** Filas con una decisión ya tomada, que validar de nuevo descarta. */
  decided?: number;
  busy: boolean;
  /** Se puede reaplicar el mapeo desde aquí; si no, la acción lleva a «Ajustar columnas». */
  canAdjust: boolean;
  onApply: (tenure: string) => void;
}) {
  const [tenure, setTenure] = useState<string>(TENURE_DEFAULT_OPTIONS[0].value);
  if (count === 0) return null;
  return (
    <section aria-label="Filas sin régimen de tenencia" className="flex flex-col gap-3 rounded-lg border border-ambar-alerta bg-ambar-bg p-4 text-ambar-texto">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">
          {count.toLocaleString("es-PE")}
          {complete ? "" : " o más"} {count === 1 ? "fila no trae" : "filas no traen"} régimen de tenencia
        </h2>
        <p className="text-base">
          Sin régimen no se pueden aceptar. {canAdjust ? "Elija uno para todas ellas y validamos de nuevo; las filas que ya lo traen no cambian." : "Ajuste las columnas e indique uno para todas ellas."}
        </p>
      </div>
      {decisionsLostNotice(decided) && canAdjust && <p className="text-sm font-medium">{decisionsLostNotice(decided)}</p>}
      <div className="flex flex-wrap items-end gap-3">
        {canAdjust && (
          <Select label="Régimen para esas filas" value={tenure} disabled={busy} onChange={(event) => setTenure(event.target.value)} fieldClassName="min-w-56">
            {TENURE_DEFAULT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        )}
        <Button variant="primary" disabled={busy} onClick={() => onApply(tenure)}>
          {busy ? "Validando…" : canAdjust ? "Aplicar y validar de nuevo" : "Ajustar columnas"}
        </Button>
      </div>
    </section>
  );
}

/** Formato con que se leyó el archivo y acceso a cambiarlo sin volver a subirlo. */
export function FormatBar({ formatName, busy, onChange }: { formatName: string | null; busy: boolean; onChange: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gris-texto">
      <span>
        Formato aplicado: <strong className="font-medium text-tinta">{formatName ?? "columnas ajustadas a mano"}</strong>
      </span>
      <Button variant="secondary" disabled={busy} onClick={onChange}>
        Cambiar formato
      </Button>
    </div>
  );
}

export function ApprovalPanel({
  summary,
  canApprove,
  busy,
  onConfirm,
}: {
  summary: ApprovalSummary | null;
  canApprove: boolean;
  busy: boolean;
  onConfirm: (comment: string) => void;
}) {
  return (
    <Card as="section" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-tinta">Aprobación de la carga</h2>
      {summary ? <p className="text-base text-tinta">{summarySentence(summary)}</p> : <p className="text-base text-gris-texto">Calculando el resumen…</p>}
      <p className="text-sm text-gris-texto">
        Las filas nuevas y las actualizaciones sin decisión se aplican con la aprobación; los conflictos y posibles duplicados sin resolver no se
        aplican. Si una fila incumple una regla al aplicar, no se aplica ninguna y el lote vuelve a revisión.
      </p>
      {!canApprove ? (
        <PermissionNotice>Su rol puede preparar la carga, pero no aprobarla. La aprueba un Gestor de colecciones o un Administrador.</PermissionNotice>
      ) : (
        <ConfirmButton
          label="Aprobar y aplicar"
          variant="primary"
          icon={Check}
          className="self-start"
          disabled={!summary || busy || summary.create + summary.update === 0}
          confirmTitle="Aprobar la carga masiva"
          confirmDescription={summary ? `${summarySentence(summary)} El cambio queda auditado con su usuario y el lote.` : ""}
          onConfirm={onConfirm}
        />
      )}
    </Card>
  );
}

export function ImportLogPanel({ log, downloading, onDownload }: { log: ImportLog; downloading: boolean; onDownload: () => void }) {
  const batch = log.batch as Record<string, unknown>;
  return (
    <Card as="section" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-tinta">Bitácora del lote</h2>
      <dl className="grid grid-cols-2 gap-2 text-sm text-tinta sm:grid-cols-4">
        <div>
          <dt className="text-gris-texto">Cargado por</dt>
          <dd>{display(batch.uploaded_by)}</dd>
        </div>
        <div>
          <dt className="text-gris-texto">Aprobado por</dt>
          <dd>{display(batch.approved_by)}</dd>
        </div>
        <div>
          <dt className="text-gris-texto">Filas aplicadas</dt>
          <dd>{display(log.applied_rows)}</dd>
        </div>
        <div>
          <dt className="text-gris-texto">Filas no aplicadas</dt>
          <dd>{display(log.rejected_rows)}</dd>
        </div>
      </dl>
      {typeof batch.status_reason === "string" && batch.status_reason && <ErrorNotice message={batch.status_reason} />}
      {log.entries.length === 0 ? (
        <p className="text-base text-gris-texto">No hay filas rechazadas, excluidas ni resueltas a mano.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-base text-tinta">
          {log.entries.map((entry) => (
            <li key={entry.source_row_number} className="flex flex-wrap items-center justify-between gap-2 border-t border-borde pt-2 first:border-t-0 first:pt-0">
              <span>
                Fila {entry.source_row_number} — {actionLabel(entry.action)}
                {entry.reason && `: ${entry.reason}`}
              </span>
              <StatusBadge status={importDecisionStatus(entry.decision)} />
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" icon={Download} className="self-start" disabled={downloading} onClick={onDownload}>
        {downloading ? "Preparando…" : "Descargar bitácora (Excel)"}
      </Button>
    </Card>
  );
}

/**
 * Reversión de un lote aplicado (RNF-007, RN-005). Pide el motivo; si hay ediciones posteriores
 * (`conflicts`) las lista y exige una segunda confirmación explícita antes de pisarlas.
 */
export function RollbackPanel({
  canRevert,
  busy,
  conflicts,
  onRevert,
}: {
  canRevert: boolean;
  busy: boolean;
  conflicts: RevertConflict[] | null;
  onRevert: (reason: string | null, confirmConflicts: boolean) => void;
}) {
  return (
    <Card as="section" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-tinta">Revertir el lote</h2>
      <p className="text-base text-gris-texto">
        Las piezas que creó el lote quedan eliminadas lógicamente con el motivo (se pueden restaurar) y los campos que actualizó recuperan su
        valor anterior. Los datos de origen se conservan: nada se borra.
      </p>
      {!canRevert ? (
        <PermissionNotice>Solo un Administrador puede revertir un lote aplicado.</PermissionNotice>
      ) : conflicts ? (
        <>
          <div role="alert" className="flex flex-col gap-2 rounded-md bg-ambar-bg p-3 text-base text-ambar-texto">
            <p className="font-medium">Estas ediciones se hicieron a mano después de aplicar el lote y se perderían:</p>
            <ul className="list-disc pl-5">
              {conflicts.map((conflict) => (
                <li key={`${conflict.entityId}-${conflict.field ?? ""}`}>{conflict.message || `${conflict.entityType}: ${conflict.field ?? "registro"}`}</li>
              ))}
            </ul>
          </div>
          <ConfirmButton
            label="Revertir también estas ediciones"
            variant="danger"
            icon={Undo2}
            className="self-start"
            disabled={busy}
            confirmTitle="Revertir el lote y las ediciones posteriores"
            confirmDescription="Las ediciones listadas vuelven al valor que tenían antes del lote. La reversión queda auditada con su usuario y el motivo."
            onConfirm={() => onRevert(null, true)}
          />
        </>
      ) : (
        <ConfirmButton
          label="Revertir lote"
          variant="danger"
          icon={Undo2}
          className="self-start"
          disabled={busy}
          confirmTitle="Revertir el lote aplicado"
          confirmDescription="El lote queda revertido y no se puede volver a aplicar. La reversión queda auditada con su usuario y el motivo."
          requireReason
          reasonLabel="Motivo de la reversión"
          onConfirm={(reason) => onRevert(reason, false)}
        />
      )}
    </Card>
  );
}

export interface ReviewImage {
  image: ImportImage;
  /** Fila del lote donde está anclada; `null` = bandeja sin asignar. */
  rowNumber: number | null;
}

export function ImageReviewPanel({
  images,
  applied,
  canAssociate,
  busyId,
  onAssociate,
}: {
  images: ReviewImage[];
  applied: boolean;
  canAssociate: boolean;
  busyId: string | null;
  onAssociate: (imageId: string, pieceId: string | null) => void;
}) {
  const [pieceIds, setPieceIds] = useState<Record<string, string>>({});
  if (images.length === 0) return null;
  return (
    <Card as="section" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-tinta">Imágenes del archivo</h2>
      <p className="text-sm text-gris-texto">
        Ninguna imagen se asocia sola: confirme cada una. {applied ? "" : "Podrá asociarlas cuando el lote esté aplicado."}
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {images.map(({ image, rowNumber }) => (
          <li key={image.id} className="flex flex-col gap-2 rounded-md border border-borde p-3">
            {image.preview_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL temporal del almacenamiento
              <img src={image.preview_url} alt={`Imagen ${image.image_number} del archivo`} className="max-h-40 self-start rounded" />
            ) : (
              <ImageIcon size={28} aria-hidden="true" className="text-gris-texto" />
            )}
            <p className="text-sm text-tinta">
              Imagen {image.image_number} · {rowNumber != null ? `fila ${rowNumber}` : `sin asignar (anclada en la fila ${display(image.anchor_row_number)}, sin datos)`}
            </p>
            {image.status === "ASSOCIATED" ? (
              <StatusBadge status={{ label: "Asociada a la pieza", intent: "success" }} />
            ) : (
              applied &&
              canAssociate && (
                <div className="flex flex-wrap items-end gap-2">
                  {rowNumber == null && (
                    <Input
                      label="Identificador de la pieza"
                      value={pieceIds[image.id] ?? ""}
                      onChange={(event) => setPieceIds({ ...pieceIds, [image.id]: event.target.value })}
                    />
                  )}
                  <Button
                    variant="outline"
                    disabled={busyId === image.id || (rowNumber == null && !pieceIds[image.id]?.trim())}
                    onClick={() => onAssociate(image.id, rowNumber == null ? (pieceIds[image.id] ?? null) : null)}
                  >
                    Asociar a la pieza
                  </Button>
                </div>
              )
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
