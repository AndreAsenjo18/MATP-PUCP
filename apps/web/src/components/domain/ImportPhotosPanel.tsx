"use client";

/**
 * Fotografías del lote en el asistente de importación (change `importacion-masiva-fotografias`,
 * tarea 6.2; diseño D8), con el paso «Carga de archivo» del prototipo v3 como referencia de UX:
 * zona para arrastrar la carpeta o elegirla, avance global y por archivo, y «Reanudar».
 *
 * Se muestra con el lote mapeado (tarjeta de «Validación») y en la previsualización, para
 * agregar o reanudar. La subida, las huellas y los reintentos viven en `lib/data/importPhotos`.
 */
import { FolderUp, RotateCw } from "lucide-react";
import { useCallback, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { ImportBatch } from "@/lib/data/imports";
import {
  acceptsPhotos,
  canResume,
  entriesFromDrop,
  entriesFromInput,
  ignoredTotal,
  listPhotoFiles,
  overallProgress,
  summarize,
  uploadBatchPhotos,
  type IgnoredFiles,
  type PhotoFile,
  type PhotoProgress,
  type UploadSummary,
} from "@/lib/data/importPhotos";

/** Fotos que se listan una por una; el resto se resume para no cargar la pantalla. */
const LISTED = 200;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function ignoredSentence(ignored: IgnoredFiles): string | null {
  const total = ignoredTotal(ignored);
  if (total === 0) return null;
  const parts = [
    ignored.hidden && plural(ignored.hidden, "oculto", "ocultos"),
    ignored.system && plural(ignored.system, "del sistema (Thumbs.db, .DS_Store)", "del sistema (Thumbs.db, .DS_Store)"),
    ignored.unsupported && plural(ignored.unsupported, "con extensión no admitida", "con extensión no admitida"),
  ].filter(Boolean) as string[];
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}` : parts[0];
  return `Se ${total === 1 ? "ignoró" : "ignoraron"} ${plural(total, "archivo", "archivos")}: ${list}. Solo se suben JPEG, PNG y TIFF.`;
}

export function summarySentence(summary: UploadSummary): string {
  const parts = [
    summary.uploaded > 0 && `${plural(summary.uploaded, "foto subida", "fotos subidas")}`,
    summary.registered > 0 && `${plural(summary.registered, "ya estaba", "ya estaban")} en el lote`,
    summary.rejected > 0 && `${plural(summary.rejected, "rechazada", "rechazadas")}`,
    summary.failed > 0 && `${plural(summary.failed, "pendiente", "pendientes")} de reanudar`,
  ].filter(Boolean) as string[];
  return `${parts.join(" · ")}. El servidor verifica cada foto y la propone a su fila en unos segundos; nada llega al catálogo hasta aprobar el lote.`;
}

export function statusLabel(item: PhotoProgress): string {
  switch (item.status) {
    case "pending":
      return "Pendiente";
    case "hashing":
      return "Calculando huella";
    case "uploading":
      return `Subiendo ${item.size === 0 ? 0 : Math.round((item.loaded / item.size) * 100)} %`;
    case "uploaded":
      return "Subida";
    case "registered":
      return "Ya estaba en el lote";
    case "rejected":
      return `Rechazada: ${item.reason ?? "no admitida"}`;
    case "failed":
      return `Falló: ${item.reason ?? "sin respuesta"}`;
  }
}

export interface ImportPhotosViewProps {
  progress: PhotoProgress[];
  ignored: IgnoredFiles | null;
  running: boolean;
  message: string | null;
  error: string | null;
  onPick?: (files: FileList) => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
  onResume?: () => void;
}

/** Vista sin estado del panel (se prueba como HTML estático, ADR-012). */
export function ImportPhotosView({ progress, ignored, running, message, error, onPick, onDrop, onResume }: ImportPhotosViewProps) {
  const overall = overallProgress(progress);
  const ignoredText = ignored ? ignoredSentence(ignored) : null;
  // Primero lo que necesita atención: fallidas, rechazadas y en curso.
  const order = (item: PhotoProgress) => ({ failed: 0, rejected: 1, uploading: 2, hashing: 3, pending: 4, uploaded: 5, registered: 6 })[item.status];
  const listed = [...progress].sort((a, b) => order(a) - order(b)).slice(0, LISTED);
  return (
    <Card as="section" className="flex flex-col gap-4" aria-label="Fotografías del lote">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-tinta">Fotografías del lote</h2>
        <p className="text-base text-gris-texto">
          Opcional. Suelte la carpeta con las fotos de las piezas: cada foto se propone a su fila por el código del nombre del
          archivo o de la carpeta. Si se corta la conexión, vuelva a soltar la misma carpeta y solo se sube lo que falta.
        </p>
      </div>
      <label
        className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-borde p-6 text-center hover:border-terracota"
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
      >
        <FolderUp size={32} aria-hidden="true" className="text-terracota" />
        <span className="text-base font-medium text-tinta">Arrastre aquí la carpeta de fotografías</span>
        <span className="text-sm text-gris-texto">o haga clic para elegirla en su equipo</span>
        <input
          type="file"
          multiple
          className="sr-only"
          disabled={running}
          ref={(input) => input?.setAttribute("webkitdirectory", "")}
          onChange={(event) => event.target.files && onPick?.(event.target.files)}
        />
      </label>
      {ignoredText && <p className="text-sm text-gris-texto">{ignoredText}</p>}
      {error && (
        <p role="alert" className="rounded-md bg-carmin-bg p-3 text-base text-carmin-texto">
          {error}
        </p>
      )}
      {progress.length > 0 && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <p className="text-base text-tinta">
            {overall.done} de {plural(overall.total, "foto lista", "fotos listas")} ({overall.percent} %)
          </p>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={overall.percent} className="h-2 w-full rounded-full bg-crema">
            <div className="h-2 rounded-full bg-terracota" style={{ width: `${overall.percent}%` }} />
          </div>
          {message && <p className="text-sm text-gris-texto">{message}</p>}
          {onResume && !running && canResume(progress) && (
            <Button variant="secondary" className="self-start" onClick={onResume}>
              <RotateCw size={16} aria-hidden="true" />
              Reanudar
            </Button>
          )}
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto text-sm">
            {listed.map((item) => (
              <li key={item.relativePath} className="flex justify-between gap-3">
                <span className="truncate text-tinta">{item.relativePath}</span>
                <span className={item.status === "failed" || item.status === "rejected" ? "text-carmin-texto" : "text-gris-texto"}>{statusLabel(item)}</span>
              </li>
            ))}
          </ul>
          {progress.length > LISTED && <p className="text-sm text-gris-texto">y {progress.length - LISTED} fotos más.</p>}
        </div>
      )}
    </Card>
  );
}

/** Panel con estado: lista la carpeta, sube y permite reanudar. No se muestra si el lote ya no admite fotos. */
export function ImportPhotosPanel({ batch, devUser }: { batch: Pick<ImportBatch, "id" | "status">; devUser?: string }) {
  const [files, setFiles] = useState<PhotoFile[]>([]);
  const [ignored, setIgnored] = useState<IgnoredFiles | null>(null);
  const [progress, setProgress] = useState<PhotoProgress[]>([]);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (photos: PhotoFile[], previous: PhotoProgress[]) => {
      setRunning(true);
      setError(null);
      setMessage(null);
      let last = previous;
      const result = await uploadBatchPhotos(batch.id, photos, (next) => setProgress((last = next)), { previous, devUser });
      setRunning(false);
      if (result.status === "ok") setMessage(summarySentence(result.value));
      else {
        setError(result.message);
        setMessage(summarySentence(summarize(last)));
      }
    },
    [batch.id, devUser],
  );

  const start = useCallback(
    (entries: { file: Blob; relativePath: string }[]) => {
      const listing = listPhotoFiles(entries);
      setFiles(listing.files);
      setIgnored(listing.ignored);
      if (listing.files.length > 0) void run(listing.files, []);
    },
    [run],
  );

  if (!acceptsPhotos(batch)) return null;
  return (
    <ImportPhotosView
      progress={progress}
      ignored={ignored}
      running={running}
      message={message}
      error={error}
      onPick={(list) => start(entriesFromInput(list))}
      onDrop={(event) => {
        event.preventDefault();
        if (!running) void entriesFromDrop(event.dataTransfer.items).then(start);
      }}
      onResume={() => void run(files, progress)}
    />
  );
}
