"use client";

/**
 * Píldora de filtro con la lista nativa del sistema (changes `busqueda-barra-compacta-ia` D1 y
 * `revisar-duplicados-comparacion`): dibuja «Etiqueta» o «Etiqueta: valor» y lleva encima un `<select>`
 * transparente del mismo tamaño con `aria-label`, así el teclado, el lector de pantalla y el táctil
 * usan la lista del sistema. Activa, se pinta en terracota claro y muestra una ✕ para quitar el
 * filtro (un botón aparte, encima del `<select>`).
 *
 * `fija`: un filtro que siempre tiene valor (el estado de una cola). Muestra «Etiqueta: **valor**»
 * en blanco y sin ✕.
 */
import { ChevronDown, X } from "lucide-react";

import { cn } from "@/lib/cn";

export const PILL = "relative inline-flex min-h-11 items-center rounded-full border text-base font-semibold whitespace-nowrap";
export const PILL_OFF = "border-borde bg-white text-tinta hover:border-gris-texto";
export const PILL_ON = "border-terracota-light bg-terracota-light text-terracota-dark";
const FOCUS = "has-[select:focus-visible]:outline-3 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-terracota";

export interface PillOption {
  value: string;
  label: string;
}

/** La ✕ de una píldora activa, con «Quitar el filtro …» como nombre accesible. */
export function PillRemoveButton({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Quitar el filtro ${label}`}
      onClick={onRemove}
      className="relative z-10 mr-2 grid size-7 shrink-0 place-items-center rounded-full bg-terracota-dark/10 hover:bg-terracota-dark/20 focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-terracota"
    >
      <X size={14} aria-hidden="true" />
    </button>
  );
}

export function PillSelect({
  label,
  allLabel,
  value,
  options,
  onChange,
  fija = false,
  accessibleLabel,
}: {
  label: string;
  /** La opción «sin filtro»; en una píldora `fija` no se ofrece. */
  allLabel?: string;
  value: string | null;
  options: readonly PillOption[];
  onChange: (value: string | null) => void;
  fija?: boolean;
  /** Nombre accesible del `<select>` si debe decir más que la etiqueta visible. */
  accessibleLabel?: string;
}) {
  const chosen = value !== null ? (options.find((option) => option.value === value)?.label ?? (value === "" ? null : "(seleccionada)")) : null;
  const active = !fija && chosen !== null;
  return (
    <span className={cn(PILL, FOCUS, active ? PILL_ON : PILL_OFF)}>
      <span className={cn("pointer-events-none flex items-center gap-1.5 pl-4", active ? "pr-2" : "pr-3")}>
        {fija ? (
          <>
            {label}: <b className="font-extrabold">{chosen}</b>
          </>
        ) : active ? (
          `${label}: ${chosen}`
        ) : (
          label
        )}
        {!active && <ChevronDown size={16} aria-hidden="true" className="text-gris-texto" />}
      </span>
      <select
        aria-label={accessibleLabel ?? label}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" && !fija ? null : event.target.value)}
        className="absolute inset-0 size-full min-h-11 cursor-pointer opacity-0"
      >
        {!fija && <option value="">{allLabel ?? "Todos"}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {active && <PillRemoveButton label={`${label}: ${chosen}`} onRemove={() => onChange(null)} />}
    </span>
  );
}
