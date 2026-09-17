"use client";

/**
 * Pantalla 10 — Administración: usuarios y roles (RF-039), vocabularios/categorías (RN-010),
 * tipos de identificador (parametrizables, RN-010) y ubicaciones (RF-016).
 */
import { useState } from "react";

import { PermissionNotice } from "@/components/AppShell";
import { StatusBadge } from "@/components/Badges";
import { RequireSession } from "@/components/RequireSession";
import { useSession } from "@/lib/auth/session";
import { IDENTIFIER_TYPES, LOCATIONS, locationPath, ROLES, USERS, VOCABULARIES, termsByVocabulary } from "@/lib/fixtures";

const TABS = ["Usuarios y roles", "Vocabularios", "Tipos de identificador", "Ubicaciones"] as const;
type Tab = (typeof TABS)[number];

function AdministracionContent() {
  const { hasPermission } = useSession();
  const [tab, setTab] = useState<Tab>("Usuarios y roles");
  const [selectedVocabulary, setSelectedVocabulary] = useState(VOCABULARIES[0]?.code ?? "");

  if (!hasPermission("users.manage") && !hasPermission("vocabularies.manage") && !hasPermission("locations.manage")) {
    return <PermissionNotice>Su rol no tiene permiso para administrar el sistema. Cambie de rol desde la cabecera para probarlo.</PermissionNotice>;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-stone-900">Administración</h1>
        <p className="text-base text-stone-700">Datos parametrizables (RN-010): se pueden ajustar sin cambiar código.</p>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-stone-200">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-t-md px-3 py-2 text-base font-medium ${tab === t ? "border-b-2 border-stone-900 text-stone-900" : "text-stone-600 hover:text-stone-900"}`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "Usuarios y roles" &&
        (hasPermission("users.manage") ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <h2 className="text-lg font-semibold text-stone-900">Usuarios</h2>
              <table className="mt-2 w-full text-left text-base">
                <thead className="text-sm text-stone-600">
                  <tr>
                    <th className="py-1 pr-2 font-medium">Nombre</th>
                    <th className="py-1 pr-2 font-medium">Rol</th>
                    <th className="py-1 pr-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {USERS.map((u) => (
                    <tr key={u.id} className="border-t border-stone-100">
                      <td className="py-1 pr-2 text-stone-900">{u.full_name}</td>
                      <td className="py-1 pr-2 text-stone-700">{ROLES.find((r) => r.code === u.roles[0])?.name}</td>
                      <td className="py-1 pr-2">
                        <StatusBadge label={u.is_active ? "Activo" : "Desactivado"} tone={u.is_active ? "approved" : "neutral"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <h2 className="text-lg font-semibold text-stone-900">Roles y permisos</h2>
              <ul className="mt-2 flex flex-col gap-3">
                {ROLES.map((role) => (
                  <li key={role.code}>
                    <p className="font-medium text-stone-900">
                      {role.name} {!role.is_enabled && <span className="text-sm text-stone-500">(desactivado en fase 1)</span>}
                    </p>
                    <p className="text-sm text-stone-600">{role.permissions.length} permisos — {role.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <PermissionNotice>Su rol no tiene permiso para administrar usuarios y roles.</PermissionNotice>
        ))}

      {tab === "Vocabularios" &&
        (hasPermission("vocabularies.manage") ? (
          <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
            <ul className="flex flex-col gap-1">
              {VOCABULARIES.map((v) => (
                <li key={v.code}>
                  <button
                    type="button"
                    onClick={() => setSelectedVocabulary(v.code)}
                    className={`w-full rounded-md px-3 py-2 text-left text-base ${selectedVocabulary === v.code ? "bg-stone-900 text-white" : "text-stone-900 hover:bg-stone-100"}`}
                  >
                    {v.name} ({v.term_count})
                  </button>
                </li>
              ))}
            </ul>
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <h2 className="text-lg font-semibold text-stone-900">{VOCABULARIES.find((v) => v.code === selectedVocabulary)?.name}</h2>
              <ul className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
                {termsByVocabulary(selectedVocabulary).map((term) => (
                  <li key={term.id} className="rounded-md bg-stone-50 px-2 py-1 text-base text-stone-900">
                    {term.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <PermissionNotice>Su rol no tiene permiso para administrar vocabularios.</PermissionNotice>
        ))}

      {tab === "Tipos de identificador" &&
        (hasPermission("vocabularies.manage") ? (
          <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white p-4">
            <table className="w-full text-left text-base">
              <thead className="text-sm text-stone-600">
                <tr>
                  <th className="py-1 pr-4 font-medium">Código</th>
                  <th className="py-1 pr-4 font-medium">Etiqueta</th>
                  <th className="py-1 pr-4 font-medium">Único vigente</th>
                  <th className="py-1 pr-4 font-medium">Bloquea al asignar</th>
                  <th className="py-1 pr-4 font-medium">Solo piezas propias</th>
                </tr>
              </thead>
              <tbody>
                {IDENTIFIER_TYPES.map((type) => (
                  <tr key={type.code} className="border-t border-stone-100">
                    <td className="py-1 pr-4 font-medium text-stone-900">{type.code}</td>
                    <td className="py-1 pr-4 text-stone-700">{type.label}</td>
                    <td className="py-1 pr-4">{type.is_unique_when_current ? "Sí" : "No"}</td>
                    <td className="py-1 pr-4">{type.locks_on_assignment ? "Sí (RN-002)" : "No"}</td>
                    <td className="py-1 pr-4">{type.owned_pieces_only ? "Sí (RN-003)" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <PermissionNotice>Su rol no tiene permiso para administrar tipos de identificador.</PermissionNotice>
        ))}

      {tab === "Ubicaciones" &&
        (hasPermission("locations.manage") ? (
          <ul className="flex flex-col gap-1 rounded-lg border border-stone-200 bg-white p-4">
            {LOCATIONS.map((location) => (
              <li key={location.id} className="text-base text-stone-900" style={{ paddingLeft: `${(locationPath(location.id).length - 1) * 16}px` }}>
                {location.name} <span className="text-sm text-stone-500">({location.level})</span>
              </li>
            ))}
          </ul>
        ) : (
          <PermissionNotice>Su rol no tiene permiso para administrar ubicaciones.</PermissionNotice>
        ))}
    </div>
  );
}

export default function AdministracionPage() {
  return (
    <RequireSession>
      <AdministracionContent />
    </RequireSession>
  );
}
