"use client";

/**
 * Plantillas de mapeo en el paso «Mapeo» del asistente (change `plantillas-mapeo-y-normalizacion`,
 * tarea 4.1A; spec importacion-datos: RF-022, RF-023, RNF-010).
 *
 * Componentes de presentación, como los de `ImportWizard.tsx`: reciben los datos y avisan de cada
 * acción; `LiveImportWizard` hace las llamadas.
 *
 * - `TemplatePicker`: plantillas sugeridas por las cabeceras del archivo, lista completa y
 *   «Empezar desde cero».
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
  otherTemplates,
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

export function TemplatePicker({
  suggestions,
  templates,
  loading,
  error,
  onUse,
  onStartFromScratch,
}: {
  suggestions: TemplateSuggestion[] | null;
  templates: MappingTemplate[] | null;
  loading: boolean;
  error: string | null;
  onUse: (template: MappingTemplate) => void;
  onStartFromScratch: () => void;
}) {
  const [chosenId, setChosenId] = useState("");
  const others = otherTemplates(templates ?? [], suggestions ?? []);
  const chosen = others.find((template) => template.id === chosenId);
  return (
    <Card as="section" className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-tinta">Mapeo de columnas</h2>
      <p className="text-base text-gris-texto">
        Use una plantilla guardada para este tipo de archivo o empiece desde cero. Antes de validar puede ver cómo quedará cada columna.
      </p>
      <ErrorNotice message={error} />
      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-tinta">Plantillas que coinciden con las cabeceras del archivo</h3>
        {loading && <p className="text-base text-gris-texto">Buscando plantillas…</p>}
        {!loading && suggestions?.length === 0 && <p className="text-base text-gris-texto">Ninguna plantilla coincide con estas cabeceras.</p>}
        {!loading && suggestions && suggestions.length > 0 && (
          <ul className="flex flex-col gap-2">
            {suggestions.map((suggestion) => (
              <li key={suggestion.template.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-borde p-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="font-medium text-tinta">
                    {suggestion.template.name} <span className="text-sm font-normal text-gris-texto">· coincidencia {scoreLabel(suggestion.score)}</span>
                  </p>
                  {suggestion.missing_columns.length > 0 && (
                    <p className="text-sm text-carmin-texto">Faltan en el archivo: {suggestion.missing_columns.join(", ")}</p>
                  )}
                  {suggestion.new_columns.length > 0 && (
                    <p className="text-sm text-gris-texto">Columnas nuevas (irán a los datos de origen): {suggestion.new_columns.join(", ")}</p>
                  )}
                </div>
                <Button variant="primary" icon={Layers} onClick={() => onUse(suggestion.template)}>
                  Usar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {others.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <Select label="Otra plantilla guardada" value={chosenId} onChange={(event) => setChosenId(event.target.value)} fieldClassName="min-w-64">
            <option value="">Elija una plantilla</option>
            {others.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </Select>
          <Button variant="outline" icon={Layers} disabled={!chosen} onClick={() => chosen && onUse(chosen)}>
            Usar esta plantilla
          </Button>
        </div>
      )}
      <Button variant="secondary" icon={FilePlus2} className="self-start" onClick={onStartFromScratch}>
        Empezar desde cero
      </Button>
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
