/**
 * Paginador de las listas de Administración (papelera y consulta global de auditoría; tarea 5.2
 * de `auditoria-y-soft-delete-transversal`). Es presentacional: la página actual la lleva quien
 * lo monta. Botones de al menos 44 px y texto «Página 2 de 5» (RNF-010); con una sola página no
 * se muestra nada.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/Button";

/** Cuántas páginas hay; siempre al menos una, aunque no haya resultados. */
export function pageCount(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

/** «Mostrando del 21 al 40 de 54 registros»; vacío si no hay nada que mostrar. */
export function pageRangeSentence(page: number, pageSize: number, total: number, noun: string): string {
  if (total <= 0) return "";
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  return `Mostrando del ${first} al ${last} de ${total} ${noun}`;
}

export interface AuditLogPagerProps {
  page: number;
  pageSize: number;
  total: number;
  /** Nombre de lo que se lista, en plural: «registros», «conjuntos de cambios». */
  noun: string;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function AuditLogPager({ page, pageSize, total, noun, onPageChange, disabled = false }: AuditLogPagerProps) {
  const pages = pageCount(total, pageSize);
  if (pages <= 1) return null;
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-gris-texto">{pageRangeSentence(page, pageSize, total, noun)}</p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" icon={ChevronLeft} disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
          Anterior
        </Button>
        <span className="text-base text-tinta">
          Página {page} de {pages}
        </span>
        <Button variant="secondary" disabled={disabled || page >= pages} onClick={() => onPageChange(page + 1)}>
          Siguiente
          <ChevronRight size={18} aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
