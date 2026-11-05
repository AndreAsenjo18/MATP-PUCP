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
  { view: "change_sets", label: "Descargar conjuntos de cambios (CSV)" },
  { view: "entries", label: "Descargar campo por campo (CSV)" },
];

export const CSV_INTRO =
  "El archivo lleva los mismos filtros que está viendo. Los valores que su rol no puede ver salen ocultos, igual que en pantalla. Las columnas están en inglés; Excel lo abre con las tildes correctas.";
export const CSV_DEMO_NOTICE = "Modo demostración: la descarga la genera el servidor y aquí no hay servidor, así que no está disponible.";

export interface AuditLogExportProps {
  /** Filtros aplicados (no el borrador del formulario). */
  filters: AuditQueryFilters;
  /** Hay servidor que genere el archivo (modo `live`). */
  available: boolean;
}

export function AuditLogExport({ filters, available }: AuditLogExportProps) {
  return (
    <section aria-label="Exportar a CSV" className="flex flex-col gap-2">
      <p className="text-sm text-gris-texto">{CSV_INTRO}</p>
      <div className="flex flex-wrap gap-3">
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
    </section>
  );
}
