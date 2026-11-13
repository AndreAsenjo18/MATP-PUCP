/**
 * Piezas del Inicio como guía de tareas (changes `inicio-guia-de-tareas` y
 * `piloto-identidad-visual-inicio`): las tarjetas de tarea, con las dos principales destacadas, y
 * las fichas del estado del catálogo. Solo presentación; la pantalla hace las consultas.
 */
import { ArrowRight, ClipboardCheck, FileSpreadsheet, FileText, Hash, ImageOff, Package, PackagePlus, Search, Settings, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { IconCircle, type Tone } from "@/components/ui/IconCircle";
import { StatChip } from "@/components/ui/StatChip";
import { surfaceClassName } from "@/components/ui/Surface";
import { pendingLabel, statusParts, type CatalogStatus, type StatusPart, type Task, type TaskId } from "@/lib/help/tasks";

/** Icono y color de cada tipo de tarea. El color acompaña al icono y al nombre, nunca los reemplaza. */
const LOOK: Record<TaskId, { icon: LucideIcon; tone: Tone }> = {
  search: { icon: Search, tone: "terracota" },
  register: { icon: PackagePlus, tone: "verde" },
  load: { icon: FileSpreadsheet, tone: "anil" },
  review: { icon: ClipboardCheck, tone: "ambar" },
  report: { icon: FileText, tone: "ciruela" },
  settings: { icon: Settings, tone: "piedra" },
};

/** Lo que más se hace en el museo: va primero y más grande. */
const MAIN_TASKS: ReadonlySet<TaskId> = new Set(["search", "register"]);

function MainTaskCard({ task }: { task: Task }) {
  const { icon, tone } = LOOK[task.id];
  return (
    <Link href={task.href} className={surfaceClassName({ interactive: true, className: "group flex min-h-11 w-full items-center gap-5 p-tarjeta" })}>
      <IconCircle icon={icon} tone={tone} size="lg" solid />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-display text-2xl font-semibold text-tinta">{task.verb}</span>
        <span className="text-base text-gris-texto">{task.description}</span>
      </span>
      <ArrowRight
        size={24}
        aria-hidden="true"
        className="shrink-0 text-terracota transition-[translate] duration-150 ease-out group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
      />
    </Link>
  );
}

function TaskCard({ task, badge }: { task: Task; badge: string | null }) {
  const { icon, tone } = LOOK[task.id];
  return (
    <Link href={task.href} className={surfaceClassName({ interactive: true, className: "flex min-h-11 w-full flex-col gap-2 p-4" })}>
      <span className="flex items-center justify-between gap-2">
        <IconCircle icon={icon} tone={tone} />
        {badge && <span className="rounded-full bg-ambar-bg px-3 py-1 text-base font-semibold text-ambar-texto tabular-nums">{badge}</span>}
      </span>
      <span className="text-lg font-semibold text-tinta">{task.verb}</span>
      <span className="text-base text-gris-texto">{task.description}</span>
    </Link>
  );
}

/** Dos tarjetas grandes para lo principal y el resto más pequeñas. Una columna en pantallas estrechas. */
export function TaskCards({ tasks, pending }: { tasks: readonly Task[]; pending?: number | null }) {
  if (tasks.length === 0) {
    return (
      <p role="status" className="rounded-tarjeta bg-ambar-bg p-4 text-base text-ambar-texto">
        Su rol no tiene tareas disponibles. Pida acceso a quien administra el sistema.
      </p>
    );
  }
  const main = tasks.filter((task) => MAIN_TASKS.has(task.id));
  const others = tasks.filter((task) => !MAIN_TASKS.has(task.id));
  return (
    <div className="flex flex-col gap-tarjetas">
      {main.length > 0 && (
        <ul aria-label="Lo más frecuente" className="grid grid-cols-1 gap-tarjetas lg:grid-cols-2">
          {main.map((task) => (
            <li key={task.id} className="flex">
              <MainTaskCard task={task} />
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <ul aria-label="Otras tareas" className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-tarjetas">
          {others.map((task) => (
            <li key={task.id} className="flex">
              <TaskCard task={task} badge={task.id === "review" ? pendingLabel(pending) : null} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STATUS_LOOK: Record<StatusPart["kind"], { icon: LucideIcon; tone: Tone; href?: string }> = {
  all: { icon: Package, tone: "terracota" },
  inventory: { icon: Hash, tone: "ambar", href: "/busqueda?hasInventoryCode=false" },
  photo: { icon: ImageOff, tone: "ambar", href: "/busqueda?incompleteOnly=1" },
};

/** Fichas con el estado del catálogo; las de faltantes llevan a esas piezas. Si la consulta falla, un aviso breve. */
export function CatalogStatusChips({ status, failed }: { status: CatalogStatus | null; failed: boolean }) {
  if (failed) {
    return (
      <p role="status" className="text-base text-gris-texto">
        No pudimos leer el estado del catálogo. Las tareas de arriba funcionan igual.
      </p>
    );
  }
  if (!status) {
    return (
      <p role="status" className="flex min-h-12 items-center text-base text-gris-texto">
        Leyendo el estado del catálogo…
      </p>
    );
  }
  return (
    <ul className="flex flex-wrap items-center gap-3">
      {statusParts(status).map((part) => (
        <li key={part.kind}>
          <StatChip value={part.value} label={part.label} {...STATUS_LOOK[part.kind]} />
        </li>
      ))}
    </ul>
  );
}
