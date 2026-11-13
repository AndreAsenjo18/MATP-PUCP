/**
 * Descarga de la consulta de auditoría en CSV (tarea 5.2 de `auditoria-y-soft-delete-transversal`;
 * RF-040, RF-041). La pantalla solo ofrece el enlace con los filtros que están aplicados: el
 * archivo lo genera y envía el servidor en streaming (cabeceras en inglés y BOM UTF-8 para que
 * Excel muestre bien las tildes) y los valores de campos sensibles que el rol no puede ver salen
 * ocultos, igual que en pantalla.
 *
 * Sin servidor (modo demostración) los botones se ven desactivados y se explica por qué: el
 * navegador no arma el archivo por su cuenta.
 */
import { Download } from "lucide-react";

import { Button, buttonClassName } from "@/components/ui/Button";
import { auditCsvUrl, type AuditCsvView, type AuditQueryFilters } from "@/lib/data/audit-query";

export const CSV_VIEWS: ReadonlyArray<{ view: AuditCsvView; label: string }> = [
  { view: "change_sets", label: "Un cambio por fila" },
  { view: "entries", label: "Un campo por fila" },
];

export const CSV_INTRO =
  "Con los filtros que está viendo; lo que su rol no puede ver sale oculto. Los encabezados están en inglés.";
export const CSV_DEMO_NOTICE = "En el modo demostración no se puede descargar.";

export interface AuditLogExportProps {
  /** Filtros aplicados (no el borrador del formulario). */
  filters: AuditQueryFilters;
  /** Hay servidor que genere el archivo (modo `live`). */
  available: boolean;
}

export function AuditLogExport({ filters, available }: AuditLogExportProps) {
  return (
    // Plegado por defecto: casi nunca se usa y ocupaba un bloque entero (change `administracion-control`, D3).
    <details aria-label="Descargar en CSV" className="group flex flex-col gap-2">
      <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-md text-base font-medium text-terracota focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota">
        <Download size={18} aria-hidden="true" />
        Descargar en CSV
      </summary>
      <p className="mt-2 text-sm text-gris-texto">{CSV_INTRO}</p>
      <div className="mt-2 flex flex-wrap gap-3">
        {CSV_VIEWS.map(({ view, label }) =>
          available ? (
            <a key={view} href={auditCsvUrl(filters, view)} download className={buttonClassName({ variant: "outline" })}>
              <Download size={18} aria-hidden="true" />
              {label}
            </a>
          ) : (
            <Button key={view} variant="outline" icon={Download} disabled>
              {label}
            </Button>
          ),
        )}
      </div>
      {!available && <p className="text-sm text-ambar-texto">{CSV_DEMO_NOTICE}</p>}
    </details>
  );
}
