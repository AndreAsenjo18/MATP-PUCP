"use client";

/**
 * Pantalla 10 — Administración: usuarios y roles (RF-039), vocabularios/categorías (RN-010),
 * tipos de identificador (parametrizables, RN-010), ubicaciones (RF-016), papelera con
 * restauración (RN-005) y consulta global de auditoría con exportación a CSV (RF-040, RF-041);
 * las dos últimas son la tarea 5.2 de `auditoria-y-soft-delete-transversal`. Plantillas de mapeo
 * y normalización (marcadores de ausencia, separadores y siglas históricas): tarea 4.2 de
 * `plantillas-mapeo-y-normalizacion`, solo en modo `live`; se abren directamente con
 * `?pestana=plantillas` y `?pestana=normalizacion`. Colecciones, vocabularios y tipos de
 * identificador en modo `live`: tareas 5.1 y 5.2 de `colecciones-y-vocabularios-admin`
 * (`?pestana=colecciones`, `vocabularios`, `tipos`). Exportación completa de la base en formato
 * abierto (RF-044): tarea 4.2 de `busqueda-avanzada-y-exportacion`, `?pestana=exportacion`.
 */
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { AuditLogPanel } from "@/components/domain/AuditLogPanel";
import { MappingTemplatesLive } from "@/components/domain/MappingTemplatesAdmin";
import { NormalizationLive } from "@/components/domain/NormalizationAdmin";
import { StatusBadge } from "@/components/domain/StatusBadges";
import { TrashPanel } from "@/components/domain/TrashPanel";
import { CollectionsLive, IdentifierTypesLive, VocabulariesLive } from "@/components/domain/VocabulariesAdmin";
import { FullExportPanel } from "@/components/domain/SearchLive";
import { PermissionMatrixLive, UsersLive } from "@/components/domain/UsersAdmin";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { RequireSession } from "@/components/layout/RequireSession";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { toEntryView } from "@/lib/data/audit";
import { useMockStore } from "@/lib/data/mock-store";
import {
  createLocation,
  fetchLocationsTree,
  LOCATION_ERROR_MESSAGES,
  updateLocation,
  type LocationFailure,
  type LocationLevelLabel,
  type LocationNode,
} from "@/lib/data/locations";
import { getApiMode } from "@/lib/data/mode";
import { IDENTIFIER_TYPES, LOCATIONS, locationPath, ROLES, USERS, VOCABULARIES, termsByVocabulary } from "@/lib/fixtures";

const LOCATION_LEVELS: LocationLevelLabel[] = ["Sede", "Depósito", "Mueble", "Nivel", "Contenedor"];

function flattenLocationTree(nodes: LocationNode[], prefix: string[] = []): { id: string; label: string }[] {
  return nodes.flatMap((node) => {
    const path = [...prefix, node.name];
    return [{ id: node.id, label: path.join(" › ") }, ...flattenLocationTree(node.children ?? [], path)];
  });
}

function describeLocationFailure(failure: LocationFailure): string {
  if (failure.status === "unavailable") return failure.message;
  return LOCATION_ERROR_MESSAGES[failure.code] ?? failure.message;
}

function LocationTreeView({
  nodes,
  depth = 0,
  onDeactivate,
}: {
  nodes: LocationNode[];
  depth?: number;
  onDeactivate: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {nodes.map((node) => (
        <li key={node.id}>
          <p className="flex items-center gap-2 text-base text-tinta" style={{ paddingLeft: `${depth * 16}px` }}>
            {node.name} <span className="text-sm text-gris-texto">({node.level_type})</span>
            {node.level_type === "Contenedor" && (
              <button type="button" onClick={() => onDeactivate(node.id)} className="text-sm text-terracota underline">
                Desactivar
              </button>
            )}
          </p>
          {node.children && node.children.length > 0 && <LocationTreeView nodes={node.children} depth={depth + 1} onDeactivate={onDeactivate} />}
        </li>
      ))}
    </ul>
  );
}

function UbicacionesLive() {
  const { currentUser } = useSession();
  const devUser = currentUser?.email;
  const [tree, setTree] = useState<LocationNode[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ level: "Depósito" as LocationLevelLabel, code: "", name: "", parentId: "" });

  async function reload() {
    const result = await fetchLocationsTree(devUser);
    if (result.status === "ok") setTree(result.value);
  }

  useEffect(() => {
    let active = true;
    fetchLocationsTree(devUser).then((result) => {
      if (active && result.status === "ok") setTree(result.value);
    });
    return () => {
      active = false;
    };
  }, [devUser]);

  const flat = flattenLocationTree(tree);

  async function handleDeactivate(locationId: string) {
    setError(null);
    setMessage(null);
    const result = await updateLocation(locationId, { is_active: false }, devUser);
    if (result.status === "ok") {
      setMessage("Ubicación desactivada.");
      await reload();
    } else {
      setError(describeLocationFailure(result));
    }
  }

  async function handleCreate() {
    if (!form.code.trim() || !form.name.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await createLocation(
      {
        level: form.level,
        code: form.code.trim(),
        name: form.name.trim(),
        parent_id: form.parentId || null,
      },
      devUser,
    );
    setBusy(false);
    if (result.status === "ok") {
      setMessage(`Ubicación "${result.value.name}" creada.`);
      setForm((current) => ({ ...current, code: "", name: "" }));
      await reload();
    } else {
      setError(describeLocationFailure(result));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card as="section" aria-label="Árbol de ubicaciones">
        {tree.length === 0 ? (
          <p className="text-base text-gris-texto">Sin ubicaciones registradas todavía.</p>
        ) : (
          <LocationTreeView nodes={tree} onDeactivate={handleDeactivate} />
        )}
      </Card>

      <Card as="section" aria-label="Crear ubicación" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-tinta">Crear ubicación</h2>
        <Select label="Nivel" value={form.level} onChange={(event) => setForm((c) => ({ ...c, level: event.target.value as LocationLevelLabel }))}>
          {LOCATION_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </Select>
        <Select label="Ubicación padre" value={form.parentId} onChange={(event) => setForm((c) => ({ ...c, parentId: event.target.value }))}>
          <option value="">Sin padre (solo para Sede)</option>
          {flat.map((location) => (
            <option key={location.id} value={location.id}>
              {location.label}
            </option>
          ))}
        </Select>
        <Input label="Código" value={form.code} onChange={(event) => setForm((c) => ({ ...c, code: event.target.value }))} placeholder="p. ej. DEP2-RB" />
        <Input label="Nombre" value={form.name} onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))} placeholder="p. ej. Rack B" />
        <Button disabled={busy} onClick={handleCreate}>
          Crear
        </Button>
        {message && <p className="rounded-md bg-verde-bg px-3 py-2 text-base text-verde-exito">{message}</p>}
        {error && <p className="rounded-md bg-carmin-peligro/10 px-3 py-2 text-base text-carmin-texto">{error}</p>}
      </Card>
    </div>
  );
}

const TABS = ["Usuarios y roles", "Colecciones", "Vocabularios", "Tipos de identificador", "Ubicaciones", "Plantillas de mapeo", "Normalización", "Papelera", "Auditoría", "Exportación completa"] as const;
type Tab = (typeof TABS)[number];

/** Pestañas que se abren por URL (`/administracion?pestana=plantillas`). */
const TAB_SLUGS: Record<string, Tab> = {
  colecciones: "Colecciones",
  vocabularios: "Vocabularios",
  tipos: "Tipos de identificador",
  plantillas: "Plantillas de mapeo",
  normalizacion: "Normalización",
  exportacion: "Exportación completa",
};

function LiveOnlyNotice() {
  return (
    <Card as="section">
      <p className="text-base text-gris-texto">Disponible con la API (modo live).</p>
    </Card>
  );
}

/**
 * Consulta global de auditoría. En modo demostración el historial son las filas del store de la
 * sesión; en `live` las trae la API (igual que la pestaña «Auditoría» de la ficha de pieza).
 */
function AuditSection() {
  const { auditLog } = useMockStore();
  const live = getApiMode() === "live";
  const entries = useMemo(() => (live ? undefined : auditLog.map(toEntryView)), [live, auditLog]);
  return <AuditLogPanel demoEntries={entries} />;
}

function AdministracionContent() {
  const { hasPermission, currentRole } = useSession();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(TAB_SLUGS[params.get("pestana") ?? ""] ?? "Usuarios y roles");
  const [selectedVocabulary, setSelectedVocabulary] = useState(VOCABULARIES[0]?.code ?? "");

  const canOpenTrash = hasPermission("pieces.restore");
  const canReadAudit = hasPermission("audit.read");

  if (
    !hasPermission("users.manage") &&
    !hasPermission("vocabularies.manage") &&
    !hasPermission("collections.manage") &&
    !hasPermission("locations.manage") &&
    !hasPermission("imports.prepare") &&
    !canOpenTrash &&
    !canReadAudit &&
    !hasPermission("exports.full")
  ) {
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
          getApiMode() === "live" ? (
            <div className="flex flex-col gap-4">
              <UsersLive />
              <PermissionMatrixLive />
            </div>
          ) : (
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
          )
        ) : (
          <PermissionNotice>Su rol no tiene permiso para administrar usuarios y roles.</PermissionNotice>
        ))}

      {tab === "Colecciones" &&
        (hasPermission("collections.manage") || hasPermission("vocabularies.manage") ? (
          getApiMode() === "live" ? (
            <CollectionsLive />
          ) : (
            <LiveOnlyNotice />
          )
        ) : (
          <PermissionNotice>Su rol no tiene permiso para administrar colecciones.</PermissionNotice>
        ))}

      {tab === "Vocabularios" &&
        (hasPermission("vocabularies.manage") ? (
          getApiMode() === "live" ? (
            <VocabulariesLive />
          ) : (
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
          )
        ) : (
          <PermissionNotice>Su rol no tiene permiso para administrar vocabularios.</PermissionNotice>
        ))}

      {tab === "Tipos de identificador" &&
        (hasPermission("vocabularies.manage") ? (
          getApiMode() === "live" ? (
            <IdentifierTypesLive />
          ) : (
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
          )
        ) : (
          <PermissionNotice>Su rol no tiene permiso para administrar tipos de identificador.</PermissionNotice>
        ))}

      {tab === "Ubicaciones" &&
        (hasPermission("locations.manage") ? (
          getApiMode() === "live" ? (
            <UbicacionesLive />
          ) : (
            <Card as="section" aria-label="Ubicaciones">
              <ul className="flex flex-col gap-1">
                {LOCATIONS.map((location) => (
                  <li key={location.id} className="text-base text-tinta" style={{ paddingLeft: `${(locationPath(location.id).length - 1) * 16}px` }}>
                    {location.name} <span className="text-sm text-gris-texto">({location.level})</span>
                  </li>
                ))}
              </ul>
            </Card>
          )
        ) : (
          <PermissionNotice>Su rol no tiene permiso para administrar ubicaciones.</PermissionNotice>
        ))}

      {tab === "Plantillas de mapeo" &&
        (hasPermission("imports.prepare") ? (
          getApiMode() === "live" ? (
            <MappingTemplatesLive />
          ) : (
            <LiveOnlyNotice />
          )
        ) : (
          <PermissionNotice>Su rol no tiene permiso para administrar plantillas de mapeo.</PermissionNotice>
        ))}

      {tab === "Normalización" &&
        (hasPermission("vocabularies.manage") ? (
          getApiMode() === "live" ? (
            <NormalizationLive />
          ) : (
            <LiveOnlyNotice />
          )
        ) : (
          <PermissionNotice>Su rol no tiene permiso para administrar los parámetros de normalización.</PermissionNotice>
        ))}

      {tab === "Papelera" &&
        (canOpenTrash ? (
          // Abrir la papelera exige `pieces.restore`; restaurar es solo del Administrador (el servidor lo vuelve a comprobar).
          <TrashPanel canRestore={currentRole?.code === "ADMIN"} />
        ) : (
          <PermissionNotice>Su rol no tiene permiso para abrir la papelera.</PermissionNotice>
        ))}

      {tab === "Auditoría" &&
        (canReadAudit ? <AuditSection /> : <PermissionNotice>Su rol no tiene permiso para consultar la auditoría (RF-040).</PermissionNotice>)}

      {tab === "Exportación completa" &&
        (hasPermission("exports.full") ? (
          getApiMode() === "live" ? (
            <FullExportPanel />
          ) : (
            <LiveOnlyNotice />
          )
        ) : (
          <PermissionNotice>Solo el Administrador puede exportar la base completa (RF-044).</PermissionNotice>
        ))}
    </div>
  );
}

export default function AdministracionPage() {
  return (
    <RequireSession>
      <Suspense fallback={null}>
        <AdministracionContent />
      </Suspense>
    </RequireSession>
  );
}
