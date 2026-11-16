"use client";

/**
 * Pestaña «Piezas incompletas» de «Revisar pendientes» (change `completar-piezas-incompletas`;
 * RF-019, RF-035, RN-002, RN-005):
 *
 * - «¿Qué les falta?»: una tarjeta por alerta con su número, que es también el filtro (varias se
 *   combinan con «y», como el reporte).
 * - Una barra compacta: colección (con subcolecciones) y «Descargar» (Excel o CSV), discreto.
 * - Cada fila dice qué le falta a la pieza, en concreto («Le falta: Foto · Ubicación · categoría,
 *   materiales»), con «Completar».
 * - «Completar ficha»: un panel lateral con solo lo que falta y se puede completar aquí —
 *   ubicación, fotos y los campos simples— que guarda y pasa a la pieza siguiente. El código I no se
 *   completa aquí: lo asigna quien marca la pieza (RN-002); el panel lo explica y enlaza a la ficha.
 *
 * Reportes conserva su propio reporte (`IncompleteReportPanel`).
 */
import { ArrowRight, Camera, ChevronDown, Download, FileSpreadsheet, Hash, MapPin, ScrollText, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { LocationTreeSelect } from "@/components/domain/LocationTreeSelect";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PillSelect } from "@/components/ui/PillSelect";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { ApiSchemas } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { fetchDuplicateCollections } from "@/lib/data/duplicates";
import { getApiMode } from "@/lib/data/mode";
import { batchMovePieces, describeLocationFailure, fetchLocationsTree, newIdempotencyKey, type LocationNode } from "@/lib/data/locations";
import { uploadPiecePhotos } from "@/lib/data/media";
import { fetchPieceCatalogs, fetchPieceDetail, updatePiece, type PieceUpdateInput, type TermOption } from "@/lib/data/pieces";
import { downloadIncompleteReport, fetchIncompleteReport, INCOMPLETE_PAGE_SIZE, type AlertType, type IncompletePage, type IncompletePiece } from "@/lib/data/quality";

type CollectionOut = ApiSchemas["CollectionOut"];
type PieceDetail = ApiSchemas["PieceDetail"];

/** Las alertas en el orden de las tarjetas, con su nombre en llano y su icono. */
export const ALERT_CARDS: { code: AlertType; label: string; short: string | null; icon: LucideIcon }[] = [
  { code: "MISSING_INVENTORY_CODE", label: "Sin código I", short: "Código I", icon: Hash },
  { code: "MISSING_PHOTO", label: "Sin foto", short: "Foto", icon: Camera },
  { code: "MISSING_LOCATION", label: "Sin ubicación", short: "Ubicación", icon: MapPin },
  { code: "MISSING_REQUIRED_FIELDS", label: "Faltan datos obligatorios", short: null, icon: ScrollText },
  { code: "MISSING_RECOMMENDED_FIELDS", label: "Faltan datos recomendados", short: null, icon: ScrollText },
  { code: "UNNORMALIZABLE_IDENTIFIER", label: "Código que no se entiende", short: "Código que no se entiende", icon: Hash },
];

/** Nombre en llano de cada campo de las reglas de completitud. */
export const FIELD_LABELS: Record<string, string> = {
  denomination: "denominación",
  tenure_regime: "régimen de tenencia",
  collection_id: "colección",
  category_id: "categoría",
  description: "descripción",
  epoch_original_text: "época",
  materials: "materiales",
  dimensions_text: "medidas",
  conservation_state_id: "estado de conservación",
  provenance: "procedencia",
};

/** Campos que el panel completa; los demás (denominación, régimen) se editan en la ficha. */
export const PANEL_FIELDS = ["collection_id", "category_id", "conservation_state_id", "materials", "provenance", "epoch_original_text", "dimensions_text", "description"] as const;
type PanelField = (typeof PANEL_FIELDS)[number];

/** Lo que le falta a una pieza, en etiquetas cortas: primero lo físico, luego los campos. */
export function missingLabels(item: Pick<IncompletePiece, "alerts" | "missing_fields">): { alerts: string[]; fields: string | null } {
  const alerts = ALERT_CARDS.filter((card) => card.short && item.alerts.includes(card.code)).map((card) => card.short as string);
  const fields = (item.missing_fields ?? []).map((field) => FIELD_LABELS[field] ?? field);
  return { alerts, fields: fields.length ? fields.join(", ") : null };
}

function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("es-PE")} ${n === 1 ? one : many}`;
}

// ---------------------------------------------------------------------------------------------
// Pestaña
// ---------------------------------------------------------------------------------------------

export function IncompleteTriage({
  devUser,
  canDownload,
  canEdit,
  canMove,
  canUpload,
}: {
  devUser?: string;
  canDownload: boolean;
  /** `pieces.update`: completar campos desde el panel. */
  canEdit: boolean;
  /** `movements.register`: registrar la ubicación desde el panel. */
  canMove: boolean;
  /** `media.upload`: subir fotos desde el panel. */
  canUpload: boolean;
}) {
  const [collections, setCollections] = useState<CollectionOut[]>([]);
  const [alertFilter, setAlertFilter] = useState<AlertType[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{ status: "ok"; page: IncompletePage } | { status: "unavailable"; message: string } | null>(null);
  const [counts, setCounts] = useState<Partial<Record<AlertType, number | null>>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  // Tras guardar, se abre la pieza que sigue a la guardada en la lista nueva.
  const [advanceFrom, setAdvanceFrom] = useState<{ id: string; index: number } | null>(null);
  const canComplete = canEdit || canMove || canUpload;

  useEffect(() => {
    fetchDuplicateCollections(devUser).then(setCollections);
  }, [devUser]);

  useEffect(() => {
    let active = true;
    fetchIncompleteReport({ alert: alertFilter, collectionId: collectionId || undefined, includeSubcollections: true, page, pageSize: INCOMPLETE_PAGE_SIZE }, devUser).then((r) => {
      if (active) setResult(r);
    });
    return () => {
      active = false;
    };
  }, [alertFilter, collectionId, page, devUser, reload]);

  // El número de cada tarjeta: las piezas con esa alerta (en la colección elegida).
  useEffect(() => {
    let active = true;
    Promise.all(
      ALERT_CARDS.map((card) =>
        fetchIncompleteReport({ alert: [card.code], collectionId: collectionId || undefined, includeSubcollections: true, page: 1, pageSize: 1 }, devUser).then(
          (r) => [card.code, r.status === "ok" ? r.page.total : null] as const,
        ),
      ),
    ).then((entries) => {
      if (active) setCounts(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [collectionId, devUser, reload]);

  const items = result?.status === "ok" ? result.page.items : [];
  const total = result?.status === "ok" ? result.page.total : 0;
  const pageCount = Math.max(1, Math.ceil(total / INCOMPLETE_PAGE_SIZE));

  // Tras guardar, abre la pieza siguiente a la guardada (si sigue en la lista, la que viene después).
  if (advanceFrom && result?.status === "ok") {
    const position = items.findIndex((item) => item.piece_id === advanceFrom.id);
    const next = position >= 0 ? items[position + 1] : items[Math.min(advanceFrom.index, items.length - 1)];
    setOpenId(next?.piece_id ?? null);
    setAdvanceFrom(null);
  }

  function toggleAlert(code: AlertType) {
    setPage(1);
    setOpenId(null);
    setAlertFilter((current) => (current.includes(code) ? current.filter((c) => c !== code) : [...current, code]));
  }

  async function handleDownload(format: "xlsx" | "csv") {
    setDownloadMessage(null);
    const outcome = await downloadIncompleteReport({ alert: alertFilter, collectionId: collectionId || undefined, includeSubcollections: true }, format, devUser);
    if (outcome.status !== "ok") return setDownloadMessage(outcome.message);
    const url = URL.createObjectURL(outcome.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `piezas-incompletas.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const openIndex = items.findIndex((item) => item.piece_id === openId);
  const open = openIndex >= 0 ? items[openIndex] : null;
  const pieces = total === 1 ? "pieza" : "piezas";
  const heading =
    alertFilter.length === 0
      ? `${pieces} ${total === 1 ? "incompleta" : "incompletas"}`
      : alertFilter.length === 1
        ? `${pieces} · ${ALERT_CARDS.find((c) => c.code === alertFilter[0])?.label.toLowerCase() ?? ""}`
        : `${pieces} con todo lo elegido`;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section aria-labelledby="que-falta" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="que-falta" className="text-xl font-extrabold text-tinta">
            ¿Qué les falta?
          </h2>
          <p className="text-base text-gris-texto">Elija una o varias: se muestran las piezas a las que les falta todo lo elegido.</p>
        </div>
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          {ALERT_CARDS.map(({ code, label, icon: Icon }) => {
            const on = alertFilter.includes(code);
            const count = counts[code];
            return (
              <li key={code} className="flex">
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleAlert(code)}
                  className={cn(
                    "relative flex min-h-11 w-full flex-col items-start gap-0.5 rounded-xl border px-3.5 py-3 text-left shadow-sm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota",
                    on ? "border-2 border-terracota bg-terracota-light" : "border-borde bg-white hover:border-gris-texto",
                  )}
                >
                  <Icon size={18} aria-hidden="true" className={cn("absolute top-3 right-3", on ? "text-terracota-dark" : "text-gris-texto")} />
                  <span className="text-2xl leading-tight font-extrabold text-tinta tabular-nums">{count == null ? "—" : count.toLocaleString("es-PE")}</span>
                  <span className={cn("pr-5 text-base leading-snug font-semibold", on ? "text-terracota-dark" : "text-gris-texto")}>{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <PillSelect
          label="Colección"
          accessibleLabel="Colección (incluye sus subcolecciones)"
          allLabel="Todas las colecciones"
          value={collectionId || null}
          options={collections.map((c) => ({ value: c.id, label: c.parent_id ? `— ${c.name}` : c.name }))}
          onChange={(value) => {
            setPage(1);
            setOpenId(null);
            setCollectionId(value ?? "");
          }}
        />
        {canDownload && (
          <details className="group relative ml-auto">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full px-3 text-base font-bold text-gris-texto hover:bg-white hover:text-tinta focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota [&::-webkit-details-marker]:hidden">
              <Download size={18} aria-hidden="true" />
              Descargar
              <ChevronDown size={16} aria-hidden="true" className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="absolute right-0 z-20 mt-1 flex w-44 flex-col rounded-lg border border-borde bg-white p-1.5 shadow-md">
              <button type="button" onClick={() => handleDownload("xlsx")} className="flex min-h-11 items-center gap-2 rounded-md px-3 text-left text-base hover:bg-crema-light">
                <FileSpreadsheet size={18} aria-hidden="true" />
                Excel
              </button>
              <button type="button" onClick={() => handleDownload("csv")} className="flex min-h-11 items-center gap-2 rounded-md px-3 text-left text-base hover:bg-crema-light">
                <Download size={18} aria-hidden="true" />
                CSV
              </button>
            </div>
          </details>
        )}
      </div>
      {downloadMessage && <p className="text-base text-gris-texto">{downloadMessage}</p>}
      {notice && (
        <p role="status" className="rounded-md bg-verde-bg p-3 text-base text-verde-exito">
          {notice}
        </p>
      )}

      {!result && (
        <p role="status" className="text-base text-gris-texto">
          Cargando…
        </p>
      )}
      {result?.status === "unavailable" && <p className="text-base text-gris-texto">{result.message}</p>}
      {result?.status === "ok" && (
        <>
          <p className="text-lg font-bold text-tinta" aria-live="polite">
            {total.toLocaleString("es-PE")} {heading}
          </p>
          {items.length === 0 ? (
            <p className="rounded-tarjeta border border-dashed border-borde p-6 text-center text-base text-gris-texto">No hay piezas con esto por completar.</p>
          ) : (
            <ul aria-label="Piezas incompletas" className="overflow-hidden rounded-tarjeta border border-borde bg-white shadow-sm">
              {items.map((item) => {
                const { alerts, fields } = missingLabels(item);
                return (
                  <li key={item.piece_id} className={cn("grid items-center gap-3 border-b border-borde px-4 py-3 last:border-b-0 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]", openId === item.piece_id && "bg-crema-light")}>
                    <div className="min-w-0">
                      <Link href={`/piezas/${item.piece_id}`} className="inline-flex min-h-11 items-center text-lg font-semibold break-words text-tinta underline hover:text-terracota">
                        {item.title}
                      </Link>
                      <p className="text-base text-gris-texto">{item.collection_name ?? "Sin colección"}</p>
                    </div>
                    <p className="flex flex-wrap items-center gap-1.5 text-base">
                      <span className="font-semibold text-gris-texto">Le falta:</span>
                      {alerts.map((label) => (
                        <span key={label} className="rounded-full bg-ambar-bg px-2.5 py-0.5 font-semibold text-ambar-texto">
                          {label}
                        </span>
                      ))}
                      {fields && <span className="rounded-full bg-borde px-2.5 py-0.5 font-semibold text-tinta">{fields}</span>}
                    </p>
                    {canComplete && (
                      <Button onClick={() => setOpenId(item.piece_id)} className="w-full lg:w-auto">
                        Completar
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {pageCount > 1 && (
            <nav aria-label="Páginas de piezas incompletas" className="flex items-center justify-between gap-3 text-base text-gris-texto">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={buttonClassName({ variant: "neutral", size: "sm" })}>
                Anterior
              </button>
              <span>
                Página {page} de {pageCount}
              </span>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)} className={buttonClassName({ variant: "neutral", size: "sm" })}>
                Siguiente
              </button>
            </nav>
          )}
        </>
      )}

      {open && (
        <CompletePanel
          key={open.piece_id}
          item={open}
          position={{ index: (page - 1) * INCOMPLETE_PAGE_SIZE + openIndex + 1, total }}
          devUser={devUser}
          canEdit={canEdit}
          canMove={canMove}
          canUpload={canUpload}
          onClose={() => setOpenId(null)}
          onSkip={() => setOpenId(items[openIndex + 1]?.piece_id ?? null)}
          onSaved={(text) => {
            setNotice(text);
            setAdvanceFrom({ id: open.piece_id, index: openIndex });
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Panel «Completar ficha»
// ---------------------------------------------------------------------------------------------

type FormValues = Partial<Record<Exclude<PanelField, "materials">, string>> & { materials?: string[] };

interface Catalogs {
  collections: TermOption[];
  categories: TermOption[];
  materials: TermOption[];
  conservationStates: TermOption[];
}

/** Los cambios de la ficha a partir de lo que se llenó (solo campos con valor). */
export function updateFromForm(form: FormValues): PieceUpdateInput {
  const input: PieceUpdateInput = {};
  const text = (value: string | undefined) => (value && value.trim() ? value.trim() : null);
  if (text(form.collection_id)) input.collection_id = form.collection_id;
  if (text(form.category_id)) input.category_id = form.category_id;
  if (text(form.conservation_state_id)) input.conservation_state_id = form.conservation_state_id;
  if (form.materials && form.materials.length) input.material_term_ids = form.materials;
  if (text(form.provenance)) input.provenance = text(form.provenance);
  if (text(form.dimensions_text)) input.dimensions_text = text(form.dimensions_text);
  if (text(form.description)) input.description = text(form.description);
  if (text(form.epoch_original_text)) input.period = { text: text(form.epoch_original_text) };
  return input;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-base font-extrabold text-tinta">{title}</h3>
      {children}
    </section>
  );
}

function CompletePanel({
  item,
  position,
  devUser,
  canEdit,
  canMove,
  canUpload,
  onClose,
  onSkip,
  onSaved,
}: {
  item: IncompletePiece;
  position: { index: number; total: number };
  devUser?: string;
  canEdit: boolean;
  canMove: boolean;
  canUpload: boolean;
  onClose: () => void;
  onSkip: () => void;
  onSaved: (notice: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [detail, setDetail] = useState<PieceDetail | null>(null);
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null);
  const [tree, setTree] = useState<LocationNode[] | null>(null);
  const [treeMessage, setTreeMessage] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>({});
  const [locationId, setLocationId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const needsLocation = item.alerts.includes("MISSING_LOCATION");
  const needsPhoto = item.alerts.includes("MISSING_PHOTO");
  const needsCode = item.alerts.includes("MISSING_INVENTORY_CODE");
  const badCode = item.alerts.includes("UNNORMALIZABLE_IDENTIFIER");
  const fields = PANEL_FIELDS.filter((field) => (item.missing_fields ?? []).includes(field));
  const elsewhere = (item.missing_fields ?? []).filter((field) => !(PANEL_FIELDS as readonly string[]).includes(field));

  useEffect(() => {
    dialogRef.current?.showModal();
    let active = true;
    fetchPieceDetail(item.piece_id).then((r) => {
      if (active && r.status === "ok") setDetail(r.piece);
    });
    fetchPieceCatalogs().then((r) => {
      if (active && r.status === "ok") setCatalogs(r.catalogs);
    });
    if (needsLocation && canMove) {
      fetchLocationsTree(devUser).then((r) => {
        if (!active) return;
        if (r.status === "ok") setTree(r.value);
        else setTreeMessage(getApiMode() === "mock" ? "En la demostración la ubicación se registra desde la ficha." : r.message);
      });
    }
    return () => {
      active = false;
    };
  }, [item.piece_id, needsLocation, canMove, devUser]);

  const set = (field: Exclude<PanelField, "materials">, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const filled = fields.filter((field) => (field === "materials" ? (form.materials ?? []).length > 0 : Boolean(form[field]?.trim()))).length + (locationId ? 1 : 0) + (files.length ? 1 : 0);
  const pending = fields.length + (needsLocation && canMove ? 1 : 0) + (needsPhoto && canUpload ? 1 : 0);

  async function save() {
    setBusy(true);
    setErrors([]);
    const problems: string[] = [];
    const done: string[] = [];
    const changes = canEdit ? updateFromForm(form) : {};
    if (Object.keys(changes).length > 0) {
      const r = await updatePiece(item.piece_id, changes, detail?.version);
      if (r.status === "ok") done.push(...fields.filter((f) => (f === "materials" ? (form.materials ?? []).length : form[f]?.trim())).map((f) => FIELD_LABELS[f]));
      else problems.push(r.message);
    }
    if (locationId && canMove) {
      const r = await batchMovePieces(
        {
          movement_type: "MOVE",
          to_location_id: locationId,
          reason: "Ubicación registrada al completar la ficha (Revisar pendientes)",
          items: [{ piece_id: item.piece_id, expected_from_location_id: detail?.location?.location_id ?? null }],
        },
        newIdempotencyKey(),
        devUser,
      );
      if (r.status !== "ok") problems.push(describeLocationFailure(r));
      else if ((r.value.failures ?? []).length > 0) problems.push(r.value.failures?.[0]?.message ?? "No se pudo registrar la ubicación.");
      else done.push("ubicación");
    }
    if (files.length && canUpload) {
      const r = await uploadPiecePhotos(
        item.piece_id,
        files.map((file) => ({ file, relativePath: file.name, contentType: file.type || "image/jpeg" })),
        () => {},
        { devUser },
      );
      if (r.status === "ok") done.push(files.length === 1 ? "1 foto" : `${files.length} fotos`);
      else problems.push(r.message);
    }
    setBusy(false);
    if (problems.length > 0) {
      setErrors(problems);
      return;
    }
    onSaved(done.length ? `${item.title}: se guardó ${done.join(", ")}.` : `${item.title}: no había nada nuevo que guardar.`);
  }

  const options = (list: TermOption[] | undefined) =>
    (list ?? []).map((option) => (
      <option key={option.id} value={option.id}>
        {option.label}
      </option>
    ));

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
      className="fixed inset-y-2 right-2 left-auto m-0 h-auto max-h-none w-[calc(100vw-1rem)] max-w-none flex-col overflow-hidden rounded-panel bg-white p-0 text-tinta shadow-md backdrop:bg-tinta/30 open:flex sm:w-[32rem]"
    >
      <div className="flex flex-col gap-2 border-b border-borde px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-base font-semibold text-gris-texto">
            Completar ficha · {position.index} de {position.total.toLocaleString("es-PE")}
          </p>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Cerrar «Completar ficha»"
            className="grid min-h-11 size-11 place-items-center rounded-full border border-borde hover:bg-crema-light focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <h2 id={titleId} className="text-2xl font-extrabold break-words">
          {item.title}
        </h2>
        {pending > 0 && (
          <div className="flex items-center gap-3 text-base font-bold">
            <span aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-borde">
              <span className="block h-full rounded-full bg-verde-exito" style={{ width: `${Math.round((filled / pending) * 100)}%` }} />
            </span>
            <span>{filled === 0 ? (pending === 1 ? "Le falta 1 dato" : `Le faltan ${pending} datos`) : `Completó ${filled} de ${pending}`}</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        {needsLocation && canMove && (
          <Section title="Ubicación">
            {tree ? (
              <div className="max-h-64 overflow-y-auto rounded-md border border-borde p-3">
                <LocationTreeSelect label="Dónde está" nodes={tree} value={locationId} onChange={setLocationId} />
              </div>
            ) : (
              <p className="text-base text-gris-texto">{treeMessage ?? "Cargando los lugares…"}</p>
            )}
          </Section>
        )}

        {canEdit &&
          fields.map((field) => {
            const label = FIELD_LABELS[field];
            const title = label.charAt(0).toUpperCase() + label.slice(1);
            if (field === "collection_id" || field === "category_id" || field === "conservation_state_id") {
              const list = field === "collection_id" ? catalogs?.collections : field === "category_id" ? catalogs?.categories : catalogs?.conservationStates;
              return (
                <Select key={field} label={title} controlSize="md" value={form[field] ?? ""} onChange={(event) => set(field, event.target.value)}>
                  <option value="">Elija {field === "conservation_state_id" ? "un estado" : field === "collection_id" ? "una colección" : "una categoría"}</option>
                  {options(list)}
                </Select>
              );
            }
            if (field === "materials") {
              return (
                <fieldset key={field} className="flex flex-col gap-2">
                  <legend className="mb-2 text-base font-semibold text-tinta">{title}</legend>
                  <div className="flex flex-wrap gap-2">
                    {(catalogs?.materials ?? []).map((option) => {
                      const on = (form.materials ?? []).includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setForm((current) => ({ ...current, materials: on ? (current.materials ?? []).filter((id) => id !== option.id) : [...(current.materials ?? []), option.id] }))}
                          className={cn(
                            "min-h-11 rounded-full border px-3.5 text-base font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota",
                            on ? "border-verde-exito bg-verde-bg text-verde-exito" : "border-borde bg-white text-tinta hover:border-gris-texto",
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              );
            }
            if (field === "description") {
              return <Textarea key={field} label={title} rows={3} value={form.description ?? ""} onChange={(event) => set(field, event.target.value)} />;
            }
            return <Input key={field} label={title} controlSize="md" value={form[field] ?? ""} onChange={(event) => set(field, event.target.value)} />;
          })}

        {needsPhoto && canUpload && (
          <Section title="Foto">
            <label className="flex min-h-11 cursor-pointer flex-col items-center gap-1 rounded-md border-2 border-dashed border-borde p-4 text-center text-base font-semibold text-gris-texto hover:border-gris-texto focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-terracota">
              <Camera size={22} aria-hidden="true" />
              {files.length ? plural(files.length, "foto elegida", "fotos elegidas") : "Elegir fotos de la pieza"}
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
            </label>
          </Section>
        )}

        {(needsCode || badCode || elsewhere.length > 0) && (
          <div className="flex flex-col gap-1 rounded-md bg-crema-light p-3 text-base text-gris-texto">
            {needsCode && <p>También le falta el código I. Lo asigna quien marca la pieza físicamente.</p>}
            {badCode && <p>Tiene un código que el sistema no entiende: corríjalo en la ficha.</p>}
            {elsewhere.length > 0 && <p>Complete en la ficha: {elsewhere.map((field) => FIELD_LABELS[field] ?? field).join(", ")}.</p>}
            <Link href={`/piezas/${item.piece_id}`} className="inline-flex min-h-11 items-center gap-1 self-start font-semibold text-terracota underline">
              Abrir la ficha
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        )}

        {errors.length > 0 && (
          <div role="alert" className="rounded-md bg-carmin-bg p-3 text-base text-carmin-texto">
            {errors.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-borde px-6 py-4">
        <Button variant="neutral" onClick={onSkip} disabled={busy}>
          Saltar
        </Button>
        <Button variant="create" className="ml-auto" onClick={() => void save()} disabled={busy}>
          {busy ? "Guardando…" : "Guardar y siguiente"}
          {!busy && <ArrowRight size={18} aria-hidden="true" />}
        </Button>
      </div>
    </dialog>
  );
}
