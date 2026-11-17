/**
 * Píldora de búsqueda de la maqueta B: la lupa, el campo y el botón oscuro «Buscar» dentro del mismo
 * campo. Va dentro de un `<form>`: el botón lo envía. Bajo 640 px el botón pasa a su propia fila para
 * dejarle sitio al campo.
 *
 * - `sobre="terracota"`: en la cabecera del Inicio; el foco del campo es crema.
 * - `sobre="claro"`: en una tarjeta blanca; borde arena y foco terracota.
 * - `ia`: borde fino con el degradado de Gemini, para la búsqueda con IA del Inicio (change
 *   `inicio-busqueda-ia`, D5). Con `pensando`, el borde brilla mientras se interpreta.
 */
import { Mic, Search } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface SearchPillProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className" | "size"> {
  id: string;
  sobre?: "terracota" | "claro";
  /** Dictado por voz (change `busqueda-lenguaje-natural`, D5): oculto si el navegador no lo soporta. */
  onVoiceClick?: () => void;
  voiceListening?: boolean;
  ia?: boolean;
  pensando?: boolean;
  /** Texto del botón; «Buscar» por omisión. */
  submitLabel?: ReactNode;
  /** Algo pequeño junto al micrófono, como el ícono de ayuda de «Código o nombre». */
  adorno?: ReactNode;
}

export function SearchPill({ sobre = "claro", onVoiceClick, voiceListening = false, ia = false, pensando = false, submitLabel = "Buscar", adorno, ...input }: SearchPillProps) {
  const pill = (
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
        {adorno}
        {onVoiceClick && (
          <button
            type="button"
            onClick={onVoiceClick}
            aria-pressed={voiceListening}
            aria-label={voiceListening ? "Detener el dictado" : "Buscar por voz"}
            title={voiceListening ? "Detener el dictado" : "Buscar por voz"}
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota",
              voiceListening ? "bg-carmin-bg text-carmin-texto animate-pulse" : "text-gris-texto hover:text-terracota",
            )}
          >
            <Mic size={18} aria-hidden="true" />
          </button>
        )}
      </span>
      <button
        type="submit"
        className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-tinta px-6 py-2 text-base font-bold text-crema hover:bg-black focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota sm:w-auto"
      >
        {submitLabel}
      </button>
    </div>
  );
  if (!ia) return pill;
  return (
    <div
      data-borde-ia=""
      className={cn(
        "rounded-[calc(var(--radius-xl)+2px)] bg-linear-to-r from-gemini-azul via-gemini-violeta to-gemini-rosa p-0.5 shadow-[0_6px_26px_rgb(120_120_255/0.3)] sm:rounded-full",
        pensando && "borde-ia-pensando",
      )}
    >
      {pill}
    </div>
  );
}
