/**
 * Superficie del piloto de identidad visual (docs/guia-visual.md): fondo blanco, esquinas amplias y
 * sombra suave. `interactive` añade las respuestas a cursor, pulsación y teclado, con una transición
 * corta que se desactiva si la persona pidió menos movimiento.
 */
import { cn } from "@/lib/cn";

export function surfaceClassName({ interactive = false, className }: { interactive?: boolean; className?: string } = {}): string {
  return cn(
    "rounded-tarjeta border border-borde bg-white shadow-suave",
    interactive &&
      "transition-[translate,box-shadow,border-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-terracota hover:shadow-elevada active:translate-y-0 active:shadow-suave focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota motion-reduce:transition-none motion-reduce:hover:translate-y-0",
    className,
  );
}
