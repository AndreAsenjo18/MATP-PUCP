/**
 * Etiqueta de estado (docs/system-design.md §3). Siempre lleva texto visible: el color nunca es el
 * único portador del significado (RNF-010). Un `intent` desconocido se muestra como `default`.
 */
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type BadgeIntent = "success" | "info" | "warning" | "danger" | "default";

export const BADGE_INTENTS: Record<BadgeIntent, string> = {
  success: "bg-verde-bg text-verde-exito",
  info: "bg-terracota-light text-terracota-dark",
  warning: "bg-ambar-bg text-ambar-texto",
  danger: "bg-carmin-bg text-carmin-texto",
  default: "bg-borde text-gris-texto",
};

/**
 * Versión tenue (filas de resultados): sin relleno, con un borde fino del color de la intención y el
 * texto del mismo color. Sigue en 16 px y con texto visible.
 */
export const SUBTLE_BADGE_INTENTS: Record<BadgeIntent, string> = {
  success: "border-verde-exito/30 text-verde-exito",
  info: "border-terracota/30 text-terracota-dark",
  warning: "border-ambar-alerta/40 text-ambar-texto",
  danger: "border-carmin-peligro/40 text-carmin-texto",
  default: "border-borde text-gris-texto",
};

export interface BadgeProps {
  children: ReactNode;
  intent?: BadgeIntent;
  icon?: LucideIcon;
  title?: string;
  /** Tenue: más chica (sin bajar de 16 px) y sin relleno, para que no compita con lo principal. */
  subtle?: boolean;
  className?: string;
}

export function badgeIntentClass(intent: string | undefined): string {
  return BADGE_INTENTS[(intent ?? "default") as BadgeIntent] ?? BADGE_INTENTS.default;
}

export function Badge({ children, intent = "default", icon: Icon, title, subtle = false, className }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded-full text-sm",
        subtle ? "gap-1 border bg-white px-2 py-px font-medium" : "gap-1.5 px-3 py-1 font-semibold",
        subtle ? (SUBTLE_BADGE_INTENTS[intent] ?? SUBTLE_BADGE_INTENTS.default) : badgeIntentClass(intent),
        className,
      )}
    >
      {Icon && <Icon size={subtle ? 14 : 16} aria-hidden="true" className="shrink-0" />}
      {children}
    </span>
  );
}
