"use client";

/**
 * Reportes de inventario en modo `live` (change `reportes-inventario`, tareas 3.1 y 3.2; RF-033,
 * RF-034, RF-041): tipo de reporte, parámetros (colección, ubicación, comodatos, días sin
 * verificar), vista previa paginada con subtotales y totales, exportación a Excel (directa o en
 * segundo plano) y vista imprimible.
 */
import { FileSpreadsheet, Printer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSession } from "@/lib/auth/session";
import { fetchCollections, type CollectionOption } from "@/lib/data/normalization-admin";
import { fetchLocations } from "@/lib/data/locations";
import {
  PRINT_LIMIT,
  downloadReport,
  fetchReport,
  groupByCollection,
  missingParameter,
  printHref,
  type LiveReportType,
  type Report,
  type ReportParams,
} from "@/lib/data/reports";

const PAGE_SIZE = 25;

function cellText(value: unknown): string {
  return value == null || value === "" ? "—" : String(value);
}

export function ReportTable({ columns, rows }: { columns: string[]; rows: unknown[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-gris-texto">
          <tr>
            {columns.map((column) => (
              <th key={column} className="py-2 pr-3 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-tinta">
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-borde">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="py-1 pr-3">
                  {cellText(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Subtotales y totales del reporte completo (no solo de la página). */
export function ReportSummary({ report }: { report: Pick<Report, "subtotals" | "totals"> }) {
  const subtotals = report.subtotals ?? [];
  return (
    <div className="flex flex-col gap-2 border-t border-borde pt-3">
      {subtotals.length > 0 && (
        <ul className="grid gap-1 text-sm text-tinta sm:grid-cols-2">
          {subtotals.map((subtotal) => (
            <li key={`${subtotal.group}-${subtotal.label}`} style={{ paddingLeft: `${(subtotal.level ?? 0) * 16}px` }}>
              <span className="text-gris-texto">{subtotal.group}:</span> {subtotal.label} — {subtotal.count}
            </li>
          ))}
        </ul>
      )}
      <p className="text-base font-semibold text-tinta">
        {Object.entries(report.totals)
          .map(([label, value]) => `${label}: ${value}`)
          .join(" · ")}
      </p>
    </div>
  );
}

export function ReportPreview({ report, onPage }: { report: Report; onPage?: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(report.total_rows / Math.max(1, report.page_size)));
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold text-tinta">{report.title}</h2>
        <p className="text-sm text-gris-texto">
          Generado el {new Date(report.generated_at).toLocaleString("es-PE")}
          {report.generated_by ? ` por ${report.generated_by}` : ""}.
        </p>
      </div>
      {(report.masked_columns ?? []).length > 0 && (
        <p className="rounded-md bg-crema px-3 py-2 text-sm text-tinta">
          Su rol ve limitadas estas columnas: {report.masked_columns?.join(", ")} (solo sede y espacio, RF-041).
        </p>
      )}
      {report.message && <p className="rounded-md bg-crema-light px-3 py-2 text-base text-tinta">{report.message}</p>}
      {report.rows.length > 0 && <ReportTable columns={report.columns} rows={report.rows as unknown[][]} />}
      {report.total_rows > report.page_size && onPage && (
        <div className="flex items-center justify-between gap-3">
          <Button variant="secondary" disabled={report.page <= 1} onClick={() => onPage(report.page - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-gris-texto">
            Página {report.page} de {pages} ({report.total_rows} filas)
          </span>
          <Button variant="secondary" disabled={report.page >= pages} onClick={() => onPage(report.page + 1)}>
            Siguiente
          </Button>
        </div>
      )}
      <ReportSummary report={report} />
    </div>
  );
}

/** Vista imprimible (tarea 3.2): cabecera repetida en cada página y salto por colección. */
export function PrintableReport({ report, tooLarge }: { report: Report; tooLarge: boolean }) {
  const filters = Object.entries(report.filters ?? {});
  const header = (
    <div className="flex flex-col gap-1 border-b border-tinta pb-2">
      <h1 className="text-xl font-bold text-tinta">{report.title}</h1>
      <p className="text-sm text-tinta">
        Generado el {new Date(report.generated_at).toLocaleString("es-PE")}
        {report.generated_by ? ` por ${report.generated_by}` : ""}
      </p>
      <p className="text-sm text-tinta">Filtros: {filters.length ? filters.map(([key, value]) => `${key}: ${String(value)}`).join("; ") : "sin filtros"}</p>
    </div>
  );
  if (tooLarge) {
    return (
      <div className="flex flex-col gap-3">
        {header}
        <p role="alert" className="rounded-md bg-ambar-bg p-3 text-base text-ambar-texto">
          El reporte tiene {report.total_rows.toLocaleString("es-PE")} filas y supera el límite de impresión ({PRINT_LIMIT.toLocaleString("es-PE")}).
          Expórtelo a Excel desde la pantalla de Reportes, o filtre por colección.
        </p>
      </div>
    );
  }
  const groups = groupByCollection(report);
  return (
    <div className="flex flex-col gap-4 print:gap-0">
      {groups.map((group, index) => (
        <section key={`${group.label}-${index}`} className={index > 0 ? "print:break-before-page" : undefined}>
          <table className="w-full text-left text-xs">
            <thead className="table-header-group">
              <tr>
                <th colSpan={report.columns.length} className="pb-2 font-normal">
                  {header}
                  {group.label && <p className="pt-1 text-sm font-semibold text-tinta">Colección: {group.label}</p>}
                </th>
              </tr>
              <tr>
                {report.columns.map((column) => (
                  <th key={column} className="border-b border-borde py-1 pr-2 font-semibold">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-borde">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="py-0.5 pr-2 align-top">
                      {cellText(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <ReportSummary report={report} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Contenedor live
// ---------------------------------------------------------------------------------------------

export function ReportsLive({ type }: { type: LiveReportType }) {
  const { currentUser, hasPermission } = useSession();
  const devUser = currentUser?.email;
  const [params, setParams] = useState<ReportParams>({ includeLoansForUse: true });
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
    return () => {
      active = false;
    };
  }, [type, devUser]);

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
      setNotice("El reporte es grande: se está generando en segundo plano. Lo encontrará en «Mis exportaciones» cuando esté listo.");
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
    <Card as="section" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
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
            <input type="checkbox" checked={params.includeLoansForUse !== false} onChange={(event) => update({ includeLoansForUse: event.target.checked })} />
            Incluir comodatos
          </label>
        )}
      </div>
      {missing && <p className="text-base text-gris-texto">{missing}</p>}
      {error && (
        <p role="alert" className="rounded-md bg-carmin-bg px-3 py-2 text-base text-carmin-texto">
          {error}
        </p>
      )}
      {report && !missing && (
        <>
          <div className="flex flex-wrap gap-2">
            {hasPermission("exports.run") && (
              <Button variant="outline" icon={FileSpreadsheet} disabled={busy} onClick={handleExport}>
                Exportar a Excel
              </Button>
            )}
            <Link href={printHref(type, params)} target="_blank" className={buttonClassName({ variant: "outline" })}>
              <Printer size={18} aria-hidden="true" />
              Vista imprimible
            </Link>
          </div>
          {notice && <p className="rounded-md bg-verde-bg px-3 py-2 text-sm text-verde-exito">{notice}</p>}
          <ReportPreview report={report} onPage={setPage} />
        </>
      )}
    </Card>
  );
}
