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
 * - `ValueMapEditor` (4.1C): en las columnas `terms:<VOCABULARIO>`, la tabla «texto de origen →
 *   término activo». Con correspondencias la cadena lleva `value_map`, que no se quita a mano:
 *   sale sola al vaciar la tabla.
 */
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Eye, Plus, Save, Settings, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ErrorNotice } from "@/components/domain/ImportWizard";
import { mappingDraftStatus } from "@/components/domain/status-intents";
import { StatusBadge } from "@/components/domain/StatusBadges";
import { Button, buttonClassName } from "@/components/ui/Button";
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
  dropMapping,
  moveTransform,
  parseTransform,
  previewBlocker,
  putMapping,
  removeTransform,
  saveFormError,
  setColumnTarget,
  setColumnTransforms,
  setColumnValueMap,
  targetOptions,
  targetValue,
  templateDefaultsText,
  termLabel,
  termsVocabulary,
  transformArgError,
  transformInfo,
  transformLabel,
  valueMapError,
  type DraftStatus,
  type EditorDraft,
  type SaveKind,
  type TemplateFormValues,
  type TermOption,
  type ValueMap,
  type Vocabulary,
} from "@/lib/data/mapping-editor";

/** Pestaña de plantillas de Administración (tarea 4.2); se abre aparte para no perder el borrador. */
export const ADMIN_TEMPLATES_HREF = "/administracion?pestana=plantillas";

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
  terms = {},
}: {
  batch: ImportBatch;
  draft: EditorDraft;
  vocabularies: Pick<Vocabulary, "code" | "name">[];
  /** Términos activos por código de vocabulario, para las correspondencias (4.1C). */
  terms?: Record<string, TermOption[]>;
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
        <h2 className="text-lg font-semibold text-tinta">{draft.base ? `Ajustar columnas · ${draft.base.name}` : "Ajustar columnas"}</h2>
        <StatusBadge status={mappingDraftStatus(status)} />
      </div>
      <p className="text-base text-gris-texto">
        Elija a qué corresponde cada columna. La denominación es obligatoria. Lo que deje como «dato de origen» no se pierde: se guarda con cada pieza.
      </p>
      {dropped.length > 0 && (
        <p className="rounded-md bg-ambar-bg p-3 text-sm text-ambar-texto">
          Se quitaron del mapeo las columnas de la plantilla que este archivo no trae: {dropped.join(", ")}.
        </p>
      )}
      <Select
        label="Régimen para las filas que no lo traen"
        value={draft.tenureDefault}
        hint={templateDefaults ? `Solo para este lote. El formato trae: ${templateDefaults}.` : "Solo para este lote."}
        onChange={(event) => onChange({ ...draft, tenureDefault: event.target.value })}
        fieldClassName="max-w-sm"
      >
        <option value="">Ninguno</option>
        <option value="Propiedad">Propiedad</option>
        <option value="Comodato">Comodato</option>
        <option value="Préstamo Temporal">Préstamo temporal</option>
      </Select>
      <details className="rounded-md border border-borde px-3 py-2">
        <summary className="cursor-pointer text-base font-medium text-tinta">Opciones avanzadas</summary>
        <div className="grid gap-3 pt-3 sm:grid-cols-2">
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
            label="Fila de los títulos"
            type="number"
            min={1}
            value={draft.headerRow ?? batch.header_row ?? 1}
            hint="Si la cambia, el archivo se vuelve a leer al validar."
            onChange={(event) => onChange({ ...draft, headerRow: Number(event.target.value) || null })}
          />
        </div>
      </details>
      <ul className="flex flex-col gap-3" aria-label="Columnas del archivo">
        {draft.columns.map((column, index) => {
          const vocabulary = termsVocabulary(column);
          return (
            <ColumnMappingRow
              key={column.source_column}
              column={column}
              options={options}
              error={errors[column.source_column] ?? null}
              terms={vocabulary ? (terms[vocabulary] ?? []) : undefined}
              onTarget={(value) => onChange(setColumnTarget(draft, index, value))}
              onTransforms={(chain) => onChange(setColumnTransforms(draft, index, chain))}
              onValueMap={(map) => onChange(setColumnValueMap(draft, index, map))}
            />
          );
        })}
      </ul>
      <ErrorNotice message={errors[""] ?? null} />
      {status !== "unchanged" && (
        <details className="rounded-md border border-borde px-3 py-2" open={nameError !== null}>
          <summary className="cursor-pointer text-base font-medium text-tinta">Guardar este ajuste como formato</summary>
          <div className="pt-3">
            <SaveTemplateForm
              key={draft.base?.id ?? "new"}
              status={status}
              baseName={draft.base?.name ?? null}
              defaultSourceName={draft.base?.source_name ?? batch.source_name}
              nameError={nameError}
              busy={saving || busy}
              onSave={onSave}
            />
          </div>
        </details>
      )}
      <div className="flex flex-col gap-2 border-t border-borde pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={busy || saving} onClick={onApply}>
            {busy ? "Guardando…" : "Validar con estas columnas"}
            <ArrowRight size={18} aria-hidden="true" />
          </Button>
          <Button variant="outline" icon={Eye} disabled={blocker !== null || previewBusy || busy} onClick={onPreview}>
            {previewBusy ? "Calculando…" : "Ver cómo quedará"}
          </Button>
          <Button variant="secondary" icon={ArrowLeft} disabled={busy || saving} onClick={onBack}>
            Volver
          </Button>
          <Link href={ADMIN_TEMPLATES_HREF} target="_blank" rel="noopener" className={buttonClassName({ variant: "secondary" })}>
            <Settings size={18} aria-hidden="true" />
            Administrar formatos
          </Link>
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
  terms,
  onValueMap,
}: {
  column: ColumnMapping;
  options: TargetOption[];
  error: string | null;
  onTarget: (value: string) => void;
  onTransforms: (chain: string[]) => void;
  /** Términos activos del vocabulario de destino; solo en columnas `terms:<VOCABULARIO>`. */
  terms?: TermOption[];
  onValueMap?: (map: ValueMap) => void;
}) {
  const value = targetValue(column);
  const known = options.some((option) => option.value === value);
  const vocabulary = termsVocabulary(column);
  const map = column.value_map ?? {};
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
      <details className="min-w-0 flex-1 rounded-md bg-crema-light px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-gris-texto">
          Limpieza del valor
          {(column.transforms ?? []).length > 0 && ` · ${(column.transforms ?? []).length} ${(column.transforms ?? []).length === 1 ? "paso" : "pasos"}`}
        </summary>
        <div className="flex flex-col gap-3 pt-3">
          <TransformChain source={column.source_column} chain={column.transforms ?? []} locked={Object.keys(map).length > 0 ? ["value_map"] : []} onChange={onTransforms} />
          {vocabulary && onValueMap && (
            <ValueMapEditor source={column.source_column} vocabulary={vocabulary} map={map} terms={terms ?? []} onChange={onValueMap} />
          )}
        </div>
      </details>
    </li>
  );
}

export function ValueMapEditor({
  source,
  vocabulary,
  map,
  terms,
  onChange,
}: {
  source: string;
  vocabulary: string;
  map: ValueMap;
  terms: TermOption[];
  onChange: (map: ValueMap) => void;
}) {
  const [text, setText] = useState("");
  const [code, setCode] = useState("");
  const entries = Object.entries(map);
  const addError = text || code ? valueMapError(map, text, code) : null;
  const termSelect = (value: string, label: string, onSelect: (code: string) => void) => (
    <Select label={<span className="sr-only">{label}</span>} value={value} onChange={(event) => onSelect(event.target.value)} fieldClassName="min-w-48">
      <option value="">Elija un término…</option>
      {value && !terms.some((term) => term.code === value) && <option value={value}>{termLabel(terms, value)}</option>}
      {terms.map((term) => (
        <option key={term.code} value={term.code}>
          {term.label}
        </option>
      ))}
    </Select>
  );
  return (
    <section className="flex flex-col gap-2" aria-label={`Correspondencias de ${source}`}>
      <p className="text-sm font-medium text-gris-texto">Correspondencias con el vocabulario {vocabulary}</p>
      <p className="text-sm text-gris-texto">
        Asocie textos del archivo a un término activo. Un valor sin correspondencia ni término igual se conserva en los datos de origen; nunca se crean
        términos.
      </p>
      {terms.length === 0 && <p className="text-sm text-ambar-texto">No hay términos activos en el vocabulario {vocabulary} para asociar.</p>}
      {entries.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead className="text-gris-texto">
            <tr>
              <th className="py-1 pr-3 font-medium">Texto de origen</th>
              <th className="py-1 pr-3 font-medium">Término</th>
              <th className="py-1 font-medium">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([original, term]) => (
              <tr key={original} className="border-t border-borde align-top">
                <td className="py-1 pr-3 text-tinta">{original}</td>
                <td className="py-1 pr-3">
                  {termSelect(term, `Término para «${original}»`, (next) => next && onChange(putMapping(map, original, next)))}
                </td>
                <td className="py-1">
                  <Button variant="secondary" icon={X} aria-label={`Quitar la correspondencia de «${original}»`} onClick={() => onChange(dropMapping(map, original))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <Input label="Texto de origen" value={text} error={addError ?? undefined} onChange={(event) => setText(event.target.value)} fieldClassName="min-w-48" />
        {termSelect(code, `Término para el texto nuevo de ${source}`, setCode)}
        <Button
          variant="outline"
          icon={Plus}
          disabled={valueMapError(map, text, code) !== null}
          onClick={() => {
            onChange(putMapping(map, text, code));
            setText("");
            setCode("");
          }}
        >
          Añadir correspondencia
        </Button>
      </div>
    </section>
  );
}

export function TransformChain({
  source,
  chain,
  onChange,
  locked = [],
}: {
  source: string;
  chain: readonly string[];
  onChange: (chain: string[]) => void;
  /** Pasos que no se quitan a mano (`value_map` mientras la columna tenga correspondencias). */
  locked?: readonly string[];
}) {
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
                  <Button
                    variant="secondary"
                    icon={X}
                    aria-label={`Quitar «${label}»`}
                    disabled={locked.includes(spec)}
                    title={locked.includes(spec) ? "Se quita al dejar vacía la tabla de correspondencias." : undefined}
                    onClick={() => onChange(removeTransform(chain, index))}
                  />
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
    <section className="flex flex-col gap-3 rounded-md border border-borde bg-crema-light p-3" aria-label="Guardar como formato">
      <h3 className="text-base font-semibold text-tinta">Guardar como formato</h3>
      <p className="text-sm text-gris-texto">
        {status === "modified"
          ? "Guarde los cambios para reutilizarlos con otros archivos y para ver cómo quedará."
          : "Guárdelo para reutilizarlo con otros archivos de esta fuente y para ver cómo quedará."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label={status === "modified" ? "Nombre del formato nuevo" : "Nombre del formato"}
          value={values.name}
          error={nameError ?? undefined}
          onChange={(event) => setValues({ ...values, name: event.target.value })}
        />
        <Input label="Fuente" value={values.sourceName} hint="Por ejemplo, la consultoría o el libro de origen." onChange={(event) => setValues({ ...values, sourceName: event.target.value })} />
      </div>
      <Textarea label="Descripción (opcional)" value={values.description} rows={2} onChange={(event) => setValues({ ...values, description: event.target.value })} />
      <div className="flex flex-wrap items-center gap-3">
        <Button icon={Save} disabled={busy || newError !== null} onClick={() => onSave("new", values)}>
          {status === "modified" ? "Guardar como nuevo" : "Guardar como formato"}
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
          «Guardar cambios» modifica el formato para los próximos archivos; los ya procesados no cambian.
        </p>
      )}
    </section>
  );
}
