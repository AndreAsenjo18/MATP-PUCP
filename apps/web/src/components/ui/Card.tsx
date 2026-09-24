/**
 * Contenedor base (docs/system-design.md §3): fondo blanco, borde `borde`, esquinas redondeadas.
 * `interactive` añade el realce al pasar el cursor; `cardClassName` aplica el mismo estilo a un
 * `Link` u otro elemento.
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
    "rounded-lg border border-borde bg-white shadow-sm",
    padded && "p-4",
    interactive && "transition-shadow hover:border-terracota hover:shadow-md",
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
