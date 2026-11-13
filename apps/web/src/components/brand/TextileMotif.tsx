/**
 * Rombo de la marca (maqueta B; docs/guia-visual.md): un rombo de contorno grueso en terracota vivo,
 * junto a «MATP» en el menú oscuro. Dibujado para este proyecto. Es decorativo: se oculta a los
 * lectores de pantalla. El color sale del token `terracota-vivo`, nunca de un valor escrito a mano.
 * La trama de rombos de las cabeceras es la utilidad `trama-rombos` de `globals.css`.
 */
import { cn } from "@/lib/cn";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" className={cn("size-4 shrink-0", className)}>
      <path d="M8 1.75 14.25 8 8 14.25 1.75 8Z" fill="none" strokeWidth="2.5" className="stroke-terracota-vivo" />
    </svg>
  );
}
