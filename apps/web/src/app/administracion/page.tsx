"use client";

/**
 * Pantalla 10 — Administración, organizada en cuatro áreas (change `rediseno-ux-administracion`):
 * Personas (usuarios y permisos por rol, RF-039), Catálogo (colecciones, ubicaciones, listas de
 * valores y tipos de código; RN-010, RF-016), Importación (formatos de archivo y lectura de códigos;
 * RF-022, RF-023) y Control (papelera, auditoría y exportación completa; RN-005, RF-040, RF-044).
 * Cada sección se ve solo con el permiso que la gobierna (`AdminShell`). Se abre directamente con
 * `?pestana=<sección>`; las direcciones anteriores (`plantillas`, `normalizacion`, `colecciones`,
 * `vocabularios`, `tipos`, `exportacion`) siguen valiendo. En modo demostración las secciones que
 * necesitan la API muestran un aviso.
 */
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { AdminNav, SectionHeader, initialSection, visibleSections } from "@/components/domain/AdminShell";
import { AuditLogPanel } from "@/components/domain/AuditLogPanel";
import { LocationsLive } from "@/components/domain/LocationsAdmin";
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
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { useSession } from "@/lib/auth/session";
import { toEntryView } from "@/lib/data/audit";
import { useMockStore } from "@/lib/data/mock-store";
import { getApiMode } from "@/lib/data/mode";
import { IDENTIFIER_TYPES, LOCATIONS, locationPath, ROLES, USERS, VOCABULARIES, termsByVocabulary } from "@/lib/fixtures";

function LiveOnlyNotice() {
  return (
    <Card as="section">
      <p className="text-sm text-gris-texto">Disponible con la API (modo live).</p>
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

/** Usuarios y roles de la demostración (solo lectura, datos sintéticos). */
function DemoUsers() {
  return (
    <Card className="flex flex-col gap-3 overflow-x-auto">
      <SectionHeader title="Usuarios" description="Datos sintéticos de la demostración." />
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-gris-texto">
          <tr>
            <th className="py-1.5 pr-3 font-medium">Nombre</th>
            <th className="py-1.5 pr-3 font-medium">Rol</th>
            <th className="py-1.5 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {USERS.map((u) => (
            <tr key={u.id} className="border-t border-borde">
              <td className="py-1.5 pr-3 text-tinta">{u.full_name}</td>
              <td className="py-1.5 pr-3 text-gris-texto">{ROLES.find((r) => r.code === u.roles[0])?.name}</td>
              <td className="py-1.5">
                <StatusBadge status={u.is_active ? { label: "Activo", intent: "success" } : { label: "Desactivado", intent: "default" }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function DemoRoles() {
  return (
    <Card className="flex flex-col gap-3">
      <SectionHeader title="Permisos por rol" description="Datos sintéticos de la demostración." />
      <ul className="flex flex-col gap-2">
        {ROLES.map((role) => (
          <li key={role.code}>
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-tinta">
              {role.name} {!role.is_enabled && <Badge className="px-2 py-0 text-xs">Desactivado en fase 1</Badge>}
            </p>
            <p className="text-xs text-gris-texto">
              {role.permissions.length} permisos · {role.description}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DemoVocabularies() {
  const [selected, setSelected] = useState(VOCABULARIES[0]?.code ?? "");
  return (
    <Card className="flex flex-col gap-3">
      <SectionHeader title="Listas de valores" description="Las opciones que se eligen al llenar una ficha, como materiales, técnicas o estados de conservación." />
      <Select label="Lista" value={selected} onChange={(event) => setSelected(event.target.value)} fieldClassName="w-64">
        {VOCABULARIES.map((v) => (
          <option key={v.code} value={v.code}>
            {v.name} · {v.term_count}
          </option>
        ))}
      </Select>
      <ul className="flex flex-wrap gap-2">
        {termsByVocabulary(selected).map((term) => (
          <li key={term.id} className="rounded-full bg-verde-bg px-3 py-1 text-sm font-medium text-verde-exito">
            {term.label}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DemoIdentifierTypes() {
  return (
    <Card className="flex flex-col gap-3 overflow-x-auto">
      <SectionHeader title="Tipos de código" description="Las clases de código que puede tener una pieza." />
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-gris-texto">
          <tr>
            <th className="py-1.5 pr-3 font-medium">Código</th>
            <th className="py-1.5 pr-3 font-medium">Etiqueta</th>
            <th className="py-1.5 pr-3 font-medium">Único vigente</th>
            <th className="py-1.5 pr-3 font-medium">Bloquea al asignar</th>
            <th className="py-1.5 font-medium">Solo piezas propias</th>
          </tr>
        </thead>
        <tbody className="text-tinta">
          {IDENTIFIER_TYPES.map((type) => (
            <tr key={type.code} className="border-t border-borde">
              <td className="py-1.5 pr-3 font-mono font-medium">{type.code}</td>
              <td className="py-1.5 pr-3 text-gris-texto">{type.label}</td>
              <td className="py-1.5 pr-3">{type.is_unique_when_current ? "Sí" : "No"}</td>
              <td className="py-1.5 pr-3">{type.locks_on_assignment ? "Sí" : "No"}</td>
              <td className="py-1.5">{type.owned_pieces_only ? "Sí" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function DemoLocations() {
  return (
    <Card as="section" aria-label="Ubicaciones" className="flex flex-col gap-3">
      <SectionHeader title="Ubicaciones" description="Dónde se guardan las piezas: sede, depósito, mueble, nivel y contenedor." />
      <ul className="flex flex-col gap-0.5">
        {LOCATIONS.map((location) => (
          <li key={location.id} className="text-sm text-tinta" style={{ paddingLeft: `${(locationPath(location.id).length - 1) * 20}px` }}>
            {location.name} <span className="text-xs text-gris-texto">({location.level})</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AdminSectionView({ slug }: { slug: string }) {
  const { currentRole } = useSession();
  const live = getApiMode() === "live";
  switch (slug) {
    case "usuarios":
      return live ? <UsersLive /> : <DemoUsers />;
    case "permisos":
      return live ? <PermissionMatrixLive /> : <DemoRoles />;
    case "colecciones":
      return live ? <CollectionsLive /> : <LiveOnlyNotice />;
    case "ubicaciones":
      return live ? <LocationsLive /> : <DemoLocations />;
    case "vocabularios":
      return live ? <VocabulariesLive /> : <DemoVocabularies />;
    case "tipos":
      return live ? <IdentifierTypesLive /> : <DemoIdentifierTypes />;
    case "plantillas":
      return live ? <MappingTemplatesLive /> : <LiveOnlyNotice />;
    case "normalizacion":
      return live ? <NormalizationLive /> : <LiveOnlyNotice />;
    case "papelera":
      // Abrir la papelera exige `trash.read`; restaurar es solo del Administrador (el servidor lo vuelve a comprobar).
      return <TrashPanel canRestore={currentRole?.code === "ADMIN"} />;
    case "auditoria":
      return <AuditSection />;
    case "exportacion":
      return live ? <FullExportPanel /> : <LiveOnlyNotice />;
    default:
      return null;
  }
}

function AdministracionContent() {
  const { hasPermission } = useSession();
  const params = useSearchParams();
  const sections = useMemo(() => visibleSections(hasPermission), [hasPermission]);
  const [requested, setRequested] = useState<string | null>(null);
  const current = initialSection(requested ?? params.get("pestana"), sections);

  if (!current) {
    return <PermissionNotice>Su rol no tiene permiso para administrar el sistema. Cambie de rol desde la cabecera para probarlo.</PermissionNotice>;
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-tinta">Administración</h1>
        <p className="text-base text-gris-texto">Personas, catálogo, importación y control del sistema.</p>
      </header>

      <AdminNav sections={sections} current={current.slug} onSelect={setRequested} />

      <AdminSectionView slug={current.slug} />
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
