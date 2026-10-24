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
 * - `AppliedTemplatePanel`: la plantilla elegida, de solo lectura, con el régimen por defecto, la
 *   vista previa y «Usar este mapeo y validar».
 * - `DryRunPanel`: vista previa de normalización por columna (design D4), plegable por columna.
 */
import { ArrowRight, Eye, FilePlus2, Layers } from "lucide-react";
import { useState } from "react";

import { ErrorNotice } from "@/components/domain/ImportWizard";
import { dryRunValueStatus } from "@/components/domain/status-intents";
import { StatusBadge } from "@/components/domain/StatusBadges";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import {
  columnNeedsAttention,
  missingColumns,
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
import type { ImportBatch } from "@/lib/data/imports";

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

export function AppliedTemplatePanel({
  template,
  batch,
  tenureDefault,
  blocker,
  busy,
  previewBusy,
  onTenureChange,
  onPreview,
  onApply,
  onChooseAnother,
}: {
  template: MappingTemplate;
  batch: ImportBatch;
  tenureDefault: string;
  blocker: string | null;
  busy: boolean;
  previewBusy: boolean;
  onTenureChange: (value: string) => void;
  onPreview: () => void;
  onApply: () => void;
  onChooseAnother: () => void;
}) {
  const missing = new Set(missingColumns(template, batch.headers ?? []));
  return (
    <Card as="section" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-tinta">Mapeo con la plantilla «{template.name}»</h2>
        {template.description && <p className="text-sm text-gris-texto">{template.description}</p>}
        <p className="text-sm text-gris-texto">
          Las columnas del archivo que la plantilla no menciona se guardan como datos de origen (RF-008).
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-base">
          <thead className="text-sm text-gris-texto">
            <tr>
              <th className="py-1 pr-4 font-medium">Columna del archivo</th>
              <th className="py-1 pr-4 font-medium">Destino</th>
              <th className="py-1 pr-4 font-medium">Transformaciones</th>
            </tr>
          </thead>
          <tbody>
            {template.columns.map((column) => (
              <tr key={column.source_column} className="border-t border-borde align-top">
                <td className="py-2 pr-4 text-tinta">
                  {column.source_column}
                  {missing.has(column.source_column) && <span className="block text-sm text-carmin-texto">No está en el archivo</span>}
                </td>
                <td className="py-2 pr-4 text-gris-texto">{column.target_field ? targetLabel(column) : "Dato de origen (se conserva sin mapear)"}</td>
                <td className="py-2 pr-4 font-mono text-sm text-gris-texto">{column.transforms?.length ? column.transforms.join(" → ") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Select label="Régimen para filas sin dato" value={tenureDefault} onChange={(event) => onTenureChange(event.target.value)} fieldClassName="max-w-sm">
        <option value="">Sin valor por defecto</option>
        <option value="Propiedad">Propiedad</option>
        <option value="Comodato">Comodato</option>
        <option value="Préstamo Temporal">Préstamo temporal</option>
      </Select>
      <ErrorNotice message={blocker} />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" icon={Eye} disabled={previewBusy || busy} onClick={onPreview}>
          {previewBusy ? "Calculando vista previa…" : "Ver vista previa"}
        </Button>
        <Button disabled={busy || blocker !== null} onClick={onApply}>
          {busy ? "Guardando…" : "Usar este mapeo y validar"}
          <ArrowRight size={18} aria-hidden="true" />
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onChooseAnother}>
          Elegir otra plantilla
        </Button>
      </div>
    </Card>
  );
}

export function DryRunPanel({ result }: { result: TemplateDryRun }) {
  return (
    <Card as="section" className="flex flex-col gap-3" aria-label="Vista previa de normalización por columna">
      <h2 className="text-lg font-semibold text-tinta">Vista previa por columna</h2>
      <p className="text-sm text-gris-texto">
        Calculada sobre {result.sampled_rows} de {result.total_rows} filas (máximo 200). No guarda nada: ni el lote ni el catálogo cambian.
      </p>
      {result.missing_columns.length > 0 && (
        <p className="rounded-md bg-carmin-bg p-3 text-sm text-carmin-texto">Columnas de la plantilla que el lote no trae: {result.missing_columns.join(", ")}.</p>
      )}
      <div className="flex flex-col gap-2">
        {result.columns.map((column) => (
          <DryRunColumnDetails key={column.mapping.source_column} column={column} />
        ))}
      </div>
    </Card>
  );
}

function DryRunColumnDetails({ column }: { column: DryRunColumn }) {
  const counts = statusCounts(column).filter(([, count]) => count > 0);
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
              {column.unmatched_values.map((item) => (
                <li key={item.value} className="rounded-md bg-ambar-bg px-2 py-1 text-sm text-ambar-texto">
                  {item.value} ({item.count})
                </li>
              ))}
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
