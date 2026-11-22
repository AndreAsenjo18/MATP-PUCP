"use client";

/**
 * Visor de una foto con zoom (change `codigo-unico-y-ajustes-pantallas`, D4): la foto de la ficha a
 * toda la pantalla, para ver una firma, una marca o un deterioro.
 *
 * Se acerca y se aleja con los botones (44 px, también con el dedo), con la rueda del ratón, con
 * doble clic y con las teclas «+», «−» y «0». Acercada, la foto se recorre arrastrándola o con las
 * barras de desplazamiento. Es un `<dialog>` nativo, como los demás de la aplicación: «Esc» lo
 * cierra y el foco vuelve al botón que lo abrió.
 */
import { Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

import { Button } from "@/components/ui/Button";

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 6;
const ZOOM_FACTOR = 1.5;
/** El doble clic acerca hasta aquí, o vuelve a la foto entera si ya está acercada. */
const DOUBLE_CLICK_ZOOM = 2.5;

/** El siguiente nivel de zoom al acercar (+1) o alejar (−1), entre la foto entera y seis veces. */
export function zoomStep(zoom: number, direction: 1 | -1): number {
  const next = direction > 0 ? zoom * ZOOM_FACTOR : zoom / ZOOM_FACTOR;
  const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
  return Math.round(clamped * 100) / 100;
}

/** El zoom en palabras para el lector de pantalla y la barra: «Foto entera» o «250 %». */
export function zoomLabel(zoom: number): string {
  return zoom <= MIN_ZOOM ? "Foto entera" : `${Math.round(zoom * 100)} %`;
}

export interface PhotoZoomViewerProps {
  open: boolean;
  src: string;
  alt: string;
  /** Debajo de la barra: tipo de vista, restricción… */
  caption?: string;
  onClose: () => void;
}

export function PhotoZoomViewer({ open, src, alt, caption, onClose }: PhotoZoomViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setZoom(MIN_ZOOM);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // La rueda acerca y aleja la foto en vez de mover la página (el oyente no es pasivo).
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom((current) => zoomStep(current, event.deltaY < 0 ? 1 : -1));
    };
    area.addEventListener("wheel", onWheel, { passive: false });
    return () => area.removeEventListener("wheel", onWheel);
  }, []);

  function onKeyDown(event: ReactKeyboardEvent) {
    if (event.key === "+" || event.key === "=") setZoom((current) => zoomStep(current, 1));
    else if (event.key === "-" || event.key === "_") setZoom((current) => zoomStep(current, -1));
    else if (event.key === "0") setZoom(MIN_ZOOM);
    else return;
    event.preventDefault();
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const area = areaRef.current;
    if (!area || zoom <= MIN_ZOOM || event.pointerType === "touch") return;
    drag.current = { x: event.clientX, y: event.clientY, left: area.scrollLeft, top: area.scrollTop };
    area.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const area = areaRef.current;
    if (!area || !drag.current) return;
    area.scrollLeft = drag.current.left - (event.clientX - drag.current.x);
    area.scrollTop = drag.current.top - (event.clientY - drag.current.y);
  }

  const zoomed = zoom > MIN_ZOOM;
  const size = `${zoom * 100}%`;
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onKeyDown={onKeyDown}
      className="m-auto h-[calc(100dvh-2rem)] max-h-none w-[calc(100vw-2rem)] max-w-none overflow-hidden rounded-lg border border-borde bg-tinta p-0 text-crema backdrop:bg-tinta/70"
    >
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-crema/20 p-3">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-lg font-semibold">
              {alt}
            </h2>
            {caption && <p className="text-base text-crema/80">{caption}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" icon={ZoomOut} aria-label="Alejar" disabled={!zoomed} onClick={() => setZoom((current) => zoomStep(current, -1))} className="size-11 p-0" />
            <span role="status" className="min-w-24 text-center text-base font-semibold tabular-nums">
              {zoomLabel(zoom)}
            </span>
            <Button variant="secondary" icon={ZoomIn} aria-label="Acercar" disabled={zoom >= MAX_ZOOM} onClick={() => setZoom((current) => zoomStep(current, 1))} className="size-11 p-0" />
            <Button variant="secondary" icon={Maximize2} disabled={!zoomed} onClick={() => setZoom(MIN_ZOOM)}>
              Ajustar a la pantalla
            </Button>
            <Button variant="secondary" icon={X} aria-label="Cerrar la foto" onClick={() => dialogRef.current?.close()} className="size-11 p-0" />
          </div>
        </div>
        <div
          ref={areaRef}
          data-zoom-area=""
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onDoubleClick={() => setZoom((current) => (current > MIN_ZOOM ? MIN_ZOOM : DOUBLE_CLICK_ZOOM))}
          className={`min-h-0 flex-1 overflow-auto ${zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- URL prefirmada de corta duración, sin optimización de imagen remota */}
          <img src={src} alt={alt} onDragStart={(event) => event.preventDefault()} style={{ width: size, height: size }} className="max-w-none object-contain select-none" />
        </div>
      </div>
    </dialog>
  );
}
