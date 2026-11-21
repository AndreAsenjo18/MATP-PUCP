"use client";

/**
 * La foto principal en «Datos generales» de la ficha (change `codigo-unico-y-ajustes-pantallas`,
 * D3): antes había que abrir «Fotografías» para ver la pieza. Se amplía con zoom, como en la
 * galería, y lleva a todas las fotos. Funciona igual en modo `mock` y `live` (`fetchPieceMedia`).
 */
import { Images, ImageOff, ZoomIn } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { PhotoZoomViewer } from "@/components/domain/PhotoZoomViewer";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSession } from "@/lib/auth/session";
import { fetchPieceMedia, initialPhoto, restrictionLabel, type PieceMedia } from "@/lib/data/media";

export interface PrimaryPhotoViewProps {
  /** `undefined` mientras carga; `null` si la pieza no tiene fotos o no se pudieron leer. */
  photo: PieceMedia | null | undefined;
  total: number;
  pieceTitle: string;
  onShowAll?: () => void;
}

/** Presentación (probada con HTML estático, ADR-012). */
export function PrimaryPhotoView({ photo, total, pieceTitle, onShowAll }: PrimaryPhotoViewProps) {
  const [zoomed, setZoomed] = useState(false);
  if (photo === undefined) {
    return (
      <Card as="section" aria-label="Foto principal" className="flex min-h-48 items-center justify-center text-base text-gris-texto">
        Cargando la foto…
      </Card>
    );
  }
  if (photo === null || !photo.download_url) {
    return (
      <Card as="section" aria-label="Foto principal" className="flex flex-col items-center justify-center gap-3 border-dashed text-center text-base text-gris-texto">
        <ImageOff size={28} aria-hidden="true" />
        <p>{photo === null ? "La pieza aún no tiene fotos." : "La foto principal aún no tiene vista previa."}</p>
        {onShowAll && (
          <Button variant="secondary" icon={Images} onClick={onShowAll}>
            {photo === null ? "Ir a Fotografías" : "Ver las fotos"}
          </Button>
        )}
      </Card>
    );
  }
  const view = photo.view_type?.label ?? "Vista sin especificar";
  const alt = `${pieceTitle} — ${view}`;
  const restriction = restrictionLabel(photo);
  return (
    <Card as="section" aria-label="Foto principal" className="flex flex-col gap-3">
      <button
        type="button"
        aria-label={`Ampliar la foto principal: ${view}`}
        onClick={() => setZoomed(true)}
        className="cursor-zoom-in rounded-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- URL prefirmada de corta duración, sin optimización de imagen remota */}
        <img src={photo.download_url} alt={alt} className="max-h-80 w-full rounded-md bg-crema object-contain" />
      </button>
      <p className="text-base text-gris-texto">
        {view}
        {restriction ? ` · ${restriction}` : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon={ZoomIn} onClick={() => setZoomed(true)}>
          Ampliar
        </Button>
        {onShowAll && (
          <Button variant="secondary" icon={Images} onClick={onShowAll}>
            {total === 1 ? "Ver la foto en Fotografías" : `Ver las ${total} fotos`}
          </Button>
        )}
      </div>
      <PhotoZoomViewer open={zoomed} src={photo.download_url} alt={alt} caption={restriction ?? undefined} onClose={() => setZoomed(false)} />
    </Card>
  );
}

/** Lee las fotos de la pieza; `version` cambia cuando la galería agrega, retira o cambia la principal. */
export function PiecePrimaryPhoto({ pieceId, pieceTitle, version = 0, onShowAll }: { pieceId: string; pieceTitle: string; version?: number; onShowAll?: () => void }) {
  const { currentUser } = useSession();
  const devUser = currentUser?.email;
  const [state, setState] = useState<{ key: string; media: PieceMedia[] | null } | null>(null);
  const key = `${pieceId}:${version}`;

  useEffect(() => {
    let active = true;
    fetchPieceMedia(pieceId, devUser).then((result) => {
      if (active) setState({ key, media: result.status === "ok" ? result.media : null });
    });
    return () => {
      active = false;
    };
  }, [pieceId, devUser, key]);

  const media = state?.key === key ? state.media : undefined;
  const photo = media === undefined ? undefined : media === null ? null : initialPhoto(media);
  return <PrimaryPhotoView photo={photo} total={media?.length ?? 0} pieceTitle={pieceTitle} onShowAll={onShowAll} />;
}

/** «Datos generales» con la foto principal al lado; en un celular, la foto va arriba. */
export function GeneralDataWithPhoto({ photo, children }: { photo: ReactNode; children: ReactNode }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
      <div className="min-w-0 lg:order-2">{photo}</div>
      <div className="min-w-0 lg:order-1">{children}</div>
    </div>
  );
}
