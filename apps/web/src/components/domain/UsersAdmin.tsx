"use client";

/**
 * Administración de usuarios y editor de la matriz de permisos en modo `live` (change
 * `autenticacion-y-matriz-permisos`, tarea 4.3; RF-039, RNF-012; rediseño en
 * `rediseno-ux-administracion`).
 *
 * - Usuarios: búsqueda, filtro por rol y «Incluir desactivados» arriba; el alta es un diálogo
 *   («Nuevo usuario»); la tabla es compacta, con etiquetas de color y acciones de icono.
 * - Permisos por rol: el rol se elige con botones y los permisos se agrupan en paquetes por área,
 *   con el conteo «3 de 5» y un interruptor por paquete; el motivo y «Guardar permisos» van en una
 *   barra fija mientras haya cambios.
 *
 * Avisos que exige el spec: el rol desactivado (investigador) no se ofrece para asignar, la
 * contraseña temporal se muestra una sola vez y el sistema siempre conserva un administrador
 * (la API responde `last_administrator` y aquí se explica sin perder lo escrito).
 */
import { CircleCheck, CircleOff, KeyRound, Plus, UserCheck, UserX } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminToolbar, FormDialog, Notice, SectionHeader } from "@/components/domain/AdminShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import {
  createUser,
  describeUsersFailure,
  fetchPermissions,
  fetchRoles,
  fetchUsers,
  filterUsers,
  packagePermissions,
  packageState,
  permissionDiff,
  saveRolePermissions,
  togglePackage,
  togglePermission,
  updateUser,
  type PackageState,
  type PackageView,
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

// ---------------------------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------------------------

/** Tabla compacta: estado con etiquetas de color y acciones como botones de icono con su nombre. */
export function UsersTable({
  users,
  roles,
  onToggleActive,
  onResetPassword,
}: {
  users: UserOut[];
  roles: RoleOut[];
  onToggleActive: (user: UserOut) => void;
  onResetPassword: (user: UserOut) => void;
}) {
  if (users.length === 0) return <p className="py-3 text-sm text-gris-texto">No hay usuarios con estos filtros.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-gris-texto">
          <tr>
            <th className="py-1.5 pr-3 font-medium">Persona</th>
            <th className="py-1.5 pr-3 font-medium">Rol</th>
            <th className="py-1.5 pr-3 font-medium">Estado</th>
            <th className="py-1.5 text-right font-medium">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-t border-borde align-middle">
              <td className="py-1.5 pr-3 text-tinta">
                {user.full_name}
                <span className="block text-xs text-gris-texto">{user.email}</span>
              </td>
              <td className="py-1.5 pr-3">
                <span className="flex flex-wrap gap-1">
                  {user.roles.map((code) => (
                    <Badge key={code} intent="info" className="px-2 py-0 text-xs">
                      {roles.find((role) => role.code === code)?.name ?? code}
                    </Badge>
                  ))}
                </span>
              </td>
              <td className="py-1.5 pr-3">
                <span className="flex flex-wrap gap-1">
                  {user.is_active ? (
                    <Badge intent="success" icon={CircleCheck} className="px-2 py-0 text-xs">
                      Activo
                    </Badge>
                  ) : (
                    <Badge icon={CircleOff} className="px-2 py-0 text-xs">
                      Desactivado
                    </Badge>
                  )}
                  {user.must_change_password && (
                    <Badge intent="warning" icon={KeyRound} className="px-2 py-0 text-xs">
                      Contraseña temporal
                    </Badge>
                  )}
                </span>
              </td>
              <td className="py-1.5 text-right">
                <span className="inline-flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={user.is_active ? UserX : UserCheck}
                    title={user.is_active ? "Desactivar" : "Reactivar"}
                    aria-label={`${user.is_active ? "Desactivar" : "Reactivar"} a ${user.full_name}`}
                    onClick={() => onToggleActive(user)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    icon={KeyRound}
                    title="Restablecer contraseña"
                    aria-label={`Restablecer contraseña de ${user.full_name}`}
                    onClick={() => onResetPassword(user)}
                  />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UsersLive() {
  const [users, setUsers] = useState<UserOut[]>([]);
  const [roles, setRoles] = useState<RoleOut[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [temporary, setTemporary] = useState<{ email: string; password: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
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

  const shown = useMemo(() => filterUsers(users, { query, role: roleFilter }), [users, query, roleFilter]);

  function fail(failure: UsersFailure) {
    setProblem(describeUsersFailure(failure));
  }

  async function handleCreate(): Promise<boolean> {
    setCreateError(null);
    const result = await createUser({ email: form.email, full_name: form.fullName, roles: [form.role] });
    if (result.status !== "ok") {
      setCreateError(describeUsersFailure(result));
      return false;
    }
    setProblem(null);
    setTemporary({ email: result.value.email, password: result.value.temporary_password ?? "" });
    setForm((current) => ({ ...current, email: "", fullName: "" }));
    await reload();
    return true;
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
    <Card as="section" aria-label="Usuarios" className="flex flex-col gap-4">
      <SectionHeader title="Usuarios" description="Quién entra al sistema y con qué rol. Los permisos de cada rol se ajustan en «Permisos por rol»." />
      <AdminToolbar
        label="Filtros de usuarios"
        action={
          <Button size="sm" icon={Plus} onClick={() => setDialogOpen(true)}>
            Nuevo usuario
          </Button>
        }
      >
        <Input label="Buscar" value={query} placeholder="Nombre o correo" onChange={(event) => setQuery(event.target.value)} fieldClassName="w-56" />
        <Select label="Rol" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} fieldClassName="w-48">
          <option value="">Todos</option>
          {roles.map((role) => (
            <option key={role.code} value={role.code}>
              {role.name}
            </option>
          ))}
        </Select>
        <label className="flex min-h-9 items-center gap-2 pb-1 text-sm text-gris-texto">
          <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
          Incluir desactivados
        </label>
      </AdminToolbar>
      <Notice message={null} error={problem} />
      {temporary && <TemporaryPasswordNotice email={temporary.email} password={temporary.password} />}
      <UsersTable
        users={shown}
        roles={roles}
        onToggleActive={(user) => act(user, { is_active: !user.is_active })}
        onResetPassword={(user) => act(user, { reset_password: true })}
      />
      <FormDialog
        open={dialogOpen}
        title="Nuevo usuario"
        description="Se crea con una contraseña temporal que verá una sola vez."
        submitLabel="Crear usuario"
        error={createError}
        onClose={() => {
          setDialogOpen(false);
          setCreateError(null);
        }}
        onSubmit={handleCreate}
      >
        <Input label="Correo" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label="Nombre completo" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <RoleChoice roles={roles} value={form.role} onChange={(role) => setForm({ ...form, role })} />
      </FormDialog>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
// Permisos por rol
// ---------------------------------------------------------------------------------------------

const STATE_BADGE: Record<PackageState, { intent: "success" | "warning" | "default"; label: string }> = {
  all: { intent: "success", label: "todo" },
  partial: { intent: "warning", label: "parte" },
  none: { intent: "default", label: "nada" },
};

/** Un paquete: interruptor del paquete entero, conteo con su estado en palabras y sus permisos. */
export function PermissionPackageCard({
  pkg,
  working,
  disabled = false,
  onTogglePermission,
  onTogglePackage,
}: {
  pkg: PackageView;
  working: readonly string[];
  disabled?: boolean;
  onTogglePermission: (code: string) => void;
  onTogglePackage: (codes: string[]) => void;
}) {
  const codes = pkg.permissions.map((permission) => permission.code);
  const state = packageState(working, codes);
  const marked = codes.filter((code) => working.includes(code)).length;
  const badge = STATE_BADGE[state];
  return (
    <section aria-label={`Paquete ${pkg.label}`} data-state={state} className="flex flex-col gap-2 rounded-md border border-borde p-3">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="size-4 accent-terracota"
          checked={state === "all"}
          disabled={disabled}
          aria-label={`Marcar todo el paquete ${pkg.label}`}
          ref={(input) => {
            if (input) input.indeterminate = state === "partial";
          }}
          onChange={() => onTogglePackage(codes)}
        />
        <span className="text-sm font-semibold text-tinta">{pkg.label}</span>
        <Badge intent={badge.intent} className="ml-auto shrink-0 px-2 py-0 text-xs whitespace-nowrap">
          {marked} de {codes.length} · {badge.label}
        </Badge>
      </label>
      <ul className="flex flex-col gap-1">
        {pkg.permissions.map((permission) => (
          <li key={permission.code}>
            <label className="flex items-start gap-2 text-sm text-tinta" title={permission.code}>
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-terracota"
                checked={working.includes(permission.code)}
                disabled={disabled}
                onChange={() => onTogglePermission(permission.code)}
              />
              <span>{permission.description}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Rol elegido con botones: cada uno dice cuántos permisos tiene y si está desactivado. */
export function RoleButtons({ roles, value, onChange }: { roles: RoleOut[]; value: string; onChange: (code: string) => void }) {
  return (
    <div role="group" aria-label="Rol" className="flex flex-wrap gap-2">
      {roles.map((role) => (
        <button
          key={role.code}
          type="button"
          aria-pressed={role.code === value}
          onClick={() => onChange(role.code)}
          className={cn(
            "inline-flex min-h-9 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota",
            role.code === value ? "bg-terracota text-white" : "bg-crema text-tinta hover:bg-borde",
          )}
        >
          {role.name}
          <span className={cn("rounded-full px-1.5 text-xs", role.code === value ? "bg-white/25" : "bg-white")}>{role.permissions.length}</span>
          {!role.is_enabled && !role.name.includes("desactivado") && <span className="text-xs">desactivado</span>}
        </button>
      ))}
    </div>
  );
}

/** Barra fija mientras hay cambios: qué se agrega y retira, el motivo y guardar. */
export function PermissionSaveBar({
  diff,
  reason,
  onReason,
  onSave,
}: {
  diff: { added: string[]; removed: string[] };
  reason: string;
  onReason: (reason: string) => void;
  onSave: () => void;
}) {
  const needsReason = reason.trim().length < 3;
  return (
    <div role="region" aria-label="Guardar permisos" className="sticky bottom-0 flex flex-col gap-2 rounded-md border border-terracota bg-white p-3 shadow-md">
      <p className="flex flex-wrap items-center gap-2 text-sm text-tinta">
        {diff.added.length > 0 && <Badge intent="success" className="px-2 py-0 text-xs">Se agregan {diff.added.length}</Badge>}
        {diff.removed.length > 0 && <Badge intent="danger" className="px-2 py-0 text-xs">Se retiran {diff.removed.length}</Badge>}
        <span className="text-xs text-gris-texto">{[...diff.added.map((c) => `+ ${c}`), ...diff.removed.map((c) => `− ${c}`)].join("  ")}</span>
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <Input label="Motivo del cambio" hint="Queda en la auditoría junto con cada permiso." value={reason} onChange={(event) => onReason(event.target.value)} fieldClassName="min-w-64 flex-1" />
        <Button size="sm" onClick={onSave} disabled={needsReason}>
          Guardar permisos
        </Button>
      </div>
      {needsReason && <p className="text-xs text-gris-texto">Escriba el motivo (al menos 3 caracteres) para guardar.</p>}
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
  const packages = useMemo(() => packagePermissions(permissions), [permissions]);

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
    <Card as="section" aria-label="Matriz de permisos" className="flex flex-col gap-4">
      <SectionHeader title="Permisos por rol" description="Elija un rol y marque lo que puede hacer. Cada paquete agrupa permisos de una misma área." />
      <RoleButtons roles={roles} value={roleCode} onChange={choose} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {packages.map((pkg) => (
          <PermissionPackageCard
            key={pkg.id}
            pkg={pkg}
            working={working}
            onTogglePermission={(code) => setSelected(togglePermission(working, code))}
            onTogglePackage={(codes) => setSelected(togglePackage(working, codes))}
          />
        ))}
      </div>
      {dirty && <PermissionSaveBar diff={diff} reason={reason} onReason={setReason} onSave={save} />}
      {message && <Notice message={message.kind === "ok" ? message.text : null} error={message.kind === "error" ? message.text : null} />}
    </Card>
  );
}
