"use client";

/**
 * Estructura común de Administración (change `rediseno-ux-administracion`; spec plataforma,
 * «Administración agrupada por funciones», «Barra superior con filtros y alta en diálogo»):
 *
 * - `ADMIN_SECTIONS` y sus funciones puras: las secciones de Administración agrupadas en cuatro áreas
 *   (Personas, Catálogo, Importación y Control), con el permiso que gobierna cada una y los alias de
 *   las direcciones `?pestana=` que ya existían.
 * - `AdminNav`: fila de áreas y, debajo, las secciones del área elegida.
 * - `AdminToolbar`: filtros a la izquierda y el botón «Nuevo …» a la derecha, sobre cada listado.
 * - `FormDialog`: diálogo modal para los formularios de alta; se cierra solo si guardar tuvo éxito y
 *   conserva lo escrito si falla.
 * - `SectionHeader` y `Notice`: título corto con su explicación y avisos de resultado.
 */
import { FileSpreadsheet, Library, ShieldCheck, Users, X, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export type AdminArea = "personas" | "catalogo" | "importacion" | "control";

export interface AdminSection {
  /** Dirección de la sección: `/administracion?pestana=<slug>`. */
  slug: string;
  label: string;
  area: AdminArea;
  /** Basta con uno de estos permisos para ver la sección. */
  permissions: readonly string[];
}

export const ADMIN_AREAS: { id: AdminArea; label: string; icon: LucideIcon }[] = [
  { id: "personas", label: "Personas", icon: Users },
  { id: "catalogo", label: "Catálogo", icon: Library },
  { id: "importacion", label: "Importación", icon: FileSpreadsheet },
  { id: "control", label: "Control", icon: ShieldCheck },
];

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { slug: "usuarios", label: "Usuarios", area: "personas", permissions: ["users.manage"] },
  { slug: "permisos", label: "Permisos por rol", area: "personas", permissions: ["users.manage"] },
  { slug: "colecciones", label: "Colecciones", area: "catalogo", permissions: ["collections.manage", "vocabularies.manage"] },
  { slug: "ubicaciones", label: "Ubicaciones", area: "catalogo", permissions: ["locations.manage"] },
  { slug: "vocabularios", label: "Listas de valores", area: "catalogo", permissions: ["vocabularies.manage"] },
  { slug: "tipos", label: "Tipos de código", area: "catalogo", permissions: ["vocabularies.manage"] },
  { slug: "plantillas", label: "Formatos de archivo", area: "importacion", permissions: ["imports.prepare"] },
  { slug: "normalizacion", label: "Lectura de códigos", area: "importacion", permissions: ["vocabularies.manage"] },
  { slug: "papelera", label: "Papelera", area: "control", permissions: ["trash.read"] },
  { slug: "auditoria", label: "Auditoría", area: "control", permissions: ["audit.read"] },
  { slug: "exportacion", label: "Exportación completa", area: "control", permissions: ["exports.full"] },
];

/** Secciones que el rol puede usar, en el orden de `ADMIN_SECTIONS`. */
export function visibleSections(hasPermission: (permission: string) => boolean): AdminSection[] {
  return ADMIN_SECTIONS.filter((section) => section.permissions.some(hasPermission));
}

/** Áreas con al menos una sección visible, con sus secciones; las áreas vacías se omiten. */
export function visibleAreas(sections: readonly AdminSection[]): { id: AdminArea; label: string; icon: LucideIcon; sections: AdminSection[] }[] {
  return ADMIN_AREAS.map((area) => ({ ...area, sections: sections.filter((section) => section.area === area.id) })).filter((area) => area.sections.length > 0);
}

/** La sección de una dirección `?pestana=`, o `undefined` si no existe. */
export function sectionFromSlug(slug: string | null | undefined): AdminSection | undefined {
  return ADMIN_SECTIONS.find((section) => section.slug === slug);
}

/** Sección con la que se abre la pantalla: la de la dirección si el rol la puede ver, o la primera visible. */
export function initialSection(slug: string | null | undefined, sections: readonly AdminSection[]): AdminSection | undefined {
  const requested = sectionFromSlug(slug);
  return sections.find((section) => section.slug === requested?.slug) ?? sections[0];
}

// ---------------------------------------------------------------------------------------------
// Navegación
// ---------------------------------------------------------------------------------------------

export function AdminNav({ sections, current, onSelect }: { sections: readonly AdminSection[]; current: string; onSelect: (slug: string) => void }) {
  const areas = visibleAreas(sections);
  const active = areas.find((area) => area.sections.some((section) => section.slug === current)) ?? areas[0];
  if (!active) return null;
  return (
    <nav aria-label="Administración" className="flex flex-col gap-3">
      <div role="tablist" aria-label="Áreas de administración" className="flex flex-wrap gap-2">
        {areas.map((area) => {
          const Icon = area.icon;
          const selected = area.id === active.id;
          return (
            <button
              key={area.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onSelect(area.sections[0].slug)}
              className={cn(
                "inline-flex min-h-9 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota",
                selected ? "bg-terracota text-white" : "bg-crema text-tinta hover:bg-borde",
              )}
            >
              <Icon size={16} aria-hidden="true" />
              {area.label}
            </button>
          );
        })}
      </div>
      <div role="tablist" aria-label={`Secciones de ${active.label}`} className="flex flex-wrap gap-1 border-b border-borde">
        {active.sections.map((section) => {
          const selected = section.slug === current;
          return (
            <button
              key={section.slug}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-current={selected ? "page" : undefined}
              onClick={() => onSelect(section.slug)}
              className={cn(
                "min-h-9 rounded-t-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-terracota",
                selected ? "border-b-2 border-terracota text-terracota" : "text-gris-texto hover:text-tinta",
              )}
            >
              {section.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------------------------
// Encabezado, barra y avisos
// ---------------------------------------------------------------------------------------------

export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 className="text-lg font-semibold text-tinta">{title}</h2>
      {description && <p className="text-sm text-gris-texto">{description}</p>}
    </div>
  );
}

/** Filtros a la izquierda (`children`) y la acción de alta a la derecha (`action`, ausente sin permiso). */
export function AdminToolbar({ children, action, label }: { children?: ReactNode; action?: ReactNode; label: string }) {
  return (
    <div role="search" aria-label={label} className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-wrap items-end gap-2">{children}</div>
      {action}
    </div>
  );
}

export function Notice({ message, error }: { message: string | null; error: string | null }) {
  return (
    <>
      {message && (
        <p role="status" className="rounded-md bg-verde-bg px-3 py-2 text-sm text-verde-exito">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-carmin-bg px-3 py-2 text-sm text-carmin-texto">
          {error}
        </p>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Diálogo de alta
// ---------------------------------------------------------------------------------------------

/**
 * Diálogo modal con un formulario. `onSubmit` devuelve `true` si guardó: entonces se cierra; si
 * devuelve `false` queda abierto, con `error`, y lo escrito se conserva (los campos viven en quien
 * lo usa).
 */
export function FormDialog({
  open,
  title,
  description,
  submitLabel,
  error,
  onClose,
  onSubmit,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  submitLabel: string;
  error?: string | null;
  onClose: () => void;
  onSubmit: () => Promise<boolean>;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md rounded-lg border border-borde bg-white p-0 text-tinta backdrop:bg-tinta/40"
    >
      <form
        noValidate
        className="flex flex-col gap-4 p-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          let saved = false;
          try {
            saved = await onSubmit();
          } finally {
            setBusy(false);
          }
          if (saved) onClose();
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-lg font-semibold text-tinta">
              {title}
            </h2>
            {description && <p className="text-sm text-gris-texto">{description}</p>}
          </div>
          <Button variant="secondary" size="sm" icon={X} aria-label="Cerrar" onClick={onClose} />
        </div>
        <div className="flex flex-col gap-3">{children}</div>
        {error && (
          <p role="alert" className="rounded-md bg-carmin-bg p-2 text-sm text-carmin-texto">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Guardando…" : submitLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
