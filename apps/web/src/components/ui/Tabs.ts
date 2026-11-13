/**
 * Pestañas del sistema (maqueta B; docs/guia-visual.md).
 *
 * - **Principales** (`TAB_LIST_CLASS`, `tabClassName`): un contenedor blanco redondeado con las
 *   pestañas dentro; la activa es una píldora terracota sólida en seminegrita y las demás van sin
 *   fondo. Las usan la ficha, Revisar pendientes y las áreas de Administración.
 * - **De segundo nivel** (`UNDERLINE_TAB_LIST_CLASS`, `underlineTabClassName`): subrayadas, para que
 *   se distingan de las principales; la activa en terracota. Las usan las secciones de Administración.
 *
 * Todas miden 44 px y usan letra de 16 px. En pantallas estrechas la fila se desplaza dentro de su
 * cuadro, sin partir ni cortar el texto de ninguna pestaña. El relleno del contenedor deja sitio al
 * contorno de foco, que la zona de desplazamiento recortaría.
 */
import { cn } from "@/lib/cn";

export const TAB_LIST_CLASS =
  "flex w-fit max-w-full gap-1 overflow-x-auto overscroll-x-contain rounded-full border border-borde bg-white p-1.5 shadow-sm [scrollbar-width:thin]";

export function tabClassName(selected: boolean, className?: string): string {
  return cn(
    "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 py-2 text-base whitespace-nowrap focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota",
    // La activa se distingue también por el relleno y el peso de la letra, no solo por el color.
    selected ? "bg-terracota font-semibold text-white shadow-sm" : "font-medium text-tinta hover:bg-crema-light hover:text-terracota",
    className,
  );
}

export const UNDERLINE_TAB_LIST_CLASS = "flex max-w-full gap-2 overflow-x-auto overscroll-x-contain border-b border-borde [scrollbar-width:thin]";

export function underlineTabClassName(selected: boolean, className?: string): string {
  return cn(
    "-mb-px inline-flex min-h-11 shrink-0 items-center border-b-3 px-3 py-2 text-base whitespace-nowrap focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-terracota",
    selected ? "border-terracota font-semibold text-terracota" : "border-transparent font-medium text-gris-texto hover:border-borde hover:text-tinta",
    className,
  );
}
