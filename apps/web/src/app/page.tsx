"use client";

/**
 * Pantalla 1 — Login con selector de rol simulado (change `maqueta-ui-navegable`).
 *
 * No hay autenticación real en esta maqueta (llega con `autenticacion-y-matriz-permisos`,
 * RNF-012/013): se elige una persona sintética y su rol para demostrar la matriz de permisos
 * (RF-039) ante Gabriela y Claudio. El rol "Consulta externa/investigador" aparece pero
 * deshabilitado: RF-042 mantiene el sistema de uso exclusivamente interno en fase 1.
 */
import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
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
        <p className="text-sm font-medium uppercase tracking-wide text-terracota">Uso interno · Fase 1</p>
        <h1 className="text-3xl font-bold text-tinta">Gestión de Colecciones del MATP</h1>
        <p className="text-base text-gris-texto">
          Museo de Artes y Tradiciones Populares &quot;Luis Repetto Málaga&quot; — maqueta de demostración con datos
          sintéticos.
        </p>
      </header>

      <Card
        as="section"
        aria-label="Ingreso a la maqueta"
        className="p-6"
      >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (selectedUser && selectedRoleCode && selectedRole?.is_enabled) {
            login(selectedUser.id, selectedRoleCode);
            router.push("/inicio");
          }
        }}
      >
        <Select
          id="user"
          label="Ingresar como (persona sintética)"
          hint="Cada persona demuestra un rol de la matriz de permisos (RF-039). Puede cambiar de rol en cualquier momento desde la cabecera."
          value={selectedUserId}
          onChange={(event) => setSelectedUserId(event.target.value)}
          className="p-3"
        >
            {USERS.filter((u) => u.is_active).map((user) => {
              const role = ROLES.find((r) => r.code === user.roles[0]);
              return (
                <option key={user.id} value={user.id}>
                  {user.full_name} — {role?.name}
                </option>
              );
            })}
        </Select>

        <Button type="submit" icon={LogIn} disabled={!selectedRole?.is_enabled}>
          Entrar
        </Button>

        <div className="border-t border-borde pt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gris-texto">Roles del sistema</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-tinta">
            {ROLES.map((role) => (
              <li key={role.code} className="flex items-center justify-between gap-2">
                <span className={role.is_enabled ? "" : "text-gris-texto line-through"}>{role.name}</span>
                {!role.is_enabled && <Badge>Desactivado en fase 1 (RF-042)</Badge>}
              </li>
            ))}
          </ul>
        </div>
      </form>
      </Card>
    </main>
  );
}
