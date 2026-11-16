"use client";

/**
 * Marca de la búsqueda con IA (changes `inicio-busqueda-ia` D5 y `busqueda-barra-compacta-ia`): la
 * estrella de cuatro puntas con el degradado de Gemini y la insignia «Powered by Gemini». La marca va
 * en inglés por decisión del equipo; el resto de la interfaz sigue en español.
 */
import { useId } from "react";

import { cn } from "@/lib/cn";

/** Estrella de cuatro puntas con el degradado de Gemini. Decorativa. */
export function GeminiStar({ size = 22, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--color-gemini-azul)" }} />
          <stop offset="0.55" style={{ stopColor: "var(--color-gemini-violeta)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-gemini-rosa)" }} />
        </linearGradient>
      </defs>
      <path d="M12 1C12.6 7 17 11.4 23 12 17 12.6 12.6 17 12 23 11.4 17 7 12.6 1 12 7 11.4 11.4 7 12 1Z" fill={`url(#${id})`} />
    </svg>
  );
}

/** Insignia blanca «Powered by Gemini», para poner junto al título de una búsqueda con IA. */
export function GeminiBadge() {
  return (
    <span lang="en" className="inline-flex items-center gap-2 rounded-full bg-white py-1.5 pr-4 pl-2.5 text-base font-semibold text-gris-texto shadow-[0_4px_18px_rgb(110_110_255/0.35)]">
      <GeminiStar />
      <span>
        Powered by{" "}
        <b className="bg-linear-to-r from-gemini-azul-texto via-gemini-violeta-texto to-gemini-rosa-texto bg-clip-text font-extrabold text-transparent forced-colors:text-[CanvasText]">
          Gemini
        </b>
      </span>
    </span>
  );
}
