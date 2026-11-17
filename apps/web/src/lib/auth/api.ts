/**
 * Real authentication calls (ADR-009): sign in, sign out and change the password.
 *
 * The session itself lives in an `HttpOnly` cookie the browser manages; nothing secret is kept
 * in `localStorage`. What is kept (see `session.tsx`) is only the profile that came back, to
 * draw the menu without asking again.
 */
import { apiErrorMessage, createApiClient, type ApiSchemas } from "@/lib/api/client";
import { apiBaseUrl } from "@/lib/data/mode";

export type LoginResponse = ApiSchemas["LoginResponse"];

export type AuthResult =
  | { status: "ok"; profile: LoginResponse }
  | { status: "invalid_credentials"; message: string }
  | { status: "too_many_attempts"; message: string }
  | { status: "weak_password" | "current_password_incorrect" | "password_unchanged"; message: string }
  | { status: "error"; message: string };

const CONNECTION_MESSAGE = "No se pudo conectar con el servidor. Intente nuevamente.";

interface ErrorBody {
  code?: string;
  message?: string;
}

function failure(error: unknown, status: number): AuthResult {
  const body = (typeof error === "object" && error !== null ? error : {}) as ErrorBody;
  const message = apiErrorMessage(error);
  if (status === 401 && body.code === "invalid_credentials") return { status: "invalid_credentials", message };
  if (status === 429) return { status: "too_many_attempts", message };
  if (body.code === "weak_password") return { status: "weak_password", message };
  if (body.code === "current_password_incorrect") return { status: "current_password_incorrect", message };
  if (body.code === "password_unchanged") return { status: "password_unchanged", message };
  return { status: "error", message };
}

export async function signIn(username: string, password: string): Promise<AuthResult> {
  try {
    const { data, error, response } = await createApiClient({ baseUrl: apiBaseUrl() }).POST("/api/v1/auth/login", {
      body: { username, password },
    });
    if (data) return { status: "ok", profile: data };
    return failure(error, response.status);
  } catch {
    return { status: "error", message: CONNECTION_MESSAGE };
  }
}

/**
 * Whether the browser still holds a real session, asked with `GET /auth/me`. A plain `fetch` on
 * purpose: the API client treats a 401 as «session lost» and reloads the page, but on the sign-in
 * screen a 401 is the expected answer. `unknown` when the server cannot be reached.
 */
export async function currentSessionStatus(): Promise<"signed_in" | "signed_out" | "unknown"> {
  try {
    const response = await fetch(`${apiBaseUrl()}/api/v1/auth/me`, { credentials: "include", headers: { Accept: "application/json" } });
    if (response.ok) return "signed_in";
    return response.status === 401 || response.status === 403 ? "signed_out" : "unknown";
  } catch {
    return "unknown";
  }
}

export async function signOut(): Promise<void> {
  try {
    await createApiClient({ baseUrl: apiBaseUrl() }).POST("/api/v1/auth/logout");
  } catch {
    // Sin conexión: la sesión del servidor vence sola; igual se limpia el perfil local.
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<AuthResult> {
  try {
    const { data, error, response } = await createApiClient({ baseUrl: apiBaseUrl() }).POST(
      "/api/v1/auth/change-password",
      { body: { current_password: currentPassword, new_password: newPassword } },
    );
    if (data) return { status: "ok", profile: data };
    return failure(error, response.status);
  } catch {
    return { status: "error", message: CONNECTION_MESSAGE };
  }
}
