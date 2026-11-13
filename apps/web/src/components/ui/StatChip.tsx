/**
 * Ficha de un dato (docs/guia-visual.md): icono en círculo, la cantidad y lo que cuenta, en palabras
 * completas. Con `href` es un enlace y lo dice con una flecha, no solo con el color.
 */
import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { IconCircle, type Tone } from "@/components/ui/IconCircle";
import { cn } from "@/lib/cn";

const BASE = "inline-flex min-h-12 items-center gap-3 rounded-full border border-borde bg-white py-1 pr-4 pl-1 text-base text-tinta";

export function StatChip({ icon, tone, value, label, href }: { icon: LucideIcon; tone: Tone; value: string; label: string; href?: string }) {
  const content = (
    <>
      <IconCircle icon={icon} tone={tone} className="size-10" />
      <span>
        <strong className="font-semibold tabular-nums">{value}</strong>
        {/* Espacio duro: la cantidad no se separa de lo que cuenta al cambiar de línea. */}
        {" "}
        {label}
      </span>
    </>
  );
  if (!href) return <span className={BASE}>{content}</span>;
  return (
    <Link
      href={href}
      className={cn(
        BASE,
        "shadow-sm hover:border-terracota hover:shadow-md active:shadow-sm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota",
      )}
    >
      {content}
      <ChevronRight size={18} aria-hidden="true" className="text-gris-texto" />
    </Link>
  );
}
