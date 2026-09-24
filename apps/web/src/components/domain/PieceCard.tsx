/**
 * Tarjeta de pieza para resultados de búsqueda e inventario (docs/system-design.md §4; `CardPieza`
 * en el documento del equipo). Muestra el mismo badge de tenencia y las mismas alertas que la ficha.
 */
import { ImageOff, MapPin } from "lucide-react";
import Link from "next/link";

import { cardClassName } from "@/components/ui/Card";
import type { ApiSchemas } from "@/lib/api/client";

import { AlertBadge, TenureBadge } from "./StatusBadges";

type PieceAlert = ApiSchemas["PieceAlert"];

export interface PieceCardProps {
  href: string;
  title: string;
  inventoryCode: string | null;
  collectionName: string | null;
  locationLabel: string | null;
  tenureRegime: ApiSchemas["TenureRegime"];
  alerts?: PieceAlert[];
  hasPhoto: boolean;
}

/** Props de la tarjeta a partir del resumen de pieza del contrato de la API. */
export function pieceCardProps(piece: ApiSchemas["PieceSummary"], alerts: PieceAlert[] = []): PieceCardProps {
  return {
    href: `/piezas/${piece.id}`,
    title: piece.title,
    inventoryCode: piece.inventory_code,
    collectionName: piece.collection?.name ?? null,
    locationLabel: piece.location_label,
    tenureRegime: piece.tenure_regime,
    alerts,
    hasPhoto: piece.media_count > 0,
  };
}

export function PieceCard({ href, title, inventoryCode, collectionName, locationLabel, tenureRegime, alerts = [], hasPhoto }: PieceCardProps) {
  // «Sin foto» se muestra en el pie de la tarjeta; no se repite como badge.
  const badges = alerts.filter((alert) => alert.applies && alert.type !== "WITHOUT_PHOTO");
  return (
    <Link href={href} className={cardClassName({ interactive: true, className: "flex flex-col gap-2 focus-visible:outline-2 focus-visible:outline-terracota" })}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-sm font-bold text-terracota">{inventoryCode ?? "Sin código I"}</span>
        <TenureBadge regime={tenureRegime} />
      </div>
      <h3 className="line-clamp-2 text-lg font-semibold text-tinta" title={title}>
        {title}
      </h3>
      <p className="text-sm text-gris-texto">{collectionName ?? "Sin colección"}</p>
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {badges.map((alert) => (
            <AlertBadge key={alert.type} alert={alert} />
          ))}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-borde pt-3 text-sm text-gris-texto">
        <span className="flex items-center gap-1">
          <MapPin size={16} aria-hidden="true" className="text-terracota" />
          {locationLabel ?? "Sin ubicación"}
        </span>
        {!hasPhoto && (
          <span className="flex items-center gap-1 font-medium text-ambar-texto" title="Requiere fotografía">
            <ImageOff size={16} aria-hidden="true" />
            Sin foto
          </span>
        )}
      </div>
    </Link>
  );
}
