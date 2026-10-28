"use client";

/**
 * Paso «Archivo» del asistente de importación (change `rediseno-ux-importacion`; spec
 * importacion-datos, subida guiada con formato elegido de antemano).
 *
 * - `DropZone`: arrastrar y soltar o elegir un `.xlsx` / `.csv`, con estados de reposo, encima,
 *   elegido y error. Es un `label` de un `input[type=file]` oculto, así que funciona con teclado.
 * - `FormatPicker`: el formato (plantilla de mapeo) con que se leerá el archivo; «Detectar
 *   automáticamente» viene elegido.
 * - `UploadPanel`: guía corta, zona de subida, formato y «Más opciones».
 *
 * Son componentes de presentación; `LiveImportWizard` hace las llamadas.
 */
import { CircleCheck, FileSpreadsheet, ScanSearch, Upload } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import type { MappingTemplate } from "@/lib/data/import-templates";
import { TENURE_DEFAULT_OPTIONS, UPLOAD_TYPES_MESSAGE, formatFileSize, isSpreadsheetFile } from "@/lib/data/imports";

/** Valor de «Detectar automáticamente» en la elección de formato. */
export const AUTO_FORMAT = "auto";

export interface UploadOptions {
  /** Plantilla elegida, o `null` para detectarla por las cabeceras. */
  templateId: string | null;
  /** Régimen para las filas que no lo traen; vacío = ninguno. */
  tenureDefault: string;
}

const GUIDE = [
  "Una fila por pieza.",
  "Los títulos de las columnas, en la primera fila.",
  "La denominación de la pieza en todas las filas.",
  "El régimen de tenencia en una columna, o uno solo para todo el archivo (en «Más opciones»).",
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
        <p id={messageId} role="alert" className="text-sm font-medium text-carmin-texto">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormatPicker({
  templates,
  loading,
  value,
  onChange,
  disabled,
}: {
  templates: MappingTemplate[] | null;
  loading: boolean;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="text-base font-semibold text-tinta">Formato del archivo</legend>
      <p className="text-sm text-gris-texto">Indica cómo leer las columnas. Si no está seguro, deje la detección automática.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <FormatOption name={name} value={AUTO_FORMAT} checked={value === AUTO_FORMAT} onChange={onChange} title="Detectar automáticamente" description="Lo reconocemos por los títulos de las columnas." icon={ScanSearch} />
        {(templates ?? []).map((template) => (
          <FormatOption
            key={template.id}
            name={name}
            value={template.id}
            checked={value === template.id}
            onChange={onChange}
            title={template.name}
            description={template.description || template.source_name}
          />
        ))}
      </div>
      {loading && <p className="text-sm text-gris-texto">Buscando formatos guardados…</p>}
    </fieldset>
  );
}

function FormatOption({
  name,
  value,
  checked,
  onChange,
  title,
  description,
  icon: Icon = FileSpreadsheet,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: string;
  description: string;
  icon?: typeof FileSpreadsheet;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-terracota motion-reduce:transition-none",
        checked ? "border-terracota bg-terracota-light" : "border-borde bg-white hover:border-terracota",
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="mt-1 size-4 accent-terracota" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 font-medium text-tinta">
          <Icon size={16} aria-hidden="true" className="shrink-0 text-terracota" />
          {title}
        </span>
        <span className="text-sm text-gris-texto">{description}</span>
      </span>
    </label>
  );
}

export function UploadPanel({
  busy,
  templates,
  loadingTemplates,
  onUpload,
}: {
  busy: boolean;
  templates: MappingTemplate[] | null;
  loadingTemplates: boolean;
  onUpload: (file: File, options: UploadOptions) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState(AUTO_FORMAT);
  const [tenureDefault, setTenureDefault] = useState("");

  return (
    <Card as="section" className="flex flex-col gap-6" aria-label="Subir el archivo">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
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
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-tinta">Antes de subir</h2>
          <ul className="flex flex-col gap-1.5 text-sm text-gris-texto">
            {GUIDE.map((line) => (
              <li key={line} className="flex gap-2">
                <CircleCheck size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-verde-exito" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <FormatPicker templates={templates} loading={loadingTemplates} value={format} onChange={setFormat} disabled={busy} />

      <details className="rounded-md border border-borde px-3 py-2">
        <summary className="cursor-pointer text-base font-medium text-tinta">Más opciones</summary>
        <div className="pt-3">
          <Select
            label="Si el archivo no trae régimen de tenencia"
            hint="Se usa solo en las filas sin dato; las que lo traen conservan el suyo."
            value={tenureDefault}
            disabled={busy}
            onChange={(event) => setTenureDefault(event.target.value)}
            fieldClassName="max-w-sm"
          >
            <option value="">Ninguno: lo revisaré fila por fila</option>
            {TENURE_DEFAULT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </details>

      <Button
        icon={Upload}
        className="self-start"
        disabled={!file || busy}
        onClick={() => file && onUpload(file, { templateId: format === AUTO_FORMAT ? null : format, tenureDefault })}
      >
        {busy ? "Subiendo…" : "Subir y revisar"}
      </Button>
    </Card>
  );
}
