"use client";

/**
 * Vista previa de un reporte (change `reportes-por-atributo`, tarea 3.2; RF-033, RF-036, RF-041,
 * RNF-010): encabezado, totales arriba, tabla paginada con encabezado fijo, grupos plegables con su
 * subtotal, descripción recortada y aviso de lo limitado por permisos. Pinta el mismo reporte que
 * genera el archivo (design D3): no calcula filas, subtotales ni totales por su cuenta.
 */
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import {
  DESCRIPTION_COLUMN,
  cellText,
  filtersText,
  groupRows,
  isLongDescription,
  maskedNotice,
  totalsText,
  type Report,
  type ReportSubtotal,
} from "@/lib/data/reports";

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota";
/** Con más subtotales que estos, la lista empieza plegada para no alejar la paginación. */
const SUBTOTALS_OPEN_LIMIT = 12;

export function DescriptionCell({ text, initialExpanded = false }: { text: string; initialExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(initialExpanded);
  if (!isLongDescription(text)) return <div className="w-80 whitespace-pre-wrap">{text}</div>;
  return (
    <div className="flex w-80 flex-col items-start">
      <div className={expanded ? "whitespace-pre-wrap" : "line-clamp-2"}>{text}</div>
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className={`min-h-11 text-sm text-terracota underline ${FOCUS_RING}`}>
        {expanded ? "ver menos" : "ver más"}
      </button>
    </div>
  );
}

function ReportRow({ columns, row }: { columns: string[]; row: unknown[] }) {
  return (
    <tr className="border-t border-borde">
      {row.map((cell, index) => (
        <td key={index} className="px-2 py-1 align-top">
          {columns[index] === DESCRIPTION_COLUMN ? <DescriptionCell text={cellText(cell, DESCRIPTION_COLUMN)} /> : cellText(cell)}
        </td>
      ))}
    </tr>
  );
}

function ReportTable({ report, initialCollapsed }: { report: Report; initialCollapsed: readonly string[] }) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set(initialCollapsed));

  function toggle(label: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(label)) next.add(label);
      return next;
    });
  }

  return (
    <div className="max-h-[70vh] overflow-auto rounded-md border border-borde">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-white text-gris-texto shadow-[inset_0_-1px_0_var(--color-borde)]">
          <tr>
            {report.columns.map((column) => (
              <th key={column} scope="col" className="px-2 py-2 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        {groupRows(report).map((group, index) => {
          const { label, count } = group;
          const folded = label !== null && collapsed.has(label);
          const Icon = folded ? ChevronRight : ChevronDown;
          return (
            <tbody key={`${label}-${index}`} className="text-tinta">
              {label !== null && (
                <tr className="border-t border-borde bg-crema">
                  <th colSpan={report.columns.length} scope="colgroup" className="p-0 font-semibold">
                    <button type="button" aria-expanded={!folded} onClick={() => toggle(label)} className={`sticky left-0 flex min-h-11 items-center gap-2 px-2 text-left ${FOCUS_RING}`}>
                      <Icon size={18} aria-hidden="true" />
                      {group.heading}: {label}
                      {count !== null && ` — ${count} ${count === 1 ? "pieza" : "piezas"}`}
                    </button>
                  </th>
                </tr>
              )}
              {!folded && group.rows.map((row, rowIndex) => <ReportRow key={rowIndex} columns={report.columns} row={row} />)}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

function SubtotalList({ subtotals }: { subtotals: ReportSubtotal[] }) {
  return (
    <ul className="grid gap-1 text-sm text-tinta sm:grid-cols-2">
      {subtotals.map((subtotal) => (
        <li key={`${subtotal.group}-${subtotal.label}`} style={{ paddingLeft: `${(subtotal.level ?? 0) * 16}px` }}>
          <span className="text-gris-texto">{subtotal.group}:</span> {subtotal.label} — {subtotal.count}
        </li>
      ))}
    </ul>
  );
}

/** Subtotales y totales del reporte completo (no solo de la página). */
export function ReportSummary({ report }: { report: Pick<Report, "subtotals" | "totals"> }) {
  const subtotals = report.subtotals ?? [];
  return (
    <div className="flex flex-col gap-2 border-t border-borde pt-3">
      {subtotals.length > 0 && <SubtotalList subtotals={subtotals} />}
      <p className="text-base font-semibold text-tinta">{totalsText(report)}</p>
    </div>
  );
}

export function ReportPreview({
  report,
  onPage,
  initialCollapsed = [],
}: {
  report: Report;
  onPage?: (page: number) => void;
  /** Grupos plegados desde el inicio. */
  initialCollapsed?: readonly string[];
}) {
  const pages = Math.max(1, Math.ceil(report.total_rows / Math.max(1, report.page_size)));
  const masked = report.masked_columns ?? [];
  const subtotals = report.subtotals ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold text-tinta">{report.title}</h2>
        <p className="text-sm text-gris-texto">
          Generado el {new Date(report.generated_at).toLocaleString("es-PE")}
          {report.generated_by ? ` por ${report.generated_by}` : ""}.
        </p>
        <p className="text-sm text-gris-texto">Filtros: {filtersText(report)}</p>
      </div>
      <p className="text-base font-semibold text-tinta">{totalsText(report)}</p>
      {masked.length > 0 && <p className="rounded-md bg-crema px-3 py-2 text-sm text-tinta">{maskedNotice(masked)}</p>}
      {report.message && <p className="rounded-md bg-crema-light px-3 py-2 text-base text-tinta">{report.message}</p>}
      {report.rows.length > 0 && <ReportTable report={report} initialCollapsed={initialCollapsed} />}
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
      {subtotals.length > 0 && (
        <details open={subtotals.length <= SUBTOTALS_OPEN_LIMIT} className="flex flex-col gap-2 border-t border-borde pt-1">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-tinta">Subtotales ({subtotals.length})</summary>
          <SubtotalList subtotals={subtotals} />
        </details>
      )}
    </div>
  );
}
