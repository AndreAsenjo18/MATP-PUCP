"use client";

/**
 * Galería de la ficha en modo `live` (change `fotografias-multiples-por-pieza`, tarea 3.2):
 * miniaturas y visor con las URL prefirmadas de la API, y la restricción efectiva de cada foto con su
 * origen (RN-008). Ver la foto dentro del sistema es uso interno; la galería no ofrece descargas.
 *
 * Quien tiene `media.upload` agrega fotos, cambia el tipo de vista, las reordena y marca la principal;
 * quien tiene `media.retire` las retira con motivo. Sin esos permisos, la galería solo se ve.
 *
 * Las acciones son sobre la foto elegida, con botones de 44 px en cualquier ancho. El orden se cambia
 * con «Mover antes» y «Mover después»: arrastrar no funciona con el dedo en una tableta ni con teclado.
 */
import { Archive, ArrowLeft, ArrowRight, ImageOff, Star, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Notice } from "@/components/domain/AdminShell";
import { ConfirmButton } from "@/components/domain/ConfirmButton";
import { PiecePhotoUpload } from "@/components/domain/PiecePhotoUpload";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { useSession } from "@/lib/auth/session";
import {
  fetchPieceMedia,
  fetchViewTypes,
  initialPhoto,
  movedOrder,
  provenanceText,
  reorderPieceMedia,
  restrictionLabel,
  retirePieceMedia,
  updatePieceMedia,
  viewCounts,
  type PieceMedia,
  type PieceMediaResult,
} from "@/lib/data/media";
import type { TermOption } from "@/lib/data/pieces";
import { cn } from "@/lib/cn";

/** Los derivados se generan después de registrar: se vuelve a leer la galería tras este tiempo. */
const DERIVATIVES_WAIT_MS = 4000;
/** Una imagen que falla tras este tiempo pudo vencer su enlace: se piden enlaces nuevos una vez. */
const SIGNED_URL_RETRY_MS = 60_000;
/** Mismo mínimo que la API para el motivo de un retiro. */
const MIN_REASON_LENGTH = 3;

const viewLabel = (asset: PieceMedia) => asset.view_type?.label ?? "Vista sin especificar";

/** Imagen prefirmada que, si no carga (derivado aún no listo, TIFF, enlace vencido), muestra su reemplazo. */
function GalleryImage({ src, alt, className, fallback, onFailed }: { src: string; alt: string; className: string; fallback: ReactNode; onFailed?: () => void }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL prefirmada de corta duración, sin optimización de imagen remota
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => {
        setFailedSrc(src);
        onFailed?.();
      }}
    />
  );
}

export interface PieceGalleryActions {
  viewTypes: readonly TermOption[];
  /** Hay una operación en curso: se desactivan las demás. */
  busy: boolean;
  /** `media.upload`: tipo de vista, orden y principal. */
  canEdit: boolean;
  /** `media.retire`. */
  canRetire: boolean;
  message: string | null;
  error: string | null;
  onViewType: (id: string, termId: string) => void;
  onMakePrimary: (id: string) => void;
  onMove: (id: string, delta: -1 | 1) => void;
  onRetire: (id: string, reason: string) => void;
}

/** Lo que se puede hacer con la foto elegida. */
function PhotoActions({ media, selected, actions }: { media: PieceMedia[]; selected: PieceMedia; actions: PieceGalleryActions }) {
  const position = media.findIndex((asset) => asset.id === selected.id);
  const { busy, canEdit, canRetire, viewTypes } = actions;
  const known = viewTypes.some((option) => option.id === selected.view_type?.id);
  return (
    <div role="group" aria-label="Acciones sobre esta foto" className="flex flex-col gap-3 border-t border-borde pt-3">
      <p className="text-sm text-gris-texto">
        Foto {position + 1} de {media.length}
      </p>
      {canEdit && viewTypes.length > 0 && (
        <Select
          label="Tipo de vista"
          value={selected.view_type?.id ?? ""}
          disabled={busy}
          className="p-2.5"
          fieldClassName="sm:max-w-xs"
          onChange={(event) => {
            if (event.target.value) actions.onViewType(selected.id, event.target.value);
          }}
        >
          {!known && <option value={selected.view_type?.id ?? ""}>{viewLabel(selected)}</option>}
          {viewTypes.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      )}
      <div className="flex flex-wrap gap-2">
        {canEdit && !selected.is_primary && (
          <Button variant="secondary" icon={Star} disabled={busy} onClick={() => actions.onMakePrimary(selected.id)}>
            Marcar como principal
          </Button>
        )}
        {canEdit && media.length > 1 && (
          <>
            <Button variant="secondary" icon={ArrowLeft} disabled={busy || position === 0} onClick={() => actions.onMove(selected.id, -1)}>
              Mover antes
            </Button>
            <Button variant="secondary" icon={ArrowRight} disabled={busy || position === media.length - 1} onClick={() => actions.onMove(selected.id, 1)}>
              Mover después
            </Button>
          </>
        )}
        {canRetire && (
          <ConfirmButton
            label="Retirar foto"
            variant="danger"
            icon={Archive}
            disabled={busy}
            requireReason
            minReasonLength={MIN_REASON_LENGTH}
            reasonLabel={`Motivo (al menos ${MIN_REASON_LENGTH} caracteres)`}
            dialogSize="lg"
            confirmTitle="Retirar fotografía"
            confirmLabel="Retirar"
            confirmDescription={`La foto deja de verse en la ficha, pero no se borra: un Administrador puede restaurarla desde la Papelera.${selected.is_primary ? " Como es la principal, pasa a serlo la siguiente en orden." : ""}`}
            onConfirm={(reason) => actions.onRetire(selected.id, reason)}
          />
        )}
      </div>
      <Notice message={actions.message} error={actions.error} />
    </div>
  );
}

/**
 * Qué vistas tiene la pieza y cuántas fotos de cada una (change `aviso-fotos-repetidas`, C6): una vista
 * con varias fotos se marca para revisar, sin bloquear nada.
 */
export function ViewSummary({ media }: { media: readonly Pick<PieceMedia, "view_type">[] }) {
  const counts = viewCounts(media);
  return (
    <p className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-gris-texto">
      <span className="font-medium text-tinta">Vistas:</span>
      {counts.map((view, index) => {
        const repeated = view.count > 1 && !view.unspecified;
        return (
          <span key={view.label} className={cn("inline-flex items-center gap-1", repeated && "font-medium text-ambar-texto")}>
            {repeated && <TriangleAlert size={14} aria-hidden="true" />}
            {view.label}
            {view.count > 1 && ` (${view.count}${repeated ? ", repetida" : ""})`}
            {index < counts.length - 1 && <span aria-hidden="true">·</span>}
          </span>
        );
      })}
    </p>
  );
}

export interface PieceGalleryViewProps {
  media: PieceMedia[];
  pieceTitle: string;
  selectedId: string | null;
  onSelect?: (id: string) => void;
  /** Sin ellas, la galería solo se ve. */
  actions?: PieceGalleryActions;
  onImageFailed?: () => void;
}

/** Vista sin estado de la galería (se prueba como HTML estático, ADR-012). */
export function PieceGalleryView({ media, pieceTitle, selectedId, onSelect, actions, onImageFailed }: PieceGalleryViewProps) {
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
  const noPreview = (
    <div className="flex h-48 items-center justify-center gap-2 rounded-md bg-crema text-sm text-gris-texto">
      <ImageOff size={18} aria-hidden="true" />
      Vista previa no disponible.
    </div>
  );
  return (
    <Card as="section" aria-label="Fotografías" className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-tinta">Fotografías</h2>
      <figure className="flex flex-col gap-2">
        {selected.download_url ? (
          <GalleryImage src={selected.download_url} alt={`${pieceTitle} — ${viewLabel(selected)}`} className="max-h-[420px] w-full rounded-md bg-crema object-contain" fallback={noPreview} onFailed={onImageFailed} />
        ) : (
          noPreview
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
        {provenanceText(selected) && (
          <p className="text-sm text-gris-texto">
            <span className="font-medium">Procedencia:</span> {provenanceText(selected)}
          </p>
        )}
      </figure>
      <ul className="flex flex-wrap gap-2" aria-label="Miniaturas">
        {media.map((asset, index) => (
          <li key={asset.id}>
            <button
              type="button"
              aria-pressed={asset.id === selected.id}
              aria-label={`Ver foto ${index + 1}: ${viewLabel(asset)}${asset.is_primary ? " (principal)" : ""}`}
              onClick={() => onSelect?.(asset.id)}
              className={cn(
                "relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border-2 bg-crema",
                asset.id === selected.id ? "border-terracota" : "border-borde opacity-80 hover:opacity-100",
              )}
            >
              {asset.thumbnail_url ? (
                <GalleryImage src={asset.thumbnail_url} alt="" className="h-full w-full object-cover" fallback={<ImageOff size={18} aria-hidden="true" className="text-gris-texto" />} />
              ) : (
                <ImageOff size={18} aria-hidden="true" className="text-gris-texto" />
              )}
              {asset.is_primary && (
                <span className="absolute right-0.5 top-0.5 rounded-full bg-white p-0.5 text-terracota">
                  <Star size={12} aria-hidden="true" className="fill-current" />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {media.length > 1 && <ViewSummary media={media} />}
      {actions && (actions.canEdit || actions.canRetire) && <PhotoActions media={media} selected={selected} actions={actions} />}
    </Card>
  );
}

/** Galería con estado: carga las fotos de la pieza y aplica las acciones según los permisos del rol. */
export function PieceGallery({ pieceId, pieceTitle, onChanged }: { pieceId: string; pieceTitle: string; onChanged?: () => void }) {
  const { currentUser, hasPermission } = useSession();
  const devUser = currentUser?.email;
  const key = `${pieceId}|${devUser ?? ""}`;
  const canEdit = hasPermission("media.upload");
  const canRetire = hasPermission("media.retire");
  const [loaded, setLoaded] = useState<{ key: string; result: PieceMediaResult } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewTypes, setViewTypes] = useState<TermOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastLoad = useRef(0);
  const derivativesTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const reload = useCallback(async () => {
    const result = await fetchPieceMedia(pieceId, devUser);
    lastLoad.current = Date.now();
    setLoaded({ key, result });
  }, [pieceId, devUser, key]);

  useEffect(() => {
    let active = true;
    fetchPieceMedia(pieceId, devUser).then((result) => {
      if (!active) return;
      lastLoad.current = Date.now();
      setLoaded({ key, result });
    });
    return () => {
      active = false;
    };
  }, [pieceId, devUser, key]);

  useEffect(() => {
    let active = true;
    if (canEdit) {
      fetchViewTypes().then((options) => {
        if (active) setViewTypes(options);
      });
    }
    return () => {
      active = false;
    };
  }, [canEdit]);

  useEffect(() => () => clearTimeout(derivativesTimer.current), []);

  /** Aplica una acción y vuelve a leer la galería: el orden y la principal los decide el servidor. */
  async function act(work: () => Promise<{ status: string; message?: string }>, done: string) {
    setBusy(true);
    setMessage(null);
    setError(null);
    const result = await work();
    if (result.status === "ok") setMessage(done);
    else setError(result.message ?? "No se pudo completar la acción.");
    await reload();
    setBusy(false);
    onChanged?.();
  }

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
  const media = loaded.result.media;
  return (
    <div className="flex flex-col gap-4">
      <PieceGalleryView
        media={media}
        pieceTitle={pieceTitle}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onImageFailed={() => {
          if (Date.now() - lastLoad.current > SIGNED_URL_RETRY_MS) void reload();
        }}
        actions={{
          viewTypes,
          busy,
          canEdit,
          canRetire,
          message,
          error,
          onViewType: (id, termId) => void act(() => updatePieceMedia(pieceId, id, { view_type_term_id: termId }, devUser), "Tipo de vista actualizado."),
          onMakePrimary: (id) => void act(() => updatePieceMedia(pieceId, id, { is_primary: true }, devUser), "Foto principal actualizada."),
          onMove: (id, delta) => {
            const order = movedOrder(media, id, delta);
            if (order) void act(() => reorderPieceMedia(pieceId, order, devUser), "Orden guardado.");
          },
          onRetire: (id, reason) => void act(() => retirePieceMedia(pieceId, id, reason, devUser), "Foto retirada. No se borró: un Administrador puede restaurarla desde la Papelera."),
        }}
      />
      {canEdit && (
        <PiecePhotoUpload
          pieceId={pieceId}
          viewTypes={viewTypes}
          existing={media}
          devUser={devUser}
          onUploaded={() => {
            void reload();
            onChanged?.();
            clearTimeout(derivativesTimer.current);
            derivativesTimer.current = setTimeout(() => void reload(), DERIVATIVES_WAIT_MS);
          }}
        />
      )}
    </div>
  );
}
