"use client";

/**
 * Administración de usuarios y editor de la matriz de permisos en modo `live` (change
 * `autenticacion-y-matriz-permisos`, tarea 4.3; RF-039, RNF-012).
 *
 * Avisos que exige el spec: el rol desactivado (investigador) no se ofrece para asignar, la
 * contraseña temporal se muestra una sola vez y el sistema siempre conserva un administrador
 * (la API responde `last_administrator` y aquí se explica sin perder lo escrito).
 */
import { KeyRound, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  createUser,
  describeUsersFailure,
  fetchPermissions,
  fetchRoles,
  fetchUsers,
  permissionDiff,
  saveRolePermissions,
  togglePermission,
  updateUser,
  type PermissionOut,
  type RoleOut,
  type UserOut,
  type UsersFailure,
} from "@/lib/data/users-admin";

/** Aviso de la contraseña temporal: se entrega una sola vez y no se puede consultar después. */
export function TemporaryPasswordNotice({ email, password }: { email: string; password: string }) {
  return (
    <div role="alert" className="rounded-md border border-ambar-alerta bg-ambar-bg p-3 text-sm text-ambar-texto">
      <p className="font-semibold">Contraseña temporal de {email}</p>
      <p className="mt-1 break-all font-mono text-base text-tinta">{password}</p>
      <p className="mt-1">
        Anótela y entréguela en persona o por un canal privado: <strong>se muestra una sola vez</strong> y la persona
        deberá cambiarla al ingresar. Si se pierde, restablezca la contraseña.
      </p>
    </div>
  );
}

export function RoleChoice({ roles, value, onChange }: { roles: RoleOut[]; value: string; onChange: (code: string) => void }) {
  return (
    <Select label="Rol" value={value} onChange={(event) => onChange(event.target.value)}>
      {roles.map((role) => (
        <option key={role.code} value={role.code} disabled={!role.is_enabled}>
          {role.name}
          {role.is_enabled ? "" : " — desactivado en fase 1"}
        </option>
      ))}
    </Select>
  );
}

export function UsersLive() {
  const [users, setUsers] = useState<UserOut[]>([]);
  const [roles, setRoles] = useState<RoleOut[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [temporary, setTemporary] = useState<{ email: string; password: string } | null>(null);
  const [form, setForm] = useState({ email: "", fullName: "", role: "" });

  const reload = useCallback(async () => {
    const [usersResult, rolesResult] = await Promise.all([fetchUsers(showInactive), fetchRoles()]);
    if (usersResult.status !== "ok") return setProblem(describeUsersFailure(usersResult));
    if (rolesResult.status !== "ok") return setProblem(describeUsersFailure(rolesResult));
    setUsers(usersResult.value);
    setRoles(rolesResult.value);
    setForm((current) => ({ ...current, role: current.role || (rolesResult.value.find((r) => r.is_enabled)?.code ?? "") }));
  }, [showInactive]);

  useEffect(() => {
    // Carga inicial y al cambiar el filtro; la función actualiza el estado cuando responde la API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  function fail(failure: UsersFailure) {
    setProblem(describeUsersFailure(failure));
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setProblem(null);
    const result = await createUser({ email: form.email, full_name: form.fullName, roles: [form.role] });
    if (result.status !== "ok") return fail(result);
    setTemporary({ email: result.value.email, password: result.value.temporary_password ?? "" });
    setForm((current) => ({ ...current, email: "", fullName: "" }));
    await reload();
  }

  async function act(user: UserOut, patch: Parameters<typeof updateUser>[1]) {
    setProblem(null);
    setTemporary(null);
    const result = await updateUser(user.id, patch);
    if (result.status !== "ok") return fail(result);
    if (result.value.temporary_password) setTemporary({ email: result.value.email, password: result.value.temporary_password });
    await reload();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card className="overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-tinta">Usuarios</h2>
          <label className="flex items-center gap-2 text-sm text-gris-texto">
            <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
            Incluir desactivados
          </label>
        </div>
        {problem && (
          <p role="alert" className="mt-2 rounded-md bg-carmin-bg p-2 text-sm text-carmin-texto">
            {problem}
          </p>
        )}
        {temporary && (
          <div className="mt-2">
            <TemporaryPasswordNotice email={temporary.email} password={temporary.password} />
          </div>
        )}
        <table className="mt-2 w-full text-left text-base">
          <thead className="text-sm text-gris-texto">
            <tr>
              <th className="py-1 pr-2 font-medium">Nombre</th>
              <th className="py-1 pr-2 font-medium">Rol</th>
              <th className="py-1 pr-2 font-medium">Estado</th>
              <th className="py-1 pr-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-borde align-top">
                <td className="py-1 pr-2 text-tinta">
                  {user.full_name}
                  <span className="block text-sm text-gris-texto">{user.email}</span>
                </td>
                <td className="py-1 pr-2 text-gris-texto">{user.roles.join(", ")}</td>
                <td className="py-1 pr-2">
                  {user.is_active ? <Badge intent="success">Activo</Badge> : <Badge>Desactivado</Badge>}
                  {user.must_change_password && <Badge intent="warning">Contraseña temporal</Badge>}
                </td>
                <td className="flex flex-wrap gap-1 py-1 pr-2">
                  <Button
                    variant="outline"
                    onClick={() => act(user, { is_active: !user.is_active })}
                    aria-label={`${user.is_active ? "Desactivar" : "Reactivar"} a ${user.full_name}`}
                  >
                    {user.is_active ? "Desactivar" : "Reactivar"}
                  </Button>
                  <Button
                    variant="outline"
                    icon={KeyRound}
                    onClick={() => act(user, { reset_password: true })}
                    aria-label={`Restablecer contraseña de ${user.full_name}`}
                  >
                    Restablecer
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card as="section" aria-label="Nuevo usuario">
        <h2 className="text-lg font-semibold text-tinta">Nuevo usuario</h2>
        <form className="mt-2 flex flex-col gap-3" onSubmit={handleCreate}>
          <Input label="Correo" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Nombre completo" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <RoleChoice roles={roles} value={form.role} onChange={(role) => setForm({ ...form, role })} />
          <Button type="submit" icon={UserPlus}>
            Crear usuario
          </Button>
        </form>
      </Card>
    </div>
  );
}

export function PermissionMatrixLive() {
  const [roles, setRoles] = useState<RoleOut[]>([]);
  const [permissions, setPermissions] = useState<PermissionOut[]>([]);
  const [roleCode, setRoleCode] = useState("");
  // `null` = sin tocar: se muestran los permisos vigentes del rol.
  const [selected, setSelected] = useState<string[] | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const [rolesResult, permissionsResult] = await Promise.all([fetchRoles(), fetchPermissions()]);
    if (rolesResult.status !== "ok") return setMessage({ kind: "error", text: describeUsersFailure(rolesResult) });
    if (permissionsResult.status !== "ok") return setMessage({ kind: "error", text: describeUsersFailure(permissionsResult) });
    setRoles(rolesResult.value);
    setPermissions(permissionsResult.value);
    setRoleCode((current) => current || (rolesResult.value[0]?.code ?? ""));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const role = roles.find((item) => item.code === roleCode);
  const current = role?.permissions ?? [];
  const working = selected ?? current;
  const diff = permissionDiff(current, working);
  const dirty = diff.added.length + diff.removed.length > 0;

  function choose(code: string) {
    setRoleCode(code);
    setSelected(null);
    setMessage(null);
  }

  async function save() {
    if (!role) return;
    const result = await saveRolePermissions(role.code, working, reason);
    if (result.status !== "ok") {
      // Se conserva lo marcado y el motivo para corregir y reintentar.
      return setMessage({ kind: "error", text: describeUsersFailure(result) });
    }
    setMessage({ kind: "ok", text: "Permisos guardados. Aplican desde la siguiente acción de las personas con este rol." });
    setReason("");
    await load();
    setSelected(null);
  }

  return (
    <Card as="section" aria-label="Matriz de permisos">
      <h2 className="text-lg font-semibold text-tinta">Permisos por rol</h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <Select label="Rol" value={roleCode} onChange={(event) => choose(event.target.value)}>
          {roles.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
              {item.is_enabled ? "" : " — desactivado en fase 1"}
            </option>
          ))}
        </Select>
      </div>
      <ul className="mt-3 grid gap-1 sm:grid-cols-2">
        {permissions.map((permission) => (
          <li key={permission.code}>
            <label className="flex items-start gap-2 text-base text-tinta">
              <input
                type="checkbox"
                checked={working.includes(permission.code)}
                onChange={() => setSelected(togglePermission(working, permission.code))}
              />
              <span>
                {permission.description}
                <span className="block text-sm text-gris-texto">{permission.code}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {dirty && (
        <p className="mt-3 text-sm text-tinta">
          {diff.added.length > 0 && <>Se agregarán: {diff.added.join(", ")}. </>}
          {diff.removed.length > 0 && <>Se retirarán: {diff.removed.join(", ")}.</>}
        </p>
      )}
      <div className="mt-3 flex flex-col gap-3 sm:max-w-md">
        <Input label="Motivo del cambio" hint="Queda en la auditoría junto con cada permiso." value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button onClick={save} disabled={!dirty || reason.trim().length < 3}>
          Guardar permisos
        </Button>
      </div>
      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={message.kind === "error" ? "mt-3 rounded-md bg-carmin-bg p-2 text-sm text-carmin-texto" : "mt-3 text-sm text-verde-texto"}
        >
          {message.text}
        </p>
      )}
    </Card>
  );
}
