"use client";

/**
 * Búsqueda en modo `live` (change `busqueda-avanzada-y-exportacion`, tareas 4.1 y 4.2; RF-031,
 * RF-032, RF-036, RF-044): todos los filtros del filtro único, chips de filtros activos con
 * quitar, qué coincidió por resultado, sugerencias sin resultados, miniatura de la foto
 * principal, exportación con selección de columnas, «Mis exportaciones» y exportación completa.
 */
import { Download, FileSpreadsheet, MapPin, Plus, RefreshCw, SearchX, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { LocationPlaceDialogs, type PlaceAction } from "@/components/domain/LocationPlaceDialogs";
import { flattenLocationTree } from "@/components/domain/LocationsAdmin";
import { PieceCard, pieceCardProps } from "@/components/domain/PieceCard";
import { EMPTY_OPTIONS, FiltersDrawer, SearchFiltersPanel, loadSearchOptions, type SearchOptions } from "@/components/domain/SearchFilters";
import { SelectionBar, type SelectionFeedback } from "@/components/domain/SelectionBar";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import {
  LOCATION_ERROR_MESSAGES,
  batchMovePieces,
  fetchLocationsTree,
  finalLocations,
  movePiece,
  newIdempotencyKey,
  seenAgoText,
  type LocationFailure,
} from "@/lib/data/locations";
import {
  EMPTY_SELECTION,
  batchMoveRequest,
  pageSelectionState,
  setPageSelected,
  toggleSelected,
  verificationBody,
  type Selection,
} from "@/lib/data/selection";
import {
  DEFAULT_EXPORT_COLUMNS,
  EMPTY_FILTERS,
  EXPORT_COLUMNS,
  SEARCH_PAGE_SIZE,
  TEXT_FILTER_KEYS,
  TYPING_DEBOUNCE_MS,
  activeChips,
  filtersToSearchParams,
  canDownload,
  exportResults,
  fetchExportDownloadUrl,
  fetchExportJobs,
  fetchSearch,
  filterOfSuggestion,
  hasPendingJobs,
  jobKindLabel,
  jobStatusLabel,
  matchReasonText,
  removeFilter,
  startFullExport,
  suggestionText,
  type ExportFormat,
  type ExportJob,
  type FilterChip,
  type SearchFilters,
  type SearchHit,
  type SearchPage,
} from "@/lib/data/search";

/** Cada cuánto se consulta el estado de las exportaciones en preparación. */
const JOBS_POLL_MS = 3000;
const PERM_DONOR_DATA = "sensitive.donor_data";
const PERM_LOAN_TERMS = "sensitive.loan_terms";

function describeLocationFailure(failure: LocationFailure): string {
  if (failure.status === "unavailable") return failure.message;
  return LOCATION_ERROR_MESSAGES[failure.code] ?? failure.message;
}

function optionNames(options: SearchOptions): Record<string, string> {
  const lists = [options.collections, options.categories, options.materials, options.conservationStates, options.locations];
  return Object.fromEntries(lists.flatMap((list) => list.map((option) => [option.id, option.label])));
}

export function ActiveFilterChips({ chips, onRemove }: { chips: FilterChip[]; onRemove: (key: FilterChip["key"]) => void }) {
  if (chips.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Filtros activos">
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            onClick={() => onRemove(chip.key)}
            aria-label={`Quitar el filtro ${chip.label}: ${chip.value}`}
            className="flex min-h-11 items-center gap-1 rounded-full bg-crema px-3 py-1 text-sm text-tinta hover:bg-borde focus-visible:outline-2 focus-visible:outline-terracota"
          >
            <span className="text-gris-texto">{chip.label}:</span> {chip.value}
            <X size={16} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** «Seleccionar toda la página» y cuántas piezas hay elegidas, también de otras páginas. */
function PageSelection({
  hits,
  selection,
  onSelectionChange,
}: {
  hits: SearchHit[];
  selection: Selection;
  onSelectionChange: (next: Selection) => void;
}) {
  const state = pageSelectionState(selection, hits);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-tinta">
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          checked={state === "all"}
          aria-checked={state === "some" ? "mixed" : state === "all"}
          onChange={() => onSelectionChange(setPageSelected(selection, hits, state !== "all"))}
          className="size-6 accent-terracota"
        />
        Seleccionar toda la página
      </label>
      {selection.size > 0 && (
        <span className="flex items-center gap-2" aria-live="polite">
          {selection.size} pieza{selection.size === 1 ? "" : "s"} seleccionada{selection.size === 1 ? "" : "s"}
          <Button variant="outline" size="sm" onClick={() => onSelectionChange(EMPTY_SELECTION)}>
            Quitar la selección
          </Button>
        </span>
      )}
    </div>
  );
}

export function SearchResults({
  page,
  onPage,
  onSuggestion,
  chips = [],
  onRemoveChip,
  selection,
  onSelectionChange,
}: {
  page: SearchPage;
  onPage?: (page: number) => void;
  onSuggestion?: (suggestion: string) => void;
  /** Filtros aplicados: sin resultados se ofrece quitarlos uno por uno (fusion-busqueda-deposito 2.3). */
  chips?: FilterChip[];
  onRemoveChip?: (key: FilterChip["key"]) => void;
  /**
   * Piezas elegidas para verificar o mover (fusion-busqueda-deposito 3.1). Sin ella no hay casillas:
   * solo se pasa a quien tiene el permiso de registrar movimientos.
   */
  selection?: Selection;
  onSelectionChange?: (next: Selection) => void;
}) {
  // Los filtros que se pueden quitar ya están en `chips`; de las sugerencias quedan las demás.
  const removable = onRemoveChip ? chips : [];
  const suggestions = (page.suggestions ?? []).filter((suggestion) => !(removable.length > 0 && filterOfSuggestion(suggestion)));
  const pages = Math.max(1, Math.ceil(page.total / Math.max(1, page.limit)));
  const excluded = page.excluded_uninterpreted_period ?? 0;
  return (
    <div className="flex flex-col gap-3">
      {excluded > 0 && (
        <p className="rounded-md bg-ambar-bg px-3 py-2 text-sm text-ambar-texto">
          {excluded} pieza{excluded === 1 ? "" : "s"} cumple{excluded === 1 ? "" : "n"} los demás filtros, pero su época solo está escrita como
          texto y no se pudo comparar con el rango.
        </p>
      )}
      {page.items.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 border-dashed text-center text-base text-gris-texto">
          <SearchX size={24} aria-hidden="true" />
          No se encontraron piezas con estos filtros.
          {removable.length > 0 && onRemoveChip && (
            <ul className="flex flex-col gap-1 text-left text-sm text-tinta" aria-label="Quitar filtros uno por uno">
              {removable.map((chip) => (
                <li key={chip.key}>
                  <button type="button" onClick={() => onRemoveChip(chip.key)} className="text-terracota underline">
                    Quite el filtro {chip.label}: {chip.value}.
                  </button>
                </li>
              ))}
            </ul>
          )}
          {suggestions.length > 0 && (
            <ul className="flex flex-col gap-1 text-left text-sm text-tinta">
              {suggestions.map((suggestion) => (
                <li key={suggestion}>
                  {filterOfSuggestion(suggestion) && onSuggestion ? (
                    <button type="button" onClick={() => onSuggestion(suggestion)} className="text-terracota underline">
                      {suggestionText(suggestion)}
                    </button>
                  ) : (
                    suggestionText(suggestion)
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <>
          {selection && onSelectionChange && (
            <PageSelection hits={page.items} selection={selection} onSelectionChange={onSelectionChange} />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {page.items.map((hit) => {
              const card = (
                <PieceCard
                  compact
                  {...pieceCardProps(hit.piece)}
                  thumbnailUrl={hit.thumbnail_url}
                  matchReason={matchReasonText(hit)}
                  seenText={hit.last_seen_at ? seenAgoText(hit.last_seen_at) : null}
                />
              );
              if (!selection || !onSelectionChange) return <div key={hit.piece.id}>{card}</div>;
              // La casilla va al lado de la tarjeta, que es un enlace a la ficha.
              return (
                <div key={hit.piece.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selection.has(hit.piece.id)}
                    onChange={() => onSelectionChange(toggleSelected(selection, hit))}
                    aria-label={`Seleccionar ${hit.piece.denomination}`}
                    className="mt-3 size-7 shrink-0 accent-terracota lg:mt-4 lg:size-6"
                  />
                  <div className="min-w-0 flex-1">{card}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {page.total > page.limit && onPage && (
        <div className="flex items-center justify-between gap-3">
          <Button variant="secondary" disabled={page.page <= 1} onClick={() => onPage(page.page - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-gris-texto">
            Página {page.page} de {pages}
          </span>
          <Button variant="secondary" disabled={page.page >= pages} onClick={() => onPage(page.page + 1)}>
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}

export function ExportColumnsPicker({
  selected,
  canSeeSensitive,
  onChange,
}: {
  selected: string[];
  canSeeSensitive: (key: string) => boolean;
  onChange: (columns: string[]) => void;
}) {
  const visible = EXPORT_COLUMNS.filter((column) => !column.sensitive || canSeeSensitive(column.key));
  const toggle = (key: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(key);
    else next.delete(key);
    // Mantiene el orden del archivo (el de `EXPORT_COLUMNS`), no el de los clics.
    onChange(EXPORT_COLUMNS.map((column) => column.key).filter((columnKey) => next.has(columnKey)));
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-base font-medium text-tinta">Columnas del archivo</legend>
      <div className="grid gap-1 sm:grid-cols-2">
        {visible.map((column) => (
          <label key={column.key} className="flex min-h-11 items-center gap-2 text-sm text-tinta">
            <input type="checkbox" checked={selected.includes(column.key)} onChange={(event) => toggle(column.key, event.target.checked)} className="size-5 accent-terracota" />
            {column.label}
            {column.sensitive && <span className="text-gris-texto">(dato restringido)</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ExportJobsList({
  jobs,
  onDownload,
  now = new Date(),
}: {
  jobs: ExportJob[];
  onDownload: (job: ExportJob) => void;
  now?: Date;
}) {
  if (jobs.length === 0) return <p className="text-base text-gris-texto">Todavía no tiene exportaciones.</p>;
  return (
    <ul className="flex flex-col divide-y divide-borde">
      {jobs.map((job) => (
        <li key={job.id ?? ""} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <div className="flex flex-col">
            <span className="text-base text-tinta">
              {jobKindLabel(job)} · {job.format.toUpperCase()}
              {job.row_count != null ? ` · ${job.row_count.toLocaleString("es-PE")} filas` : ""}
            </span>
            <span className="text-sm text-gris-texto">
              {jobStatusLabel(job, now)}
              {job.created_at ? ` · solicitada el ${new Date(job.created_at).toLocaleString("es-PE")}` : ""}
              {job.expires_at && canDownload(job, now) ? ` · disponible hasta el ${new Date(job.expires_at).toLocaleString("es-PE")}` : ""}
            </span>
            {job.status === "FAILED" && job.error && <span className="text-sm text-carmin-texto">{job.error}</span>}
          </div>
          {canDownload(job, now) && (
            <Button variant="outline" icon={Download} onClick={() => onDownload(job)}>
              Descargar
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** «Mis exportaciones»: estado de los trabajos y descarga mientras no caduquen. */
export function MyExportsPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const { currentUser } = useSession();
  const devUser = currentUser?.email;
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    fetchExportJobs(devUser).then((result) => {
      if (!active) return;
      if (result.status === "ok") {
        setJobs(result.value);
        setError(null);
      } else setError(result.message);
    });
    return () => {
      active = false;
    };
  }, [devUser, refreshKey, tick]);

  const pending = hasPendingJobs(jobs);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setTick((value) => value + 1), JOBS_POLL_MS);
    return () => clearTimeout(timer);
  }, [pending, tick]);

  async function handleDownload(job: ExportJob) {
    if (!job.id) return;
    const result = await fetchExportDownloadUrl(job.id, devUser);
    if (result.status !== "ok") {
      setError(result.message);
      setTick((value) => value + 1);
      return;
    }
    window.open(result.value, "_blank", "noopener");
  }

  return (
    <Card as="section" aria-label="Mis exportaciones" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-tinta">Mis exportaciones</h2>
        <Button variant="secondary" icon={RefreshCw} onClick={() => setTick((value) => value + 1)}>
          Actualizar
        </Button>
      </div>
      <p className="text-sm text-gris-texto">Los archivos se conservan 72 horas; después puede generarlos de nuevo.</p>
      {error && (
        <p role="alert" className="rounded-md bg-carmin-bg px-3 py-2 text-base text-carmin-texto">
          {error}
        </p>
      )}
      <ExportJobsList jobs={jobs} onDownload={handleDownload} />
    </Card>
  );
}

/** Exportación de los resultados con los filtros de la pantalla (tarea 4.2). */
function ExportResultsPanel({ filters, onJobCreated }: { filters: SearchFilters; onJobCreated: () => void }) {
  const { currentUser, hasPermission } = useSession();
  const [columns, setColumns] = useState<string[]>(DEFAULT_EXPORT_COLUMNS);
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canSeeSensitive = (key: string) =>
    key === "lender_name" ? hasPermission(PERM_DONOR_DATA) : key === "loan_agreement_ref" ? hasPermission(PERM_LOAN_TERMS) : true;

  async function handleExport() {
    setBusy(true);
    setNotice(null);
    setError(null);
    const result = await exportResults(filters, columns, format, currentUser?.email);
    setBusy(false);
    if (result.status !== "ok") return setError(result.message);
    if (result.value.kind === "job") {
      setNotice("La exportación es grande: se está preparando en segundo plano. Aparecerá en «Mis exportaciones» cuando esté lista.");
      onJobCreated();
      return;
    }
    saveBlob(result.value.blob, result.value.fileName);
    setNotice(
      `Archivo descargado con las mismas piezas y el mismo orden que la búsqueda${format === "xlsx" ? ", más una hoja con los filtros y la fecha" : ""}.`,
    );
  }

  return (
    <Card as="section" aria-label="Exportar resultados" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-tinta">Exportar resultados</h2>
      <ExportColumnsPicker selected={columns} canSeeSensitive={canSeeSensitive} onChange={setColumns} />
      <div className="flex flex-wrap items-end gap-3">
        <Select label="Formato" value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}>
          <option value="xlsx">Excel (.xlsx)</option>
          <option value="csv">CSV</option>
        </Select>
        <Button icon={FileSpreadsheet} disabled={busy || columns.length === 0} onClick={handleExport}>
          {busy ? "Exportando…" : "Exportar"}
        </Button>
      </div>
      {notice && <p className="rounded-md bg-verde-bg px-3 py-2 text-sm text-verde-exito">{notice}</p>}
      {error && (
        <p role="alert" className="rounded-md bg-carmin-bg px-3 py-2 text-base text-carmin-texto">
          {error}
        </p>
      )}
    </Card>
  );
}

/** Exportación completa en formato abierto (RF-044): un trabajo único a la vez. */
export function FullExportPanel() {
  const { currentUser } = useSession();
  const devUser = currentUser?.email;
  const [job, setJob] = useState<ExportJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const request = useCallback(async () => {
    setBusy(true);
    const result = await startFullExport(devUser);
    setBusy(false);
    if (result.status === "ok") {
      setJob(result.value);
      setError(null);
    } else setError(result.message);
  }, [devUser]);

  // Mientras el paquete se prepara, volver a pedirlo devuelve el mismo trabajo (no inicia otro).
  const pending = job != null && hasPendingJobs([job]);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(request, JOBS_POLL_MS);
    return () => clearTimeout(timer);
  }, [pending, job, request]);

  async function handleDownload(target: ExportJob) {
    if (!target.id) return;
    const result = await fetchExportDownloadUrl(target.id, devUser);
    if (result.status !== "ok") return setError(result.message);
    window.open(result.value, "_blank", "noopener");
  }

  return (
    <Card as="section" aria-label="Exportación completa" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-tinta">Exportación completa de la base (RF-044)</h2>
      <p className="text-base text-gris-texto">
        Prepara un paquete ZIP con un CSV por tabla, un libro Excel, un diccionario de columnas y un manifiesto con las huellas de cada
        archivo. Incluye las piezas eliminadas con su motivo; nunca incluye contraseñas.
      </p>
      <Button icon={Download} disabled={busy || pending} onClick={request} className="self-start">
        {pending ? "Preparando el paquete…" : "Preparar exportación completa"}
      </Button>
      {job && <ExportJobsList jobs={[job]} onDownload={handleDownload} />}
      {error && (
        <p role="alert" className="rounded-md bg-carmin-bg px-3 py-2 text-base text-carmin-texto">
          {error}
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
// Contenedor live
// ---------------------------------------------------------------------------------------------

export function SearchLive({ initialFilters = EMPTY_FILTERS }: { initialFilters?: SearchFilters }) {
  const { currentUser, hasPermission } = useSession();
  const devUser = currentUser?.email;
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [query, setQuery] = useState<SearchFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SearchPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<SearchOptions>(EMPTY_OPTIONS);
  const [jobsKey, setJobsKey] = useState(0);
  const canExport = hasPermission("exports.run");
  // Verificar y mover desde los resultados: solo con el permiso de la antigua vista de depósito (3.1).
  const canMove = hasPermission("movements.register");
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [acting, setActing] = useState(false);
  const [feedback, setFeedback] = useState<SelectionFeedback | null>(null);
  // Sube al verificar o mover, para que los resultados muestren la ubicación nueva (3.2).
  const [reloadKey, setReloadKey] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Cada «Ver por ubicación» vuelve a montar el panel con «Más filtros» abierto (design D3).
  const [locationRevealKey, setLocationRevealKey] = useState(0);
  // Agregar, editar o desactivar lugares desde el árbol (`crud-manual-completo` 3.1).
  const canManagePlaces = hasPermission("locations.manage");
  const [placeAction, setPlaceAction] = useState<PlaceAction | null>(null);
  const [placeNotice, setPlaceNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadSearchOptions(devUser).then((loaded) => {
      if (active) setOptions(loaded);
    });
    return () => {
      active = false;
    };
  }, [devUser]);

  // Los textos esperan a que el usuario deje de escribir; los demás filtros se aplican al instante.
  useEffect(() => {
    const typing = TEXT_FILTER_KEYS.some((key) => filters[key] !== query[key]);
    const delay = typing ? TYPING_DEBOUNCE_MS : 0;
    const timer = setTimeout(() => {
      setQuery(filters);
      setPage(1);
    }, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- los textos de `query` solo deciden la espera
  }, [filters]);

  useEffect(() => {
    let active = true;
    fetchSearch(query, page, devUser, SEARCH_PAGE_SIZE).then((response) => {
      if (!active) return;
      if (response.status === "ok") {
        setResult(response.value);
        setError(null);
      } else {
        setResult(null);
        setError(response.message);
      }
    });
    return () => {
      active = false;
    };
  }, [query, page, devUser, reloadKey]);

  // Los filtros aplicados viajan en la dirección, sin sumar una entrada al historial por cada tecla (2.3).
  useEffect(() => {
    const search = filtersToSearchParams(query).toString();
    const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", url);
  }, [query]);

  const names = useMemo(() => optionNames(options), [options]);
  const destinations = useMemo(() => finalLocations(options.locationTree), [options.locationTree]);

  // «Verificar»: una verificación física por pieza elegida, la operación de la antigua vista de depósito.
  async function verifySelection() {
    const pieces = [...selection.values()];
    setActing(true);
    setFeedback(null);
    const results = await Promise.all(pieces.map((piece) => movePiece(piece.id, verificationBody(), devUser)));
    setActing(false);
    const failed = results.filter((result): result is LocationFailure => result.status !== "ok");
    setFeedback(
      failed.length === 0
        ? { kind: "ok", text: `Verificación física registrada para ${pieces.length} pieza${pieces.length === 1 ? "" : "s"}.` }
        : { kind: "error", text: `No se verificaron ${failed.length} de ${pieces.length} piezas: ${describeLocationFailure(failed[0])}` },
    );
    setReloadKey((key) => key + 1);
  }

  // «Mover a»: un solo lote, todo o nada, con la ubicación que se vio de cada pieza.
  async function moveSelection(toLocationId: string, reason: string) {
    setActing(true);
    setFeedback(null);
    const result = await batchMovePieces(batchMoveRequest(selection, toLocationId, reason), newIdempotencyKey(), devUser);
    setActing(false);
    if (result.status !== "ok") {
      setFeedback({ kind: "error", text: describeLocationFailure(result) });
      return;
    }
    const failures = result.value.failures ?? [];
    if (failures.length > 0) {
      const detail = failures.map((failure) => `${selection.get(failure.piece_id)?.denomination ?? failure.piece_id}: ${failure.message}`);
      setFeedback({ kind: "error", text: `No se movió ninguna pieza: ${failures.length} con problemas. ${detail.join(" · ")}` });
      return;
    }
    const moved = (result.value.registered ?? []).length;
    const label = destinations.find((option) => option.id === toLocationId)?.label ?? "el destino elegido";
    setFeedback({ kind: "ok", text: `${moved} pieza${moved === 1 ? "" : "s"} movida${moved === 1 ? "" : "s"} a ${label}.` });
    setSelection(EMPTY_SELECTION);
    setReloadKey((key) => key + 1);
  }
  async function handlePlaceChanged(text: string, removedId?: string) {
    setPlaceNotice(text);
    if (removedId && filters.locationId === removedId) setFilters((current) => ({ ...current, locationId: null }));
    const locations = await fetchLocationsTree(devUser);
    if (locations.status === "ok") setOptions((current) => ({ ...current, locations: flattenLocationTree(locations.value), locationTree: locations.value }));
  }

  const chips = activeChips(query, names);
  const update = (next: Partial<SearchFilters>) => setFilters((current) => ({ ...current, ...next }));
  const remove = (key: FilterChip["key"]) => setFilters((current) => removeFilter(current, key));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-tinta">Búsqueda</h1>
        <p className="text-base text-gris-texto">
          Busque por cualquier código —vigente o histórico, con o sin formato (&quot;I 236&quot;, &quot;M.M.Z. 015&quot;, &quot;mmz 15&quot;)— o por
          denominación, autor, procedencia, material, época o descripción, sin preocuparse por mayúsculas ni tildes.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <FiltersDrawer open={filtersOpen} onToggle={() => setFiltersOpen((open) => !open)} activeCount={chips.length}>
          <SearchFiltersPanel
            key={locationRevealKey}
            filters={filters}
            options={options}
            onChange={update}
            onClear={() => setFilters(EMPTY_FILTERS)}
            openMore={locationRevealKey > 0}
            locationActions={
              canManagePlaces
                ? {
                    onAdd: (node) => setPlaceAction({ kind: "add", node }),
                    onEdit: (node) => setPlaceAction({ kind: "edit", node }),
                    onDeactivate: (node) => setPlaceAction({ kind: "deactivate", node }),
                  }
                : undefined
            }
            locationNotice={placeNotice}
          />
        </FiltersDrawer>
        <LocationPlaceDialogs action={placeAction} nodes={options.locationTree} devUser={devUser} onClose={() => setPlaceAction(null)} onChanged={handlePlaceChanged} />

        {/* En tableta la barra de la selección va fija abajo: el final de la lista queda a la vista. */}
        <section className={cn("flex flex-col gap-4", canMove && (selection.size > 0 || feedback) && "pb-48 lg:pb-0")} aria-label="Resultados">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-base text-gris-texto" aria-live="polite">
              <strong className="text-tinta">{result?.total ?? 0}</strong> resultado{result?.total === 1 ? "" : "s"}
            </p>
            <Button
              variant="outline"
              icon={MapPin}
              onClick={() => {
                setFiltersOpen(true);
                setLocationRevealKey((key) => key + 1);
              }}
            >
              Ver por ubicación
            </Button>
            <Link href="/piezas/nueva" className={buttonClassName({})}>
              <Plus size={18} aria-hidden="true" />
              Nueva pieza
            </Link>
          </div>
          <ActiveFilterChips chips={chips} onRemove={remove} />
          {canMove && (
            <SelectionBar
              selection={selection}
              destinations={destinations}
              busy={acting}
              feedback={feedback}
              onVerify={verifySelection}
              onMove={moveSelection}
            />
          )}
          {error && (
            <p role="alert" className="rounded-md bg-carmin-bg px-3 py-2 text-base text-carmin-texto">
              {error}
            </p>
          )}
          {result && (
            <SearchResults
              page={result}
              onPage={setPage}
              chips={chips}
              onRemoveChip={remove}
              {...(canMove ? { selection, onSelectionChange: setSelection } : {})}
              onSuggestion={(suggestion) => {
                const key = filterOfSuggestion(suggestion);
                if (key) remove(key);
              }}
            />
          )}
          {canExport && (
            <>
              <ExportResultsPanel filters={query} onJobCreated={() => setJobsKey((value) => value + 1)} />
              <MyExportsPanel refreshKey={jobsKey} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
