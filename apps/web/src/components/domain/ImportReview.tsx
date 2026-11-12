"use client";

/**
 * Pantalla de revisión del asistente de importación, simplificada (change
 * `importacion-revision-simplificada`): el resumen que suma el total y el bloque de un error
 * repetido en muchas filas. Son componentes de presentación; `LiveImportWizard` hace las llamadas.
 */
import { MinusCircle } from "lucide-react";
import { useState, type ReactNode } from "react";

import { ConfirmButton } from "@/components/domain/ConfirmButton";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatCauseSentence, type ErrorGroup, type FormatCause, type ReviewSummary } from "@/lib/data/import-review";
import { validationHint, type RowClassification } from "@/lib/data/imports";

export interface ReviewFilter {
  classification: RowClassification | null;
  onlyErrors: boolean;
}

const FIGURES: { label: string; value: ReviewFilter; count: (summary: ReviewSummary) => number }[] = [
  { label: "Con errores", value: { classification: null, onlyErrors: true }, count: (s) => s.errors },
  { label: "Conflictos", value: { classification: "CONFLICT", onlyErrors: false }, count: (s) => s.conflicts },
  { label: "Posibles duplicados", value: { classification: "POSSIBLE_DUPLICATE", onlyErrors: false }, count: (s) => s.duplicates },
  { label: "Actualizaciones", value: { classification: "UPDATE", onlyErrors: false }, count: (s) => s.updates },
  { label: "Nuevas", value: { classification: "NEW", onlyErrors: false }, count: (s) => s.news },
];

const same = (a: ReviewFilter, b: ReviewFilter) => a.classification === b.classification && a.onlyErrors === b.onlyErrors;

/** Resumen al comienzo de la revisión: cada fila en una sola situación, las cifras suman el total. */
export function ReviewSummaryPanel({
  summary,
  filter,
  onFilter,
  sentence,
  formatLine,
}: {
  summary: ReviewSummary | null;
  filter: ReviewFilter;
  onFilter: (value: ReviewFilter) => void;
  /** Qué falta para poder aprobar. */
  sentence: string;
  /** «Formato aplicado: … · Cambiar», como una línea del resumen. */
  formatLine?: ReactNode;
}) {
  const all: ReviewFilter = { classification: null, onlyErrors: false };
  return (
    <section aria-label="Resumen de la revisión" className="flex flex-col gap-3 rounded-lg border border-borde bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-tinta">
        {summary ? (summary.total === 0 ? "El archivo no trajo filas" : `${summary.total.toLocaleString("es-PE")} ${summary.total === 1 ? "fila" : "filas"}`) : "Calculando el resumen…"}
      </h2>
      {summary && summary.total > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar filas">
          <Button variant={same(filter, all) ? "primary" : "outline"} aria-pressed={same(filter, all)} onClick={() => onFilter(all)}>
            Todas ({summary.total.toLocaleString("es-PE")})
          </Button>
          {FIGURES.map((figure) => {
            const count = figure.count(summary);
            const active = same(filter, figure.value);
            return (
              <Button key={figure.label} variant={active ? "primary" : "outline"} aria-pressed={active} disabled={count === 0 && !active} onClick={() => onFilter(figure.value)}>
                {figure.label} ({count.toLocaleString("es-PE")})
              </Button>
            );
          })}
        </div>
      )}
      <p className="text-base text-tinta">{sentence}</p>
      {formatLine}
    </section>
  );
}

/** Un error que se repite en tres o más filas: se explica y se resuelve una sola vez. */
export function RepeatedErrorBlock({
  group,
  cause,
  totalRows,
  canDecide,
  busy,
  progress,
  action,
  onChangeFormat,
  onExcludeAll,
  children,
}: {
  group: ErrorGroup;
  cause: FormatCause | null;
  /** Filas del lote, para decir «30 de 30». */
  totalRows: number;
  canDecide: boolean;
  busy: boolean;
  /** Avance de «dejar fuera todas», si está en curso. */
  progress: { done: number; total: number } | null;
  /** Acción directa del error (por ejemplo, elegir el régimen). */
  action?: ReactNode;
  onChangeFormat: () => void;
  onExcludeAll: () => void;
  /** Las filas del grupo; se montan solo al abrir «Ver las N filas». */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const count = group.rowIds.length;
  const hint = validationHint(group.code)?.hint ?? null;
  const undecided = group.undecided;
  return (
    <section aria-label={`Error repetido: ${group.message}`} className="flex flex-col gap-3 rounded-lg border border-ambar-alerta bg-ambar-bg p-4 text-ambar-texto">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">
          {count.toLocaleString("es-PE")} {count === 1 ? "fila" : "filas"}: {group.message.replace(/\.$/, "")}
          {totalRows > 0 && count === totalRows ? " (todas)" : ""}
        </h2>
        {cause ? (
          <p className="text-base">
            {formatCauseSentence(cause)} Pruebe primero con otro formato; si el archivo no trae ese dato, también puede elegir uno para todas las filas.
          </p>
        ) : (
          hint && <p className="text-base">{hint}</p>
        )}
      </div>

      {canDecide && (
        <div className="flex flex-wrap items-end gap-3">
          {cause && (
            <Button variant="primary" disabled={busy} onClick={onChangeFormat}>
              Cambiar formato
            </Button>
          )}
          {action}
        </div>
      )}

      {canDecide && undecided > 0 && (
        <div className="flex flex-col gap-1 border-t border-ambar-alerta/40 pt-3">
          <ConfirmButton
            label={`Dejar fuera las ${undecided.toLocaleString("es-PE")} filas`}
            variant="secondary"
            icon={MinusCircle}
            className="self-start"
            disabled={busy || progress !== null}
            confirmTitle="Dejar fuera estas filas"
            confirmDescription={`Las ${undecided.toLocaleString("es-PE")} filas no se importarán y quedan en la bitácora del lote. Puede cambiar de idea fila por fila.`}
            onConfirm={onExcludeAll}
          />
          {progress && (
            <p role="status" className="text-sm font-medium">
              Dejando fuera… {progress.done.toLocaleString("es-PE")} de {progress.total.toLocaleString("es-PE")}
            </p>
          )}
        </div>
      )}

      <details open={open} onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)} className={cn("text-base")}>
        <summary className="min-h-11 cursor-pointer py-2 font-medium">Ver las {count.toLocaleString("es-PE")} filas</summary>
        {open && <div className="flex flex-col gap-3 pt-2">{children}</div>}
      </details>
    </section>
  );
}
