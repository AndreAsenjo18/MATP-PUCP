/**
 * Tablas de la maqueta B (docs/guia-visual.md): la fila de títulos en crema y siempre a la vista, y el
 * desplazamiento solo dentro del cuadro de la tabla, nunca de la página. El cuadro tiene un alto
 * máximo para que la fila de títulos quede fija al desplazarse hacia abajo, y se desplaza a los lados
 * cuando la tabla es más ancha que la pantalla.
 */
export const TABLE_BOX_CLASS = "max-h-[min(70dvh,40rem)] max-w-full overflow-auto overscroll-contain rounded-md border border-borde bg-white [scrollbar-width:thin]";

/** `border-separate` deja que los bordes de las celdas acompañen a la fila de títulos fija. */
export const TABLE_CLASS = "w-full border-separate border-spacing-0 text-left text-base";

export const THEAD_CLASS = "sticky top-0 z-10 bg-crema text-tinta";

export const TH_CLASS = "px-4 py-3 font-semibold whitespace-nowrap";

export const TD_CLASS = "border-t border-borde px-4 py-3 align-top";
