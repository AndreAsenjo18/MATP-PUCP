/**
 * Píldora de un dato (docs/guia-visual.md, maqueta B): la cantidad en negrita y lo que cuenta, en
 * palabras completas. `neutro` en blanco; `alerta` en ámbar suave para lo que falta. Con `href` es
 * un enlace y lo dice con una flecha, no solo con el color. 44 px de alto como mínimo.
 */
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/cn";

export type StatChipTone = "neutro" | "alerta";

const TONES: Record<StatChipTone, string> = {
  neutro: "border-borde bg-white text-tinta",
  alerta: "border-ambar-alerta/40 bg-ambar-bg text-ambar-texto",
};

const BASE = "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-1.5 text-base";

export function StatChip({ value, label, tone = "neutro", href }: { value: string; label: string; tone?: StatChipTone; href?: string }) {
  const content = (
    <>
      <strong className="font-extrabold tabular-nums">{value}</strong>
      <span>{label}</span>
    </>
  );
  if (!href) return <span className={cn(BASE, TONES[tone])}>{content}</span>;
  return (
    <Link
      href={href}
      className={cn(BASE, TONES[tone], "hover:border-terracota hover:shadow-sm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota")}
    >
      {content}
      <ChevronRight size={16} aria-hidden="true" className="-mr-1 shrink-0" />
    </Link>
  );
}
