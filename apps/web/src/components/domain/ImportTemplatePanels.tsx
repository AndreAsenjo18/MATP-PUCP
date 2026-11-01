"use client";

/**
 * Formatos (plantillas de mapeo) en el asistente (changes `plantillas-mapeo-y-normalizacion`,
 * tarea 4.1A, y `rediseno-ux-importacion`; spec importacion-datos: RF-022, RF-023, RNF-010).
 *
 * Componentes de presentación, como los de `ImportWizard.tsx`: reciben los datos y avisan de cada
 * acción; `LiveImportWizard` hace las llamadas.
 *
 * - `FormatProblemPanel`: cuando el formato no se aplicó solo (ninguna plantilla reconoce el
 *   archivo, la elegida no encaja o se quiere cambiar), ofrece otro formato o «Ajustar columnas».
 * - `DryRunPanel`: vista previa de normalización por columna (design D4), plegable por columna.
 *   Con `association` (4.1C), cada valor sin término ofrece «Asociar a término», que añade la
 *   correspondencia al borrador; con `stale`, avisa que el borrador cambió desde el cálculo.
 */
import { FilePlus2, Layers, Link2 } from "lucide-react";
import { useState } from "react";

import { ErrorNotice } from "@/components/domain/ImportWizard";
import { dryRunValueStatus } from "@/components/domain/status-intents";
import { StatusBadge } from "@/components/domain/StatusBadges";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import {
  columnNeedsAttention,
  previewValue,
  scoreLabel,
  statusCounts,
  targetLabel,
  traceStepText,
  type DryRunColumn,
  type DryRunExample,
  type MappingTemplate,
  type TemplateDryRun,
  type TemplateSuggestion,
} from "@/lib/data/import-templates";
import { termLabel, termsVocabulary, type TermOption } from "@/lib/data/mapping-editor";

/** Por qué el formato no se pudo aplicar solo (el asistente se detiene antes de validar). */
export type FormatIssue =
  | { kind: "unrecognized" }
  | { kind: "missing"; template: MappingTemplate; missing: string[] }
  | { kind: "failed"; template: MappingTemplate; message: string }
  | { kind: "change"; current: MappingTemplate | null };

/**
 * Se muestra cuando el formato no se aplicó solo: ninguna plantilla reconoce el archivo, la
 * elegida no encaja o el mapeo fue rechazado. Ofrece otro formato o «Ajustar columnas».
 */
export function FormatProblemPanel({
  issue,
  suggestions,
  templates,
  loading,
  busy,
  error,
  decided = 0,
  onCancel,
  onUse,
  onAdjust,
}: {
  issue: FormatIssue;
  suggestions: TemplateSuggestion[] | null;
  templates: MappingTemplate[] | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  /** Filas con una decisión ya tomada: al cambiar de formato se descartan. */
  decided?: number;
  /** Solo al cambiar de formato: volver a la revisión sin cambiar nada. */
  onCancel?: () => void;
  onUse: (template: MappingTemplate) => void;
  onAdjust: (template: MappingTemplate | null) => void;
}) {
  const scores = new Map((suggestions ?? []).map((suggestion) => [suggestion.template.id, suggestion.score]));
  const ranked = [...(templates ?? [])].sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  const excluded = issue.kind === "missing" || issue.kind === "failed" ? issue.template.id : issue.kind === "change" ? issue.current?.id : undefined;
  const others = ranked.filter((template) => template.id !== excluded);
  return (
    <Card as="section" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-tinta">
          {issue.kind === "unrecognized" ? "No reconocemos el formato de este archivo" : issue.kind === "change" ? "Cambiar el formato" : "Este formato no encaja con el archivo"}
        </h2>
        {issue.kind === "unrecognized" && <p className="text-base text-gris-texto">Elija uno de los formatos guardados o ajuste las columnas a mano.</p>}
        {issue.kind === "missing" && (
          <p className="text-base text-gris-texto">
            Al formato «{issue.template.name}» le faltan estas columnas: <strong className="text-tinta">{issue.missing.join(", ")}</strong>.
          </p>
        )}
        {issue.kind === "failed" && <p className="text-base text-gris-texto">{issue.message}</p>}
        {issue.kind === "change" && <p className="text-base text-gris-texto">El archivo se leerá de nuevo con el formato que elija y se validará otra vez.</p>}
        {issue.kind === "change" && decided > 0 && (
          <p className="rounded-md bg-ambar-bg p-3 text-sm font-medium text-ambar-texto">
            {decided === 1 ? "La decisión que ya tomó se pierde" : `Las ${decided.toLocaleString("es-PE")} decisiones que ya tomó se pierden`}: las filas se recalculan.
          </p>
        )}
      </div>
      <ErrorNotice message={error} />
      {loading && <p className="text-base text-gris-texto">Buscando formatos…</p>}
      {others.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Formatos guardados">
          {others.map((template) => (
            <li key={template.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-borde p-3">
              <div className="flex min-w-0 flex-col">
                <p className="font-medium text-tinta">
                  {template.name}
                  {scores.has(template.id) && <span className="text-sm font-normal text-gris-texto"> · se parece {scoreLabel(scores.get(template.id) ?? 0)}</span>}
                </p>
                {template.description && <p className="text-sm text-gris-texto">{template.description}</p>}
              </div>
              <Button variant="outline" icon={Layers} disabled={busy} onClick={() => onUse(template)}>
                Usar este formato
              </Button>
            </li>
          ))}
        </ul>
      )}
      {!loading && others.length === 0 && <p className="text-base text-gris-texto">No hay otros formatos guardados.</p>}
      <Button variant={others.length === 0 ? "primary" : "secondary"} icon={FilePlus2} className="self-start" disabled={busy} onClick={() => onAdjust(issue.kind === "missing" || issue.kind === "failed" ? issue.template : null)}>
        Ajustar columnas
      </Button>
      {issue.kind === "change" && onCancel && (
        <Button variant="secondary" className="self-start" disabled={busy} onClick={onCancel}>
          Volver a la revisión
        </Button>
      )}
    </Card>
  );
}

/** Lo que necesita «Asociar a término»: términos por vocabulario y el borrador (4.1C). */
export interface TermAssociation {
  terms: Record<string, TermOption[]>;
  /** Término al que el borrador ya asocia ese texto en esa columna, o `null`. */
  pending: (source: string, text: string) => string | null;
  onAssociate: (source: string, text: string, code: string) => void;
}

export function DryRunPanel({ result, stale = false, association }: { result: TemplateDryRun; stale?: boolean; association?: TermAssociation }) {
  return (
    <Card as="section" className="flex flex-col gap-3" aria-label="Vista previa de normalización por columna">
      <h2 className="text-lg font-semibold text-tinta">Vista previa por columna</h2>
      <p className="text-sm text-gris-texto">
        Calculada sobre {result.sampled_rows} de {result.total_rows} filas (máximo 200). No guarda nada: ni el lote ni el catálogo cambian.
      </p>
      {stale && (
        <p className="rounded-md bg-ambar-bg p-3 text-sm text-ambar-texto">
          Esta vista previa es de la plantilla guardada y el mapeo cambió desde entonces: guarde la plantilla y vuelva a pedir la vista previa para ver el
          resultado de los cambios.
        </p>
      )}
      {result.missing_columns.length > 0 && (
        <p className="rounded-md bg-carmin-bg p-3 text-sm text-carmin-texto">Columnas de la plantilla que el lote no trae: {result.missing_columns.join(", ")}.</p>
      )}
      <div className="flex flex-col gap-2">
        {result.columns.map((column) => (
          <DryRunColumnDetails key={column.mapping.source_column} column={column} association={association} />
        ))}
      </div>
    </Card>
  );
}

function DryRunColumnDetails({ column, association }: { column: DryRunColumn; association?: TermAssociation }) {
  const counts = statusCounts(column).filter(([, count]) => count > 0);
  const source = column.mapping.source_column;
  const vocabulary = termsVocabulary(column.mapping);
  const terms = vocabulary ? (association?.terms[vocabulary] ?? []) : [];
  return (
    <details className="rounded-md border border-borde p-3" open={columnNeedsAttention(column)}>
      <summary className="flex cursor-pointer flex-wrap items-center gap-2">
        <span className="font-medium text-tinta">{column.mapping.source_column}</span>
        <span className="text-sm text-gris-texto">→ {column.mapping.target_field ? targetLabel(column.mapping) : "Dato de origen"}</span>
        {counts.map(([status, count]) => (
          <StatusBadge key={status} status={{ ...dryRunValueStatus(status), label: `${dryRunValueStatus(status).label}: ${count}` }} />
        ))}
        <span className="text-sm text-gris-texto">Vacías: {column.empty}</span>
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        {!column.in_file && <p className="text-sm text-carmin-texto">El lote no trae esta columna.</p>}
        {column.unmatched_values.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-tinta">Valores sin término en el vocabulario (los más frecuentes)</h4>
            <ul className="mt-1 flex flex-wrap gap-2">
              {column.unmatched_values.map((item) => {
                const pending = association?.pending(source, item.value) ?? null;
                return (
                  <li key={item.value} className="flex flex-wrap items-center gap-2 rounded-md bg-ambar-bg px-2 py-1 text-sm text-ambar-texto">
                    <span>
                      {item.value} ({item.count})
                    </span>
                    {pending && <span className="text-tinta">→ {termLabel(terms, pending)}, pendiente de guardar</span>}
                    {!pending && association && vocabulary && terms.length > 0 && (
                      <AssociateTermControl source={source} text={item.value} terms={terms} onAssociate={association.onAssociate} />
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-1 text-sm text-gris-texto">Se conservan como texto en los datos de origen de cada fila; no se crean términos.</p>
          </div>
        )}
        {column.examples.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-tinta">Ejemplos</h4>
            <ul className="mt-1 flex flex-col gap-2">
              {column.examples.map((example) => (
                <DryRunExampleItem key={example.source_row_number} example={example} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

function AssociateTermControl({
  source,
  text,
  terms,
  onAssociate,
}: {
  source: string;
  text: string;
  terms: TermOption[];
  onAssociate: (source: string, text: string, code: string) => void;
}) {
  const [code, setCode] = useState("");
  return (
    <span className="flex flex-wrap items-end gap-2">
      <Select label={<span className="sr-only">Término para «{text}»</span>} value={code} onChange={(event) => setCode(event.target.value)}>
        <option value="">Elija un término…</option>
        {terms.map((term) => (
          <option key={term.code} value={term.code}>
            {term.label}
          </option>
        ))}
      </Select>
      <Button variant="outline" icon={Link2} disabled={!code} onClick={() => onAssociate(source, text, code)}>
        Asociar a término
      </Button>
    </span>
  );
}

function DryRunExampleItem({ example }: { example: DryRunExample }) {
  const proposals = Object.entries(example.proposals);
  return (
    <li className="rounded-md bg-crema-light p-2 text-sm text-tinta">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Fila {example.source_row_number}</span>
        <span>
          {previewValue(example.original)} → {previewValue(example.value)}
        </span>
        <StatusBadge status={dryRunValueStatus(example.status)} />
      </div>
      {example.trace.length > 0 && (
        <ol className="mt-1 list-decimal pl-5 font-mono text-gris-texto">
          {example.trace.map((step, index) => (
            <li key={index}>{traceStepText(step)}</li>
          ))}
        </ol>
      )}
      {example.identifiers.length > 0 && (
        <p className="mt-1 text-gris-texto">
          Códigos:{" "}
          {example.identifiers
            .map((identifier) => `${identifier.type_code} ${identifier.is_absent ? "(sin código)" : (identifier.normalized_value ?? `${identifier.original_value} (no normalizable)`)}`)
            .join(" · ")}
        </p>
      )}
      {proposals.length > 0 && (
        <p className="mt-1 text-gris-texto">Propuesta (no reemplaza el texto): {proposals.map(([field, value]) => `${field} = ${previewValue(value)}`).join(", ")}</p>
      )}
      {Object.keys(example.matched_terms).length > 0 && (
        <p className="mt-1 text-gris-texto">
          Términos:{" "}
          {Object.entries(example.matched_terms)
            .map(([value, code]) => `${value} → ${code}`)
            .join(", ")}
        </p>
      )}
      {example.unmatched_terms.length > 0 && <p className="mt-1 text-ambar-texto">Sin término: {example.unmatched_terms.join(", ")}</p>}
      {example.errors.length > 0 && <p className="mt-1 text-carmin-texto">{example.errors.join(" ")}</p>}
    </li>
  );
}
