/**
 * Pieza en los resultados de búsqueda (docs/system-design.md §4; `CardPieza` en el documento del
 * equipo), como fila de la maqueta B: el código en terracota, el nombre grande, debajo la colección y
 * la ubicación en tono tenue, las insignias (tenencia, alertas, «Sin foto») y una flecha. Toda la fila
 * es el enlace a la ficha. Muestra el mismo badge de tenencia y las mismas alertas que la ficha.
 *
 * Desde 1024 px los datos van en una sola fila de unos 84 px; por debajo, el código, el nombre y las
 * insignias se apilan. Los textos largos saltan de línea: no se cortan.
 */
import { ArrowRight, ImageOff, MapPin } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/cn";
import type { ApiSchemas } from "@/lib/api/client";

import { AlertBadge, TenureBadge } from "./StatusBadges";
import type { TenureRegimeLabel } from "./status-intents";

type PieceAlert = ApiSchemas["PieceAlert"];

export interface PieceCardProps {
  href: string;
  title: string;
  inventoryCode: string | null;
  collectionName: string | null;
  locationLabel: string | null;
  tenureRegime: TenureRegimeLabel | string;
  alerts?: PieceAlert[];
  hasPhoto: boolean;
  /** Miniatura de la foto principal (búsqueda en modo `live`). */
  thumbnailUrl?: string | null;
  /** Qué coincidió con la búsqueda, en lenguaje claro (RF-031). */
  matchReason?: string | null;
  /** «visto hace N días», solo para quien puede ver la ubicación (fusion-busqueda-deposito 3.3). */
  seenText?: string | null;
  /** Menos relleno por debajo de 1024 px, para ver más resultados en tableta (fusion-busqueda-deposito D4). */
  compact?: boolean;
}

/** Props de la fila a partir del resumen de pieza del contrato de la API. */
export function pieceCardProps(piece: ApiSchemas["PieceSummary"], alerts: PieceAlert[] = []): PieceCardProps {
  return {
    href: `/piezas/${piece.id}`,
    title: piece.denomination,
    inventoryCode: piece.code_i,
    collectionName: piece.collection?.name ?? null,
    locationLabel: piece.location_label,
    tenureRegime: piece.tenure_regime,
    alerts,
    hasPhoto: piece.media_count > 0,
  };
}

export function PieceCard({
  href,
  title,
  inventoryCode,
  collectionName,
  locationLabel,
  tenureRegime,
  alerts = [],
  hasPhoto,
  thumbnailUrl,
  matchReason,
  seenText,
  compact = false,
}: PieceCardProps) {
  // «Sin foto» va con las insignias; no se repite como alerta.
  const badges = alerts.filter((alert) => alert.applies && alert.type !== "MISSING_PHOTO");
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-21 items-center gap-4 rounded-tarjeta border border-borde bg-white shadow-sm transition-[translate] duration-150 ease-out hover:border-terracota hover:shadow-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0",
        compact ? "px-4 py-3 lg:px-5 lg:py-4" : "px-5 py-4",
      )}
    >
      {thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- URL prefirmada del almacenamiento
        <img src={thumbnailUrl} alt="" loading="lazy" className="size-14 shrink-0 rounded-md bg-crema object-cover" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:gap-5">
        <span className="shrink-0 font-mono text-base font-bold text-terracota lg:w-32">{inventoryCode ?? "Sin código I"}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-lg font-bold break-words text-tinta">{title}</h3>
          <p className="flex flex-wrap items-center gap-x-1.5 text-base text-gris-texto">
            <span>{collectionName ?? "Sin colección"}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin size={16} aria-hidden="true" className="shrink-0 text-terracota" />
              {locationLabel ?? "Sin ubicación"}
              {seenText && <span> · {seenText}</span>}
            </span>
          </p>
          {matchReason && <p className="mt-1 self-start rounded-md bg-crema px-2 py-0.5 text-base text-tinta">{matchReason}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 lg:max-w-[45%] lg:justify-end">
          <TenureBadge regime={tenureRegime} />
          {badges.map((alert) => (
            <AlertBadge key={alert.type} alert={alert} />
          ))}
          {!hasPhoto && (
            <span className="inline-flex items-center gap-1 font-medium text-ambar-texto" title="Requiere fotografía">
              <ImageOff size={16} aria-hidden="true" />
              Sin foto
            </span>
          )}
        </div>
      </div>
      <ArrowRight
        size={20}
        aria-hidden="true"
        className="shrink-0 text-terracota transition-[translate] duration-150 ease-out group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0"
      />
    </Link>
  );
}
