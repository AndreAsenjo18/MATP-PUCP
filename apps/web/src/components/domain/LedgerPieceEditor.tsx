"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { RowPhotoStrip } from "@/components/domain/ImportPhotoTray";
import { fetchCollectionList, type CollectionItem } from "@/lib/data/admin";
import { confirmRepeatedPhotos, fetchLedgerRowPhotos, listPhotoFiles, uploadBatchPhotos, type PhotoProgress, type TrayPhoto } from "@/lib/data/importPhotos";
import type { ImportRow } from "@/lib/data/imports";

export type LedgerFieldChange = { column: string; value: string };

const GROUPS: [string, string[]][] = [
  ["Identificación", ["Denominación sugerida", "Colección", "Código de inventario", "Código adicional", "Régimen de tenencia", "Tipo de bien", "Categoría"]],
  ["Descripción y procedencia", ["Descripción", "Autor", "Procedencia", "Época (texto original)", "Forma de adquisición", "Fecha"]],
  ["Medidas y materiales", ["Materiales", "Medidas (texto original)", "Alto (cm)", "Ancho (cm)", "Espesor (cm)", "Diámetro (cm)", "Peso (gr)"]],
  ["Conservación y ubicación", ["Estado de conservación", "Ubicación", "Observaciones"]],
];
const KNOWN = new Set(GROUPS.flatMap(([, fields]) => fields));
const LONG = new Set(["Descripción", "Medidas (texto original)", "Observaciones"]);

function initialValues(row: ImportRow, headers: readonly string[]): Record<string, string> {
  const mapped = row.mapped_data as { collection_id?: string | null } | null;
  return Object.fromEntries(headers.map((name) => {
    const raw = row.raw_data[name];
    if (name === "Colección" && mapped?.collection_id) return [name, `id:${mapped.collection_id}`];
    if (name === "Régimen de tenencia" && !raw && row.preview?.tenure_regime) return [name, row.preview.tenure_regime];
    return [name, raw == null ? "" : String(raw)];
  }));
}

export function LedgerPieceEditor({ batchId, row, headers, devUser, busy, canEdit, notice, onSave, onPhotoBusy, onPhotosChanged }: {
  batchId: string; row: ImportRow; headers: readonly string[]; devUser?: string; busy: boolean; canEdit: boolean;
  notice: string | null; onSave: (changes: LedgerFieldChange[]) => Promise<void>;
  onPhotoBusy: (busy: boolean) => void; onPhotosChanged: () => Promise<void>;
}) {
  const columns = headers.filter((name) => !name.startsWith("__"));
  const [initial] = useState(() => initialValues(row, columns));
  const [values, setValues] = useState(initial);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void fetchCollectionList(devUser).then((result) => {
      if (!active) return;
      if (result.status === "ok") {
        setCollections(result.value.filter((item) => item.is_active));
        setCollectionError(null);
      } else setCollectionError(result.message);
    });
    return () => { active = false; };
  }, [devUser, retry]);
  const changes = columns.filter((name) => (values[name] ?? "").trim() !== (initial[name] ?? "").trim())
    .map((column) => ({ column, value: values[column] ?? "" }));
  const edit = (name: string, value: string) => setValues((previous) => ({ ...previous, [name]: value }));
  const disabled = busy || !canEdit;
  function field(name: string) {
    const label = name === "Denominación sugerida" ? "Denominación" : name === "Fecha" ? "Fecha de ingreso" : name;
    if (name === "Colección") return (
      <Select key={name} label={label} value={values[name] ?? ""} disabled={disabled || Boolean(collectionError)} onChange={(event) => edit(name, event.target.value)}>
        <option value="">Seleccione una colección</option>
        {values[name] && !collections.some((item) => `id:${item.id}` === values[name]) && <option value={values[name]}>{row.preview?.collection || values[name]} (actual)</option>}
        {collections.map((item) => <option key={item.id} value={`id:${item.id}`}>{item.name}{item.acronym ? ` (${item.acronym})` : ""}</option>)}
      </Select>
    );
    if (name === "Régimen de tenencia") return (
      <Select key={name} label={label} value={values[name] ?? ""} disabled={disabled} onChange={(event) => edit(name, event.target.value)}>
        <option value="">Sin especificar (usar valor del lote)</option>
        {["Propiedad", "Comodato", "Préstamo Temporal"].map((value) => <option key={value} value={value}>{value}</option>)}
      </Select>
    );
    if (LONG.has(name)) return (
      <label key={name} className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">{label}
        <textarea rows={3} className="w-full rounded-md border border-borde bg-white p-3 text-base" value={values[name] ?? ""} disabled={disabled} onChange={(event) => edit(name, event.target.value)} />
      </label>
    );
    return <Input key={name} label={label} value={values[name] ?? ""} disabled={disabled} onChange={(event) => edit(name, event.target.value)} />;
  }
  const groups = [...GROUPS, ["Otros campos", columns.filter((name) => !KNOWN.has(name))] as [string, string[]]];
  return <section className="flex flex-col gap-4 rounded-2xl border border-borde p-4 sm:p-5" aria-label="Editar datos de la pieza">
    <div>
      <h3 className="text-lg font-bold">Datos de la pieza</h3>
      <p className="text-sm text-gris-texto">Revise y complete los campos. Los datos originales y las correcciones se conservan en el lote.</p>
    </div>
    {groups.map(([title, names]) => {
      const fields = names.filter((name) => columns.includes(name));
      return fields.length > 0 ? <section key={title} className="flex flex-col gap-3 border-t border-borde pt-3">
        <h4 className="font-semibold text-terracota">{title}</h4>
        <div className="grid gap-3 sm:grid-cols-2">{fields.map(field)}</div>
      </section> : null;
    })}
    {collectionError && <div role="alert" className="text-sm text-carmin-texto">{collectionError} <Button variant="secondary" size="sm" disabled={busy} onClick={() => setRetry((n) => n + 1)}>Reintentar</Button></div>}
    {notice && changes.length > 0 && <p className="text-sm text-ambar-texto">{notice}</p>}
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled={disabled || changes.length === 0} onClick={() => void onSave(changes)}>{busy ? "Procesando…" : `Guardar cambios (${changes.length}) y validar`}</Button>
      <Button variant="secondary" disabled={disabled || changes.length === 0} onClick={() => setValues(initial)}>Restablecer</Button>
    </div>
    <LedgerPiecePhotos batchId={batchId} rowId={row.id} devUser={devUser} busy={busy} canEdit={canEdit} onBusy={onPhotoBusy} onChanged={onPhotosChanged} />
  </section>;
}

function LedgerPiecePhotos({ batchId, rowId, devUser, busy, canEdit, onBusy, onChanged }: {
  batchId: string; rowId: string; devUser?: string; busy: boolean; canEdit: boolean;
  onBusy: (busy: boolean) => void; onChanged: () => Promise<void>;
}) {
  const [photos, setPhotos] = useState<TrayPhoto[]>([]);
  const [progress, setProgress] = useState<PhotoProgress[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      const result = await fetchLedgerRowPhotos(batchId, rowId, devUser);
      if (!active) return;
      if (result.status === "ok") {
        setPhotos(result.value);
        if (result.value.some((photo) => photo.status === "UPLOADED")) timer = setTimeout(load, 2000);
      } else setError(result.message);
    };
    void load();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [batchId, rowId, devUser, revision]);
  async function upload(files: File[]) {
    if (busy || !canEdit || !files.length) return;
    const listed = listPhotoFiles(files.map((file) => ({ file, relativePath: file.name })));
    if (!listed.files.length) { setError("Seleccione imágenes JPEG, PNG o TIFF."); return; }
    onBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await uploadBatchPhotos(batchId, listed.files, setProgress, { devUser, ledgerRowId: rowId });
      if (result.status !== "ok") setError(result.message);
      else {
        const summary = result.value;
        setMessage(`${summary.uploaded + summary.registered} foto(s) recibida(s) para esta pieza. La verificación puede tardar unos segundos.`);
        if (summary.failed || summary.rejected || listed.files.length !== files.length) setError("Algunas fotos no se pudieron recibir. Revise los motivos y vuelva a elegir las que faltan.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar la foto.");
    } finally {
      setRevision((n) => n + 1);
      await onChanged();
      onBusy(false);
    }
  }
  const pending = photos.filter((photo) => photo.status !== "VERIFIED" && photo.status !== "APPLIED");
  return <section className="flex flex-col gap-3 border-t border-borde pt-4" aria-label="Fotografías de esta pieza">
    <h4 className="font-semibold text-terracota">Fotografías de esta pieza (opcional)</h4>
    <p className="text-sm text-gris-texto">Agregue fotos de la pieza física. Se asociarán directamente a esta fila, no al libro completo.</p>
    <RowPhotoStrip photos={photos.filter((photo) => photo.status === "VERIFIED" || photo.status === "APPLIED")} busy={busy} onConfirmRepeated={canEdit ? async (ids) => {
      onBusy(true);
      try {
        const result = await confirmRepeatedPhotos(batchId, ids, devUser);
        if (result.status !== "ok") setError(result.message);
        setRevision((n) => n + 1);
        await onChanged();
      } finally { onBusy(false); }
    } : undefined} />
    {pending.map((photo) => <p key={photo.id} className="text-sm text-gris-texto">{photo.original_filename}: {photo.status === "UPLOADED" ? "Verificando…" : photo.status === "PENDING_UPLOAD" ? "Pendiente de subir; vuelva a elegir el archivo" : photo.rejection_reason || photo.status}</p>)}
    {canEdit && <>
      <input ref={picker} type="file" multiple accept=".jpg,.jpeg,.png,.tif,.tiff" className="hidden" onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void upload(files); }} />
      <Button variant="secondary" icon={Camera} className="self-start" disabled={busy} onClick={() => picker.current?.click()}>Agregar fotografías</Button>
    </>}
    {progress.filter((item) => item.status === "rejected" || item.status === "failed").map((item) => <p key={item.relativePath} className="text-sm text-carmin-texto">{item.relativePath}: {item.reason || "No se pudo subir"}</p>)}
    {message && <p role="status" className="text-sm text-verde-exito">{message}</p>}
    {error && <p role="alert" className="text-sm text-carmin-texto">{error}</p>}
  </section>;
}
