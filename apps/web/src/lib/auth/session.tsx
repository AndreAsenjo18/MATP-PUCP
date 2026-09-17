"use client";

/**
 * Sesión simulada de la maqueta (pantalla 1 "Login"): selector de rol para demostrar la matriz
 * de permisos (RF-039) sin autenticación real (RNF-012/013 llegan con
 * `autenticacion-y-matriz-permisos`). Se guarda solo en `localStorage` del navegador — nunca se
 * envía a ningún servicio ni sustituye una autenticación real.
 *
 * Se lee con `useSyncExternalStore` (fuente externa mutable) en vez de `useEffect` + `setState`,
 * siguiendo la regla `react-hooks/set-state-in-effect` del linter del proyecto.
 */
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

import { ROLES, USERS } from "@/lib/fixtures";

const STORAGE_KEY = "matp-maqueta-sesion";

export interface Session {
  userId: string;
  roleCode: string;
}

interface SessionContextValue {
  session: Session | null;
  login: (userId: string, roleCode: string) => void;
  logout: () => void;
  hasPermission: (permissionCode: string) => boolean;
  currentUser: (typeof USERS)[number] | undefined;
  currentRole: (typeof ROLES)[number] | undefined;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedSession: Session | null = null;

function parse(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (typeof parsed.userId === "string" && typeof parsed.roleCode === "string") return parsed;
  } catch {
    // localStorage puede tener contenido corrupto: se trata como sesión ausente.
  }
  return null;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getSnapshot(): Session | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSession = parse(raw);
  }
  return cachedSession;
}

function getServerSnapshot(): Session | null {
  return null;
}

/**
 * Lectura directa y síncrona de `localStorage`, para usar en un efecto de redirección
 * ("¿hay sesión guardada?"). A diferencia del `session` reactivo de `useSession()`, esta no
 * puede quedar momentáneamente desincronizada durante la primera pintada tras la hidratación
 * (el valor de `useSyncExternalStore` se corrige en un efecto propio, que corre después de los
 * efectos de los componentes hijos como `RequireSession` — leer aquí evita esa carrera).
 */
export function getStoredSession(): Session | null {
  return getSnapshot();
}

function notify() {
  for (const listener of listeners) listener();
}

function writeSession(next: Session | null) {
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Continúa solo en memoria si el almacenamiento del navegador no está disponible.
  }
  cachedRaw = next ? JSON.stringify(next) : null;
  cachedSession = next;
  notify();
}

export function SessionProvider({ children }: { children: ReactNode }) {
  // `getServerSnapshot` siempre da null; React re-sincroniza con el valor real de localStorage
  // justo después de hidratar (antes de pintar), sin necesidad de un `useEffect` propio.
  const session = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const login = useCallback((userId: string, roleCode: string) => writeSession({ userId, roleCode }), []);
  const logout = useCallback(() => writeSession(null), []);

  const currentUser = useMemo(() => USERS.find((u) => u.id === session?.userId), [session]);
  const currentRole = useMemo(() => ROLES.find((r) => r.code === session?.roleCode), [session]);

  const hasPermission = useCallback(
    (permissionCode: string) => currentRole?.permissions.includes(permissionCode) ?? false,
    [currentRole],
  );

  const value = useMemo<SessionContextValue>(
    () => ({ session, login, logout, hasPermission, currentUser, currentRole }),
    [session, login, logout, hasPermission, currentUser, currentRole],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
