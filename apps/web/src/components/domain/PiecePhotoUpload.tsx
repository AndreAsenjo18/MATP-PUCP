"use client";

/**
 * Agregar fotografías desde la ficha (change `fotografias-multiples-por-pieza`, tarea 3.2; spec
 * multimedia, «Subida verificada de fotografías»). Se eligen una o varias fotos, con su tipo de vista,
 * y se ve el avance de cada una. Lo que falla se reintenta con una autorización nueva, y una foto que
 * ya está en la pieza espera a que la persona decida.
 *
 * Avisos que no bloquean (change `aviso-fotos-repetidas`, C6): la vista elegida ya tiene fotos en la
 * pieza, o se suben varias fotos con una sola vista. Puede haber dos tomas válidas del mismo ángulo.
 *
 * El botón de elegir ocupa todo el ancho y en una tableta abre la galería o la cámara. La subida, la
 * huella y los reintentos viven en `lib/data/media`.
 */
import { ImagePlus, RotateCw, TriangleAlert, Upload } from "lucide-react";
import { useState } from "react";

import { Notice } from "@/components/domain/AdminShell";
import { OverallPhotoProgress, ignoredSentence } from "@/components/domain/ImportPhotosPanel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { canResume, entriesFromInput, listPhotoFiles, type IgnoredFiles, type PhotoFile } from "@/lib/data/importPhotos";
import { manyWithOneViewWarning, sameViewWarning, uploadPiecePhotos, type PieceMedia, type PiecePhotoProgress } from "@/lib/data/media";
import type { TermOption } from "@/lib/data/pieces";

/** Lo que el selector de archivos deja elegir; el servidor verifica el tipo real de cada foto. */
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/tiff,.jpg,.jpeg,.png,.tif,.tiff";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function piecePhotoStatus(item: PiecePhotoProgress): string {
  switch (item.status) {
    case "pending":
      return "Pendiente";
    case "hashing":
      return "Preparando";
    case "uploading":
      return `Subiendo ${item.size === 0 ? 0 : Math.round((item.loaded / item.size) * 100)} %`;
    case "uploaded":
      return "Verificando";
    case "registered":
      return "Agregada";
    case "rejected":
      return item.duplicate ? (item.reason ?? "Esta foto ya está en la pieza.") : `Rechazada: ${item.reason ?? "no admitida"}`;
    case "failed":
      return `Falló: ${item.reason ?? "sin respuesta"}`;
  }
}

/** Aviso de color, icono y texto que no detiene la subida (RNF-010). */
function ViewWarning({ text }: { text: string }) {
  return (
    <p role="status" className="flex items-start gap-2 rounded-md bg-ambar-bg px-3 py-2 text-sm text-ambar-texto">
      <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
      {text}
    </p>
  );
}

/** Resumen de una pasada: lo agregado, lo rechazado, lo repetido y lo que queda por reintentar. */
export function uploadSentence(progress: readonly PiecePhotoProgress[]): string {
  const count = (matches: (item: PiecePhotoProgress) => boolean) => progress.filter(matches).length;
  const added = count((item) => item.status === "registered");
  const repeated = count((item) => item.duplicate === true);
  const rejected = count((item) => item.status === "rejected" && !item.duplicate);
  const failed = count((item) => item.status === "failed" || item.status === "pending");
  const parts = [
    added > 0 && plural(added, "foto agregada", "fotos agregadas"),
    repeated > 0 && `${plural(repeated, "ya estaba", "ya estaban")} en la pieza`,
    rejected > 0 && plural(rejected, "rechazada", "rechazadas"),
    failed > 0 && `${plural(failed, "pendiente", "pendientes")} de reintentar`,
  ].filter(Boolean);
  return `${parts.join(" · ")}.`;
}

export interface PiecePhotoUploadViewProps {
  viewTypes: readonly TermOption[];
  /** Fotos que ya tiene la pieza: para avisar si la vista elegida se repite. */
  existing?: readonly Pick<PieceMedia, "view_type">[];
  viewTypeId: string;
  progress: readonly PiecePhotoProgress[];
  ignored: IgnoredFiles | null;
  running: boolean;
  message: string | null;
  error: string | null;
  onViewType?: (id: string) => void;
  onPick?: (files: FileList) => void;
  onRetry?: () => void;
  onUploadRepeated?: (item: PiecePhotoProgress) => void;
}

/** Vista sin estado (se prueba como HTML estático, ADR-012). */
export function PiecePhotoUploadView({ viewTypes, existing = [], viewTypeId, progress, ignored, running, message, error, onViewType, onPick, onRetry, onUploadRepeated }: PiecePhotoUploadViewProps) {
  const ignoredText = ignored ? ignoredSentence(ignored) : null;
  const sameView = sameViewWarning(existing, viewTypeId, viewTypes);
  const manyOneView = manyWithOneViewWarning(progress.length, viewTypeId, viewTypes);
  return (
    <Card as="section" aria-label="Agregar fotografías" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-tinta">Agregar fotografías</h3>
        <p className="text-sm text-gris-texto">JPEG, PNG o TIFF. Puede elegir varias a la vez; el archivo original no se modifica.</p>
      </div>
      {viewTypes.length > 0 && (
        <Select label="Tipo de vista de estas fotos" value={viewTypeId} disabled={running} className="p-2.5" fieldClassName="sm:max-w-xs" onChange={(event) => onViewType?.(event.target.value)}>
          <option value="">Elegir después</option>
          {viewTypes.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      )}
      {sameView && <ViewWarning text={sameView} />}
      <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-borde p-4 text-base font-medium text-tinta hover:border-terracota focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-terracota">
        <ImagePlus size={22} aria-hidden="true" className="text-terracota" />
        Elegir fotografías
        <input
          type="file"
          multiple
          accept={PHOTO_ACCEPT}
          className="sr-only"
          disabled={running}
          onChange={(event) => {
            if (event.target.files) onPick?.(event.target.files);
            event.target.value = ""; // para poder volver a elegir el mismo archivo
          }}
        />
      </label>
      {ignoredText && <p className="text-sm text-gris-texto">{ignoredText}</p>}
      {manyOneView && <ViewWarning text={manyOneView} />}
      <Notice message={message} error={error} />
      {progress.length > 0 && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <OverallPhotoProgress progress={progress} />
          {onRetry && !running && canResume([...progress]) && (
            <Button variant="secondary" icon={RotateCw} className="self-start" onClick={onRetry}>
              Reintentar
            </Button>
          )}
          <ul className="flex flex-col gap-2 text-sm">
            {progress.map((item) => (
              <li key={item.relativePath} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="min-w-0 truncate text-tinta">{item.relativePath}</span>
                <span className={item.status === "failed" || (item.status === "rejected" && !item.duplicate) ? "text-carmin-texto" : "text-gris-texto"}>{piecePhotoStatus(item)}</span>
                {item.duplicate && onUploadRepeated && !running && (
                  <Button variant="outline" icon={Upload} onClick={() => onUploadRepeated(item)}>
                    Subir de todos modos
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/** Con estado: elige, sube y reintenta. Avisa cuando alguna foto quedó en la pieza. */
export function PiecePhotoUpload({
  pieceId,
  viewTypes,
  existing = [],
  devUser,
  onUploaded,
}: {
  pieceId: string;
  viewTypes: readonly TermOption[];
  existing?: readonly Pick<PieceMedia, "view_type">[];
  devUser?: string;
  onUploaded?: () => void;
}) {
  const [files, setFiles] = useState<PhotoFile[]>([]);
  const [ignored, setIgnored] = useState<IgnoredFiles | null>(null);
  const [progress, setProgress] = useState<PiecePhotoProgress[]>([]);
  const [viewTypeId, setViewTypeId] = useState("");
  const [confirmed, setConfirmed] = useState<ReadonlySet<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(photos: PhotoFile[], previous: PiecePhotoProgress[], confirmedDuplicates: ReadonlySet<string>) {
    setRunning(true);
    setMessage(null);
    setError(null);
    let last = previous;
    const result = await uploadPiecePhotos(
      pieceId,
      photos,
      (next) => {
        last = next;
        setProgress(next);
      },
      { viewTypeId: viewTypeId || null, previous, confirmedDuplicates, devUser },
    );
    setRunning(false);
    if (result.status === "ok") setMessage(uploadSentence(last));
    else setError(result.message);
    if (last.some((item) => item.status === "registered")) onUploaded?.();
  }

  return (
    <PiecePhotoUploadView
      viewTypes={viewTypes}
      existing={existing}
      viewTypeId={viewTypeId}
      progress={progress}
      ignored={ignored}
      running={running}
      message={message}
      error={error}
      onViewType={setViewTypeId}
      onPick={(list) => {
        const listing = listPhotoFiles(entriesFromInput(list));
        setFiles(listing.files);
        setIgnored(listing.ignored);
        setConfirmed(new Set());
        setProgress([]);
        if (listing.files.length > 0) void run(listing.files, [], new Set());
      }}
      onRetry={() => void run(files, progress, confirmed)}
      onUploadRepeated={(item) => {
        const next = new Set(confirmed).add(item.relativePath);
        setConfirmed(next);
        void run(files, progress, next);
      }}
    />
  );
}
