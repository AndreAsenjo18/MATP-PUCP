/**
 * Administración de colecciones, vocabularios, tipos de identificador y conservación, modo `live`
 * (change `colecciones-y-vocabularios-admin`, tareas 5.1 a 5.3; RN-010, RF-010..012, RF-023).
 *
 * Las reglas de la pantalla (código estable sugerido desde la etiqueta, qué campos bloquea un tipo
 * del sistema, cómo se cuenta el impacto de un cambio de regla) son funciones puras (ADR-012). En
 * modo `mock` las operaciones responden `unavailable`, como el resto de las pantallas `live`.
 */
import { createApiClient, type ApiSchemas } from "@/lib/api/client";

import { IMPORT_ERROR_MESSAGES, call, type ImportResult } from "./imports";
import { apiBaseUrl } from "./mode";

export type VocabularySummary = ApiSchemas["VocabularyOut"];
export type VocabularyTerm = ApiSchemas["TermOut"];
export type IdentifierType = ApiSchemas["IdentifierTypeOut"];
export type NormalizationRule = ApiSchemas["NormalizationRule"];
export type NormalizationPreview = ApiSchemas["NormalizationPreviewOut"];
export type CollectionItem = ApiSchemas["CollectionOut"];
export type ConservationAssessment = ApiSchemas["ConservationAssessmentOut"];
export type TenureLabel = ApiSchemas["CollectionCreate"]["default_tenure_regime"];

/** Reglas de normalización implementadas, con su explicación para la pantalla. */
export const NORMALIZATION_RULES: { value: NormalizationRule; label: string }[] = [
  { value: "INVENTORY", label: "Código I (I-236)" },
  { value: "COLLECTION", label: "Sigla y correlativo (MMZ 15)" },
  { value: "INC_RN", label: "INC / Registro Nacional (4 o 6 dígitos)" },
  { value: "GENERIC", label: "Texto simple (mayúsculas, sin espacios repetidos)" },
];

export const ADMIN_ERROR_MESSAGES: Record<string, string> = {
  ...IMPORT_ERROR_MESSAGES,
  vocabulary_exists: "Ya existe un vocabulario con ese código.",
  identifier_type_exists: "Ya existe un tipo de identificador con ese código.",
  duplicate_term: "Ya existe un término con ese código o esa etiqueta en el vocabulario.",
  term_in_use: "El término está en uso: desactívelo en lugar de eliminarlo.",
  system_identifier_type: "Es un tipo de identificador del sistema: solo se pueden cambiar su etiqueta, descripción y orden (RN-002, RN-003).",
  normalization_change_requires_preview: "Los identificadores cambiaron después de la vista previa: vuelva a revisar el impacto antes de confirmar.",
  normalization_collision: "La nueva regla dejaría el mismo código vigente en piezas distintas: corrija esos códigos antes de cambiar la regla (RN-002).",
  admin_required: "Solo un Administrador puede confirmar este cambio (RN-002).",
  duplicate_acronym: "Ya existe una colección con esa sigla.",
  invalid_conservation_term: "Elija un estado de conservación activo de la escala.",
  request_validation_failed: "Revise los datos: hay campos obligatorios vacíos o con formato no válido.",
};

function client(devUser: string | undefined) {
  return createApiClient({ baseUrl: apiBaseUrl(), devUser });
}

// ---------------------------------------------------------------------------------------------
// Reglas de la pantalla
// ---------------------------------------------------------------------------------------------

/** Código estable a partir de una etiqueta: «Arte plumario» → «ARTE_PLUMARIO». */
export function suggestCode(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "C_$1");
}

/** Por qué el código no sirve (mismo patrón que la API: `^[A-Z][A-Z0-9_]*$`), o `null`. */
export function codeError(code: string, { min = 1, max = 60 }: { min?: number; max?: number } = {}): string | null {
  if (!code) return "Escriba el código.";
  if (!/^[A-Z][A-Z0-9_]*$/.test(code)) return "Use mayúsculas, números y guion bajo, empezando por una letra.";
  if (code.length < min) return `El código debe tener al menos ${min} caracteres.`;
  if (code.length > max) return `El código admite como máximo ${max} caracteres.`;
  return null;
}

/** Reglas estructurales que un tipo del sistema no deja cambiar (design D1). */
export function lockedRules(type: Pick<IdentifierType, "is_system" | "is_unique_when_current" | "locks_on_assignment" | "owned_pieces_only">): string[] {
  if (!type.is_system) return [];
  const rules: string[] = [];
  if (type.locks_on_assignment) rules.push("se bloquea al asignarse (RN-002)");
  if (type.is_unique_when_current) rules.push("es único entre los códigos vigentes");
  if (type.owned_pieces_only) rules.push("solo aplica a piezas en propiedad (RN-003)");
  return rules;
}

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString("es-PE")} ${count === 1 ? one : many}`;
}

/** Resumen en lenguaje claro de la vista previa de un cambio de regla (RNF-010). */
export function previewSentence(preview: Pick<NormalizationPreview, "total_identifiers" | "changed_count" | "unparseable_count" | "collisions">): string {
  if (preview.total_identifiers === 0) return "El tipo no tiene identificadores registrados: el cambio no recalcula nada.";
  const parts = [
    `De ${plural(preview.total_identifiers, "identificador registrado", "identificadores registrados")}, ${plural(preview.changed_count, "cambia", "cambian")} su valor normalizado`,
  ];
  if (preview.unparseable_count > 0) parts.push(`${plural(preview.unparseable_count, "deja", "dejan")} de reconocerse y quedarán para revisión`);
  if (preview.collisions.length > 0) parts.push(`${plural(preview.collisions.length, "código vigente quedaría repetido", "códigos vigentes quedarían repetidos")} en piezas distintas`);
  return `${parts.join("; ")}. Los valores originales no cambian.`;
}

// ---------------------------------------------------------------------------------------------
// Vocabularios y términos
// ---------------------------------------------------------------------------------------------

export async function fetchVocabularies(devUser?: string): Promise<ImportResult<VocabularySummary[]>> {
  return call(() => client(devUser).GET("/api/v1/vocabularies"), ADMIN_ERROR_MESSAGES);
}

/** `POST /vocabularies`: código estable único (409 `vocabulary_exists`). */
export async function createVocabulary(code: string, name: string, devUser?: string): Promise<ImportResult<VocabularySummary>> {
  return call(() => client(devUser).POST("/api/v1/vocabularies", { body: { code, name: name.trim() } }), ADMIN_ERROR_MESSAGES);
}

/** Términos de un vocabulario, también los desactivados (la administración los muestra). */
export async function fetchTerms(vocabularyCode: string, devUser?: string): Promise<ImportResult<VocabularyTerm[]>> {
  return call(
    () =>
      client(devUser).GET("/api/v1/vocabularies/{vocabulary_code}/terms", {
        params: { path: { vocabulary_code: vocabularyCode }, query: { include_inactive: true } },
      }),
    ADMIN_ERROR_MESSAGES,
  );
}

export async function createTerm(vocabularyCode: string, code: string, label: string, devUser?: string): Promise<ImportResult<VocabularyTerm>> {
  return call(
    () =>
      client(devUser).POST("/api/v1/vocabularies/{vocabulary_code}/terms", {
        params: { path: { vocabulary_code: vocabularyCode } },
        body: { code, label: label.trim(), sort_order: 0 },
      }),
    ADMIN_ERROR_MESSAGES,
  );
}

/** Activa o desactiva un término; desactivar nunca borra (RN-005). */
export async function setTermActive(vocabularyCode: string, termId: string, isActive: boolean, devUser?: string): Promise<ImportResult<VocabularyTerm>> {
  return call(
    () =>
      client(devUser).PATCH("/api/v1/vocabularies/{vocabulary_code}/terms/{term_id}", {
        params: { path: { vocabulary_code: vocabularyCode, term_id: termId } },
        body: { is_active: isActive },
      }),
    ADMIN_ERROR_MESSAGES,
  );
}

// ---------------------------------------------------------------------------------------------
// Tipos de identificador
// ---------------------------------------------------------------------------------------------

export async function fetchIdentifierTypes(devUser?: string): Promise<ImportResult<IdentifierType[]>> {
  return call(() => client(devUser).GET("/api/v1/identifier-types"), ADMIN_ERROR_MESSAGES);
}

export async function createIdentifierType(
  input: { code: string; label: string; rule: NormalizationRule },
  devUser?: string,
): Promise<ImportResult<IdentifierType>> {
  return call(
    () =>
      client(devUser).POST("/api/v1/identifier-types", {
        body: { code: input.code, label: input.label.trim(), normalization_rule: input.rule, sort_order: 0 },
      }),
    ADMIN_ERROR_MESSAGES,
  );
}

/** `PATCH /identifier-types/{code}`: etiqueta, o regla nueva con el `confirmToken` de la vista previa. */
export async function updateIdentifierType(
  code: string,
  changes: { label?: string; rule?: NormalizationRule; confirmToken?: string },
  devUser?: string,
): Promise<ImportResult<IdentifierType>> {
  return call(
    () =>
      client(devUser).PATCH("/api/v1/identifier-types/{type_code}", {
        params: { path: { type_code: code } },
        body: {
          ...(changes.label !== undefined ? { label: changes.label.trim() } : {}),
          ...(changes.rule !== undefined ? { normalization_rule: changes.rule } : {}),
          ...(changes.confirmToken !== undefined ? { confirm_token: changes.confirmToken } : {}),
        },
      }),
    ADMIN_ERROR_MESSAGES,
  );
}

/** Vista previa del cambio de regla: no escribe nada (RF-023, RNF-007). */
export async function previewRuleChange(code: string, rule: NormalizationRule, devUser?: string): Promise<ImportResult<NormalizationPreview>> {
  return call(
    () =>
      client(devUser).POST("/api/v1/identifier-types/{type_code}/normalization-preview", {
        params: { path: { type_code: code } },
        body: { normalization_rule: rule },
      }),
    ADMIN_ERROR_MESSAGES,
  );
}

// ---------------------------------------------------------------------------------------------
// Colecciones
// ---------------------------------------------------------------------------------------------

export async function fetchCollectionList(devUser?: string): Promise<ImportResult<CollectionItem[]>> {
  const result = await call(() => client(devUser).GET("/api/v1/collections", {}), ADMIN_ERROR_MESSAGES);
  if (result.status !== "ok") return result;
  return { status: "ok", value: [...result.value].sort((a, b) => a.name.localeCompare(b.name, "es")) };
}

export async function createCollection(
  input: { name: string; acronym: string; tenure: TenureLabel; parentId?: string | null },
  devUser?: string,
): Promise<ImportResult<CollectionItem>> {
  return call(
    () =>
      client(devUser).POST("/api/v1/collections", {
        body: {
          name: input.name.trim(),
          acronym: input.acronym.trim() || null,
          default_tenure_regime: input.tenure,
          parent_id: input.parentId || null,
        },
      }),
    ADMIN_ERROR_MESSAGES,
  );
}

// ---------------------------------------------------------------------------------------------
// Conservación (tarea 5.3)
// ---------------------------------------------------------------------------------------------

export async function fetchAssessments(pieceId: string, devUser?: string): Promise<ImportResult<ConservationAssessment[]>> {
  return call(
    () => client(devUser).GET("/api/v1/pieces/{piece_id}/conservation-assessments", { params: { path: { piece_id: pieceId } } }),
    ADMIN_ERROR_MESSAGES,
  );
}

/** Estados activos de la escala de conservación, para el formulario. */
export async function fetchConservationStates(devUser?: string): Promise<ImportResult<VocabularyTerm[]>> {
  return call(() => client(devUser).GET("/api/v1/conservation-states", {}), ADMIN_ERROR_MESSAGES);
}

/** `POST`: devuelve el historial completo; una fecha antigua no cambia el estado actual. */
export async function recordAssessment(
  pieceId: string,
  input: { statusTermId: string; assessedOn?: string | null; notes?: string | null },
  devUser?: string,
): Promise<ImportResult<ConservationAssessment[]>> {
  return call(
    () =>
      client(devUser).POST("/api/v1/pieces/{piece_id}/conservation-assessments", {
        params: { path: { piece_id: pieceId } },
        body: {
          status_term_id: input.statusTermId,
          assessed_at: input.assessedOn ? `${input.assessedOn}T12:00:00Z` : null,
          notes: input.notes?.trim() || null,
        },
      }),
    ADMIN_ERROR_MESSAGES,
  );
}
