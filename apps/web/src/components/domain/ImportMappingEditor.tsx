"use client";

/**
 * Editor de mapeo del paso «Mapeo» del asistente (change `plantillas-mapeo-y-normalizacion`, tarea
 * 4.1B; spec importacion-datos: RF-022, RF-023, RNF-010; design D1, D2, D4).
 *
 * Componentes de presentación: reciben el borrador y avisan de cada cambio; las reglas están en
 * `lib/data/mapping-editor.ts` (ADR-012) y `LiveImportWizard` hace las llamadas.
 *
 * - `MappingEditor`: hoja, fila de cabeceras, régimen por defecto, una fila por columna, estado
 *   del borrador, guardar como plantilla, vista previa y «Usar este mapeo y validar».
 * - `ColumnMappingRow`: destino de la columna con `Select` (sin arrastrar, accesible con teclado)
 *   y su cadena de transformaciones.
 * - `TransformChain`: añadir, quitar, subir y bajar pasos; argumento obligatorio en `split:`,
 *   `date:` y `default:`.
 * - `SaveTemplateForm`: en línea, sin modal; «Guardar como nueva» es la opción principal.
 */
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Eye, Plus, Save, X } from "lucide-react";
import { useState } from "react";

import { ErrorNotice } from "@/components/domain/ImportWizard";
import { mappingDraftStatus } from "@/components/domain/status-intents";
import { StatusBadge } from "@/components/domain/StatusBadges";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { ColumnMapping, ImportBatch, TargetOption } from "@/lib/data/imports";
import {
  TRANSFORMS,
  addTransform,
  applyNotice,
  draftStatus,
  droppedColumns,
  moveTransform,
  parseTransform,
  previewBlocker,
  removeTransform,
  saveFormError,
  setColumnTarget,
  setColumnTransforms,
  targetOptions,
  targetValue,
  templateDefaultsText,
  transformArgError,
  transformInfo,
  transformLabel,
  type DraftStatus,
  type EditorDraft,
  type SaveKind,
  type TemplateFormValues,
  type Vocabulary,
} from "@/lib/data/mapping-editor";

export function MappingEditor({
  batch,
  draft,
  vocabularies,
  errors,
  nameError,
  busy,
  saving,
  previewBusy,
  onChange,
  onSave,
  onPreview,
  onApply,
  onBack,
}: {
  batch: ImportBatch;
  draft: EditorDraft;
  vocabularies: Pick<Vocabulary, "code" | "name">[];
  /** Errores por columna de origen; `""` = errores generales del mapeo. */
  errors: Record<string, string>;
  nameError: string | null;
  busy: boolean;
  saving: boolean;
  previewBusy: boolean;
  onChange: (draft: EditorDraft) => void;
  onSave: (kind: SaveKind, values: TemplateFormValues) => void;
  onPreview: () => void;
  onApply: () => void;
  onBack: () => void;
}) {
  const status = draftStatus(draft);
  const options = targetOptions(vocabularies);
  const dropped = droppedColumns(draft, batch);
  const blocker = previewBlocker(draft, batch);
  const notice = applyNotice(draft, batch);
  const sheetNames = batch.sheet_names ?? [];
  const templateDefaults = templateDefaultsText(draft.templateDefaults);
  return (
    <Card as="section" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-tinta">{draft.base ? `Mapeo con la plantilla «${draft.base.name}»` : "Mapeo de columnas"}</h2>
        <StatusBadge status={mappingDraftStatus(status)} />
      </div>
      <p className="text-base text-gris-texto">
        Indique a qué campo de la ficha corresponde cada columna y cómo se limpia su valor. Las columnas que deje como «dato de origen» no se pierden:
        se guardan junto a cada pieza (RF-008). La denominación es obligatoria.
      </p>
      {dropped.length > 0 && (
        <p className="rounded-md bg-ambar-bg p-3 text-sm text-ambar-texto">
          Se quitaron del mapeo las columnas de la plantilla que este archivo no trae: {dropped.join(", ")}.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {sheetNames.length > 1 && (
          <Select label="Hoja" value={draft.sheetName ?? batch.sheet_name ?? ""} onChange={(event) => onChange({ ...draft, sheetName: event.target.value })}>
            {sheetNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        )}
        <Input
          label="Fila de cabeceras"
          type="number"
          min={1}
          value={draft.headerRow ?? batch.header_row ?? 1}
          hint="Cambiarla vuelve a leer el archivo al validar."
          onChange={(event) => onChange({ ...draft, headerRow: Number(event.target.value) || null })}
        />
        <Select
          label="Régimen para filas sin dato"
          value={draft.tenureDefault}
          hint={templateDefaults ? `Solo para este lote; no cambia la plantilla, que trae: ${templateDefaults}.` : "Solo para este lote; no cambia la plantilla."}
          onChange={(event) => onChange({ ...draft, tenureDefault: event.target.value })}
        >
          <option value="">Sin valor por defecto</option>
          <option value="Propiedad">Propiedad</option>
          <option value="Comodato">Comodato</option>
          <option value="Préstamo Temporal">Préstamo temporal</option>
        </Select>
      </div>
      <ul className="flex flex-col gap-3" aria-label="Columnas del archivo">
        {draft.columns.map((column, index) => (
          <ColumnMappingRow
            key={column.source_column}
            column={column}
            options={options}
            error={errors[column.source_column] ?? null}
            onTarget={(value) => onChange(setColumnTarget(draft, index, value))}
            onTransforms={(chain) => onChange(setColumnTransforms(draft, index, chain))}
          />
        ))}
      </ul>
      <ErrorNotice message={errors[""] ?? null} />
      {status !== "unchanged" && (
        <SaveTemplateForm
          key={draft.base?.id ?? "new"}
          status={status}
          baseName={draft.base?.name ?? null}
          defaultSourceName={draft.base?.source_name ?? batch.source_name}
          nameError={nameError}
          busy={saving || busy}
          onSave={onSave}
        />
      )}
      <div className="flex flex-col gap-2 border-t border-borde pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" icon={Eye} disabled={blocker !== null || previewBusy || busy} onClick={onPreview}>
            {previewBusy ? "Calculando vista previa…" : "Ver vista previa"}
          </Button>
          <Button disabled={busy || saving} onClick={onApply}>
            {busy ? "Guardando…" : "Usar este mapeo y validar"}
            <ArrowRight size={18} aria-hidden="true" />
          </Button>
          <Button variant="secondary" icon={ArrowLeft} disabled={busy || saving} onClick={onBack}>
            Volver a las plantillas
          </Button>
        </div>
        {blocker && <p className="text-sm text-gris-texto">{blocker}</p>}
        {notice && <p className="text-sm text-ambar-texto">{notice}</p>}
      </div>
    </Card>
  );
}

export function ColumnMappingRow({
  column,
  options,
  error,
  onTarget,
  onTransforms,
}: {
  column: ColumnMapping;
  options: TargetOption[];
  error: string | null;
  onTarget: (value: string) => void;
  onTransforms: (chain: string[]) => void;
}) {
  const value = targetValue(column);
  const known = options.some((option) => option.value === value);
  return (
    <li className="flex flex-col gap-3 rounded-md border border-borde p-3 sm:flex-row sm:items-start">
      <div className="flex flex-col gap-2 sm:w-72 sm:shrink-0">
        <p className="font-medium break-words text-tinta">{column.source_column}</p>
        <Select label={<span className="sr-only">Destino de {column.source_column}</span>} value={value} error={error ?? undefined} onChange={(event) => onTarget(event.target.value)}>
          {!known && <option value={value}>{value}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
      <TransformChain source={column.source_column} chain={column.transforms ?? []} onChange={onTransforms} />
    </li>
  );
}

export function TransformChain({ source, chain, onChange }: { source: string; chain: readonly string[]; onChange: (chain: string[]) => void }) {
  const [code, setCode] = useState("");
  const [arg, setArg] = useState("");
  const info = transformInfo(code);
  const argError = code ? transformArgError(code, arg) : null;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <p className="text-sm font-medium text-gris-texto">Transformaciones, en orden</p>
      {chain.length === 0 ? (
        <p className="text-sm text-gris-texto">Sin transformaciones: el valor se toma tal cual.</p>
      ) : (
        <ol className="flex flex-col gap-1" aria-label={`Transformaciones de ${source}`}>
          {chain.map((spec, index) => {
            const label = transformLabel(spec);
            return (
              <li key={`${spec}-${index}`} className="flex flex-wrap items-center gap-2 rounded-md bg-crema-light px-2 py-1" title={transformInfo(parseTransform(spec).code)?.help}>
                <span className="text-sm text-tinta">
                  {index + 1}. {label}
                </span>
                <code className="font-mono text-xs text-gris-texto">{spec}</code>
                <span className="ml-auto flex gap-1">
                  <Button variant="secondary" icon={ArrowUp} aria-label={`Subir «${label}»`} disabled={index === 0} onClick={() => onChange(moveTransform(chain, index, -1))} />
                  <Button
                    variant="secondary"
                    icon={ArrowDown}
                    aria-label={`Bajar «${label}»`}
                    disabled={index === chain.length - 1}
                    onClick={() => onChange(moveTransform(chain, index, 1))}
                  />
                  <Button variant="secondary" icon={X} aria-label={`Quitar «${label}»`} onClick={() => onChange(removeTransform(chain, index))} />
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <Select
          label={<span className="sr-only">Añadir transformación a {source}</span>}
          value={code}
          hint={info?.help}
          onChange={(event) => {
            setCode(event.target.value);
            setArg("");
          }}
          fieldClassName="min-w-56"
        >
          <option value="">Añadir transformación…</option>
          {TRANSFORMS.filter((transform) => transform.addable).map((transform) => (
            <option key={transform.code} value={transform.code}>
              {transform.label} ({transform.argument ? `${transform.code}:…` : transform.code})
            </option>
          ))}
        </Select>
        {info?.argument?.options && (
          <Select label={info.argument.label} value={arg} error={argError ?? undefined} onChange={(event) => setArg(event.target.value)}>
            <option value="">Elija…</option>
            {info.argument.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        )}
        {info?.argument && !info.argument.options && (
          <Input label={info.argument.label} value={arg} error={argError ?? undefined} onChange={(event) => setArg(event.target.value)} fieldClassName="w-32" />
        )}
        <Button
          variant="outline"
          icon={Plus}
          disabled={!code || argError !== null}
          onClick={() => {
            onChange(addTransform(chain, code, arg));
            setCode("");
            setArg("");
          }}
        >
          Añadir
        </Button>
      </div>
    </div>
  );
}

export function SaveTemplateForm({
  status,
  baseName,
  defaultSourceName,
  nameError,
  busy,
  onSave,
}: {
  status: Exclude<DraftStatus, "unchanged">;
  baseName: string | null;
  defaultSourceName: string;
  nameError: string | null;
  busy: boolean;
  onSave: (kind: SaveKind, values: TemplateFormValues) => void;
}) {
  const [values, setValues] = useState<TemplateFormValues>({ name: "", sourceName: defaultSourceName, description: "" });
  const newError = saveFormError(values, "new");
  return (
    <section className="flex flex-col gap-3 rounded-md border border-borde bg-crema-light p-3" aria-label="Guardar como plantilla">
      <h3 className="text-base font-semibold text-tinta">Guardar como plantilla</h3>
      <p className="text-sm text-gris-texto">
        {status === "modified"
          ? "Guarde los cambios para reutilizarlos en otras cargas y para ver la vista previa."
          : "Guarde el mapeo como plantilla para reutilizarlo en otras cargas de esta fuente y para ver la vista previa."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label={status === "modified" ? "Nombre de la plantilla nueva" : "Nombre de la plantilla"}
          value={values.name}
          error={nameError ?? undefined}
          onChange={(event) => setValues({ ...values, name: event.target.value })}
        />
        <Input label="Fuente" value={values.sourceName} hint="Por ejemplo, la consultoría o el libro de origen." onChange={(event) => setValues({ ...values, sourceName: event.target.value })} />
      </div>
      <Textarea label="Descripción (opcional)" value={values.description} rows={2} onChange={(event) => setValues({ ...values, description: event.target.value })} />
      <div className="flex flex-wrap items-center gap-3">
        <Button icon={Save} disabled={busy || newError !== null} onClick={() => onSave("new", values)}>
          {status === "modified" ? "Guardar como nueva" : "Guardar como plantilla"}
        </Button>
        {status === "modified" && baseName && (
          <Button variant="outline" icon={Save} disabled={busy} onClick={() => onSave("update", values)}>
            Guardar cambios en «{baseName}»
          </Button>
        )}
      </div>
      {newError && <p className="text-sm text-gris-texto">{newError}</p>}
      {status === "modified" && (
        <p className="text-sm text-gris-texto">
          «Guardar cambios» modifica la plantilla para las próximas cargas; los lotes ya procesados conservan el mapeo con que se procesaron.
        </p>
      )}
    </section>
  );
}
