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

export const CONTROL_STYLES =
  "w-full rounded-md border bg-white p-2 text-base text-tinta focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-terracota disabled:cursor-not-allowed disabled:bg-crema-light disabled:text-gris-texto";

export function controlClassName(hasError: boolean, className?: string): string {
  return cn(CONTROL_STYLES, hasError ? "border-carmin-peligro" : "border-borde", className);
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
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-sm font-medium text-tinta">
        {label}
      </label>
      {children}
      {hint && (
        <p id={ids.hintId} className="text-sm text-gris-texto">
          {hint}
        </p>
      )}
      {error && (
        <p id={ids.errorId} className="text-sm font-medium text-carmin-texto">
          {error}
        </p>
      )}
    </div>
  );
}
