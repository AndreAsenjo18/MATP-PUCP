"use client";

/**
 * Sección «Formatos de archivo» de Administración, modo `live` (change
 * `plantillas-mapeo-y-normalizacion`, tarea 4.2, y `rediseno-ux-administracion`; spec
 * importacion-datos: RF-022, RN-005). Un formato es una plantilla de mapeo: la forma de leer las
 * columnas de una misma fuente.
 *
 * - `TemplateAdminList` (presentación): los formatos agrupados por fuente, cada uno con sus columnas
 *   plegadas, edición en línea de nombre, fuente y descripción, y eliminación con motivo. Las
 *   columnas se editan en el asistente de importación, no aquí.
 * - `filterTemplates` y `groupTemplatesBySource`: búsqueda por nombre o fuente y agrupación.
 * - `MappingTemplatesLive`: lee las plantillas y hace las llamadas. Ver y editar exigen
 *   `imports.prepare`; eliminar, `imports.approve` [SUPUESTO T8].
 */
import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { ConfirmButton } from "@/components/domain/ConfirmButton";
import { ErrorNotice } from "@/components/domain/ImportWizard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AdminToolbar, SectionHeader } from "@/components/domain/AdminShell";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useSession } from "@/lib/auth/session";
import {
  deleteTemplate,
  fetchTemplates,
  renameTemplate,
  targetLabel,
  templateMetaError,
  type MappingTemplate,
  type TemplateMetaInput,
} from "@/lib/data/import-templates";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Formatos cuyo nombre o fuente contiene la búsqueda. */
export function filterTemplates(templates: readonly MappingTemplate[], query: string): MappingTemplate[] {
  const wanted = fold(query);
  return templates.filter((template) => !wanted || fold(template.name).includes(wanted) || fold(template.source_name).includes(wanted));
}

/** Formatos agrupados por fuente, con las fuentes y los formatos en orden alfabético. */
export function groupTemplatesBySource(templates: readonly MappingTemplate[]): { source: string; templates: MappingTemplate[] }[] {
  const groups = new Map<string, MappingTemplate[]>();
  for (const template of templates) groups.set(template.source_name, [...(groups.get(template.source_name) ?? []), template]);
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "es"))
    .map(([source, items]) => ({ source, templates: [...items].sort((a, b) => a.name.localeCompare(b.name, "es")) }));
}

export function TemplateAdminList({
  templates,
  canEdit,
  canDelete,
  busyId,
  errors,
  onRename,
  onDelete,
}: {
  templates: MappingTemplate[];
  canEdit: boolean;
  canDelete: boolean;
  busyId: string | null;
  /** Error por plantilla (`id` → mensaje), p. ej. el nombre repetido. */
  errors: Record<string, string>;
  onRename: (templateId: string, input: TemplateMetaInput) => void;
  onDelete: (templateId: string, reason: string) => void;
}) {
  if (templates.length === 0) {
    return <p className="text-sm text-gris-texto">No hay formatos que mostrar. Los formatos nuevos se crean desde el asistente de importación.</p>;
  }
  return (
    <div className="flex flex-col gap-5" aria-label="Formatos de archivo">
      {groupTemplatesBySource(templates).map((group) => (
        <section key={group.source} aria-label={`Fuente ${group.source}`} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-tinta">
            {group.source} <span className="font-normal text-gris-texto">· {group.templates.length === 1 ? "1 formato" : `${group.templates.length} formatos`}</span>
          </h3>
          <ul className="flex flex-col gap-2">
            {group.templates.map((template) => (
              <TemplateAdminItem
                key={`${template.id}-${template.name}-${template.description ?? ""}`}
                template={template}
                canEdit={canEdit}
                canDelete={canDelete}
                busy={busyId === template.id}
                error={errors[template.id] ?? null}
                onRename={(input) => onRename(template.id, input)}
                onDelete={(reason) => onDelete(template.id, reason)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TemplateAdminItem({
  template,
  canEdit,
  canDelete,
  busy,
  error,
  onRename,
  onDelete,
}: {
  template: MappingTemplate;
  canEdit: boolean;
  canDelete: boolean;
  busy: boolean;
  error: string | null;
  onRename: (input: TemplateMetaInput) => void;
  onDelete: (reason: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<TemplateMetaInput>({
    name: template.name,
    sourceName: template.source_name,
    description: template.description ?? "",
  });
  const invalid = templateMetaError(values);
  return (
    <li className="flex flex-col gap-2 rounded-md border border-borde p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm font-medium text-tinta">{template.name}</p>
          <p className="text-xs text-gris-texto">
            {template.source_name} · {template.columns.length} columnas · creada el {formatDate(template.created_at)}
          </p>
          {template.description && <p className="text-xs text-gris-texto">{template.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && !editing && (
            <Button variant="outline" size="sm" icon={Pencil} disabled={busy} onClick={() => setEditing(true)}>
              Editar
            </Button>
          )}
          {canDelete && (
            <ConfirmButton
              label="Eliminar"
              variant="danger"
              size="sm"
              icon={Trash2}
              disabled={busy}
              confirmTitle={`Eliminar el formato «${template.name}»`}
              confirmDescription="El formato pasa a la papelera y deja de sugerirse. Los lotes que lo usaron conservan las columnas con que se procesaron."
              requireReason
              reasonLabel="Motivo de la eliminación"
              onConfirm={onDelete}
            />
          )}
        </div>
      </div>
      {!canDelete && <p className="text-xs text-gris-texto">Eliminar un formato corresponde al Gestor de colecciones o al Administrador.</p>}
      {editing && (
        <div className="flex flex-col gap-3 rounded-md bg-crema-light p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Nombre" value={values.name} error={error ?? undefined} onChange={(event) => setValues({ ...values, name: event.target.value })} />
            <Input label="Fuente" value={values.sourceName} onChange={(event) => setValues({ ...values, sourceName: event.target.value })} />
          </div>
          <Textarea label="Descripción (opcional)" rows={2} value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} />
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" disabled={busy || invalid !== null} onClick={() => onRename(values)}>
              {busy ? "Guardando…" : "Guardar"}
            </Button>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            {invalid && <span className="text-sm text-gris-texto">{invalid}</span>}
          </div>
          <p className="text-sm text-gris-texto">Las columnas y transformaciones se editan desde el asistente de importación.</p>
        </div>
      )}
      {!editing && <ErrorNotice message={error} />}
      <details className="text-sm">
        <summary className="cursor-pointer text-gris-texto">Columnas ({template.columns.length})</summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-gris-texto">
            <tr>
              <th className="py-1 pr-3 font-medium">Columna del archivo</th>
              <th className="py-1 pr-3 font-medium">Destino</th>
              <th className="py-1 font-medium">Transformaciones</th>
            </tr>
          </thead>
          <tbody className="text-tinta">
            {template.columns.map((column) => (
              <tr key={column.source_column} className="border-t border-borde align-top">
                <td className="py-1 pr-3">{column.source_column}</td>
                <td className="py-1 pr-3 text-gris-texto">{column.target_field ? targetLabel(column) : "Dato de origen (se conserva sin mapear)"}</td>
                <td className="py-1 font-mono text-gris-texto">{column.transforms?.length ? column.transforms.join(" → ") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </li>
  );
}

export function MappingTemplatesLive() {
  const { currentUser, hasPermission } = useSession();
  const devUser = currentUser?.email;
  const [templates, setTemplates] = useState<MappingTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    fetchTemplates(devUser).then((result) => {
      if (!active) return;
      if (result.status === "ok") setTemplates(result.value);
      else setError(result.message);
    });
    return () => {
      active = false;
    };
  }, [devUser, reload]);

  async function handleRename(templateId: string, input: TemplateMetaInput) {
    setBusyId(templateId);
    const result = await renameTemplate(templateId, input, devUser);
    setBusyId(null);
    if (result.status !== "ok") return setErrors({ ...errors, [templateId]: result.message });
    setErrors({});
    setMessage(`Formato «${result.value.name}» guardado.`);
    setReload((n) => n + 1);
  }

  async function handleDelete(templateId: string, reason: string) {
    setBusyId(templateId);
    const result = await deleteTemplate(templateId, reason, devUser);
    setBusyId(null);
    if (result.status !== "ok") return setErrors({ ...errors, [templateId]: result.message });
    setErrors({});
    setMessage("Formato eliminado: está en la papelera.");
    setReload((n) => n + 1);
  }

  return (
    <Card as="section" aria-label="Formatos de archivo" className="flex flex-col gap-4">
      <SectionHeader
        title="Formatos de archivo"
        description="Cómo leer las columnas de cada fuente (el libro de inventario, una ficha en Word, una tabla de Access…). El asistente de importación los reconoce solo por los títulos de las columnas."
      />
      <AdminToolbar label="Buscar formatos">
        <Input label="Buscar" value={query} placeholder="Nombre o fuente" onChange={(event) => setQuery(event.target.value)} fieldClassName="w-64" />
      </AdminToolbar>
      <ErrorNotice message={error} />
      {message && <p className="rounded-md bg-verde-bg px-3 py-2 text-base text-verde-exito">{message}</p>}
      {templates === null ? (
        <p className="text-sm text-gris-texto">Cargando formatos…</p>
      ) : (
        <TemplateAdminList
          templates={filterTemplates(templates, query)}
          canEdit={hasPermission("imports.prepare")}
          canDelete={hasPermission("imports.approve")}
          busyId={busyId}
          errors={errors}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      )}
    </Card>
  );
}
