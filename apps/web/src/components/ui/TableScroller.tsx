"use client";

/**
 * Cuadro de una tabla ancha con flechas para desplazarla a los lados (Reportes). Solo comportamiento
 * visual: no cambia filas, columnas ni datos.
 *
 * - Las flechas aparecen solo cuando la tabla es más ancha que su cuadro; cada una desplaza unos
 *   cuatro quintos del ancho visible y se desactiva cuando ya no hay más hacia ese lado.
 * - Con «reducir movimiento», el desplazamiento es inmediato.
 * - El cuadro recibe el foco para recorrerlo también con las flechas del teclado, y su nombre lo
 *   anuncia el lector de pantalla.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { DISABLED_STYLES } from "./Button";
import { TABLE_BOX_CLASS } from "./Table";

export interface ScrollEdges {
  /** Queda tabla por ver a la izquierda. */
  left: boolean;
  /** Queda tabla por ver a la derecha. */
  right: boolean;
}

/** Hacia qué lados queda tabla por ver; 1 px de tolerancia por el redondeo del navegador. */
export function scrollEdges(scrollLeft: number, scrollWidth: number, clientWidth: number): ScrollEdges {
  return { left: scrollLeft > 1, right: scrollLeft + clientWidth < scrollWidth - 1 };
}

/** Cuánto del ancho visible avanza cada flecha: deja una columna a la vista como referencia. */
const STEP = 0.8;

const ARROW = `inline-flex size-11 items-center justify-center rounded-full border border-borde bg-white text-tinta shadow-sm hover:border-terracota hover:text-terracota focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota ${DISABLED_STYLES}`;

export function TableScroller({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<ScrollEdges>({ left: false, right: false });

  const update = useCallback(() => {
    const element = box.current;
    if (element) setEdges(scrollEdges(element.scrollLeft, element.scrollWidth, element.clientWidth));
  }, []);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    update();
    element.addEventListener("scroll", update, { passive: true });
    // Cambia al girar la pantalla, al plegar un grupo o al mostrar todas las columnas.
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [update]);

  const scroll = (direction: -1 | 1) => {
    const element = box.current;
    if (!element) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({ left: direction * element.clientWidth * STEP, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {(edges.left || edges.right) && (
        <div className="flex items-center justify-end gap-2">
          <button type="button" aria-controls={id} aria-label="Ver las columnas de la izquierda" title="Ver las columnas de la izquierda" disabled={!edges.left} onClick={() => scroll(-1)} className={ARROW}>
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <button type="button" aria-controls={id} aria-label="Ver las columnas de la derecha" title="Ver las columnas de la derecha" disabled={!edges.right} onClick={() => scroll(1)} className={ARROW}>
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        </div>
      )}
      <div id={id} ref={box} role="region" aria-label={label} tabIndex={0} className={cn(TABLE_BOX_CLASS, className)}>
        {children}
      </div>
    </div>
  );
}
