/**
 * Botón base del sistema de diseño (docs/system-design.md §3). Altura mínima de 44 px, foco
 * visible y estado deshabilitado atenuado (RNF-010). Un botón solo con icono exige `aria-label`.
 */
import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "danger";
export type ButtonSize = "md" | "lg";

interface ButtonBaseProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
}

export type ButtonProps = ButtonBaseProps &
  ({ children: ReactNode; "aria-label"?: string } | { children?: undefined; "aria-label": string });

const BASE_STYLES =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota disabled:cursor-not-allowed disabled:opacity-50";

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-terracota text-white hover:bg-terracota-dark",
  secondary: "bg-crema text-tinta hover:bg-borde",
  outline: "border border-terracota bg-white text-terracota hover:bg-terracota-light",
  danger: "bg-carmin-peligro text-white hover:bg-carmin-texto",
};

const SIZES: Record<ButtonSize, string> = {
  md: "px-4 py-2 text-base",
  lg: "px-5 py-4 text-lg font-semibold",
};

/** Clases de un botón, para aplicar el mismo estilo a un enlace (`Link`). */
export function buttonClassName({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
  return cn(BASE_STYLES, BUTTON_VARIANTS[variant] ?? BUTTON_VARIANTS.primary, SIZES[size] ?? SIZES.md, className);
}

export function Button({ variant = "primary", size = "md", icon: Icon, className, type = "button", children, ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonClassName({ variant, size, className })} {...props}>
      {Icon && <Icon size={18} aria-hidden="true" />}
      {children}
    </button>
  );
}
