"use client";

/**
 * Paso 2 del asistente «Importar fotografías al catálogo»: cómo se leen los nombres (change
 * `importacion-fotos-a-catalogo`, tarea 7.3; spec importacion-datos, «Forma de lectura de los
 * nombres por carpeta» y «Colección de la carpeta como pista»; diseño D4, D5, D7 y D10).
 *
 * A la izquierda el árbol de carpetas con sus conteos y su estado («se lee sola», «sugerencia
 * pendiente», «sin código»); a la derecha, para la carpeta elegida: la forma de lectura, la
 * plantilla con los tipos de identificador como chips, la colección pista (la propuesta resaltada),
 * el rango, la sugerencia con «Usar» y la vista previa de 20 nombres, que se recalcula al escribir.
 * Nada se guarda hasta «Guardar la lectura de la carpeta».
 */
import { FileUp, Folder, Lightbulb, Save } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBadge } from "@/components/domain/StatusBadges";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { fetchIdentifierTypes } from "@/lib/data/admin";
import { fetchCollections, type CollectionOption } from "@/lib/data/normalization-admin";
import {
  FOLDER_STATE_LABELS,
  READING_MODES,
  REASON_LABELS,
  fetchPhotoFolders,
  folderState,
  insertMarker,
  previewReading,
  saveReading,
  templateMarkers,
  uploadCorrespondences,
  type Correspondences,
  type FolderState,
  type PhotoFolder,
  type PhotoFolders,
  type ReadingPreview,
  type ReadingRule,
} from "@/lib/data/photoBatches";

/** Tipos que se ofrecen si no se pudieron leer (modo mock). */
const DEFAULT_TYPES = ["COLECCION", "I", "INC_RN", "PUCP"];
const PREVIEW_DELAY_MS = 400;

const STATE_INTENTS: Record<FolderState, "success" | "warning" | "default" | "info"> = {
  reads: "success",
  suggestion: "warning",
  "no-code": "default",
  empty: "info",
};

/** La regla de la carpeta tal como se edita: la vigente, con su colección si la tiene. */
export function draftFor(folder: PhotoFolder): ReadingRule {
  return { mode: folder.rule.mode ?? "auto", template: folder.rule.template ?? null, collection_id: folder.collection?.id ?? null };
}

export interface PhotoReadingViewProps {
  folders: PhotoFolder[];
  selected: string | null;
  draft: ReadingRule | null;
  collections: CollectionOption[];
  typeCodes: string[];
  preview: ReadingPreview | null;
  previewError: string | null;
  saving: boolean;
  message: string | null;
  error: string | null;
  correspondences: Correspondences | null;
  onSelect?: (path: string) => void;
  onDraft?: (rule: ReadingRule) => void;
  onSave?: () => void;
  onCorrespondences?: (file: File) => void;
}

/** Vista sin estado del paso (se prueba como HTML estático, ADR-012). */
export function PhotoReadingView({
  folders,
  selected,
  draft,
  collections,
  typeCodes,
  preview,
  previewError,
  saving,
  message,
  error,
  correspondences,
  onSelect,
  onDraft,
  onSave,
  onCorrespondences,
}: PhotoReadingViewProps) {
  const folder = folders.find((item) => item.path === selected) ?? null;
  const templateRef = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(16rem,1fr)_2fr]">
      <Card as="section" aria-label="Carpetas del lote" className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-tinta">Carpetas</h2>
        {folders.length === 0 && <p className="text-base text-gris-texto">Todavía no hay fotos con carpeta en el lote.</p>}
        <ul className="flex flex-col gap-1">
          {folders.map((item) => {
            const state = folderState(item);
            return (
              <li key={item.path} style={{ paddingLeft: `${item.depth * 1.25}rem` }}>
                <button
                  type="button"
                  aria-current={item.path === selected ? "true" : undefined}
                  onClick={() => onSelect?.(item.path)}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm focus-visible:outline-2 focus-visible:outline-terracota",
                    item.path === selected ? "bg-terracota-light text-tinta" : "hover:bg-crema",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1">
                    <Folder size={16} aria-hidden="true" className="shrink-0 text-terracota" />
                    <span className="truncate">{item.name}</span>
                    <span className="text-gris-texto">({item.photos})</span>
                  </span>
                  <StatusBadge status={{ label: FOLDER_STATE_LABELS[state], intent: STATE_INTENTS[state] }} />
                </button>
              </li>
            );
          })}
        </ul>
        <label className={cn("mt-2 inline-flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-md border border-terracota px-3 text-sm font-medium text-terracota hover:bg-terracota-light")}>
          <FileUp size={16} aria-hidden="true" />
          Subir lista de correspondencias
          <input type="file" accept=".csv,.xlsx" className="sr-only" onChange={(event) => event.target.files?.[0] && onCorrespondences?.(event.target.files[0])} />
        </label>
        <p className="text-sm text-gris-texto">CSV o Excel con las columnas «archivo» y «codigo» (y, si quiere, «tipo»).</p>
        {correspondences && (
          <p className="text-sm text-tinta" aria-live="polite">
            Lista: {correspondences.applied} aplicadas · {correspondences.no_photo} sin foto · {correspondences.no_piece} sin pieza · {correspondences.ambiguous} ambiguas.
          </p>
        )}
      </Card>

      <Card as="section" aria-label="Cómo se leen los nombres" className="flex flex-col gap-4">
        {!folder || !draft ? (
          <p className="text-base text-gris-texto">Elija una carpeta para ver cómo se leen sus nombres.</p>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-tinta">{folder.path}</h2>
              <p className="text-sm text-gris-texto">
                {folder.photos} fotos
                {folder.range && ` · carpeta de rango ${folder.range[0]}–${folder.range[1]}: su nombre no se lee como código`}
                {folder.rule_from && folder.rule_from !== folder.path && ` · hereda la lectura de «${folder.rule_from}»`}
              </p>
            </div>

            {folder.suggestion?.template && draft.template !== folder.suggestion.template && (
              <div className="flex flex-wrap items-center gap-2 rounded-md bg-ambar-bg p-3 text-sm text-ambar-texto">
                <Lightbulb size={16} aria-hidden="true" />
                <span>
                  {folder.suggestion.matching} de {folder.suggestion.total} nombres siguen la forma «{folder.suggestion.shape}». Sugerencia: la plantilla{" "}
                  <code>{folder.suggestion.template}</code>.
                </span>
                <Button size="sm" variant="outline" onClick={() => onDraft?.({ ...draft, mode: "template", template: folder.suggestion?.template ?? null })}>
                  Usar la plantilla {folder.suggestion.template}
                </Button>
              </div>
            )}

            <fieldset className="flex flex-col gap-2">
              <legend className="text-base font-medium text-tinta">Forma de lectura</legend>
              {READING_MODES.map((mode) => (
                <label key={mode.value} className="flex items-start gap-2 text-base text-tinta">
                  <input type="radio" name="reading-mode" value={mode.value} checked={draft.mode === mode.value} onChange={() => onDraft?.({ ...draft, mode: mode.value })} className="mt-1" />
                  <span>
                    {mode.label} <span className="text-sm text-gris-texto">— {mode.help}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {draft.mode === "template" && (
              <div className="flex flex-col gap-2">
                <label htmlFor="photo-template" className="text-base font-medium text-tinta">
                  Plantilla
                </label>
                <input
                  id="photo-template"
                  ref={templateRef}
                  value={draft.template ?? ""}
                  onChange={(event) => onDraft?.({ ...draft, template: event.target.value })}
                  placeholder="{COLECCION} {n} - PUCP {PUCP}"
                  className="min-h-11 rounded-md border border-borde px-3 font-mono text-base"
                />
                <div className="flex flex-wrap gap-2" aria-label="Insertar en la plantilla">
                  {templateMarkers(typeCodes).map(({ marker, label }) => (
                    <button
                      key={marker}
                      type="button"
                      onClick={() => {
                        const cursor = templateRef.current?.selectionStart ?? undefined;
                        onDraft?.({ ...draft, template: insertMarker(draft.template ?? "", marker, cursor).text });
                      }}
                      className="min-h-9 rounded-full bg-crema px-3 text-sm text-tinta hover:bg-borde focus-visible:outline-2 focus-visible:outline-terracota"
                      title={label}
                    >
                      {marker}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="flex flex-col gap-1 text-base text-tinta">
              <span className="font-medium">Colección de la carpeta</span>
              <select
                value={draft.collection_id ?? ""}
                onChange={(event) => onDraft?.({ ...draft, collection_id: event.target.value || null })}
                className="min-h-11 rounded-md border border-borde px-3"
              >
                <option value="">Sin colección</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                    {collection.id === folder.proposed_collection?.id ? " (propuesta)" : ""}
                  </option>
                ))}
              </select>
              {folder.collection_pending && <span className="text-sm text-ambar-texto">Colección propuesta por el nombre de la carpeta: confírmela al guardar.</span>}
            </label>

            <div className="flex flex-col gap-2" aria-live="polite">
              <h3 className="text-base font-semibold text-tinta">Vista previa</h3>
              {previewError && <p className="rounded-md bg-carmin-bg p-3 text-sm text-carmin-texto">{previewError}</p>}
              {preview && !previewError && (
                <>
                  <p className="text-sm text-gris-texto">
                    {preview.total} fotos en la carpeta{preview.not_fitting > 0 && ` · ${preview.not_fitting} no siguen la plantilla`}.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-gris-texto">
                        <tr>
                          <th className="py-1 pr-3 font-medium">Nombre</th>
                          <th className="py-1 pr-3 font-medium">Códigos leídos</th>
                          <th className="py-1 font-medium">Resultado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.items.map((item) => (
                          <tr key={item.photo_id} className="border-t border-borde">
                            <td className="py-1 pr-3 text-tinta">{item.relative_path.split("/").pop()}</td>
                            <td className="py-1 pr-3 text-gris-texto">{item.codes.join(" · ") || "—"}</td>
                            <td className="py-1 text-tinta">
                              {item.piece_id ? "Pieza encontrada" : item.match_status === "AMBIGUOUS" ? "Ambigua" : "Sin pieza"}
                              {item.match_reason && <span className="text-gris-texto"> · {REASON_LABELS[item.match_reason] ?? item.match_reason}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {error && (
              <p role="alert" className="rounded-md bg-carmin-bg p-3 text-base text-carmin-texto">
                {error}
              </p>
            )}
            {message && <p className="text-sm text-verde-exito">{message}</p>}
            <Button icon={Save} className="self-start" disabled={saving} onClick={onSave}>
              Guardar la lectura de la carpeta
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}

/** Paso con estado: carga las carpetas, recalcula la vista previa al editar y guarda la regla. */
export function PhotoReadingStep({ batchId, devUser, onChanged }: { batchId: string; devUser?: string; onChanged?: () => void }) {
  const [data, setData] = useState<PhotoFolders | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReadingRule | null>(null);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [typeCodes, setTypeCodes] = useState<string[]>(DEFAULT_TYPES);
  const [preview, setPreview] = useState<ReadingPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [correspondences, setCorrespondences] = useState<Correspondences | null>(null);

  const load = useCallback(async () => {
    const result = await fetchPhotoFolders(batchId, devUser);
    if (result.status !== "ok") return setError(result.message);
    setData(result.value);
    setSelected((current) => {
      if (current) return current;
      const first = result.value.folders[0];
      if (first) setDraft(draftFor(first));
      return first?.path ?? null;
    });
  }, [batchId, devUser]);

  useEffect(() => {
    // Carga al mostrarse; las funciones actualizan el estado cuando responde la API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    void fetchCollections(devUser).then((result) => result.status === "ok" && setCollections(result.value));
    void fetchIdentifierTypes(devUser).then((result) => {
      if (result.status === "ok") setTypeCodes(result.value.filter((type) => type.is_active).map((type) => type.code));
    });
  }, [load, devUser]);

  useEffect(() => {
    if (!selected || !draft) return;
    const timer = setTimeout(() => {
      void previewReading(batchId, selected, draft, devUser).then((result) => {
        if (result.status === "ok") {
          setPreview(result.value);
          setPreviewError(null);
        } else setPreviewError(result.message);
      });
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [batchId, devUser, selected, draft]);

  return (
    <PhotoReadingView
      folders={data?.folders ?? []}
      selected={selected}
      draft={draft}
      collections={collections}
      typeCodes={typeCodes}
      preview={preview}
      previewError={previewError}
      saving={saving}
      message={message}
      error={error}
      correspondences={correspondences}
      onSelect={(path) => {
        const next = data?.folders.find((item) => item.path === path);
        setSelected(path);
        if (next) setDraft(draftFor(next));
        setMessage(null);
        setError(null);
      }}
      onDraft={setDraft}
      onSave={async () => {
        if (!selected || !draft) return;
        setSaving(true);
        setError(null);
        const result = await saveReading(batchId, selected, draft, devUser);
        setSaving(false);
        if (result.status !== "ok") return setError(result.message);
        setData(result.value);
        setMessage("Lectura guardada: las fotos automáticas de la carpeta se emparejaron de nuevo; las asignadas a mano no cambiaron.");
        onChanged?.();
      }}
      onCorrespondences={async (file) => {
        setError(null);
        const result = await uploadCorrespondences(batchId, file, file.name, devUser);
        if (result.status !== "ok") return setError(result.message);
        setCorrespondences(result.value);
        await load();
        onChanged?.();
      }}
    />
  );
}
