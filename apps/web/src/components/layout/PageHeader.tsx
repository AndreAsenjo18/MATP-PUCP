/**
 * Cabecera de página de la dirección B (change `remodelacion-visual`; docs/guia-visual.md): un panel
 * terracota de esquinas muy redondeadas con el título en Manrope 800, la línea de ayuda si la
 * pantalla ya la tiene y, desde 768 px, la trama de rombos a la derecha, decorativa y nunca detrás
 * del texto.
 *
 * - `grande`: solo el Inicio. Nombre del museo arriba, título grande y lo que se le pase como hijo
 *   (el buscador).
 * - `compacta`: el resto de pantallas. Poca altura (de 96 a 128 px con una línea de ayuda) y las
 *   acciones principales dentro de la banda, como píldoras crema (`headerActionClassName`).
 *
 * Todo el texto va en crema sobre terracota (contraste 5,7:1). El foco dentro de la banda es crema,
 * porque el contorno terracota del sistema no se vería sobre ella.
 */
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type PageHeaderSize = "grande" | "compacta";

export interface PageHeaderProps {
  title: ReactNode;
  /** Línea de ayuda bajo el título, solo si la pantalla ya la tenía. */
  description?: ReactNode;
  /** Texto pequeño sobre el título (el nombre del museo en el Inicio). */
  eyebrow?: ReactNode;
  /** Acciones principales de la pantalla, dentro de la banda. */
  actions?: ReactNode;
  /** «Volver a …» como píldora crema arriba de la banda (maqueta B de la ficha). */
  back?: { href: string; label: ReactNode };
  /** Insignias junto al título, en la misma línea si caben (el código y la tenencia de la ficha). */
  meta?: ReactNode;
  /** Contenido extra dentro de la banda, bajo el título (el buscador del Inicio). */
  children?: ReactNode;
  size?: PageHeaderSize;
  /** `id` del título, para las secciones que se etiquetan con él. */
  titleId?: string;
  className?: string;
}

/** Píldora crema con texto oscuro para las acciones dentro de la banda; 44 px de alto y foco crema. */
export const headerActionClassName =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-crema px-5 py-2.5 text-center text-base font-bold text-tinta shadow-sm transition-[translate] duration-150 ease-out hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-crema motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0";

export function PageHeader({ title, description, eyebrow, actions, back, meta, children, size = "compacta", titleId, className }: PageHeaderProps) {
  const large = size === "grande";
  return (
    <header
      className={cn(
        "relative isolate overflow-hidden rounded-panel bg-terracota text-crema shadow-sm",
        // Compacta: de 96 px (solo título) a 128 px (título y dos líneas de ayuda), centrada en alto.
        large ? "px-6 py-8 sm:px-10 sm:py-10" : "flex min-h-24 flex-col justify-center px-5 py-4 sm:px-7",
        className,
      )}
    >
      {/* La trama ocupa la franja derecha; el contenido deja ese espacio libre (md:pr-*). */}
      <span
        aria-hidden="true"
        data-trama=""
        className={cn(
          "trama-rombos pointer-events-none absolute inset-y-0 right-0 -z-10 hidden md:block",
          large ? "w-[40%]" : "w-[min(34%,20rem)] [--trama-tamano:3.5rem]",
        )}
      />
      <div className={cn("flex flex-col", large ? "gap-6 md:pr-[36%]" : "gap-4 md:flex-row md:items-center md:justify-between md:pr-[min(28%,16rem)]")}>
        <div className="flex min-w-0 flex-col gap-1.5">
          {back && <BandBackLink href={back.href}>{back.label}</BandBackLink>}
          {eyebrow && <p className="text-base font-semibold">{eyebrow}</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 id={titleId} className={cn("text-balance break-words", large ? "text-titulo" : "text-titulo-trabajo")}>
              {title}
            </h1>
            {meta}
          </div>
          {description && <p className="max-w-3xl text-base">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        {children}
      </div>
    </header>
  );
}

/**
 * «Volver a …» dentro de la banda: una píldora crema de 32 px, como en la maqueta, con un área de
 * toque de 44 px. El foco se dibuja alrededor de la píldora.
 */
function BandBackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="group -my-1.5 inline-flex min-h-11 items-center self-start focus-visible:outline-none">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-crema px-3 py-1 text-base font-semibold text-tinta group-hover:bg-white group-focus-visible:outline-3 group-focus-visible:outline-offset-2 group-focus-visible:outline-crema">
        <ArrowLeft size={18} aria-hidden="true" className="shrink-0" />
        {children}
      </span>
    </Link>
  );
}
