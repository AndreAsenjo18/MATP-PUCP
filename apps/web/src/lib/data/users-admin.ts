/**
 * Capa de datos de la administración de usuarios y de la matriz de permisos en modo `live`
 * (change `autenticacion-y-matriz-permisos`, tarea 4.3; spec usuarios-roles, RF-039, RNF-012).
 *
 * Mismo patrón que `lib/data/locations.ts`: en modo `mock` las operaciones responden
 * `unavailable` (la pantalla sigue leyendo `lib/fixtures`), y en `live` usan el cliente tipado
 * contra `/users`, `/roles` y `/permissions`.
 */
import { apiErrorMessage, createApiClient, type ApiSchemas } from "@/lib/api/client";

import { apiBaseUrl, getApiMode } from "./mode";

export type UserOut = ApiSchemas["UserOut"];
export type UserCreateInput = ApiSchemas["UserCreate"];
// `reset_password` tiene valor por defecto en la API, pero el tipo generado lo exige.
export type UserUpdateInput = Partial<ApiSchemas["UserUpdate"]>;
export type RoleOut = ApiSchemas["RoleOut"];
export type PermissionOut = ApiSchemas["PermissionOut"];

export type UsersFailure =
  | { status: "rejected"; code: string; message: string }
  | { status: "unavailable"; message: string };

export type UsersResult<T> = { status: "ok"; value: T } | UsersFailure;

const MOCK_MESSAGE = "La administración de usuarios conectada a la API solo funciona con NEXT_PUBLIC_API_MODE=live.";
const CONNECTION_MESSAGE = "No se pudo conectar con el servidor. Intente nuevamente.";

/** Mensajes de pantalla para los errores conocidos del dominio; el resto usa el de la API. */
export const USER_ERROR_MESSAGES: Record<string, string> = {
  email_taken: "Ya existe un usuario con ese correo. Búsquelo entre las cuentas desactivadas y reactívelo.",
  role_disabled: "Ese rol está desactivado en la fase 1 y no se puede asignar.",
  last_administrator: "Eso dejaría el sistema sin ningún administrador activo. Asigne primero el rol a otra persona.",
  unknown_role: "Uno de los roles indicados no existe.",
  unknown_permission: "Uno de los permisos indicados no existe.",
  weak_password: "La contraseña no cumple la política (al menos 12 caracteres y no ser común).",
  permission_denied: "Su rol no tiene permiso para administrar usuarios y roles.",
};

export function describeUsersFailure(failure: UsersFailure): string {
  if (failure.status === "unavailable") return failure.message;
  return USER_ERROR_MESSAGES[failure.code] ?? failure.message;
}

function client() {
  return createApiClient({ baseUrl: apiBaseUrl() });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejected(error: unknown): UsersFailure {
  const code = isRecord(error) && typeof error.code === "string" ? error.code : "error";
  return { status: "rejected", code, message: apiErrorMessage(error) };
}

async function call<T>(operation: () => Promise<{ data?: T; error?: unknown }>): Promise<UsersResult<T>> {
  if (getApiMode() !== "live") return { status: "unavailable", message: MOCK_MESSAGE };
  try {
    const { data, error } = await operation();
    if (data !== undefined) return { status: "ok", value: data };
    return rejected(error);
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

export function fetchUsers(includeInactive: boolean): Promise<UsersResult<UserOut[]>> {
  return call(async () => {
    const { data, error } = await client().GET("/api/v1/users", {
      params: { query: { page_size: 100, include_inactive: includeInactive } },
    });
    return { data: data?.items, error };
  });
}

/** El resultado trae `temporary_password` una sola vez: la pantalla debe mostrarla de inmediato. */
export function createUser(input: UserCreateInput): Promise<UsersResult<UserOut>> {
  return call(() => client().POST("/api/v1/users", { body: input }));
}

export function updateUser(userId: string, patch: UserUpdateInput): Promise<UsersResult<UserOut>> {
  return call(() =>
    client().PATCH("/api/v1/users/{user_id}", { params: { path: { user_id: userId } }, body: { reset_password: false, ...patch } }),
  );
}

export function fetchRoles(): Promise<UsersResult<RoleOut[]>> {
  return call(() => client().GET("/api/v1/roles"));
}

export function fetchPermissions(): Promise<UsersResult<PermissionOut[]>> {
  return call(() => client().GET("/api/v1/permissions"));
}

export function saveRolePermissions(
  roleCode: string,
  permissions: string[],
  reason: string,
): Promise<UsersResult<RoleOut>> {
  return call(() =>
    client().PUT("/api/v1/roles/{role_code}/permissions", {
      params: { path: { role_code: roleCode } },
      body: { permissions, reason },
    }),
  );
}

/** Permisos agregados y retirados al pasar de `before` a `after` (para confirmar el cambio). */
export function permissionDiff(before: readonly string[], after: readonly string[]) {
  const was = new Set(before);
  const now = new Set(after);
  return {
    added: [...now].filter((code) => !was.has(code)).sort(),
    removed: [...was].filter((code) => !now.has(code)).sort(),
  };
}

export function togglePermission(selected: readonly string[], code: string): string[] {
  return selected.includes(code) ? selected.filter((item) => item !== code) : [...selected, code].sort();
}

// ---------------------------------------------------------------------------------------------
// Paquetes de permisos y filtro de usuarios (change `rediseno-ux-administracion`)
// ---------------------------------------------------------------------------------------------

export interface PermissionPackage {
  id: string;
  label: string;
  codes: readonly string[];
}

/** Los permisos agrupados por área; el orden es el de la pantalla. */
export const PERMISSION_PACKAGES: readonly PermissionPackage[] = [
  {
    id: "fichas",
    label: "Fichas",
    codes: ["pieces.read", "pieces.create", "pieces.update", "pieces.delete", "pieces.restore", "identifiers.manage", "identifiers.correct_inventory_code", "conservation.assess"],
  },
  { id: "importacion", label: "Importación", codes: ["imports.prepare", "imports.approve", "imports.revert"] },
  { id: "calidad", label: "Calidad de datos", codes: ["duplicates.resolve", "quality.completeness_rules.manage"] },
  { id: "ubicacion", label: "Ubicación y movimientos", codes: ["locations.manage", "movements.register"] },
  { id: "fotos", label: "Fotografías", codes: ["media.upload", "media.retire"] },
  { id: "sensibles", label: "Datos sensibles", codes: ["sensitive.valuation", "sensitive.exact_location", "sensitive.loan_terms", "sensitive.donor_data"] },
  { id: "reportes", label: "Reportes y exportación", codes: ["reports.view", "exports.run", "exports.full"] },
  { id: "ia", label: "IA", codes: ["ai.request", "ai.review"] },
  { id: "administracion", label: "Administración", codes: ["users.manage", "collections.manage", "vocabularies.manage", "trash.read", "audit.read"] },
];

export interface PackageView {
  id: string;
  label: string;
  permissions: PermissionOut[];
}

/**
 * Los permisos que envió la API repartidos en paquetes, en el orden de `PERMISSION_PACKAGES`;
 * los paquetes sin permisos se omiten y los códigos desconocidos van a «Otros».
 */
export function packagePermissions(permissions: readonly PermissionOut[]): PackageView[] {
  const known = new Set(PERMISSION_PACKAGES.flatMap((pkg) => pkg.codes));
  const views: PackageView[] = PERMISSION_PACKAGES.map((pkg) => ({
    id: pkg.id,
    label: pkg.label,
    permissions: pkg.codes.flatMap((code) => permissions.filter((permission) => permission.code === code)),
  }));
  const others = permissions.filter((permission) => !known.has(permission.code));
  if (others.length > 0) views.push({ id: "otros", label: "Otros", permissions: [...others] });
  return views.filter((view) => view.permissions.length > 0);
}

export type PackageState = "none" | "partial" | "all";

export function packageState(selected: readonly string[], codes: readonly string[]): PackageState {
  const marked = codes.filter((code) => selected.includes(code)).length;
  return marked === 0 ? "none" : marked === codes.length ? "all" : "partial";
}

/** Marca todo el paquete o, si ya estaba completo, lo quita entero. */
export function togglePackage(selected: readonly string[], codes: readonly string[]): string[] {
  if (packageState(selected, codes) === "all") return selected.filter((code) => !codes.includes(code));
  return [...new Set([...selected, ...codes])].sort();
}

function fold(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Usuarios cuyo nombre o correo contiene la búsqueda y que tienen el rol elegido (vacío = todos). */
export function filterUsers(users: readonly UserOut[], filters: { query: string; role: string }): UserOut[] {
  const query = fold(filters.query);
  return users.filter(
    (user) =>
      (!filters.role || user.roles.includes(filters.role)) && (!query || fold(user.full_name).includes(query) || fold(user.email).includes(query)),
  );
}
