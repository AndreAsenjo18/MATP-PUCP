"use client";

/**
 * Trama de rombos animada de la cabecera grande del Inicio (change `inicio-busqueda-ia`, D4). Dibuja
 * los mismos rombos que la imagen `trama-rombos` (celda de 72 px, anclada arriba a la derecha), pero
 * uno por uno en SVG para animarlos con CSS (`.trama-svg` en globals.css):
 *
 * - `tejiendo`: al montarse, cada rombo se dibuja con un retraso según su fila y columna.
 * - `quieta`: al terminar. Pasa a este estado para que quitar la ola no vuelva a tejer.
 * - `pensando`: mientras `pensando` es verdadero (Gemini interpretando la búsqueda).
 *
 * Decorativa: oculta a lectores de pantalla. Se mide con `ResizeObserver` y no se dibuja hasta
 * conocer su tamaño, así que el HTML del servidor solo lleva el contenedor.
 */
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

const CELDA = 72;
const MITAD = CELDA / 2;
const BORDE = 28;
const NUDO = 8.5;
/** Retraso por paso de diagonal y duración del último rombo; deben coincidir con globals.css. */
const PASO_MS = 45;
const ULTIMO_MS = 450 + 350;

export type EstadoTrama = "tejiendo" | "quieta" | "pensando";

export interface Rombo {
  x: number;
  y: number;
  /** Fila + columna: el orden en que se teje. */
  k: number;
  /** Columna contada desde la derecha: el desfase de la ola. */
  c: number;
}

/** Los rombos que cubren un área de `ancho` × `alto` px, anclados arriba a la derecha. */
export function rombosDeTrama(ancho: number, alto: number): Rombo[] {
  const columnas = Math.ceil(ancho / CELDA);
  const filas = Math.ceil(alto / CELDA);
  const rombos: Rombo[] = [];
  for (let fila = 0; fila < filas; fila++) {
    for (let columna = 0; columna < columnas; columna++) {
      rombos.push({ x: ancho - MITAD - columna * CELDA, y: MITAD + fila * CELDA, k: fila + columna, c: columna });
    }
  }
  return rombos;
}

/** Cuánto dura el tejido completo de esos rombos, en milisegundos. */
export function duracionTejido(rombos: readonly Rombo[]): number {
  const ultimo = rombos.reduce((max, rombo) => Math.max(max, rombo.k), 0);
  return ultimo * PASO_MS + ULTIMO_MS;
}

function rombo(x: number, y: number, r: number): string {
  return `M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z`;
}

function prefiereMenosMovimiento(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export function TramaRombos({ pensando = false, className }: { pensando?: boolean; className?: string }) {
  const contenedor = useRef<HTMLSpanElement>(null);
  const [tamano, setTamano] = useState<{ ancho: number; alto: number } | null>(null);
  const [tejida, setTejida] = useState(false);

  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(([entrada]) => {
      const { width, height } = entrada.contentRect;
      setTamano((actual) => (actual && actual.ancho === Math.round(width) && actual.alto === Math.round(height) ? actual : { ancho: Math.round(width), alto: Math.round(height) }));
    });
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  const rombos = tamano ? rombosDeTrama(tamano.ancho, tamano.alto) : [];
  const listo = rombos.length > 0;

  // Al conocer el tamaño por primera vez, se teje una sola vez; luego queda quieta.
  useEffect(() => {
    if (!listo || tejida) return;
    const espera = prefiereMenosMovimiento() ? 0 : duracionTejido(rombos);
    const temporizador = setTimeout(() => setTejida(true), espera);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo importa el primer tamaño conocido
  }, [listo, tejida]);

  const estado: EstadoTrama = pensando ? "pensando" : tejida ? "quieta" : "tejiendo";

  return (
    <span ref={contenedor} aria-hidden="true" data-trama="" className={cn("pointer-events-none absolute inset-y-0 right-0 -z-10", className)}>
      {tamano && (
        <svg className="trama-svg size-full" viewBox={`0 0 ${tamano.ancho} ${tamano.alto}`} data-estado={estado} focusable="false">
          {rombos.map(({ x, y, k, c }) => (
            <g key={`${k}-${c}`} style={{ "--k": k, "--c": c } as React.CSSProperties}>
              <path className="rombo-borde" pathLength={1} d={rombo(x, y, BORDE)} />
              <path className="rombo-nudo" d={rombo(x, y, NUDO)} />
            </g>
          ))}
        </svg>
      )}
    </span>
  );
}
