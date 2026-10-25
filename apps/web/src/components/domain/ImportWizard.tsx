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
import { Check, Download, FileSpreadsheet, ImageIcon, MinusCircle, Upload } from "lucide-react";
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
  WIZARD_STEPS,
  acceptBlocker,
  actionLabel,
  candidatePieces,
  conflictingRows,
  fieldAction,
  needsResolution,
  progressText,
  summarySentence,
  type ApprovalSummary,
  type FieldAction,
  type ImportBatch,
  type ImportImage,
  type ImportLog,
  type ImportRow,
  type RowClassification,
  type RowDecisionInput,
} from "@/lib/data/imports";

export function ImportSteps({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Pasos de la importación">
      {WIZARD_STEPS.map((label, index) => (
        <li
          key={label}
          aria-current={index === current ? "step" : undefined}
          className={cn(
            "flex min-h-11 items-center gap-1 rounded-full px-4 py-2 text-sm font-medium",
            index === current ? "bg-terracota text-white" : index < current ? "bg-verde-bg text-verde-exito" : "bg-crema text-tinta",
          )}
        >
          {index < current && <Check size={16} aria-hidden="true" />}
          {index + 1}. {label}
        </li>
      ))}
    </ol>
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

export function UploadPanel({ busy, onUpload }: { busy: boolean; onUpload: (file: File) => void }) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <Card as="section" className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-tinta">Subir la hoja de cálculo</h2>
      <p className="text-base text-gris-texto">
        Elija un archivo Excel (.xlsx) o CSV. El archivo original se guarda sin cambios y nada llega al catálogo hasta que una persona
        autorizada apruebe el lote.
      </p>
      <label className="flex flex-col items-center gap-2 rounded-md border border-dashed border-borde p-6 text-center text-gris-texto">
        <FileSpreadsheet size={28} aria-hidden="true" className="text-terracota" />
        <span className="font-medium text-tinta">{file ? file.name : "Seleccionar archivo"}</span>
        <input type="file" accept=".xlsx,.csv" className="text-sm" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      </label>
      <Button icon={Upload} className="self-start" disabled={!file || busy} onClick={() => file && onUpload(file)}>
        {busy ? "Subiendo…" : "Subir archivo"}
      </Button>
    </Card>
  );
}

export function ProgressPanel({ batch }: { batch: ImportBatch }) {
  return (
    <Card as="section" className="flex flex-col gap-2" aria-live="polite">
      <h2 className="text-lg font-semibold text-tinta">Procesando el lote</h2>
      <p className="text-base text-gris-texto">{progressText(batch.progress)}</p>
      <p className="text-sm text-gris-texto">Puede salir de esta pantalla: el proceso continúa en el servidor.</p>
    </Card>
  );
}

export function BatchHeader({ batch }: { batch: ImportBatch }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="font-medium text-tinta">{batch.file_name}</span>
      <StatusBadge status={importBatchStatus(batch.status)} />
      {batch.status_reason && <span className="text-sm text-carmin-texto">{batch.status_reason}</span>}
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
  const others = conflictingRows(row);
  const errors = row.validation_errors.map((error) => String((error as { message?: unknown }).message ?? "")).filter(Boolean);

  const accept = () =>
    onDecide({
      decision: "ACCEPTED",
      targetPieceId: resolvable && target && target !== "new" ? target : null,
      asNew: resolvable && target === "new",
      fieldDecisions: row.diff.length > 0 ? fields : undefined,
    });

  return (
    <article className="rounded-md border border-borde p-3" aria-label={`Fila ${row.source_row_number}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-tinta">Fila {row.source_row_number}</span>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={importClassificationStatus(row.classification)} />
          <StatusBadge status={importDecisionStatus(row.decision)} />
        </div>
      </div>
      <p className="mt-1 text-sm text-gris-texto">{actionLabel(row.action)}</p>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm text-tinta sm:grid-cols-4">
        {Object.entries(row.raw_data)
          .filter(([key]) => !key.startsWith("__"))
          .map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="font-medium text-gris-texto">{key}</dt>
              <dd className="break-words">{display(value)}</dd>
            </div>
          ))}
      </dl>
      {errors.length > 0 && <p className="mt-2 text-sm font-medium text-carmin-texto">{errors.join("; ")}</p>}
      {others.length > 0 && <p className="mt-2 text-sm text-ambar-texto">El mismo código I aparece en la fila {others.join(", ")} de este lote.</p>}
      {row.decision_reason && <p className="mt-2 text-sm text-gris-texto">Motivo: {row.decision_reason}</p>}

      {row.diff.length > 0 && (
        <fieldset className="mt-2 rounded-md bg-ambar-bg p-2 text-sm text-ambar-texto">
          <legend className="font-medium">Cambios sobre la pieza del catálogo</legend>
          {row.diff.map((change) => (
            <label key={change.field} className="flex flex-wrap items-center gap-2">
              <input
                type="checkbox"
                disabled={!canDecide}
                checked={fields[change.field] === "accept"}
                onChange={(event) => setFields({ ...fields, [change.field]: event.target.checked ? "accept" : "exclude" })}
              />
              <strong>{change.field}</strong>: {display(change.current_value)} → {display(change.incoming_value)}
              {change.default_action === "keep" && <span>(la celda está vacía: se conserva el valor actual)</span>}
            </label>
          ))}
        </fieldset>
      )}

      {resolvable && canDecide && (
        <Select label="¿A qué pieza corresponde esta fila?" value={target} onChange={(event) => setTarget(event.target.value)} fieldClassName="mt-2">
          <option value="">Elegir…</option>
          {candidates.map((candidate) => (
            <option key={candidate.pieceId} value={candidate.pieceId}>
              Pieza {candidate.pieceId.slice(0, 8)} · {candidate.reason}
            </option>
          ))}
          <option value="new">Es una pieza nueva</option>
        </Select>
      )}

      {row.images && row.images.length > 0 && (
        <p className="mt-2 flex items-center gap-1 text-sm text-gris-texto">
          <ImageIcon size={16} aria-hidden="true" />
          {row.images.length === 1 ? "1 imagen anclada en esta fila" : `${row.images.length} imágenes ancladas en esta fila`} (se asocian después de aplicar).
        </p>
      )}

      {canDecide && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="outline" icon={Check} disabled={busy || (Boolean(blocker) && !choosing) || row.has_validation_errors} onClick={accept}>
            Aceptar
          </Button>
          <Button variant="secondary" icon={MinusCircle} disabled={busy} onClick={() => onDecide({ decision: "EXCLUDED" })}>
            Excluir
          </Button>
          <ConfirmButton
            label="Rechazar"
            variant="danger"
            disabled={busy}
            confirmTitle="Rechazar fila"
            confirmDescription="La fila queda en la bitácora como rechazada, con el motivo indicado (RF-028)."
            requireReason
            reasonLabel="Motivo del rechazo"
            onConfirm={(reason) => onDecide({ decision: "REJECTED", reason })}
          />
          {blocker && !choosing && <span className="text-sm text-gris-texto">{blocker}</span>}
        </div>
      )}
    </article>
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
        <PermissionNotice>Su rol puede preparar la carga pero no aprobarla (RF-027). La aprueba un Gestor de colecciones o un Administrador.</PermissionNotice>
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
