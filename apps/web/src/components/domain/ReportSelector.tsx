"use client";

/**
 * Selector de reportes con tarjetas (change `reportes-por-atributo`, tarea 3.1; RF-033, RF-047,
 * RNF-010): el título y una línea de lo que trae cada reporte, en vez de solo su nombre.
 */
import { cardClassName } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { REPORT_TYPES, type ReportKey } from "@/lib/data/reports";

export function ReportSelector({ selected, onSelect }: { selected: ReportKey; onSelect: (type: ReportKey) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="group" aria-label="Tipo de reporte">
      {REPORT_TYPES.map((report) => (
        <button
          key={report.type}
          type="button"
          aria-pressed={selected === report.type}
          onClick={() => onSelect(report.type)}
          className={cardClassName({
            interactive: true,
            className: cn(
              "flex min-h-11 flex-col gap-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota",
              selected === report.type && "ring-2 ring-terracota",
            ),
          })}
        >
          <span className="text-base font-semibold text-tinta">{report.label}</span>
          <span className="text-sm text-gris-texto">{report.summary}</span>
        </button>
      ))}
    </div>
  );
}
