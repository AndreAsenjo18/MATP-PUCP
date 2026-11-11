"use client";

/**
 * Reportes de inventario en modo `live` (change `reportes-inventario`, tareas 3.1 y 3.2; RF-033,
 * RF-034, RF-041): tipo de reporte, parámetros (colección, ubicación, comodatos, días sin
 * verificar, atributo y filtros de la búsqueda), vista previa paginada con subtotales y totales,
 * exportación a Excel (directa o en segundo plano, con aviso al terminar) y vista imprimible.
 */
import { FileSpreadsheet, Printer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { DisclosureSummary, withActiveCount } from "@/components/domain/DisclosureSummary";
import { ReportPreview } from "@/components/domain/ReportPreview";
import { EMPTY_OPTIONS, SearchFiltersPanel, loadSearchOptions, type SearchOptions } from "@/components/domain/SearchFilters";
import { MyExportsPanel } from "@/components/domain/SearchLive";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { fetchCollections, type CollectionOption } from "@/lib/data/normalization-admin";
import { fetchLocations } from "@/lib/data/locations";
import {
  GROUP_BY_OPTIONS,
  downloadReport,
  fetchReport,
  missingParameter,
  printHref,
  type ExportJob,
  type GroupBy,
  type LiveReportType,
  type Report,
  type ReportParams,
} from "@/lib/data/reports";
import { EMPTY_FILTERS, TEXT_FILTER_KEYS, TYPING_DEBOUNCE_MS, activeChips, fetchExportJob, hasPendingJobs, type SearchFilters } from "@/lib/data/search";

/**
 * Etiquetas, ayudas y controles de `Field` (components/ui, de la Base) y el árbol de ubicaciones
 * (`LocationTreeSelect`, de P3) a 16 px y 44 px solo en Reportes, sin tocar esos componentes
 * (change `reportes-vista-simplificada`, design D6).
 */
export const READABLE =
  "[&_label]:text-base [&_p]:text-base [&_legend]:text-base [&_fieldset_button]:text-base [&_fieldset_button]:min-h-11 [&_fieldset_span.rounded-full]:text-base [&_select]:min-h-11 [&_input:not([type=checkbox])]:min-h-11";

/** Filas por página de la vista previa (design D4). */
const PAGE_SIZE = 50;
/** Cada cuánto se consulta el reporte que se genera en segundo plano. */
const JOB_POLL_MS = 3000;

// ---------------------------------------------------------------------------------------------
// Configuración de «Piezas agrupadas por…» (reportes-por-atributo, tarea 3.1)
// ---------------------------------------------------------------------------------------------

export function GroupBySelect({ value, onChange }: { value: GroupBy | null | undefined; onChange: (value: GroupBy | null) => void }) {
  return (
    <Select label="Agrupar por" value={value ?? ""} onChange={(event) => onChange((event.target.value || null) as GroupBy | null)}>
      <option value="">Elija un atributo</option>
      {GROUP_BY_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

/** Descargar e imprimir; un reporte sin piezas no ofrece ninguna de las dos. */
export function ReportActions({
  type,
  params,
  report,
  canExport,
  busy,
  onExport,
}: {
  type: LiveReportType;
  params: ReportParams;
  report: Pick<Report, "total_rows">;
  canExport: boolean;
  busy: boolean;
  onExport: () => void;
}) {
  if (report.total_rows === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {canExport && (
        <Button variant="outline" icon={FileSpreadsheet} disabled={busy} onClick={onExport}>
          Exportar a Excel
        </Button>
      )}
      <Link href={printHref(type, params)} target="_blank" className={buttonClassName({ variant: "outline" })}>
        <Printer size={18} aria-hidden="true" />
        Vista imprimible
      </Link>
    </div>
  );
}

/** Los filtros de la búsqueda, plegados para que la tabla quede a la vista (design D4). */
export function ReportFilters({
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
  const active = activeChips(filters).length;
  return (
    <details className="group flex flex-col gap-3">
      <DisclosureSummary>{withActiveCount("Filtros", active)}</DisclosureSummary>
      <div className="max-w-xl">
        <SearchFiltersPanel filters={filters} options={options} onChange={onChange} onClear={onClear} />
      </div>
    </details>
  );
}

/** Cómo va el reporte que se genera en segundo plano (escenario «Reporte muy grande»). */
export function ReportJobNotice({ job }: { job: Pick<ExportJob, "status"> }) {
  if (job.status === "FAILED") {
    return (
      <p role="alert" className="rounded-md bg-carmin-bg px-3 py-2 text-base text-carmin-texto">
        No se pudo generar el reporte. Intente de nuevo.
      </p>
    );
  }
  if (job.status === "READY") {
    return (
      <p role="status" className="rounded-md bg-verde-bg px-3 py-2 text-base text-verde-exito">
        Su reporte ya está listo: descárguelo en «Mis exportaciones», aquí abajo.
      </p>
    );
  }
  return (
    <p role="status" className="rounded-md bg-crema px-3 py-2 text-base text-tinta">
      El reporte es grande: se está generando en segundo plano. Le avisaremos aquí cuando esté listo. También lo encontrará en «Mis exportaciones».
    </p>
  );
}

// ---------------------------------------------------------------------------------------------
// Contenedor live
// ---------------------------------------------------------------------------------------------

export function ReportsLive({ type }: { type: LiveReportType }) {
  const { currentUser, hasPermission } = useSession();
  const devUser = currentUser?.email;
  const [params, setParams] = useState<ReportParams>({ includeLoansForUse: true, filters: EMPTY_FILTERS });
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [options, setOptions] = useState<SearchOptions>(EMPTY_OPTIONS);
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [job, setJob] = useState<ExportJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [locations, setLocations] = useState<{ id: string; label: string }[]>([]);
  const missing = missingParameter(type, params);

  useEffect(() => {
    let active = true;
    if (type === "by-collection") {
      fetchCollections(devUser).then((result) => {
        if (active && result.status === "ok") setCollections(result.value);
      });
    }
    if (type === "by-location") {
      fetchLocations({}, devUser).then((result) => {
        if (active && result.status === "ok") setLocations(result.value.map((l) => ({ id: l.id, label: `${l.name} (${l.level})` })));
      });
    }
    if (type === "by-attribute") {
      loadSearchOptions(devUser).then((loaded) => {
        if (active) setOptions(loaded);
      });
    }
    return () => {
      active = false;
    };
  }, [type, devUser]);

  // Los textos esperan a que el usuario deje de escribir; los demás filtros se aplican al instante.
  useEffect(() => {
    if (filters === params.filters) return;
    const typing = TEXT_FILTER_KEYS.some((key) => filters[key] !== params.filters?.[key]);
    const timer = setTimeout(() => update({ filters }), typing ? TYPING_DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- los filtros aplicados solo deciden la espera
  }, [filters]);

  useEffect(() => {
    let active = true;
    if (missing) return;
    fetchReport(type, params, page, PAGE_SIZE, devUser).then((result) => {
      if (!active) return;
      if (result.status === "ok") {
        setReport(result.value);
        setError(null);
      } else {
        setReport(null);
        setError(result.message);
      }
    });
    return () => {
      active = false;
    };
  }, [type, params, page, devUser, missing]);

  // Sigue el reporte en segundo plano hasta que termina, para avisar en esta pantalla.
  useEffect(() => {
    if (!job?.id || !hasPendingJobs([job])) return;
    const jobId = job.id;
    const timer = setTimeout(() => {
      fetchExportJob(jobId, devUser).then((result) => {
        setJob((current) => (result.status === "ok" ? result.value : current && { ...current }));
      });
    }, JOB_POLL_MS);
    return () => clearTimeout(timer);
  }, [job, devUser]);

  function update(next: Partial<ReportParams>) {
    setParams((current) => ({ ...current, ...next }));
    setPage(1);
  }

  async function handleExport() {
    setBusy(true);
    const result = await downloadReport(type, params, devUser);
    setBusy(false);
    if (result.status !== "ok") return setError(result.message);
    if (result.value.kind === "job") {
      setNotice(null);
      setJob(result.value.job);
      return;
    }
    const url = URL.createObjectURL(result.value.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.value.fileName;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Excel descargado: incluye la cabecera con fecha, usuario y filtros, y una hoja de subtotales.");
  }

  return (
    <>
      <Card as="section" className={cn("flex min-w-0 flex-col gap-4", READABLE)}>
        <div className="flex flex-wrap items-end gap-3">
          {type === "by-attribute" && <GroupBySelect value={params.groupBy} onChange={(groupBy) => update({ groupBy })} />}
          {type === "by-collection" && (
            <Select label="Colección" value={params.collectionId ?? ""} onChange={(event) => update({ collectionId: event.target.value || null })}>
              <option value="">Elija una colección</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </Select>
          )}
          {type === "by-location" && (
            <>
              <Select label="Ubicación" value={params.locationId ?? ""} onChange={(event) => update({ locationId: event.target.value || null })}>
                <option value="">Elija una ubicación</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.label}
                  </option>
                ))}
              </Select>
              <Input
                label="No verificadas en los últimos (días)"
                type="number"
                min={0}
                value={params.notVerifiedSinceDays ?? ""}
                onChange={(event) => update({ notVerifiedSinceDays: event.target.value === "" ? null : Number(event.target.value) })}
              />
            </>
          )}
          {type !== "by-location" && (
            <label className="flex min-h-11 items-center gap-2 text-base text-tinta">
              <input type="checkbox" className="size-5 accent-terracota" checked={params.includeLoansForUse !== false} onChange={(event) => update({ includeLoansForUse: event.target.checked })} />
              Incluir comodatos
            </label>
          )}
        </div>
        {type === "by-attribute" && (
          <ReportFilters
            filters={filters}
            options={options}
            onChange={(next) => setFilters((current) => ({ ...current, ...next }))}
            onClear={() => setFilters(EMPTY_FILTERS)}
          />
        )}
        {missing && <p className="text-base text-gris-texto">{missing}</p>}
        {error && (
          <p role="alert" className="rounded-md bg-carmin-bg px-3 py-2 text-base text-carmin-texto">
            {error}
          </p>
        )}
        {job && <ReportJobNotice job={job} />}
        {report && !missing && (
          <>
            <ReportActions type={type} params={params} report={report} canExport={hasPermission("exports.run")} busy={busy} onExport={handleExport} />
            {notice && <p className="rounded-md bg-verde-bg px-3 py-2 text-base text-verde-exito">{notice}</p>}
            <ReportPreview report={report} onPage={setPage} />
          </>
        )}
      </Card>
      {job && <MyExportsPanel refreshKey={hasPendingJobs([job]) ? 0 : 1} />}
    </>
  );
}
