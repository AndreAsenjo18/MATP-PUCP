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

export interface BadgeProps {
  children: ReactNode;
  intent?: BadgeIntent;
  icon?: LucideIcon;
  title?: string;
  className?: string;
}

export function badgeIntentClass(intent: string | undefined): string {
  return BADGE_INTENTS[(intent ?? "default") as BadgeIntent] ?? BADGE_INTENTS.default;
}

export function Badge({ children, intent = "default", icon: Icon, title, className }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium",
        badgeIntentClass(intent),
        className,
      )}
    >
      {Icon && <Icon size={14} aria-hidden="true" />}
      {children}
    </span>
  );
}
