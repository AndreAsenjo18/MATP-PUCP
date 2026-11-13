/**
 * Píldora de búsqueda de la maqueta B: la lupa, el campo y el botón oscuro «Buscar» dentro del mismo
 * campo. Va dentro de un `<form>`: el botón lo envía. Bajo 640 px el botón pasa a su propia fila para
 * dejarle sitio al campo.
 *
 * - `sobre="terracota"`: en la cabecera del Inicio; el foco del campo es crema.
 * - `sobre="claro"`: en una tarjeta blanca; borde arena y foco terracota.
 */
import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export interface SearchPillProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className" | "size"> {
  id: string;
  sobre?: "terracota" | "claro";
}

export function SearchPill({ sobre = "claro", ...input }: SearchPillProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl bg-white p-1.5 shadow-sm has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 sm:flex-nowrap sm:rounded-full",
        sobre === "terracota" ? "has-[input:focus-visible]:outline-crema" : "border border-borde has-[input:focus-visible]:outline-terracota",
      )}
    >
      <span className="flex min-w-0 flex-1 basis-48 items-center gap-2 pl-3.5">
        <Search size={20} aria-hidden="true" className="shrink-0 text-terracota" />
        <input
          type="search"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          {...input}
          className="min-h-11 w-full min-w-0 flex-1 bg-transparent text-base text-tinta placeholder:text-gris-texto focus-visible:outline-none"
        />
      </span>
      <button
        type="submit"
        className="min-h-11 w-full shrink-0 rounded-full bg-tinta px-6 py-2 text-base font-bold text-crema hover:bg-black focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota sm:w-auto"
      >
        Buscar
      </button>
    </div>
  );
}
