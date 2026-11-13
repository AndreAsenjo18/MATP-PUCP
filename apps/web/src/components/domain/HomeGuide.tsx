/**
 * Piezas del Inicio como guía de tareas (changes `inicio-guia-de-tareas` y `remodelacion-visual`,
 * maqueta B): el buscador de la cabecera, la tarjeta verde para registrar, las demás tareas en
 * tarjetas blancas y las píldoras del estado del catálogo. Solo presentación; la pantalla hace las
 * consultas.
 */
import { ArrowRight, ChartNoAxesColumn, ClipboardCheck, Plus, Search, SlidersHorizontal, Upload, type LucideIcon } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { useId } from "react";

import { cardClassName } from "@/components/ui/Card";
import { IconCircle, type Tone } from "@/components/ui/IconCircle";
import { StatChip, type StatChipTone } from "@/components/ui/StatChip";
import { cn } from "@/lib/cn";
import { pendingLabel, statusParts, type CatalogStatus, type StatusPart, type Task, type TaskId } from "@/lib/help/tasks";

/** Icono y color de cada tarea de las tarjetas blancas. El color acompaña al icono y al nombre, nunca los reemplaza. */
const LOOK: Record<Exclude<TaskId, "search" | "register">, { icon: LucideIcon; tone: Tone }> = {
  load: { icon: Upload, tone: "anil" },
  review: { icon: ClipboardCheck, tone: "ambar" },
  report: { icon: ChartNoAxesColumn, tone: "ciruela" },
  settings: { icon: SlidersHorizontal, tone: "piedra" },
};

/**
 * Buscador de la cabecera del Inicio: un formulario real hacia Buscar, con la dirección de siempre
 * (`/busqueda?q=…`). Navega sin recargar la página (`next/form`).
 */
export function HomeSearch({ task }: { task: Task }) {
  const id = useId();
  const hintId = `${id}-ayuda`;
  return (
    <Form action={task.href} role="search" className="flex flex-col gap-3">
      <label htmlFor={id} className="text-lg font-bold">
        {task.verb}
      </label>
      {/* Una píldora con el botón dentro; bajo 640 px el botón pasa a su propia fila para dejarle sitio al campo. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-1.5 shadow-sm has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-crema sm:flex-nowrap sm:rounded-full">
        <span className="flex min-w-0 flex-1 basis-48 items-center gap-2 pl-3.5">
          <Search size={20} aria-hidden="true" className="shrink-0 text-terracota" />
          <input
            id={id}
            name="q"
            type="search"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            placeholder="Código o nombre, por ejemplo I-0236"
            aria-describedby={hintId}
            className="min-h-11 w-full min-w-0 flex-1 bg-transparent text-base text-tinta placeholder:text-gris-texto focus-visible:outline-none"
          />
        </span>
        <button
          type="submit"
          className="min-h-11 w-full shrink-0 rounded-full bg-tinta px-6 py-2 text-base font-bold text-crema hover:bg-black focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota sm:w-auto"
        >
          Buscar
        </button>
      </div>
      <p id={hintId} className="text-base">
        {task.description}
      </p>
    </Form>
  );
}

const MOTION = "transition-[translate] duration-150 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0";

/** «Registrar una pieza nueva»: tarjeta ancha en verde sólido, con el «+» en un círculo blanco y una flecha. */
function RegisterCard({ task }: { task: Task }) {
  return (
    <Link
      href={task.href}
      className={cn(
        "group flex min-h-11 w-full items-center gap-4 rounded-tarjeta bg-verde-exito p-5 text-white shadow-sm hover:shadow-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota sm:gap-5 sm:px-8 sm:py-6",
        MOTION,
      )}
    >
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-verde-exito sm:size-14">
        <Plus size={28} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-xl font-extrabold text-balance sm:text-2xl">{task.verb}</span>
        <span className="text-base">{task.description}</span>
      </span>
      {/* Toda la tarjeta es el enlace: en pantallas estrechas la flecha cede su sitio al texto. */}
      <ArrowRight
        size={24}
        aria-hidden="true"
        className="hidden shrink-0 transition-[translate] duration-150 ease-out group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0 sm:block"
      />
    </Link>
  );
}

function TaskCard({ task, badge }: { task: Task; badge: string | null }) {
  const { icon, tone } = LOOK[task.id as keyof typeof LOOK];
  return (
    <Link href={task.href} className={cardClassName({ interactive: true, padded: false, className: "flex h-full min-h-11 w-full flex-col gap-4 p-6" })}>
      <span className="flex items-start justify-between gap-2">
        <IconCircle icon={icon} tone={tone} shape="square" />
        {badge && <span className="rounded-full bg-ambar-bg px-3 py-0.5 text-base font-semibold text-ambar-texto tabular-nums">{badge}</span>}
      </span>
      <span className="flex flex-col gap-1.5">
        <span className="text-xl font-bold text-tinta">{task.verb}</span>
        <span className="text-base text-gris-texto">{task.description}</span>
      </span>
    </Link>
  );
}

/**
 * Tareas bajo la cabecera: «Registrar una pieza nueva» en una tarjeta verde ancha y el resto en una
 * fila de tarjetas blancas (dos columnas en pantallas medianas, una en las estrechas). «Buscar una
 * pieza» no va aquí: es el buscador de la cabecera (`HomeSearch`).
 */
export function TaskCards({ tasks, pending }: { tasks: readonly Task[]; pending?: number | null }) {
  if (tasks.length === 0) {
    return (
      <p role="status" className="rounded-tarjeta bg-ambar-bg p-4 text-base text-ambar-texto">
        Su rol no tiene tareas disponibles. Pida acceso a quien administra el sistema.
      </p>
    );
  }
  const register = tasks.find((task) => task.id === "register");
  const others = tasks.filter((task) => task.id !== "search" && task.id !== "register");
  if (!register && others.length === 0) return null;
  return (
    <div className="flex flex-col gap-tarjetas">
      {register && <RegisterCard task={register} />}
      {others.length > 0 && (
        <ul aria-label="Otras tareas" className="grid grid-cols-1 gap-tarjetas sm:grid-cols-2 xl:grid-flow-col xl:grid-cols-none xl:auto-cols-fr">
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

const CHIP_LOOK: Record<StatusPart["kind"], { tone: StatChipTone; href?: string }> = {
  all: { tone: "neutro" },
  inventory: { tone: "alerta", href: "/busqueda?hasInventoryCode=false" },
  photo: { tone: "alerta", href: "/busqueda?incompleteOnly=1" },
};

/** Píldoras del estado del catálogo: el total en blanco y lo que falta en ámbar suave, como enlace a esas piezas. */
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
      <p role="status" className="flex min-h-11 items-center text-base text-gris-texto">
        Leyendo el estado del catálogo…
      </p>
    );
  }
  return (
    <ul className="flex flex-wrap items-center gap-3">
      {statusParts(status).map((part) => (
        <li key={part.kind}>
          <StatChip value={part.value} label={part.label} {...CHIP_LOOK[part.kind]} />
        </li>
      ))}
    </ul>
  );
}
