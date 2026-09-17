"use client";

/**
 * Pantalla 1 — Login con selector de rol simulado (change `maqueta-ui-navegable`).
 *
 * No hay autenticación real en esta maqueta (llega con `autenticacion-y-matriz-permisos`,
 * RNF-012/013): se elige una persona sintética y su rol para demostrar la matriz de permisos
 * (RF-039) ante Gabriela y Claudio. El rol "Consulta externa/investigador" aparece pero
 * deshabilitado: RF-042 mantiene el sistema de uso exclusivamente interno en fase 1.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useSession } from "@/lib/auth/session";
import { ROLES, USERS } from "@/lib/fixtures";

export default function LoginPage() {
  const router = useRouter();
  const { session, login } = useSession();
  const [selectedUserId, setSelectedUserId] = useState(USERS[0]?.id ?? "");

  useEffect(() => {
    if (session) {
      router.replace("/inicio");
    }
  }, [session, router]);

  const selectedUser = USERS.find((u) => u.id === selectedUserId);
  const selectedRoleCode = selectedUser?.roles[0];
  const selectedRole = ROLES.find((r) => r.code === selectedRoleCode);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-8 px-4 py-10">
      <header className="flex flex-col gap-2 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-stone-600">Uso interno · Fase 1</p>
        <h1 className="text-3xl font-bold text-stone-900">Gestión de Colecciones del MATP</h1>
        <p className="text-base text-stone-700">
          Museo de Artes y Tradiciones Populares &quot;Luis Repetto Málaga&quot; — maqueta de demostración con datos
          sintéticos.
        </p>
      </header>

      <form
        className="flex flex-col gap-5 rounded-lg border border-stone-200 bg-white p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (selectedUser && selectedRoleCode && selectedRole?.is_enabled) {
            login(selectedUser.id, selectedRoleCode);
            router.push("/inicio");
          }
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="user" className="text-base font-medium text-stone-900">
            Ingresar como (persona sintética)
          </label>
          <select
            id="user"
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            className="rounded-md border border-stone-300 p-3 text-base text-stone-900"
          >
            {USERS.filter((u) => u.is_active).map((user) => {
              const role = ROLES.find((r) => r.code === user.roles[0]);
              return (
                <option key={user.id} value={user.id}>
                  {user.full_name} — {role?.name}
                </option>
              );
            })}
          </select>
          <p className="text-sm text-stone-600">
            Cada persona demuestra un rol de la matriz de permisos (RF-039). Puede cambiar de rol en cualquier
            momento desde la cabecera.
          </p>
        </div>

        <button
          type="submit"
          disabled={!selectedRole?.is_enabled}
          className="rounded-md bg-stone-900 px-4 py-3 text-base font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Entrar
        </button>

        <div className="border-t border-stone-100 pt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Roles del sistema</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-stone-700">
            {ROLES.map((role) => (
              <li key={role.code} className="flex items-center justify-between gap-2">
                <span className={role.is_enabled ? "" : "text-stone-400"}>{role.name}</span>
                {!role.is_enabled && (
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                    Desactivado en fase 1 (RF-042)
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </form>
    </main>
  );
}
