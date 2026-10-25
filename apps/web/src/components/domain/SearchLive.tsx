"use client";

/**
 * Búsqueda en modo `live` (change `busqueda-avanzada-y-exportacion`, tareas 4.1 y 4.2; RF-031,
 * RF-032, RF-036, RF-044): todos los filtros del filtro único, chips de filtros activos con
 * quitar, qué coincidió por resultado, sugerencias sin resultados, miniatura de la foto
 * principal, exportación con selección de columnas, «Mis exportaciones» y exportación completa.
 */
import { Download, Eraser, FileSpreadsheet, Plus, RefreshCw, SearchX, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PieceCard, pieceCardProps } from "@/components/domain/PieceCard";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSession } from "@/lib/auth/session";
import { fetchLocations } from "@/lib/data/locations";
import { fetchPieceCatalogs, type TermOption } from "@/lib/data/pieces";
import {
  DEFAULT_EXPORT_COLUMNS,
  EMPTY_FILTERS,
  EXPORT_COLUMNS,
  SEARCH_PAGE_SIZE,
  activeChips,
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
  type SearchPage,
  type TenureRegimeLabel,
} from "@/lib/data/search";

/** Espera tras la última tecla antes de buscar. */
const TYPING_DEBOUNCE_MS = 300;
/** Cada cuánto se consulta el estado de las exportaciones en preparación. */
const JOBS_POLL_MS = 3000;
const PERM_DONOR_DATA = "sensitive.donor_data";
const PERM_LOAN_TERMS = "sensitive.loan_terms";

export interface SearchOptions {
  collections: TermOption[];
  categories: TermOption[];
  materials: TermOption[];
  conservationStates: TermOption[];
  locations: TermOption[];
}

const EMPTY_OPTIONS: SearchOptions = { collections: [], categories: [], materials: [], conservationStates: [], locations: [] };
const TENURE_REGIMES: TenureRegimeLabel[] = ["Propiedad", "Comodato", "Préstamo Temporal"];

function optionNames(options: SearchOptions): Record<string, string> {
  return Object.fromEntries(Object.values(options).flatMap((list: TermOption[]) => list.map((option) => [option.id, option.label])));
}

function toBoolean(value: string): boolean | null {
  return value === "" ? null : value === "true";
}

function toYear(value: string): number | null {
  if (value.trim() === "") return null;
  const year = Number(value);
  return Number.isFinite(year) ? Math.trunc(year) : null;
}

function OptionSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: TermOption[];
  onChange: (value: string | null) => void;
}) {
  return (
    <Select label={label} value={value ?? ""} onChange={(event) => onChange(event.target.value || null)}>
      <option value="">Todas</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

export function SearchFiltersPanel({
  filters,
  options,
  onChange,
  onClear,
}: {
  filters: SearchFilters;
  options: SearchOptions;
  onChange: (next: Partial<SearchFilters>) => void;
  onClear: () => void;
}) {
  return (
    <Card as="aside" aria-label="Filtros de búsqueda" className="flex flex-col gap-4">
      <Input
        id="q"
        label="Código o texto"
        value={filters.q}
        onChange={(event) => onChange({ q: event.target.value })}
        placeholder="p. ej. I-0236, mmz 15, cerámica huánuco"
        hint="Sin distinguir mayúsculas ni tildes."
        className="p-2.5"
      />
      <OptionSelect label="Colección (con subcolecciones)" value={filters.collectionId} options={options.collections} onChange={(collectionId) => onChange({ collectionId })} />
      <OptionSelect label="Categoría" value={filters.categoryId} options={options.categories} onChange={(categoryId) => onChange({ categoryId })} />
      <OptionSelect label="Material" value={filters.materialId} options={options.materials} onChange={(materialId) => onChange({ materialId })} />
      <OptionSelect
        label="Estado de conservación"
        value={filters.conservationStateId}
        options={options.conservationStates}
        onChange={(conservationStateId) => onChange({ conservationStateId })}
      />
      <OptionSelect label="Ubicación (con lo que contiene)" value={filters.locationId} options={options.locations} onChange={(locationId) => onChange({ locationId })} />
      <Select
        label="Régimen de tenencia"
        value={filters.tenureRegime ?? ""}
        onChange={(event) => onChange({ tenureRegime: (event.target.value || null) as TenureRegimeLabel | null })}
      >
        <option value="">Todos</option>
        {TENURE_REGIMES.map((regime) => (
          <option key={regime} value={regime}>
            {regime}
          </option>
        ))}
      </Select>
      <Select
        label="Código I"
        value={filters.hasInventoryCode === null ? "" : String(filters.hasInventoryCode)}
        onChange={(event) => onChange({ hasInventoryCode: toBoolean(event.target.value) })}
      >
        <option value="">Con o sin código I</option>
        <option value="true">Con código I</option>
        <option value="false">Sin código I</option>
      </Select>
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Época desde (año)"
          type="number"
          value={filters.epochStartYear ?? ""}
          onChange={(event) => onChange({ epochStartYear: toYear(event.target.value) })}
        />
        <Input
          label="Época hasta (año)"
          type="number"
          value={filters.epochEndYear ?? ""}
          onChange={(event) => onChange({ epochEndYear: toYear(event.target.value) })}
        />
      </div>
      <Select
        label="Completitud de la ficha"
        value={filters.hasAlerts === null ? "" : String(filters.hasAlerts)}
        onChange={(event) => onChange({ hasAlerts: toBoolean(event.target.value) })}
      >
        <option value="">Todas las piezas</option>
        <option value="true">Solo piezas incompletas</option>
        <option value="false">Solo piezas completas</option>
      </Select>
      <Button variant="secondary" icon={Eraser} onClick={onClear}>
        Limpiar filtros
      </Button>
    </Card>
  );
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

export function SearchResults({
  page,
  onPage,
  onSuggestion,
}: {
  page: SearchPage;
  onPage?: (page: number) => void;
  onSuggestion?: (suggestion: string) => void;
}) {
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
          {(page.suggestions ?? []).length > 0 && (
            <ul className="flex flex-col gap-1 text-left text-sm text-tinta">
              {(page.suggestions ?? []).map((suggestion) => (
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
        <div className="grid gap-3 sm:grid-cols-2">
          {page.items.map((hit) => (
            <PieceCard key={hit.piece.id} {...pieceCardProps(hit.piece)} thumbnailUrl={hit.thumbnail_url} matchReason={matchReasonText(hit)} />
          ))}
        </div>
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

  useEffect(() => {
    let active = true;
    Promise.all([fetchPieceCatalogs(), fetchLocations({}, devUser)]).then(([catalogs, locations]) => {
      if (!active) return;
      setOptions({
        collections: catalogs.status === "ok" ? catalogs.catalogs.collections : [],
        categories: catalogs.status === "ok" ? catalogs.catalogs.categories : [],
        materials: catalogs.status === "ok" ? catalogs.catalogs.materials : [],
        conservationStates: catalogs.status === "ok" ? catalogs.catalogs.conservationStates : [],
        locations: locations.status === "ok" ? locations.value.map((location) => ({ id: location.id, label: `${location.name} (${location.level})` })) : [],
      });
    });
    return () => {
      active = false;
    };
  }, [devUser]);

  // El texto espera a que el usuario deje de escribir; los demás filtros se aplican al instante.
  useEffect(() => {
    const delay = filters.q === query.q ? 0 : TYPING_DEBOUNCE_MS;
    const timer = setTimeout(() => {
      setQuery(filters);
      setPage(1);
    }, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `query.q` solo decide la espera
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
  }, [query, page, devUser]);

  const names = useMemo(() => optionNames(options), [options]);
  const chips = activeChips(query, names);
  const update = (next: Partial<SearchFilters>) => setFilters((current) => ({ ...current, ...next }));
  const remove = (key: FilterChip["key"]) => setFilters((current) => removeFilter(current, key));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-tinta">Búsqueda</h1>
        <p className="text-base text-gris-texto">
          Busque por cualquier código —vigente o histórico, con o sin formato (&quot;I 236&quot;, &quot;M.M.Z. 015&quot;, &quot;mmz 15&quot;)— o por
          denominación, autor, procedencia, material o época, sin preocuparse por mayúsculas ni tildes.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <SearchFiltersPanel filters={filters} options={options} onChange={update} onClear={() => setFilters(EMPTY_FILTERS)} />

        <section className="flex flex-col gap-4" aria-label="Resultados">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-base text-gris-texto" aria-live="polite">
              <strong className="text-tinta">{result?.total ?? 0}</strong> resultado{result?.total === 1 ? "" : "s"}
            </p>
            <Link href="/piezas/nueva" className={buttonClassName({})}>
              <Plus size={18} aria-hidden="true" />
              Nueva pieza
            </Link>
          </div>
          <ActiveFilterChips chips={chips} onRemove={remove} />
          {error && (
            <p role="alert" className="rounded-md bg-carmin-bg px-3 py-2 text-base text-carmin-texto">
              {error}
            </p>
          )}
          {result && (
            <SearchResults
              page={result}
              onPage={setPage}
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
