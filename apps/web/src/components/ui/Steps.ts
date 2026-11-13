/**
 * Pasos de un asistente (maqueta B; docs/guia-visual.md): el mismo contenedor blanco que las
 * pestañas principales, con el paso actual en terracota sólido, los hechos en verde con su marca y
 * los que faltan sin fondo. 44 px de alto y 16 px de letra. El estado nunca va solo en el color: el
 * actual lleva `aria-current` y los hechos, un icono de visto.
 */
import { cn } from "@/lib/cn";

import { DISABLED_STYLES } from "./Button";
import { TAB_LIST_CLASS } from "./Tabs";

export type StepState = "actual" | "hecho" | "pendiente";

export const STEP_LIST_CLASS = TAB_LIST_CLASS;

export function stepClassName(state: StepState, className?: string): string {
  return cn(
    "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-base whitespace-nowrap focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota",
    DISABLED_STYLES,
    state === "actual" && "bg-terracota font-semibold text-white shadow-sm",
    state === "hecho" && "bg-verde-bg font-medium text-verde-exito",
    state === "pendiente" && "font-medium text-tinta enabled:hover:bg-crema-light enabled:hover:text-terracota",
    className,
  );
}
