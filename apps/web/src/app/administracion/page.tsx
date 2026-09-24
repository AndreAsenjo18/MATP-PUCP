"use client";

/**
 * Pantalla 10 — Administración: usuarios y roles (RF-039), vocabularios/categorías (RN-010),
 * tipos de identificador (parametrizables, RN-010) y ubicaciones (RF-016).
 */
import { useState } from "react";

import { StatusBadge } from "@/components/domain/StatusBadges";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { RequireSession } from "@/components/layout/RequireSession";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
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
        <h1 className="text-2xl font-bold text-tinta">Administración</h1>
        <p className="text-base text-gris-texto">Datos parametrizables (RN-010): se pueden ajustar sin cambiar código.</p>
      </header>

      <div role="tablist" aria-label="Secciones de administración" className="flex flex-wrap gap-1 border-b border-borde">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "min-h-11 rounded-t-md px-3 py-2 text-base font-medium focus-visible:outline-2 focus-visible:outline-terracota",
              tab === t ? "border-b-2 border-terracota text-terracota" : "text-gris-texto hover:text-tinta",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Usuarios y roles" &&
        (hasPermission("users.manage") ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="overflow-x-auto">
              <h2 className="text-lg font-semibold text-tinta">Usuarios</h2>
              <table className="mt-2 w-full text-left text-base">
                <thead className="text-sm text-gris-texto">
                  <tr>
                    <th className="py-1 pr-2 font-medium">Nombre</th>
                    <th className="py-1 pr-2 font-medium">Rol</th>
                    <th className="py-1 pr-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {USERS.map((u) => (
                    <tr key={u.id} className="border-t border-borde">
                      <td className="py-1 pr-2 text-tinta">{u.full_name}</td>
                      <td className="py-1 pr-2 text-gris-texto">{ROLES.find((r) => r.code === u.roles[0])?.name}</td>
                      <td className="py-1 pr-2">
                        <StatusBadge status={u.is_active ? { label: "Activo", intent: "success" } : { label: "Desactivado", intent: "default" }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card>
              <h2 className="text-lg font-semibold text-tinta">Roles y permisos</h2>
              <ul className="mt-2 flex flex-col gap-3">
                {ROLES.map((role) => (
                  <li key={role.code}>
                    <p className="flex flex-wrap items-center gap-2 font-medium text-tinta">
                      {role.name} {!role.is_enabled && <Badge>Desactivado en fase 1</Badge>}
                    </p>
                    <p className="text-sm text-gris-texto">
                      {role.permissions.length} permisos — {role.description}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
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
                    aria-pressed={selectedVocabulary === v.code}
                    onClick={() => setSelectedVocabulary(v.code)}
                    className={cn(
                      "min-h-11 w-full rounded-md px-3 py-2 text-left text-base focus-visible:outline-2 focus-visible:outline-terracota",
                      selectedVocabulary === v.code ? "bg-terracota text-white" : "text-tinta hover:bg-crema",
                    )}
                  >
                    {v.name} ({v.term_count})
                  </button>
                </li>
              ))}
            </ul>
            <Card>
              <h2 className="text-lg font-semibold text-tinta">{VOCABULARIES.find((v) => v.code === selectedVocabulary)?.name}</h2>
              <ul className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
                {termsByVocabulary(selectedVocabulary).map((term) => (
                  <li key={term.id} className="rounded-md bg-crema-light px-2 py-1 text-base text-tinta">
                    {term.label}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ) : (
          <PermissionNotice>Su rol no tiene permiso para administrar vocabularios.</PermissionNotice>
        ))}

      {tab === "Tipos de identificador" &&
        (hasPermission("vocabularies.manage") ? (
          <Card className="overflow-x-auto">
            <table className="w-full text-left text-base">
              <thead className="text-sm text-gris-texto">
                <tr>
                  <th className="py-1 pr-4 font-medium">Código</th>
                  <th className="py-1 pr-4 font-medium">Etiqueta</th>
                  <th className="py-1 pr-4 font-medium">Único vigente</th>
                  <th className="py-1 pr-4 font-medium">Bloquea al asignar</th>
                  <th className="py-1 pr-4 font-medium">Solo piezas propias</th>
                </tr>
              </thead>
              <tbody className="text-tinta">
                {IDENTIFIER_TYPES.map((type) => (
                  <tr key={type.code} className="border-t border-borde">
                    <td className="py-1 pr-4 font-medium">{type.code}</td>
                    <td className="py-1 pr-4 text-gris-texto">{type.label}</td>
                    <td className="py-1 pr-4">{type.is_unique_when_current ? "Sí" : "No"}</td>
                    <td className="py-1 pr-4">{type.locks_on_assignment ? "Sí (RN-002)" : "No"}</td>
                    <td className="py-1 pr-4">{type.owned_pieces_only ? "Sí (RN-003)" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <PermissionNotice>Su rol no tiene permiso para administrar tipos de identificador.</PermissionNotice>
        ))}

      {tab === "Ubicaciones" &&
        (hasPermission("locations.manage") ? (
          <Card as="section" aria-label="Ubicaciones">
            <ul className="flex flex-col gap-1">
              {LOCATIONS.map((location) => (
                <li key={location.id} className="text-base text-tinta" style={{ paddingLeft: `${(locationPath(location.id).length - 1) * 16}px` }}>
                  {location.name} <span className="text-sm text-gris-texto">({location.level})</span>
                </li>
              ))}
            </ul>
          </Card>
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
