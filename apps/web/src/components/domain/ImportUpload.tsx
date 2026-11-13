"use client";

/**
 * Paso «Archivo» del asistente de importación (change `importacion-elegir-origen`; spec
 * importacion-datos, subida mínima con detección automática del formato).
 *
 * - `DropZone`: arrastrar y soltar o elegir un `.xlsx` / `.csv`, con estados de reposo, encima,
 *   elegido y error. Es un `label` de un `input[type=file]` oculto, así que funciona con teclado.
 * - `UploadPanel`: la zona de subida, el botón y la guía plegada. El formato siempre se detecta
 *   solo; se elige o se cambia después de subir, si hace falta.
 *
 * Son componentes de presentación; `LiveImportWizard` hace las llamadas.
 */
import { CircleCheck, FileSpreadsheet, Upload } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { UPLOAD_TYPES_MESSAGE, formatFileSize, isSpreadsheetFile } from "@/lib/data/imports";

export const UPLOAD_GUIDE = [
  "Una fila por pieza.",
  "Los títulos de las columnas, en la primera fila.",
  "La denominación de la pieza en todas las filas.",
  "El régimen de tenencia de cada pieza en una columna.",
  "Varios códigos en una celda: sepárelos con «/» o «;».",
];

export function DropZone({ file, error, disabled, onFile, onReject }: { file: File | null; error: string | null; disabled?: boolean; onFile: (file: File) => void; onReject: (message: string) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageId = useId();

  function take(candidate: File | undefined) {
    if (!candidate) return;
    if (!isSpreadsheetFile(candidate.name)) return onReject(UPLOAD_TYPES_MESSAGE);
    onFile(candidate);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (!disabled) take(event.dataTransfer.files[0]);
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-terracota motion-reduce:transition-none",
          dragging ? "border-terracota bg-terracota-light" : file ? "border-verde-exito bg-verde-bg" : "border-borde bg-crema-light hover:border-terracota",
          error && "border-carmin-peligro",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        {file ? <CircleCheck size={32} aria-hidden="true" className="text-verde-exito" /> : <FileSpreadsheet size={32} aria-hidden="true" className="text-terracota" />}
        {file ? (
          <>
            <span className="font-medium break-all text-tinta">{file.name}</span>
            <span className="text-sm text-gris-texto">{formatFileSize(file.size)} · Suelte otro archivo para cambiarlo</span>
          </>
        ) : (
          <>
            <span className="text-lg font-semibold text-tinta">{dragging ? "Suelte el archivo aquí" : "Arrastre aquí su archivo"}</span>
            <span className="text-sm text-gris-texto">o haga clic para elegirlo · Excel (.xlsx) o CSV</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv"
          disabled={disabled}
          aria-describedby={error ? messageId : undefined}
          className="sr-only"
          onChange={(event) => {
            take(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
      {error && (
        <p id={messageId} role="alert" className="texto-error text-sm font-medium text-carmin-texto">
          {error}
        </p>
      )}
    </div>
  );
}

export function UploadPanel({ busy, onUpload }: { busy: boolean; onUpload: (file: File) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card as="section" className="flex flex-col gap-4" aria-label="Subir el archivo">
      <DropZone
        file={file}
        error={error}
        disabled={busy}
        onFile={(next) => {
          setFile(next);
          setError(null);
        }}
        onReject={setError}
      />

      <Button icon={Upload} className="self-start" disabled={!file || busy} onClick={() => file && onUpload(file)}>
        {busy ? "Subiendo…" : "Subir y revisar"}
      </Button>

      <details className="rounded-md border border-borde px-3 py-2">
        <summary className="min-h-11 cursor-pointer py-2 text-base font-medium text-tinta">¿Cómo preparo mi Excel?</summary>
        <ul className="flex flex-col gap-1.5 pb-2 pt-1 text-base text-gris-texto">
          {UPLOAD_GUIDE.map((line) => (
            <li key={line} className="flex gap-2">
              <CircleCheck size={16} aria-hidden="true" className="mt-1 shrink-0 text-verde-exito" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
