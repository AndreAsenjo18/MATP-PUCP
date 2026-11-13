/**
 * Botón base del sistema de diseño (docs/guia-visual.md). Forma de píldora, 44 px de alto como
 * mínimo y letra de 16 px en todos los tamaños, foco visible y estado deshabilitado atenuado
 * (RNF-010). La etiqueta salta de línea en vez de cortarse: el botón crece en alto. Un botón solo
 * con icono exige `aria-label`.
 */
import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "create" | "secondary" | "neutral" | "outline" | "danger" | "danger-outline";
export type ButtonSize = "sm" | "md" | "lg" | "touch";

interface ButtonBaseProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
}

export type ButtonProps = ButtonBaseProps &
  ({ children: ReactNode; "aria-label"?: string } | { children?: undefined; "aria-label": string });

const BASE_STYLES =
  "inline-flex items-center justify-center gap-2 rounded-full text-center font-semibold leading-snug transition-[translate] duration-150 ease-out focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota disabled:cursor-not-allowed disabled:opacity-50 motion-safe:enabled:hover:-translate-y-px motion-safe:enabled:active:translate-y-0";

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-terracota text-white shadow-sm hover:bg-terracota-dark",
  // Verde: la acción principal de crear o registrar (dirección B).
  create: "bg-verde-exito text-white shadow-sm hover:brightness-90",
  secondary: "border border-borde bg-crema text-tinta hover:bg-borde",
  // Blanco con borde arena, para acciones de apoyo dentro de una tarjeta blanca («Limpiar filtros»).
  neutral: "border border-borde bg-white text-tinta hover:border-gris-texto hover:bg-crema-light",
  outline: "border border-terracota bg-white text-terracota hover:bg-terracota-light",
  danger: "bg-carmin-peligro text-white shadow-sm hover:bg-carmin-texto",
  // Lo destructivo que no es la confirmación final («Eliminar pieza»): discreto, con borde y texto ladrillo.
  "danger-outline": "border border-carmin-peligro bg-white text-carmin-texto hover:bg-carmin-bg",
};

const SIZES: Record<ButtonSize, string> = {
  // Compacto para tablas y barras: poco relleno, pero nunca menos de 44 px ni de 16 px.
  sm: "min-h-11 gap-1.5 px-3.5 py-2 text-base",
  md: "min-h-11 px-5 py-2.5 text-base",
  lg: "min-h-14 px-6 py-3 text-lg",
  // Más relleno en pantallas estrechas y táctiles, menos desde 1024 px, con los mismos mínimos.
  touch: "min-h-12 px-4 py-3 text-base lg:min-h-11 lg:px-3.5 lg:py-2",
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
      {Icon && <Icon size={size === "lg" ? 22 : 20} aria-hidden="true" className="shrink-0" />}
      {children}
    </button>
  );
}
