"use client";

/**
 * Lista administrable común (change `crud-manual-completo`, tarea 2.1, design D1; RNF-010): buscador,
 * «Agregar», «Editar» y «Retirar» por fila, y «Ver retiradas» con «Restaurar». Cada acción solo se
 * muestra si llega su manejador: quien no tiene el permiso no la ve. El diálogo común es `FormDialog`
 * (`AdminShell`); `RetireDialog` le suma el motivo obligatorio al retirar.
 */
import { Archive, Pencil, Plus, RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";

import { AdminToolbar, FormDialog } from "@/components/domain/AdminShell";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

export interface AdminColumn<T> {
  header: string;
  cell: (item: T) => ReactNode;
  align?: "left" | "right";
}

export interface AdminRetired<R> {
  /** Texto del botón que muestra u oculta lo retirado, p. ej. «Ver retiradas». */
  toggleLabel: string;
  shown: boolean;
  onToggle: () => void;
  items: readonly R[];
  columns: readonly AdminColumn<R>[];
  rowKey: (item: R) => string;
  rowName: (item: R) => string;
  /** Sin él no hay «Restaurar» (p. ej. solo el Administrador restaura, [SUPUESTO Ñ3]). */
  onRestore?: (item: R) => void;
  restoreLabel?: string;
  emptyMessage: string;
}

export interface AdminListProps<T, R> {
  /** Nombre de la lista, para la tabla y el buscador. */
  label: string;
  items: readonly T[];
  columns: readonly AdminColumn<T>[];
  rowKey: (item: T) => string;
  /** Nombre de cada fila en las etiquetas de sus acciones («Editar Colección RA»). */
  rowName: (item: T) => string;
  query: string;
  onQueryChange: (query: string) => void;
  searchPlaceholder?: string;
  /** Filtros adicionales junto al buscador. */
  filters?: ReactNode;
  addLabel?: string;
  onAdd?: () => void;
  onEdit?: (item: T) => void;
  onRetire?: (item: T) => void;
  retireLabel?: string;
  emptyMessage: string;
  retired?: AdminRetired<R>;
}

function AdminTable<T>({
  caption,
  items,
  columns,
  rowKey,
  actions,
}: {
  caption: string;
  items: readonly T[];
  columns: readonly AdminColumn<T>[];
  rowKey: (item: T) => string;
  actions?: (item: T) => ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-xs text-gris-texto">
          <tr>
            {columns.map((column) => (
              <th key={column.header} scope="col" className={cn("py-1.5 pr-3 font-medium", column.align === "right" && "text-right")}>
                {column.header}
              </th>
            ))}
            {actions && (
              <th scope="col" className="py-1.5 text-right font-medium">
                Acciones
              </th>
            )}
          </tr>
        </thead>
        <tbody className="text-tinta">
          {items.map((item) => (
            <tr key={rowKey(item)} className="border-t border-borde">
              {columns.map((column) => (
                <td key={column.header} className={cn("py-1.5 pr-3", column.align === "right" && "text-right")}>
                  {column.cell(item)}
                </td>
              ))}
              {actions && (
                <td className="py-1.5">
                  <div className="flex flex-wrap justify-end gap-1.5">{actions(item)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminList<T, R = never>({
  label,
  items,
  columns,
  rowKey,
  rowName,
  query,
  onQueryChange,
  searchPlaceholder,
  filters,
  addLabel = "Agregar",
  onAdd,
  onEdit,
  onRetire,
  retireLabel = "Retirar",
  emptyMessage,
  retired,
}: AdminListProps<T, R>) {
  const hasActions = Boolean(onEdit || onRetire);
  return (
    <div className="flex flex-col gap-3">
      <AdminToolbar
        label={`Buscar en ${label.toLowerCase()}`}
        action={
          onAdd && (
            <Button size="sm" icon={Plus} onClick={onAdd}>
              {addLabel}
            </Button>
          )
        }
      >
        <Input label="Buscar" type="search" value={query} placeholder={searchPlaceholder} onChange={(event) => onQueryChange(event.target.value)} fieldClassName="w-56" />
        {filters}
        {retired && (
          <Button variant="secondary" size="sm" aria-pressed={retired.shown} onClick={retired.onToggle}>
            {retired.toggleLabel}
          </Button>
        )}
      </AdminToolbar>
      {items.length === 0 ? (
        <p className="py-2 text-sm text-gris-texto">{emptyMessage}</p>
      ) : (
        <AdminTable
          caption={label}
          items={items}
          columns={columns}
          rowKey={rowKey}
          actions={
            hasActions
              ? (item) => (
                  <>
                    {onEdit && <Button variant="outline" size="sm" icon={Pencil} aria-label={`Editar ${rowName(item)}`} title="Editar" onClick={() => onEdit(item)} />}
                    {onRetire && (
                      <Button variant="outline" size="sm" icon={Archive} aria-label={`${retireLabel} ${rowName(item)}`} title={retireLabel} onClick={() => onRetire(item)} />
                    )}
                  </>
                )
              : undefined
          }
        />
      )}
      {retired?.shown && (
        <section aria-label={`${label}: retiradas`} className="flex flex-col gap-2 rounded-md bg-crema-light p-3">
          <h3 className="text-sm font-semibold text-tinta">Retiradas</h3>
          {retired.items.length === 0 ? (
            <p className="text-sm text-gris-texto">{retired.emptyMessage}</p>
          ) : (
            <AdminTable
              caption={`${label} retiradas`}
              items={retired.items}
              columns={retired.columns}
              rowKey={retired.rowKey}
              actions={
                retired.onRestore
                  ? (item) => (
                      <Button variant="outline" size="sm" icon={RotateCcw} aria-label={`${retired.restoreLabel ?? "Restaurar"} ${retired.rowName(item)}`} onClick={() => retired.onRestore?.(item)}>
                        {retired.restoreLabel ?? "Restaurar"}
                      </Button>
                    )
                  : undefined
              }
            />
          )}
        </section>
      )}
    </div>
  );
}

/** El motivo de un retiro: obligatorio, al menos 3 caracteres como pide la API (RN-005). */
export function reasonError(reason: string): string | null {
  return reason.trim().length >= 3 ? null : "Escriba el motivo (al menos 3 caracteres).";
}

/** Retirar con motivo obligatorio: nunca se borra, se puede restaurar (RN-005). */
export function RetireDialog({
  open,
  title,
  consequence,
  submitLabel = "Retirar",
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  /** Qué pasa al retirar, en lenguaje claro. */
  consequence: string;
  submitLabel?: string;
  error?: string | null;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<boolean>;
}) {
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  return (
    <FormDialog
      open={open}
      title={title}
      description={consequence}
      submitLabel={submitLabel}
      error={error}
      onClose={() => {
        setReason("");
        setFieldError(null);
        onClose();
      }}
      onSubmit={async () => {
        const problem = reasonError(reason);
        setFieldError(problem);
        if (problem) return false;
        const saved = await onSubmit(reason.trim());
        if (saved) setReason("");
        return saved;
      }}
    >
      <Input label="Motivo (obligatorio)" value={reason} required aria-required="true" error={fieldError} onChange={(event) => setReason(event.target.value)} />
    </FormDialog>
  );
}
