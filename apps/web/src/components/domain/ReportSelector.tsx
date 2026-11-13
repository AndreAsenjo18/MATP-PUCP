"use client";

/**
 * Selector de reportes con tarjetas (change `reportes-por-atributo`, tarea 3.1; RF-033, RF-047,
 * RNF-010): el título y una línea de lo que trae cada reporte, en vez de solo su nombre. Maqueta B:
 * cada tipo con su icono en un círculo de color; el elegido, con borde terracota y una marca de visto
 * (además de `aria-pressed`). Tres arriba y dos abajo desde 1024 px.
 */
import { ChartNoAxesColumn, Check, Layers, Library, MapPin, ScanSearch, type LucideIcon } from "lucide-react";

import { cardClassName } from "@/components/ui/Card";
import { IconCircle, type Tone } from "@/components/ui/IconCircle";
import { cn } from "@/lib/cn";
import { REPORT_TYPES, type ReportKey } from "@/lib/data/reports";

const LOOK: Record<ReportKey, { icon: LucideIcon; tone: Tone }> = {
  inventory: { icon: ChartNoAxesColumn, tone: "ambar" },
  "by-collection": { icon: Library, tone: "anil" },
  "by-location": { icon: MapPin, tone: "verde" },
  "by-attribute": { icon: Layers, tone: "ciruela" },
  incomplete: { icon: ScanSearch, tone: "ambar" },
};

export function ReportSelector({ selected, onSelect }: { selected: ReportKey; onSelect: (type: ReportKey) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" role="group" aria-label="Tipo de reporte">
      {REPORT_TYPES.map((report, index) => {
        const chosen = selected === report.type;
        const { icon, tone } = LOOK[report.type] ?? { icon: ChartNoAxesColumn, tone: "piedra" };
        return (
          <button
            key={report.type}
            type="button"
            aria-pressed={chosen}
            onClick={() => onSelect(report.type)}
            className={cardClassName({
              interactive: true,
              className: cn(
                "relative flex min-h-11 items-start gap-4 text-left",
                index < 3 ? "lg:col-span-2" : "lg:col-span-3",
                chosen && "ring-2 ring-terracota",
              ),
            })}
          >
            <IconCircle icon={icon} tone={tone} />
            <span className={cn("flex min-w-0 flex-1 flex-col gap-1", chosen && "pr-8")}>
              <span className="text-lg font-bold text-tinta">{report.label}</span>
              <span className="text-base text-gris-texto">{report.summary}</span>
            </span>
            {chosen && (
              <span aria-hidden="true" className="absolute top-4 right-4 inline-flex size-7 items-center justify-center rounded-full bg-terracota text-white">
                <Check size={16} strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
