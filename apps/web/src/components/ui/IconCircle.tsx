/**
 * Icono dentro de un círculo de color (docs/guia-visual.md). El color dice el tipo de tarea, pero
 * nunca va solo: quien lo usa pone siempre un texto al lado. `solid` es para lo más importante.
 */
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

export type Tone = "terracota" | "verde" | "anil" | "ambar" | "ciruela" | "piedra";

const SOFT: Record<Tone, string> = {
  terracota: "bg-terracota-light text-terracota-dark",
  verde: "bg-verde-bg text-verde-exito",
  anil: "bg-anil-bg text-anil",
  ambar: "bg-ambar-bg text-ambar-texto",
  ciruela: "bg-ciruela-bg text-ciruela",
  piedra: "bg-borde text-gris-texto",
};

const SOLID: Record<Tone, string> = {
  terracota: "bg-terracota text-white",
  verde: "bg-verde-exito text-white",
  anil: "bg-anil text-white",
  ambar: "bg-ambar-texto text-white",
  ciruela: "bg-ciruela text-white",
  piedra: "bg-gris-texto text-white",
};

const SIZES = { md: "size-11", lg: "size-16" } as const;
const ICON_SIZES = { md: 22, lg: 30 } as const;

export function IconCircle({
  icon: Icon,
  tone,
  size = "md",
  solid = false,
  className,
}: {
  icon: LucideIcon;
  tone: Tone;
  size?: keyof typeof SIZES;
  solid?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full", SIZES[size], (solid ? SOLID : SOFT)[tone], className)}>
      <Icon size={ICON_SIZES[size]} aria-hidden="true" />
    </span>
  );
}
