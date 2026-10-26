"use client";

/**
 * Galería de la ficha en modo `live` (change `fotografias-multiples-por-pieza`, tarea 3.2):
 * miniaturas y visor con las URL prefirmadas de la API, y la etiqueta de restricción de cada foto
 * (RN-008). Ver la foto dentro del sistema es uso interno; la galería no ofrece descargas.
 *
 * Mínima a propósito: el selector de tipo de vista, el reordenamiento, la marca de principal y
 * el retiro con motivo quedan pendientes en la tarea.
 */
import { ImageOff, Star, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useSession } from "@/lib/auth/session";
import { fetchPieceMedia, initialPhoto, restrictionLabel, type PieceMedia, type PieceMediaResult } from "@/lib/data/media";
import { cn } from "@/lib/cn";

const viewLabel = (asset: PieceMedia) => asset.view_type?.label ?? "Vista sin especificar";

export interface PieceGalleryViewProps {
  media: PieceMedia[];
  pieceTitle: string;
  selectedId: string | null;
  onSelect?: (id: string) => void;
}

/** Vista sin estado de la galería (se prueba como HTML estático, ADR-012). */
export function PieceGalleryView({ media, pieceTitle, selectedId, onSelect }: PieceGalleryViewProps) {
  if (media.length === 0) {
    return (
      <Card as="section" aria-label="Fotografías" className="flex items-center justify-center gap-2 border-dashed text-base text-gris-texto">
        <ImageOff size={20} aria-hidden="true" />
        Sin fotografías registradas.
      </Card>
    );
  }
  const selected = media.find((asset) => asset.id === selectedId) ?? initialPhoto(media)!;
  const restriction = restrictionLabel(selected);
  return (
    <Card as="section" aria-label="Fotografías" className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-tinta">Fotografías</h2>
      <figure className="flex flex-col gap-2">
        {selected.download_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL prefirmada de corta duración, sin optimización de imagen remota
          <img src={selected.download_url} alt={`${pieceTitle} — ${viewLabel(selected)}`} className="max-h-[420px] w-full rounded-md bg-crema object-contain" />
        ) : (
          <div className="flex h-48 items-center justify-center gap-2 rounded-md bg-crema text-sm text-gris-texto">
            <ImageOff size={18} aria-hidden="true" />
            Vista previa no disponible.
          </div>
        )}
        <figcaption className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-tinta">{viewLabel(selected)}</span>
          {selected.is_primary && (
            <Badge icon={Star} className="self-start">
              Principal
            </Badge>
          )}
          {restriction && (
            <Badge intent="warning" icon={TriangleAlert} className="self-start">
              {restriction}
            </Badge>
          )}
        </figcaption>
      </figure>
      <ul className="flex flex-wrap gap-2" aria-label="Miniaturas">
        {media.map((asset, index) => (
          <li key={asset.id}>
            <button
              type="button"
              aria-pressed={asset.id === selected.id}
              aria-label={`Ver foto ${index + 1}: ${viewLabel(asset)}`}
              onClick={() => onSelect?.(asset.id)}
              className={cn(
                "flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border-2 bg-crema",
                asset.id === selected.id ? "border-terracota" : "border-borde opacity-80 hover:opacity-100",
              )}
            >
              {asset.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- miniatura prefirmada
                <img src={asset.thumbnail_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageOff size={18} aria-hidden="true" className="text-gris-texto" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Galería con estado: carga las fotos de la pieza y permite elegir cuál ver. */
export function PieceGallery({ pieceId, pieceTitle }: { pieceId: string; pieceTitle: string }) {
  const { currentUser } = useSession();
  const devUser = currentUser?.email;
  const key = `${pieceId}|${devUser ?? ""}`;
  const [loaded, setLoaded] = useState<{ key: string; result: PieceMediaResult } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchPieceMedia(pieceId, devUser).then((result) => {
      if (active) setLoaded({ key, result });
    });
    return () => {
      active = false;
    };
  }, [pieceId, devUser, key]);

  if (loaded?.key !== key) {
    return (
      <p role="status" className="text-base text-gris-texto">
        Cargando las fotografías…
      </p>
    );
  }
  if (loaded.result.status !== "ok") {
    return (
      <p role="alert" className="rounded-md bg-carmin-bg p-3 text-base text-carmin-texto">
        {loaded.result.message}
      </p>
    );
  }
  return <PieceGalleryView media={loaded.result.media} pieceTitle={pieceTitle} selectedId={selectedId} onSelect={setSelectedId} />;
}
