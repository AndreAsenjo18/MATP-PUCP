/**
 * Cabecera de un desplegable (`<details>`) que se reconoce como tal (change
 * `reportes-vista-simplificada`, design D3; Req: Desplegables de filtros y subtotales reconocibles).
 * Un `<summary>` con `display: flex` pierde el triángulo del navegador y parece un título: esta
 * cabecera dibuja su propia flecha, que gira al abrir. El `<details>` que la contiene debe llevar la
 * clase `group`. 16 px, 44 px de alto y foco visible.
 */
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** «Filtros (2 activos)»; sin activos, el nombre solo. */
export function withActiveCount(label: string, active: number): string {
  return active > 0 ? `${label} (${active} activo${active === 1 ? "" : "s"})` : label;
}

/**
 * `button`: con borde y fondo, para que se vea que se pulsa (Reportes, prueba humana 7.2). `plain`, el
 * de siempre («Más filtros» de Búsqueda y «Subtotales»).
 */
export type DisclosureVariant = "plain" | "button";

export function DisclosureSummary({ children, className, variant = "plain" }: { children: ReactNode; className?: string; variant?: DisclosureVariant }) {
  return (
    <summary
      data-variant={variant}
      className={cn(
        "flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md text-base font-medium text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota [&::-webkit-details-marker]:hidden",
        variant === "button" && "w-fit border border-terracota bg-white px-4 py-2 text-terracota hover:bg-terracota-light",
        className,
      )}
    >
      <ChevronRight size={18} aria-hidden="true" data-disclosure-arrow="" className="shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
      <span>{children}</span>
    </summary>
  );
}
