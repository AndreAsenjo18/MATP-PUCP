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
