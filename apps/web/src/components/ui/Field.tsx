/**
 * Envoltorio común de los campos de formulario (`Input`, `Select`, `Textarea`): etiqueta visible
 * asociada por `id`, ayuda opcional y mensaje de error en español enlazado con `aria-describedby`
 * (RNF-010).
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

export interface FieldIds {
  hintId?: string;
  errorId?: string;
  describedBy?: string;
}

export function fieldIds(id: string, { hint, error }: Pick<FieldProps, "hint" | "error">): FieldIds {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return { hintId, errorId, describedBy };
}

/** Campos de 44 px o más, con radio alto y borde arena (docs/guia-visual.md). */
export const CONTROL_STYLES =
  "w-full rounded-md border bg-white px-3.5 py-2 text-base text-tinta shadow-sm placeholder:text-gris-texto focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-terracota disabled:cursor-not-allowed disabled:bg-crema-light disabled:text-gris-texto";

/** `md`: 44 px, el de siempre. `lg`: 52 px, para las barras de filtros (maqueta B de Buscar). */
export type ControlSize = "md" | "lg";

const CONTROL_SIZES: Record<ControlSize, string> = { md: "min-h-11", lg: "min-h-13" };

export function controlClassName(hasError: boolean, className?: string, size: ControlSize = "md"): string {
  // Con error el borde rojo se mantiene también al pasar el cursor.
  return cn(CONTROL_STYLES, CONTROL_SIZES[size], hasError ? "border-carmin-peligro" : "border-borde enabled:hover:border-gris-texto", className);
}

export function Field({
  id,
  label,
  hint,
  error,
  ids,
  className,
  children,
}: FieldProps & { id: string; ids: FieldIds; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-base font-semibold text-tinta">
        {label}
      </label>
      {children}
      {hint && (
        <p id={ids.hintId} className="text-base text-gris-texto">
          {hint}
        </p>
      )}
      {error && (
        <p id={ids.errorId} className="texto-error text-base font-semibold text-carmin-texto">
          {error}
        </p>
      )}
    </div>
  );
}
