/**
 * Rombo escalonado de tejido, dibujado para este proyecto (docs/guia-visual.md). Es decorativo: se
 * oculta a los lectores de pantalla. Los colores salen de los tokens (`fill-terracota`…), nunca de
 * valores escritos a mano.
 */
import { cn } from "@/lib/cn";

/** El rombo en una celda de 56 × 40: contorno, interior y centro. */
function Diamond() {
  return (
    <>
      <g className="fill-terracota">
        <rect x="24" y="4" width="8" height="4" />
        <rect x="20" y="8" width="16" height="4" />
        <rect x="16" y="12" width="24" height="4" />
        <rect x="12" y="16" width="32" height="8" />
        <rect x="16" y="24" width="24" height="4" />
        <rect x="20" y="28" width="16" height="4" />
        <rect x="24" y="32" width="8" height="4" />
      </g>
      <g className="fill-ambar-alerta">
        <rect x="24" y="12" width="8" height="4" />
        <rect x="20" y="16" width="16" height="8" />
        <rect x="24" y="24" width="8" height="4" />
      </g>
      <rect x="26" y="18" width="4" height="4" className="fill-crema-light" />
    </>
  );
}

/** Un solo rombo, para acompañar el nombre del museo. */
export function TextileMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="10 2 36 36" className={cn("size-6 shrink-0", className)}>
      <Diamond />
    </svg>
  );
}
