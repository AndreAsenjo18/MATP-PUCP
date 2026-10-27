/**
 * Reglas del editor de mapeo del asistente de importación (change `plantillas-mapeo-y-normalizacion`,
 * tarea 4.1B; spec importacion-datos: RF-022, RF-023, RNF-010; design D1, D2, D4).
 *
 * Funciones puras (ADR-012: la lógica de interacción se prueba sin navegador): el borrador del
 * mapeo, si cambió respecto de su plantilla, la cadena de transformaciones, los cuerpos para
 * guardar la plantilla (`POST`/`PATCH /import-templates`), los errores por columna y por qué no se
 * puede ver la vista previa o validar todavía. Una operación de red: los vocabularios del destino
 * `terms:<VOCABULARIO>`.
 */
import { createApiClient, type ApiSchemas } from "@/lib/api/client";

import { batchMappingRequest, missingColumns, type BatchMappingSource, type MappingTemplate } from "./import-templates";
import { TARGET_OPTIONS, call, suggestMapping, type ColumnMapping, type ImportBatch, type ImportFailure, type ImportResult, type TargetOption } from "./imports";
import { apiBaseUrl } from "./mode";

export type Vocabulary = ApiSchemas["VocabularyOut"];
export type MappingTemplateCreate = ApiSchemas["MappingTemplateCreate"];
export type MappingTemplateUpdate = ApiSchemas["MappingTemplateUpdate"];

// ---------------------------------------------------------------------------------------------
// Borrador
// ---------------------------------------------------------------------------------------------

/** El mapeo que la persona edita: una columna por cabecera del archivo, en su orden. */
export interface EditorDraft {
  /** Plantilla de la que parte; `null` = mapeo nuevo («Empezar desde cero»). */
  base: MappingTemplate | null;
  columns: ColumnMapping[];
  /**
   * Régimen para las filas sin dato de este lote (etiqueta del contrato, `Propiedad`…; `""` = ninguno).
   * Es un valor del lote, no un cambio de la plantilla: no cambia el estado del borrador y se envía
   * como `defaults` junto con `template_id`, sobre los de la plantilla (fase 2 de design D1).
   */
  tenureDefault: string;
  /** Valores por defecto propios de la plantilla, tal como están guardados; se conservan al guardar. */
  templateDefaults: Record<string, string>;
  /** Hoja y fila de cabeceras elegidas; `null` = las del lote. */
  sheetName: string | null;
  headerRow: number | null;
}

export type DraftStatus = "unchanged" | "modified" | "new";

/**
 * Forma única de una columna, para comparar y enviar: un código de un tipo fijo se escribe
 * `identifier:<TIPO>` (como lo elige el `Select`); la API lo devuelve como `identifier` con
 * `identifier_type_code`, que es lo mismo.
 */
export function canonicalColumn(column: ColumnMapping): ColumnMapping {
  const transforms = [...(column.transforms ?? [])];
  const valueMap = column.value_map && Object.keys(column.value_map).length > 0 ? { ...column.value_map } : null;
  const base = { source_column: column.source_column, transforms, value_map: valueMap };
  const target = column.target_field ?? null;
  if (target === "identifier" && !column.split_compound && column.identifier_type_code) {
    return { ...base, target_field: `identifier:${column.identifier_type_code}`, identifier_type_code: null, split_compound: false };
  }
  if (target === "identifier") return { ...base, target_field: target, identifier_type_code: column.identifier_type_code ?? null, split_compound: true };
  return { ...base, target_field: target, identifier_type_code: null, split_compound: false };
}

function payloadColumn(source: string): ColumnMapping {
  return { source_column: source, target_field: null, identifier_type_code: null, split_compound: false, transforms: [], value_map: null };
}

/** La plantilla sobre las cabeceras del lote: las columnas que el archivo no trae se quitan. */
export function draftFromTemplate(template: MappingTemplate, batch: Pick<ImportBatch, "headers">): EditorDraft {
  const bySource = new Map(template.columns.map((column) => [column.source_column, column]));
  const templateDefaults = { ...(template.defaults ?? {}) };
  return {
    base: template,
    columns: (batch.headers ?? []).map((header) => canonicalColumn(bySource.get(header) ?? payloadColumn(header))),
    tenureDefault: templateDefaults.tenure_regime ?? "",
    templateDefaults,
    sheetName: null,
    headerRow: null,
  };
}

/** «Empezar desde cero»: el mapeo sugerido por las cabeceras (`suggestMapping`). */
export function draftFromScratch(batch: Pick<ImportBatch, "headers">): EditorDraft {
  return {
    base: null,
    columns: suggestMapping(batch.headers ?? []).map((column) => canonicalColumn({ ...column, transforms: [], value_map: null })),
    tenureDefault: "",
    templateDefaults: {},
    sheetName: null,
    headerRow: null,
  };
}

/** Columnas que importan para comparar: una columna de origen sin transformaciones es como no listarla. */
function mappingKey(columns: readonly ColumnMapping[]): string {
  const relevant = columns
    .map(canonicalColumn)
    .filter((column) => column.target_field || column.transforms?.length || column.value_map)
    .sort((a, b) => a.source_column.localeCompare(b.source_column));
  return JSON.stringify(relevant);
}

/** Solo cuentan las columnas: el régimen del lote (`tenureDefault`) no modifica la plantilla. */
export function draftStatus(draft: EditorDraft): DraftStatus {
  if (!draft.base) return "new";
  return mappingKey(draft.columns) !== mappingKey(draft.base.columns) ? "modified" : "unchanged";
}

/** «régimen Propiedad, colección LRM», para explicar qué trae la plantilla junto al régimen del lote. */
export function templateDefaultsText(defaults: Record<string, string>): string | null {
  const names: Record<string, string> = { tenure_regime: "régimen", collection: "colección", denomination: "denominación" };
  const parts = Object.entries(defaults).map(([key, value]) => `${names[key] ?? key} ${value}`);
  return parts.length > 0 ? parts.join(", ") : null;
}

/** Se eligió otra hoja u otra fila de cabeceras: el lote debe volver a leerse al guardar el mapeo. */
export function sourceChanged(draft: Pick<EditorDraft, "sheetName" | "headerRow">, batch: Pick<ImportBatch, "sheet_name" | "header_row">): boolean {
  return (draft.sheetName !== null && draft.sheetName !== batch.sheet_name) || (draft.headerRow !== null && draft.headerRow !== batch.header_row);
}

/** Columnas de la plantilla que el borrador quitó porque el archivo no las trae. */
export function droppedColumns(draft: EditorDraft, batch: Pick<ImportBatch, "headers">): string[] {
  return draft.base ? missingColumns(draft.base, batch.headers ?? []) : [];
}

// ---------------------------------------------------------------------------------------------
// Destino de una columna
// ---------------------------------------------------------------------------------------------

/** Destinos del `Select`: los campos e identificadores, y un destino de términos por vocabulario. */
export function targetOptions(vocabularies: readonly Pick<Vocabulary, "code" | "name">[]): TargetOption[] {
  return [...TARGET_OPTIONS, ...vocabularies.map((vocabulary) => ({ value: `terms:${vocabulary.code}`, label: `Términos: ${vocabulary.name}` }))];
}

/** Valor del `Select` para una columna. */
export function targetValue(column: ColumnMapping): string {
  return canonicalColumn(column).target_field ?? "";
}

/** Un destino que no es de términos no lleva correspondencias: se quitan con su transformación. */
export function setColumnTarget(draft: EditorDraft, index: number, value: string): EditorDraft {
  return updateColumn(draft, index, (column) => {
    const retargeted = canonicalColumn({ ...column, target_field: value || null, identifier_type_code: null, split_compound: value === "identifier" });
    return value.startsWith("terms:") ? retargeted : withValueMap(retargeted, {});
  });
}

export function setColumnTransforms(draft: EditorDraft, index: number, transforms: readonly string[]): EditorDraft {
  return updateColumn(draft, index, (column) => ({ ...column, transforms: [...transforms] }));
}

function updateColumn(draft: EditorDraft, index: number, change: (column: ColumnMapping) => ColumnMapping): EditorDraft {
  return { ...draft, columns: draft.columns.map((column, i) => (i === index ? change(column) : column)) };
}

// ---------------------------------------------------------------------------------------------
// Cadena de transformaciones (design D2)
// ---------------------------------------------------------------------------------------------

export interface TransformInfo {
  code: string;
  label: string;
  help: string;
  /** Argumento obligatorio (`split:`, `date:`, `default:`). */
  argument?: { label: string; options?: readonly string[] };
  /** Se añade desde el editor; `value_map` llega con su tabla de correspondencias (4.1C). */
  addable: boolean;
}

/** Transformaciones v1 en el orden en que se ofrecen. Formatos de fecha [SUPUESTO T5]. */
export const TRANSFORMS: readonly TransformInfo[] = [
  { code: "trim", label: "Quitar espacios", help: "Quita los espacios al inicio y al final.", addable: true },
  { code: "upper", label: "Pasar a mayúsculas", help: "Convierte el texto a mayúsculas.", addable: true },
  { code: "absence_markers", label: "Reconocer «sin código»", help: "S/N, s/c, -, N/A y similares se tratan como celda sin código.", addable: true },
  { code: "split_concatenated", label: "Separar varios códigos", help: "Separa una celda con varios códigos (I-0236 / MMZ 15); S/N y S/C no se separan.", addable: true },
  { code: "split", label: "Separar por un carácter", help: "Separa la celda en varios valores con el separador indicado.", argument: { label: "Separador" }, addable: true },
  { code: "date", label: "Leer como fecha", help: "Lee el texto con el formato indicado; una celda de fecha de Excel se toma tal cual.", argument: { label: "Formato", options: ["dd/mm/yyyy", "yyyy"] }, addable: true },
  { code: "propose_period", label: "Proponer época", help: "Propone tipo y años de época (s. XX, ca. 1950…) sin cambiar el texto original.", addable: true },
  { code: "propose_dimensions", label: "Proponer medidas", help: "Propone medidas estructuradas (alto 23 cm, 23 x 15 cm) sin cambiar el texto.", addable: true },
  { code: "value_map", label: "Correspondencias de valores", help: "Reemplaza los valores listados en la tabla de correspondencias de la columna.", addable: false },
  { code: "default", label: "Valor si está vacía", help: "Pone este valor cuando la celda está vacía.", argument: { label: "Valor" }, addable: true },
];

export interface ParsedTransform {
  code: string;
  arg: string | null;
}

/** `split:,` → `{ code: "split", arg: "," }`; el argumento es lo que sigue al primer `:` (puede ser `:`). */
export function parseTransform(spec: string): ParsedTransform {
  const colon = spec.indexOf(":");
  return colon < 0 ? { code: spec, arg: null } : { code: spec.slice(0, colon), arg: spec.slice(colon + 1) };
}

export function transformInfo(code: string): TransformInfo | undefined {
  return TRANSFORMS.find((transform) => transform.code === code);
}

/** Nombre en español de un paso de la cadena: «Separar por un carácter («,»)». */
export function transformLabel(spec: string): string {
  const { code, arg } = parseTransform(spec);
  const info = transformInfo(code);
  if (!info) return spec;
  return info.argument && arg !== null ? `${info.label} («${arg}»)` : info.label;
}

/** Error del argumento, o `null` si se puede añadir. Los espacios cuentan: « » es un separador válido. */
export function transformArgError(code: string, arg: string): string | null {
  const info = transformInfo(code);
  if (!info) return "Elija una transformación.";
  if (!info.argument) return null;
  if (arg === "") return `Indique ${info.argument.label.toLowerCase()}.`;
  if (info.argument.options && !info.argument.options.includes(arg)) return `Elija un formato: ${info.argument.options.join(" o ")}.`;
  return null;
}

/** `split` + `,` → `split:,`; sin argumento, el código solo. */
export function transformSpec(code: string, arg: string): string {
  return transformInfo(code)?.argument ? `${code}:${arg}` : code;
}

export function addTransform(chain: readonly string[], code: string, arg = ""): string[] {
  if (transformArgError(code, arg)) return [...chain];
  return [...chain, transformSpec(code, arg)];
}

export function removeTransform(chain: readonly string[], index: number): string[] {
  return chain.filter((_, i) => i !== index);
}

/** Sube (`-1`) o baja (`+1`) un paso; en los extremos no cambia nada. */
export function moveTransform(chain: readonly string[], index: number, direction: -1 | 1): string[] {
  const target = index + direction;
  if (index < 0 || index >= chain.length || target < 0 || target >= chain.length) return [...chain];
  const next = [...chain];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// ---------------------------------------------------------------------------------------------
// Correspondencias de valores con términos (4.1C; Req: Correspondencia de valores con vocabularios)
// ---------------------------------------------------------------------------------------------

/** Un término activo que se puede elegir como destino de una correspondencia. */
export interface TermOption {
  code: string;
  label: string;
}

export type ValueMap = Record<string, string>;

const VALUE_MAP = "value_map";

/** Vocabulario de una columna con destino `terms:<VOCABULARIO>`, o `null`. */
export function termsVocabulary(column: Pick<ColumnMapping, "target_field">): string | null {
  const target = column.target_field ?? "";
  return target.startsWith("terms:") ? target.slice("terms:".length) || null : null;
}

/**
 * Como compara la API las claves de `value_map`: sin distinguir mayúsculas, tildes ni espacios
 * repetidos [SUPUESTO] (`transforms.py`). «Madera  Policromada» y «madera policromada» son la misma.
 */
export function foldText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

function findKey(map: ValueMap, text: string): string | undefined {
  const key = foldText(text);
  return Object.keys(map).find((existing) => foldText(existing) === key);
}

/** La cadena con `value_map` si hay correspondencias (al final, si faltaba) y sin él si no hay. */
export function syncValueMapTransform(transforms: readonly string[], hasMap: boolean): string[] {
  const present = transforms.includes(VALUE_MAP);
  if (hasMap && !present) return [...transforms, VALUE_MAP];
  if (!hasMap && present) return transforms.filter((spec) => spec !== VALUE_MAP);
  return [...transforms];
}

/** La columna con estas correspondencias (`null` si quedan vacías) y la cadena al día. */
export function withValueMap(column: ColumnMapping, map: ValueMap): ColumnMapping {
  const hasMap = Object.keys(map).length > 0;
  return { ...column, value_map: hasMap ? { ...map } : null, transforms: syncValueMapTransform(column.transforms ?? [], hasMap) };
}

export function setColumnValueMap(draft: EditorDraft, index: number, map: ValueMap): EditorDraft {
  return updateColumn(draft, index, (column) => withValueMap(column, map));
}

/** Por qué no se puede añadir la correspondencia, o `null`. */
export function valueMapError(map: ValueMap, text: string, code: string): string | null {
  if (!text.trim()) return "Escriba el texto de origen.";
  const existing = findKey(map, text);
  if (existing !== undefined) return `Ya hay una correspondencia para «${existing}».`;
  if (!code) return "Elija el término.";
  return null;
}

/** Añade `text → code`; si ya había una para el mismo texto (sin tildes ni mayúsculas), la reemplaza. */
export function putMapping(map: ValueMap, text: string, code: string): ValueMap {
  const next = { ...map };
  const existing = findKey(next, text);
  if (existing !== undefined) delete next[existing];
  next[text.trim()] = code;
  return next;
}

export function dropMapping(map: ValueMap, text: string): ValueMap {
  const next = { ...map };
  delete next[text];
  return next;
}

/** «Asociar a término» desde la vista previa: la correspondencia va a la columna de ese origen. */
export function associateTerm(draft: EditorDraft, source: string, text: string, code: string): EditorDraft {
  const index = draft.columns.findIndex((column) => column.source_column === source);
  if (index < 0 || !code) return draft;
  return setColumnValueMap(draft, index, putMapping(draft.columns[index].value_map ?? {}, text, code));
}

/** El término al que el borrador ya asocia ese texto en esa columna, o `null`. */
export function pendingTerm(draft: Pick<EditorDraft, "columns">, source: string, text: string): string | null {
  const map = draft.columns.find((column) => column.source_column === source)?.value_map ?? {};
  const key = findKey(map, text);
  return key === undefined ? null : map[key];
}

/** Nombre de un término para mostrar; un código que no está entre los activos se señala. */
export function termLabel(terms: readonly TermOption[], code: string): string {
  return terms.find((term) => term.code === code)?.label ?? `${code} (no es un término activo)`;
}

// ---------------------------------------------------------------------------------------------
// Guardar como plantilla, vista previa y validar
// ---------------------------------------------------------------------------------------------

export interface TemplateFormValues {
  name: string;
  sourceName: string;
  description: string;
}

export type SaveKind = "new" | "update";

/** Error del nombre, o `null`. Guardar como nueva exige nombre; guardar cambios lo puede conservar. */
export function saveFormError(form: TemplateFormValues, kind: SaveKind): string | null {
  if (kind === "new" && !form.name.trim()) return "Indique un nombre para la plantilla.";
  if (kind === "new" && !form.sourceName.trim()) return "Indique la fuente del archivo.";
  return null;
}

/** Los de la plantilla con el régimen del lote encima, si se eligió uno. */
function batchDefaults(draft: EditorDraft): Record<string, string> {
  return { ...draft.templateDefaults, ...(draft.tenureDefault ? { tenure_regime: draft.tenureDefault } : {}) };
}

/**
 * Cuerpo de `POST /import-templates`: todas las cabeceras del lote como columnas (las de origen
 * también). La plantilla nueva conserva los valores por defecto de la que partió y toma como suyo
 * el régimen elegido para el lote.
 */
export function templateCreateBody(draft: EditorDraft, form: TemplateFormValues, headers: readonly string[]): MappingTemplateCreate {
  return {
    name: form.name.trim(),
    source_name: form.sourceName.trim(),
    headers: [...headers],
    columns: draft.columns.map(canonicalColumn),
    defaults: batchDefaults(draft),
    description: form.description.trim() || null,
  };
}

/**
 * Cuerpo de `PATCH /import-templates/{id}`: cabeceras, columnas y valores por defecto van juntos
 * (design D3). Los valores por defecto son los que la plantilla ya tiene: el régimen del lote no
 * la cambia.
 */
export function templateUpdateBody(draft: EditorDraft, form: TemplateFormValues, headers: readonly string[]): MappingTemplateUpdate {
  const body: MappingTemplateUpdate = { headers: [...headers], columns: draft.columns.map(canonicalColumn), defaults: { ...draft.templateDefaults } };
  if (form.name.trim() && form.name.trim() !== draft.base?.name) body.name = form.name.trim();
  if (form.description.trim()) body.description = form.description.trim();
  return body;
}

/** Errores de un guardado rechazado: el nombre repetido va al campo y los del mapeo, a su columna (`""` = general). */
export function saveErrors(failure: ImportFailure): { name: string | null; columns: Record<string, string> } {
  if (failure.status === "rejected" && failure.code === "template_name_taken") return { name: failure.message, columns: {} };
  return { name: null, columns: columnErrors(failure) };
}

/** Errores de `invalid_mapping` por columna; los que no son de una columna, bajo `""`. */
export function columnErrors(failure: ImportFailure): Record<string, string> {
  if (failure.status !== "rejected") return { "": failure.message };
  const list = Array.isArray(failure.details?.errors) ? failure.details.errors : [];
  const errors: Record<string, string> = {};
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const { column, message } = item as { column?: string | null; message?: string };
    const key = column ?? "";
    errors[key] = errors[key] ? `${errors[key]} ${message ?? ""}` : (message ?? "");
  }
  return Object.keys(errors).length > 0 ? errors : { "": failure.message };
}

/** Por qué no se puede ver la vista previa todavía, o `null` (design D4: plantilla guardada y sin cambios). */
export function previewBlocker(draft: EditorDraft, batch: Pick<ImportBatch, "sheet_name" | "header_row">): string | null {
  if (sourceChanged(draft, batch)) return "Cambió la hoja o la fila de cabeceras: valide el mapeo para volver a leer el archivo.";
  if (draftStatus(draft) !== "unchanged") return "Guarde la plantilla para ver la vista previa: se calcula con la plantilla guardada.";
  return null;
}

/**
 * Qué se envía al validar: la plantilla si no cambió, con el régimen del lote como `defaults` (la
 * API los aplica sobre los de la plantilla); si no, las columnas del borrador (v1) con los valores
 * por defecto de la plantilla y el régimen del lote encima.
 */
export function applySource(draft: EditorDraft, batch: Pick<ImportBatch, "sheet_name" | "header_row" | "headers">): BatchMappingSource {
  // Una plantilla a la que el archivo no le trae columnas no se puede aplicar tal cual: se envían las columnas que quedaron.
  if (draft.base && draftStatus(draft) === "unchanged" && !sourceChanged(draft, batch) && droppedColumns(draft, batch).length === 0) {
    return { kind: "template", templateId: draft.base.id, tenureDefault: draft.tenureDefault };
  }
  return { kind: "columns", columns: draft.columns.map(canonicalColumn), sheetName: draft.sheetName, headerRow: draft.headerRow, tenureDefault: draft.tenureDefault, defaults: draft.templateDefaults };
}

/** Aviso junto a «Usar este mapeo y validar» cuando el mapeo no queda guardado como plantilla. */
export function applyNotice(draft: EditorDraft, batch: Pick<ImportBatch, "sheet_name" | "header_row" | "headers">): string | null {
  return applySource(draft, batch).kind === "columns" ? "Este mapeo se usará solo en este lote: no queda guardado como plantilla." : null;
}

/** Cuerpo de `PUT /imports/{batch_id}/mapping` al validar desde el editor. */
export function applyRequest(draft: EditorDraft, batch: Pick<ImportBatch, "sheet_name" | "header_row" | "headers">) {
  return batchMappingRequest(applySource(draft, batch));
}

// ---------------------------------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------------------------------

/** `GET /vocabularies`: los destinos `terms:<VOCABULARIO>` posibles. */
export async function fetchVocabularies(devUser?: string): Promise<ImportResult<Vocabulary[]>> {
  return call(() => createApiClient({ baseUrl: apiBaseUrl(), devUser }).GET("/api/v1/vocabularies"));
}

/** `GET /vocabularies/{code}/terms`: los términos activos, destino de las correspondencias. */
export async function fetchVocabularyTerms(vocabularyCode: string, devUser?: string): Promise<ImportResult<TermOption[]>> {
  const result = await call(() =>
    createApiClient({ baseUrl: apiBaseUrl(), devUser }).GET("/api/v1/vocabularies/{vocabulary_code}/terms", { params: { path: { vocabulary_code: vocabularyCode } } }),
  );
  if (result.status !== "ok") return result;
  return { status: "ok", value: result.value.filter((term) => term.is_active).map((term) => ({ code: term.code, label: term.label })) };
}
