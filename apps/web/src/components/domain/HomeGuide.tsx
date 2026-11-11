/**
 * Piezas del Inicio como guía de tareas (change `inicio-guia-de-tareas`): las tarjetas de tarea y
 * la línea de estado del catálogo. Solo presentación; la pantalla hace las consultas.
 */
import { ClipboardCheck, FileSpreadsheet, FileText, PackagePlus, Search, Settings, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { cardClassName } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { pendingLabel, statusParts, type CatalogStatus, type Task, type TaskId } from "@/lib/help/tasks";

const ICONS: Record<TaskId, LucideIcon> = {
  search: Search,
  register: PackagePlus,
  load: FileSpreadsheet,
  review: ClipboardCheck,
  report: FileText,
  settings: Settings,
};

/** Tarjetas grandes: un verbo, una línea de explicación y un único enlace. Una columna en pantallas estrechas. */
export function TaskCards({ tasks, pending }: { tasks: readonly Task[]; pending?: number | null }) {
  if (tasks.length === 0) {
    return (
      <p role="status" className="rounded-md bg-ambar-bg p-4 text-base text-ambar-texto">
        Su rol no tiene tareas disponibles. Pida acceso a quien administra el sistema.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tasks.map((task) => {
        const Icon = ICONS[task.id];
        const badge = task.id === "review" ? pendingLabel(pending) : null;
        return (
          <li key={task.id} className="flex">
            <Link
              href={task.href}
              className={cardClassName({
                interactive: true,
                className: "flex min-h-11 w-full flex-col gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota",
              })}
            >
              <span className="flex items-center justify-between gap-2">
                <Icon size={28} aria-hidden="true" className="text-terracota" />
                {badge && <span className="rounded-full bg-ambar-bg px-3 py-1 text-base font-semibold text-ambar-texto">{badge}</span>}
              </span>
              <span className="text-lg font-semibold text-tinta">{task.verb}</span>
              <span className="text-base text-gris-texto">{task.description}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const STATUS_HREF = {
  all: "/busqueda",
  inventory: "/busqueda?hasInventoryCode=false",
  photo: "/busqueda?incompleteOnly=1",
} as const;

/** Una sola línea: «318 piezas · 117 sin código I · 138 sin foto». Si la consulta falla, un aviso breve. */
export function CatalogStatusLine({ status, failed }: { status: CatalogStatus | null; failed: boolean }) {
  if (failed) {
    return (
      <p role="status" className="text-base text-gris-texto">
        No pudimos leer el estado del catálogo. Las tareas de arriba funcionan igual.
      </p>
    );
  }
  if (!status) {
    return (
      <p role="status" className="text-base text-gris-texto">
        Leyendo el estado del catálogo…
      </p>
    );
  }
  const parts = statusParts(status);
  return (
    <p aria-label="Estado del catálogo" className="flex flex-wrap items-center gap-x-2 text-base text-tinta">
      {parts.map((part, index) => (
        <span key={part.kind} className="flex items-center gap-x-2">
          {index > 0 && <span aria-hidden="true">·</span>}
          <Link href={STATUS_HREF[part.kind]} className={cn("inline-flex min-h-11 items-center underline hover:text-terracota", part.kind !== "all" && "font-medium")}>
            {part.text}
          </Link>
        </span>
      ))}
    </p>
  );
}
