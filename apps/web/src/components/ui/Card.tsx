/**
 * Superficie base (docs/guia-visual.md): fondo blanco, borde arena, esquinas de 24 px y sombra
 * cálida suave. `interactive` añade las respuestas a cursor, pulsación y teclado, con un movimiento
 * corto que desaparece si la persona pidió menos movimiento. `cardClassName` aplica el mismo estilo
 * a un `Link` u otro elemento.
 */
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type CardElement = "div" | "section" | "article" | "li" | "aside";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: CardElement;
  interactive?: boolean;
  padded?: boolean;
  children: ReactNode;
}

export function cardClassName({
  interactive = false,
  padded = true,
  className,
}: { interactive?: boolean; padded?: boolean; className?: string } = {}): string {
  return cn(
    "rounded-tarjeta border border-borde bg-white shadow-sm",
    padded && "p-5",
    interactive &&
      "transition-[translate] duration-150 ease-out hover:border-terracota hover:shadow-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0",
    className,
  );
}

export function Card({ as: Element = "div", interactive, padded, className, children, ...props }: CardProps) {
  return (
    <Element className={cardClassName({ interactive, padded, className })} {...props}>
      {children}
    </Element>
  );
}
