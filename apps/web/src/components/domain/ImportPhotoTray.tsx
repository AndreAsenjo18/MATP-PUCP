"use client";

/**
 * Bandeja mínima de fotos del lote en la previsualización (change `importacion-masiva-fotografias`,
 * tareas 4.1 y `assign` de 4.2; diseño D4 y D8): las fotos ambiguas o sin emparejar, con su
 * miniatura, para asignarlas a una fila por su número en el Excel. Lo asignado a mano ya no lo
 * cambia el emparejamiento y nada llega al catálogo hasta aprobar el lote.
 *
 * Sin reordenar, descartar ni desasignar: quedan para S5.
 */
import { ImageOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { ImportBatch } from "@/lib/data/imports";
import { assignPhotos, fetchTrayPhotos, fetchTrayRows, type TrayPhoto, type TrayRow } from "@/lib/data/importPhotos";

/** Por qué una foto está en la bandeja, con los números de fila que la persona ve en el Excel. */
export function trayReason(photo: TrayPhoto, rows: TrayRow[]): string {
  if (photo.match_status !== "AMBIGUOUS") return "Sin emparejar: ninguna fila tiene su código";
  const numbers = (photo.candidate_row_ids ?? [])
    .map((id) => rows.find((row) => row.id === id)?.number)
    .filter((number): number is number => number !== undefined)
    .sort((a, b) => a - b);
  if (numbers.length === 0) return "Ambigua: varias filas tienen su código";
  const list = numbers.length > 1 ? `${numbers.slice(0, -1).join(", ")} o ${numbers.at(-1)}` : String(numbers[0]);
  return `Ambigua: filas ${list}`;
}

export interface ImportPhotoTrayViewProps {
  photos: TrayPhoto[];
  rows: TrayRow[];
  selected: string[];
  rowNumber: string;
  busy: boolean;
  message: string | null;
  error: string | null;
  onToggle?: (photoId: string) => void;
  onRowNumber?: (value: string) => void;
  onAssign?: () => void;
}

/** Vista sin estado de la bandeja (se prueba como HTML estático, ADR-012). */
export function ImportPhotoTrayView({ photos, rows, selected, rowNumber, busy, message, error, onToggle, onRowNumber, onAssign }: ImportPhotoTrayViewProps) {
  const target = rowNumber.trim() === "" ? null : rows.find((row) => row.number === Number(rowNumber));
  const canAssign = !busy && selected.length > 0 && target != null;
  return (
    <Card as="section" aria-label="Fotos por revisar" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-tinta">Fotos por revisar ({photos.length})</h2>
        <p className="text-base text-gris-texto">
          Fotos que no se pudieron proponer solas. Elíjalas y asígnelas a una fila; nada llega al catálogo hasta aprobar el lote.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-md bg-carmin-bg p-3 text-base text-carmin-texto">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-verde-exito">
          {message}
        </p>
      )}
      {photos.length === 0 ? (
        <p className="text-base text-gris-texto">No hay fotos ambiguas ni sin emparejar.</p>
      ) : (
        <>
          <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
            {photos.map((photo) => (
              <li key={photo.id}>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={selected.includes(photo.id)}
                    onChange={() => onToggle?.(photo.id)}
                    aria-label={`Elegir ${photo.relative_path}`}
                  />
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-crema">
                    {photo.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- miniatura prefirmada de corta duración
                      <img src={photo.thumbnail_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageOff size={18} aria-hidden="true" className="text-gris-texto" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-tinta">{photo.relative_path}</span>
                    <span className="text-sm text-gris-texto">{trayReason(photo, rows)}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm text-tinta">
              Número de fila del Excel
              <input
                type="number"
                min={1}
                inputMode="numeric"
                className="w-32 rounded-md border border-borde px-3 py-2 text-base"
                value={rowNumber}
                onChange={(event) => onRowNumber?.(event.target.value)}
              />
            </label>
            <Button disabled={!canAssign} onClick={onAssign}>
              Asignar {selected.length > 0 ? `${selected.length} ` : ""}a la fila
            </Button>
            {rowNumber.trim() !== "" && (
              <span className={target ? "text-sm text-gris-texto" : "text-sm text-carmin-texto"}>
                {target ? target.label : "No hay una fila con ese número en el lote."}
              </span>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

/** Bandeja con estado: solo en la previsualización, cuando las fotos ya tienen su propuesta. */
export function ImportPhotoTray({ batch, devUser }: { batch: Pick<ImportBatch, "id" | "status">; devUser?: string }) {
  const [photos, setPhotos] = useState<TrayPhoto[]>([]);
  const [rows, setRows] = useState<TrayRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [rowNumber, setRowNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visible = batch.status === "IN_PREVIEW";

  const load = useCallback(async () => {
    const [nextPhotos, nextRows] = await Promise.all([fetchTrayPhotos(batch.id, devUser), fetchTrayRows(batch.id, devUser)]);
    if (nextPhotos.status === "ok") setPhotos(nextPhotos.value);
    else setError(nextPhotos.message);
    if (nextRows.status === "ok") setRows(nextRows.value);
  }, [batch.id, devUser]);

  useEffect(() => {
    // Carga al mostrarse en la previsualización; la función actualiza el estado cuando responde la API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (visible) void load();
  }, [visible, load]);

  if (!visible) return null;
  return (
    <ImportPhotoTrayView
      photos={photos}
      rows={rows}
      selected={selected}
      rowNumber={rowNumber}
      busy={busy}
      message={message}
      error={error}
      onToggle={(id) => setSelected((current) => (current.includes(id) ? current.filter((other) => other !== id) : [...current, id]))}
      onRowNumber={setRowNumber}
      onAssign={async () => {
        const target = rows.find((row) => row.number === Number(rowNumber));
        if (!target) return;
        setBusy(true);
        setError(null);
        const result = await assignPhotos(batch.id, selected, target.id, devUser);
        setBusy(false);
        if (result.status !== "ok") {
          setError(result.message);
          return;
        }
        setMessage(`${result.value.length === 1 ? "1 foto asignada" : `${result.value.length} fotos asignadas`} a la ${target.label.toLowerCase()}.`);
        setSelected([]);
        await load();
      }}
    />
  );
}
