/**
 * Datos de referencia sintéticos para la maqueta (change `maqueta-ui-navegable`).
 *
 * Roles, permisos, vocabularios y tipos de identificador se copian tal cual del seed real de
 * `apps/api/app/seed/reference.py` (change `modelo-datos-nucleo`) para que la maqueta y la API
 * describan exactamente la misma matriz de permisos (RF-039) y los mismos vocabularios (RN-010).
 * Todo es [SUPUESTO] hasta que la contraparte lo valide (docs/preguntas-contraparte.md B4-B7).
 */
import type { ApiSchemas } from "@/lib/api/client";

import { ids } from "./ids";

export type RoleCode =
  | "ADMIN"
  | "COLLECTIONS_MANAGER"
  | "CATALOGUER"
  | "CONSERVATION"
  | "STORAGE_STAFF"
  | "INTERNAL_VIEWER"
  | "EXTERNAL_RESEARCHER";

export const PERMISSIONS: Record<string, string> = {
  "pieces.read": "Consultar fichas de piezas",
  "pieces.create": "Registrar piezas",
  "pieces.update": "Editar fichas de piezas",
  "pieces.delete": "Eliminar piezas lógicamente",
  "pieces.restore": "Restaurar piezas eliminadas",
  "identifiers.manage": "Registrar identificadores",
  "identifiers.correct_inventory_code": "Corregir código I (procedimiento auditado)",
  "collections.manage": "Administrar colecciones",
  "vocabularies.manage": "Administrar vocabularios y tipos de identificador",
  "media.upload": "Subir fotografías y documentos",
  "media.retire": "Retirar fotografías",
  "locations.manage": "Administrar ubicaciones",
  "movements.register": "Registrar movimientos y verificaciones",
  "conservation.assess": "Registrar evaluaciones de conservación",
  "imports.prepare": "Preparar cargas masivas",
  "imports.approve": "Aprobar cargas masivas",
  "imports.revert": "Revertir cargas masivas",
  "duplicates.resolve": "Resolver candidatos a duplicado",
  "ai.request": "Solicitar sugerencias de IA",
  "ai.review": "Aprobar o rechazar sugerencias de IA",
  "reports.view": "Ver reportes",
  "exports.run": "Exportar resultados",
  "exports.full": "Exportación completa de la base",
  "audit.read": "Consultar auditoría",
  "users.manage": "Administrar usuarios y roles",
  "sensitive.valuation": "Ver valorización",
  "sensitive.exact_location": "Ver ubicación exacta",
  "sensitive.loan_terms": "Ver condiciones de comodato",
  "sensitive.donor_data": "Ver datos de donantes y comodantes",
};

const ALL_PERMISSIONS = Object.keys(PERMISSIONS);
const READ_ONLY = ["pieces.read", "reports.view"];

const ROLE_PERMISSIONS: Record<RoleCode, string[]> = {
  ADMIN: ALL_PERMISSIONS,
  COLLECTIONS_MANAGER: ALL_PERMISSIONS.filter(
    (code) => !["users.manage", "exports.full", "imports.revert"].includes(code),
  ),
  CATALOGUER: [
    ...READ_ONLY,
    "pieces.create",
    "pieces.update",
    "identifiers.manage",
    "media.upload",
    "movements.register",
    "imports.prepare",
    "ai.request",
    "exports.run",
    "sensitive.exact_location",
  ],
  CONSERVATION: [
    ...READ_ONLY,
    "conservation.assess",
    "media.upload",
    "movements.register",
    "sensitive.exact_location",
  ],
  STORAGE_STAFF: [...READ_ONLY, "movements.register", "sensitive.exact_location"],
  INTERNAL_VIEWER: [...READ_ONLY],
  EXTERNAL_RESEARCHER: ["pieces.read"],
};

export const ROLES: ApiSchemas["RoleOut"][] = [
  { code: "ADMIN", name: "Administrador", is_enabled: true, description: "Acceso completo, incluida la corrección auditada del código I.", permissions: ROLE_PERMISSIONS.ADMIN },
  { code: "COLLECTIONS_MANAGER", name: "Gestor de colecciones (Curadora)", is_enabled: true, description: "Gestión curatorial de colecciones, calidad e importaciones, sin administración de usuarios.", permissions: ROLE_PERMISSIONS.COLLECTIONS_MANAGER },
  { code: "CATALOGUER", name: "Catalogador / practicante", is_enabled: true, description: "Registro y edición de piezas, identificadores, fotos y movimientos.", permissions: ROLE_PERMISSIONS.CATALOGUER },
  { code: "CONSERVATION", name: "Conservación", is_enabled: true, description: "Evaluaciones de estado de conservación y registro fotográfico.", permissions: ROLE_PERMISSIONS.CONSERVATION },
  { code: "STORAGE_STAFF", name: "Personal auxiliar de depósito", is_enabled: true, description: "Consulta y registro de movimientos/verificaciones desde el depósito, incluida la vista móvil.", permissions: ROLE_PERMISSIONS.STORAGE_STAFF },
  { code: "INTERNAL_VIEWER", name: "Consulta interna", is_enabled: true, description: "Solo lectura de fichas y reportes, sin campos sensibles ni exportación.", permissions: ROLE_PERMISSIONS.INTERNAL_VIEWER },
  { code: "EXTERNAL_RESEARCHER", name: "Consulta externa / investigador (desactivado en fase 1)", is_enabled: false, description: "Modelado para una fase futura; RF-042 lo mantiene desactivado en fase 1.", permissions: ROLE_PERMISSIONS.EXTERNAL_RESEARCHER },
];

export const USERS: ApiSchemas["UserOut"][] = [
  { id: ids.user(1), full_name: "Administrador MATP (sintético)", email: "admin@matp.local", roles: ["ADMIN"], is_active: true, created_at: "2026-01-12T09:00:00Z", last_login_at: "2026-09-16T14:05:00Z", locked_until: null },
  { id: ids.user(2), full_name: "Gabriela Curadora (sintética)", email: "curadora@matp.local", roles: ["COLLECTIONS_MANAGER"], is_active: true, created_at: "2026-01-12T09:00:00Z", last_login_at: "2026-09-16T11:40:00Z", locked_until: null },
  { id: ids.user(3), full_name: "Practicante Catalogador (sintético)", email: "catalogador@matp.local", roles: ["CATALOGUER"], is_active: true, created_at: "2026-02-03T09:00:00Z", last_login_at: "2026-09-15T16:20:00Z", locked_until: null },
  { id: ids.user(4), full_name: "Especialista de Conservación (sintético)", email: "conservacion@matp.local", roles: ["CONSERVATION"], is_active: true, created_at: "2026-02-03T09:00:00Z", last_login_at: "2026-09-10T10:00:00Z", locked_until: null },
  { id: ids.user(5), full_name: "Auxiliar de Depósito (sintético)", email: "deposito@matp.local", roles: ["STORAGE_STAFF"], is_active: true, created_at: "2026-03-01T09:00:00Z", last_login_at: "2026-09-16T08:15:00Z", locked_until: null },
  { id: ids.user(6), full_name: "Consulta Interna (sintético)", email: "consulta@matp.local", roles: ["INTERNAL_VIEWER"], is_active: true, created_at: "2026-03-01T09:00:00Z", last_login_at: "2026-08-20T09:00:00Z", locked_until: null },
  { id: ids.user(7), full_name: "Ex practicante (sintético, desactivado)", email: "exbecario@matp.local", roles: ["CATALOGUER"], is_active: false, created_at: "2026-01-20T09:00:00Z", last_login_at: "2026-04-01T09:00:00Z", locked_until: null },
];

export const IDENTIFIER_TYPES: ApiSchemas["IdentifierTypeOut"][] = [
  { code: "I", label: "Código de inventario general (I)", description: "Columna vertebral del inventario; una vez asignado no cambia salvo corrección auditada (RN-002).", normalization_rule: "INVENTORY", is_unique_when_current: true, locks_on_assignment: true, owned_pieces_only: true, allowed_for_temporary_loan: false, is_active: true, sort_order: 0 },
  { code: "COLLECTION", label: "Código de colección", description: "Correlativo con siglas de colección (p. ej. MMZ, RA).", normalization_rule: "COLLECTION", is_unique_when_current: false, locks_on_assignment: false, owned_pieces_only: false, allowed_for_temporary_loan: false, is_active: true, sort_order: 1 },
  { code: "INC_RN", label: "Código INC / Registro Nacional", description: "Formato cambió de 4 a 6 dígitos según el año de registro.", normalization_rule: "INC_RN", is_unique_when_current: false, locks_on_assignment: false, owned_pieces_only: false, allowed_for_temporary_loan: true, is_active: true, sort_order: 2 },
  { code: "PUCP", label: "Código PUCP", description: "Identificador institucional PUCP.", normalization_rule: "GENERIC", is_unique_when_current: false, locks_on_assignment: false, owned_pieces_only: false, allowed_for_temporary_loan: true, is_active: true, sort_order: 3 },
  { code: "OWNER", label: "Código del propietario o comodante", description: "Código asignado por el propietario original o el comodante (p. ej. AJB).", normalization_rule: "GENERIC", is_unique_when_current: false, locks_on_assignment: false, owned_pieces_only: false, allowed_for_temporary_loan: true, is_active: true, sort_order: 4 },
  { code: "OTHER", label: "Otro código histórico", description: "Cualquier otro código histórico que deba conservarse.", normalization_rule: "GENERIC", is_unique_when_current: false, locks_on_assignment: false, owned_pieces_only: false, allowed_for_temporary_loan: true, is_active: true, sort_order: 5 },
];

interface VocabularyDef {
  code: string;
  name: string;
  terms: [string, string][];
}

const VOCABULARY_DEFS: VocabularyDef[] = [
  { code: "CATEGORY", name: "Categorías (tipologías)", terms: [["RETABLO", "Retablo"], ["TEXTIL", "Textil"], ["CERAMICA", "Cerámica"], ["MATE_BURILADO", "Mate burilado"], ["MASCARA", "Máscara"], ["IMAGINERIA", "Imaginería"], ["JUGUETE", "Juguete popular"], ["PLATERIA", "Platería"], ["INSTRUMENTO_MUSICAL", "Instrumento musical"], ["PINTURA_POPULAR", "Pintura popular"]] },
  { code: "MATERIAL", name: "Materiales", terms: [["MADERA", "Madera"], ["ARCILLA", "Arcilla"], ["LANA", "Lana"], ["ALGODON", "Algodón"], ["PLATA", "Plata"], ["CALABAZA", "Calabaza"], ["YESO", "Yeso"], ["PASTA_PAPA", "Pasta de papa"], ["CUERO", "Cuero"], ["PIGMENTO", "Pigmentos"]] },
  { code: "TECHNIQUE", name: "Técnicas", terms: [["TALLADO", "Tallado"], ["MODELADO", "Modelado"], ["TEJIDO_TELAR", "Tejido en telar"], ["BURILADO", "Burilado"], ["POLICROMADO", "Policromado"], ["REPUJADO", "Repujado"]] },
  { code: "CONSERVATION_STATUS", name: "Estados de conservación", terms: [["BUENO", "Bueno"], ["REGULAR", "Regular"], ["MALO", "Malo"], ["EN_RESTAURACION", "En restauración"]] },
  { code: "ACQUISITION_METHOD", name: "Formas de adquisición", terms: [["DONACION", "Donación"], ["COMPRA", "Compra"], ["TRANSFERENCIA", "Transferencia interna"], ["COMODATO", "Comodato"], ["LEGADO", "Legado"], ["DESCONOCIDA", "Desconocida"]] },
  { code: "PHOTO_VIEW_TYPE", name: "Tipos de vista fotográfica", terms: [["FRONTAL", "Frontal"], ["PERFIL", "Perfil"], ["POSTERIOR", "Posterior"], ["SUPERIOR", "Superior"], ["DETALLE", "Detalle"], ["ABIERTA", "Abierta"], ["CERRADA", "Cerrada"]] },
  { code: "OBJECT_TYPE", name: "Tipos de bien", terms: [["BIEN_MUEBLE", "Bien mueble"], ["CONJUNTO", "Conjunto"], ["COMPONENTE", "Componente de conjunto"]] },
  { code: "AVAILABILITY", name: "Disponibilidad", terms: [["EN_DEPOSITO", "En depósito"], ["EN_SALA", "En sala"], ["EN_PRESTAMO", "En préstamo"], ["EN_EXPOSICION_TEMPORAL", "En exposición temporal"], ["EN_RESTAURACION", "En restauración"], ["NO_LOCALIZADA", "No localizada"]] },
  { code: "USAGE_RESTRICTION", name: "Restricciones de uso de imágenes", terms: [["SIN_RESTRICCION", "Sin restricción"], ["SOLO_USO_INTERNO", "Solo uso interno"], ["NO_PUBLICAR", "No publicar"], ["AUTORIZACION_COMODANTE", "Requiere autorización del comodante"]] },
];

export const VOCABULARIES: ApiSchemas["VocabularyOut"][] = VOCABULARY_DEFS.map((def, index) => ({
  id: ids.vocabulary(index + 1),
  code: def.code,
  name: def.name,
  description: "[SUPUESTO] Vocabulario inicial precargado con la consultoría 2024/25; ajustar con la contraparte.",
  term_count: def.terms.length,
}));

export const TERMS: ApiSchemas["TermOut"][] = VOCABULARY_DEFS.flatMap((def, vIndex) =>
  def.terms.map(([code, label], tIndex) => ({
    id: ids.term(vIndex * 100 + tIndex + 1),
    vocabulary_code: def.code,
    code,
    label,
    description: null,
    sort_order: tIndex,
    is_active: true,
    external_uri: null,
  })),
);

export function termRef(vocabularyCode: string, code: string): ApiSchemas["TermRef"] {
  const term = TERMS.find((t) => t.vocabulary_code === vocabularyCode && t.code === code);
  if (!term) throw new Error(`Fixture: término ${vocabularyCode}/${code} no existe`);
  return { id: term.id, code: term.code, label: term.label };
}

export function termsByVocabulary(vocabularyCode: string): ApiSchemas["TermOut"][] {
  return TERMS.filter((t) => t.vocabulary_code === vocabularyCode);
}
