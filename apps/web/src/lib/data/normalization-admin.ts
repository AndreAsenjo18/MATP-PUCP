/**
 * Administración de los parámetros de normalización y las siglas históricas, modo `live` (change
 * `plantillas-mapeo-y-normalizacion`, tarea 4.2; spec identificacion-piezas: RN-010, RF-023;
 * design D5).
 *
 * `GET`/`PUT /normalization-settings/{key}` (marcadores de ausencia y separadores) y
 * `GET`/`POST`/`DELETE /collection-acronym-aliases`, con el permiso `vocabularies.manage`
 * [SUPUESTO T8]. Un cambio que alteraría identificadores ya registrados responde 409
 * `normalization_change_requires_preview` y no guarda nada [SUPUESTO T10]: `impactFrom` lo lee
 * para la pantalla. Las reglas de edición (añadir y quitar marcadores y separadores, comparar
 * como el servidor) son funciones puras (ADR-012). En modo `mock` las operaciones responden
 * `unavailable`.
 */
import { createApiClient, type ApiSchemas } from "@/lib/api/client";

import { IMPORT_ERROR_MESSAGES, call, type ImportFailure, type ImportResult } from "./imports";
import { apiBaseUrl } from "./mode";

export type NormalizationSetting = ApiSchemas["NormalizationSettingOut"];
export type ConcatenationSeparators = ApiSchemas["ConcatenationSeparators"];
export type AcronymAlias = ApiSchemas["AcronymAliasOut"];
export type SettingKey = NormalizationSetting["key"];
/** Forma de adquisición → régimen (etiqueta del contrato), `tenure_aliases` (ajustes-lectura-importacion). */
export type TenureAliases = Record<string, string>;
export const TENURE_LABELS = ["Propiedad", "Comodato", "Préstamo Temporal"] as const;

export interface CollectionOption {
  id: string;
  name: string;
  acronym: string | null;
}

export const IMPACT_CODE = "normalization_change_requires_preview";

/** Mensajes de la pantalla para los errores conocidos; el resto, los del asistente o los de la API. */
export const NORMALIZATION_ERROR_MESSAGES: Record<string, string> = {
  ...IMPORT_ERROR_MESSAGES,
  invalid_setting_value: "El valor no es válido para este parámetro: revise los marcadores o separadores.",
  normalization_setting_not_found: "Ese parámetro de normalización no existe.",
  acronym_alias_not_found: "La sigla histórica ya no existe o fue eliminada.",
  collection_not_found: "La colección elegida no existe.",
  alias_required: "Escriba la sigla histórica.",
};

function client(devUser: string | undefined) {
  return createApiClient({ baseUrl: apiBaseUrl(), devUser });
}

// ---------------------------------------------------------------------------------------------
// Reglas de la pantalla
// ---------------------------------------------------------------------------------------------

/** Como compara el servidor un marcador: N1 (NFKC, mayúsculas) y sin ningún espacio. */
export function markerKey(marker: string): string {
  return marker.normalize("NFKC").toUpperCase().replace(/\s+/g, "");
}

/** Por qué no se puede añadir el marcador, o `null`. */
export function markerError(markers: readonly string[], marker: string): string | null {
  const key = markerKey(marker);
  const existing = markers.find((item) => markerKey(item) === key);
  if (existing !== undefined) return existing === "" ? "La celda vacía ya es un marcador." : `«${existing}» ya es un marcador.`;
  if (!marker.trim()) return "Escriba el marcador.";
  return null;
}

export function addMarker(markers: readonly string[], marker: string): string[] {
  return markerError(markers, marker) ? [...markers] : [...markers, marker.trim()];
}

export function removeItem(items: readonly string[], item: string): string[] {
  return items.filter((current) => current !== item);
}

const SEPARATOR_NAMES: Record<string, string> = {
  "/": "barra",
  ";": "punto y coma",
  "|": "barra vertical",
  ",": "coma",
  "\n": "salto de línea",
  "\r": "retorno de carro",
  "\t": "tabulación",
  "+": "más",
  "-": "guion",
  ".": "punto",
  ":": "dos puntos",
};

/** «coma ,», «salto de línea». */
export function separatorLabel(separator: string): string {
  const name = SEPARATOR_NAMES[separator];
  if (!name) return `«${separator}»`;
  return separator.trim() ? `${name} ${separator}` : name;
}

/** Separadores que se eligen por nombre porque no se pueden escribir en un campo. */
export const SPECIAL_SEPARATORS = ["\n", "\r", "\t"] as const;

/** Por qué no se puede añadir el separador, o `null`. El espacio partiría códigos como `I 236` [SUPUESTO T10]. */
export function separatorError(separators: readonly string[], separator: string): string | null {
  if (separator === "") return "Escriba el separador.";
  if (!(SPECIAL_SEPARATORS as readonly string[]).includes(separator) && !separator.trim()) {
    return "Un separador no puede ser un espacio: partiría códigos como «I 236».";
  }
  if (separators.includes(separator)) return `${separatorLabel(separator)} ya es un separador.`;
  return null;
}

export function addSeparator(separators: readonly string[], separator: string): string[] {
  return separatorError(separators, separator) ? [...separators] : [...separators, separator];
}

/** El borrador cambió respecto de lo guardado (el orden no importa). */
export function hasChanges(saved: readonly string[], draft: readonly string[]): boolean {
  const a = [...saved].sort();
  const b = [...draft].sort();
  return a.length !== b.length || a.some((item, i) => item !== b[i]);
}

export function separatorsValue(value: NormalizationSetting["value"]): ConcatenationSeparators {
  if (Array.isArray(value)) return { separators: value, unsplit_markers: [] };
  return "separators" in value && Array.isArray(value.separators) ? (value as ConcatenationSeparators) : { separators: [], unsplit_markers: [] };
}

export function tenureAliasesValue(value: NormalizationSetting["value"]): TenureAliases {
  if (Array.isArray(value) || "separators" in value) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

/** Como el servidor compara una forma de adquisición: minúsculas, sin tildes ni espacios de más. */
export function aliasKey(text: string): string {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().split(/\s+/).join(" ");
}

export function tenureAliasError(aliases: TenureAliases, alias: string): string | null {
  const key = aliasKey(alias);
  if (!key) return "Escriba la forma de adquisición.";
  if (Object.keys(aliases).some((existing) => aliasKey(existing) === key)) return "Esa forma de adquisición ya tiene un régimen.";
  return null;
}

export function tenureAliasesChanged(saved: TenureAliases, draft: TenureAliases): boolean {
  const entries = (aliases: TenureAliases) => JSON.stringify(Object.entries(aliases).sort(([a], [b]) => a.localeCompare(b)));
  return entries(saved) !== entries(draft);
}

export function markersValue(value: NormalizationSetting["value"]): string[] {
  return Array.isArray(value) ? value : [];
}

export interface ImpactExample {
  typeCode: string;
  originalValue: string;
  normalizedValue: string | null;
  proposedValue: string | null;
  reason: string;
}

export interface NormalizationImpact {
  affected: number;
  examples: ImpactExample[];
  /** Afectados que no están entre los ejemplos. */
  remaining: number;
}

const IMPACT_REASONS: Record<string, string> = {
  normalization: "Cambia su forma normalizada",
  separation: "Cambia cómo se separa su celda",
};

export function impactReasonLabel(reason: string): string {
  return IMPACT_REASONS[reason] ?? reason;
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** El 409 `normalization_change_requires_preview` como lo muestra la pantalla, o `null` si es otro error. */
export function impactFrom(failure: ImportFailure): NormalizationImpact | null {
  if (failure.status !== "rejected" || failure.code !== IMPACT_CODE) return null;
  const affected = typeof failure.details?.affected === "number" ? failure.details.affected : 0;
  const raw = Array.isArray(failure.details?.examples) ? failure.details.examples : [];
  const examples = raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      typeCode: text(item.identifier_type_code) ?? "",
      originalValue: text(item.original_value) ?? "",
      normalizedValue: text(item.normalized_value),
      proposedValue: text(item.proposed_value),
      reason: text(item.reason) ?? "",
    }));
  return { affected, examples, remaining: Math.max(0, affected - examples.length) };
}

/** Error de un alias rechazado que va en el campo de la sigla, o `null`. */
export function aliasFieldError(failure: ImportFailure): string | null {
  if (failure.status !== "rejected") return null;
  return ["acronym_alias_taken", "alias_is_current_acronym", "alias_required"].includes(failure.code) ? failure.message : null;
}

// ---------------------------------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------------------------------

/** `GET /normalization-settings/{key}`: el valor vigente, o el del código (`is_default`). */
export async function fetchSetting(key: SettingKey, devUser?: string): Promise<ImportResult<NormalizationSetting>> {
  return call(() => client(devUser).GET("/api/v1/normalization-settings/{key}", { params: { path: { key } } }), NORMALIZATION_ERROR_MESSAGES);
}

/** `PUT /normalization-settings/{key}`: 409 `normalization_change_requires_preview` si alteraría códigos registrados. */
export async function saveSetting(
  key: SettingKey,
  value: string[] | ConcatenationSeparators | TenureAliases,
  devUser?: string,
): Promise<ImportResult<NormalizationSetting>> {
  return call(
    () => client(devUser).PUT("/api/v1/normalization-settings/{key}", { params: { path: { key } }, body: { value } }),
    NORMALIZATION_ERROR_MESSAGES,
  );
}

/** `GET /collection-acronym-aliases`: las siglas históricas activas. */
export async function fetchAliases(devUser?: string): Promise<ImportResult<AcronymAlias[]>> {
  return call(() => client(devUser).GET("/api/v1/collection-acronym-aliases"), NORMALIZATION_ERROR_MESSAGES);
}

/** `POST /collection-acronym-aliases`: única entre las activas y distinta de toda sigla actual. */
export async function createAlias(alias: string, collectionId: string, devUser?: string): Promise<ImportResult<AcronymAlias>> {
  return call(
    () => client(devUser).POST("/api/v1/collection-acronym-aliases", { body: { alias: alias.trim(), collection_id: collectionId } }),
    NORMALIZATION_ERROR_MESSAGES,
  );
}

/** `DELETE /collection-acronym-aliases/{id}?reason=`: borrado lógico con motivo (RN-005). */
export async function deleteAlias(aliasId: string, reason: string, devUser?: string): Promise<ImportResult<null>> {
  return call(async () => {
    const { error } = await client(devUser).DELETE("/api/v1/collection-acronym-aliases/{alias_id}", {
      params: { path: { alias_id: aliasId }, query: { reason: reason.trim() } },
    });
    return error !== undefined ? { error } : { data: null };
  }, NORMALIZATION_ERROR_MESSAGES);
}

/** `GET /collections`: las colecciones activas, para elegir a cuál apunta una sigla histórica. */
export async function fetchCollections(devUser?: string): Promise<ImportResult<CollectionOption[]>> {
  const result = await call(() => client(devUser).GET("/api/v1/collections", {}), NORMALIZATION_ERROR_MESSAGES);
  if (result.status !== "ok") return result;
  return {
    status: "ok",
    value: result.value
      .filter((collection) => collection.is_active)
      .map((collection) => ({ id: collection.id, name: collection.name, acronym: collection.acronym ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name, "es")),
  };
}
