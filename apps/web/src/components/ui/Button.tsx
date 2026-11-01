/**
 * Botón base del sistema de diseño (docs/system-design.md §3). Altura mínima de 44 px, foco
 * visible y estado deshabilitado atenuado (RNF-010). Un botón solo con icono exige `aria-label`.
 */
import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "touch";

interface ButtonBaseProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
}

export type ButtonProps = ButtonBaseProps &
  ({ children: ReactNode; "aria-label"?: string } | { children?: undefined; "aria-label": string });

const BASE_STYLES =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota disabled:cursor-not-allowed disabled:opacity-50";

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-terracota text-white hover:bg-terracota-dark",
  secondary: "bg-crema text-tinta hover:bg-borde",
  outline: "border border-terracota bg-white text-terracota hover:bg-terracota-light",
  danger: "bg-carmin-peligro text-white hover:bg-carmin-texto",
};

const SIZES: Record<ButtonSize, string> = {
  // Compacto para tablas y barras de Administración (escritorio): 32 px de alto, por encima del mínimo de WCAG 2.2.
  sm: "min-h-8 gap-1.5 px-2.5 py-1 text-sm",
  md: "min-h-11 px-4 py-2 text-base",
  lg: "min-h-11 px-5 py-4 text-lg font-semibold",
  // Grande y táctil en celular (44 px), compacto desde md: para pantallas que se usan en ambos.
  touch: "min-h-11 px-4 py-3 text-base font-semibold md:min-h-9 md:gap-1.5 md:px-3 md:py-1.5 md:text-sm",
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
      {Icon && <Icon size={size === "sm" ? 16 : 18} aria-hidden="true" />}
      {children}
    </button>
  );
}
