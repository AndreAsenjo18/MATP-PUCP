"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { getStoredSession, useSession } from "@/lib/auth/session";

/**
 * Redirige a "/" (login) si no hay una sesión simulada activa. Envuelve el contenido de cada
 * pantalla protegida.
 *
 * El efecto relee `localStorage` directamente (`getStoredSession`) en vez de confiar solo en el
 * `session` reactivo de `useSession()`: justo después de hidratar, el `session` del contexto
 * puede tardar un renderizado más en sincronizarse (los efectos de este componente hijo corren
 * antes que la sincronización interna de `useSyncExternalStore` en `SessionProvider`), y una
 * lectura directa evita redirigir por error a un usuario que sí tiene sesión.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!getStoredSession()) {
      router.replace("/");
    }
  }, [session, router]);

  if (!session) return null;
  return <>{children}</>;
}
