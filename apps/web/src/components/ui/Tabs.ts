/**
 * Un solo estilo de pestañas para todo el sistema (maqueta B; docs/guia-visual.md): píldoras de 44 px,
 * la activa en terracota sólido y las demás blancas con borde arena. En pantallas estrechas la fila
 * se desplaza dentro de su propio cuadro, sin cortar ni partir el texto de cada pestaña. El relleno
 * del cuadro deja sitio al contorno de foco, que la zona de desplazamiento recortaría.
 *
 * Lo usan la ficha de la pieza, Revisar pendientes y Administración (áreas y secciones).
 */
import { cn } from "@/lib/cn";

export const TAB_LIST_CLASS = "-mx-1.5 flex gap-2 overflow-x-auto overscroll-x-contain p-1.5 [scrollbar-width:thin]";

export function tabClassName(selected: boolean, className?: string): string {
  return cn(
    "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-base whitespace-nowrap focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota",
    // La activa se distingue también por el relleno y el peso de la letra, no solo por el color.
    selected ? "border-terracota bg-terracota font-semibold text-white shadow-sm" : "border-borde bg-white font-medium text-tinta hover:border-terracota hover:text-terracota",
    className,
  );
}
