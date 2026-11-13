/**
 * Tabla de tareas del museo (change `inicio-guia-de-tareas`, D1): lo que una persona puede querer
 * hacer, con un verbo, una línea de explicación, la pantalla donde se hace y el permiso que pide.
 * Es la única fuente de verdad del Inicio y, más adelante, del menú y del asistente de ayuda.
 * Funciones puras, sin React, para probarlas directamente.
 */

export type TaskId = "search" | "register" | "load" | "review" | "report" | "settings";

export interface Task {
  id: TaskId;
  /** Lo que se hace, en verbo («Buscar una pieza»). */
  verb: string;
  /** Una línea de explicación. */
  description: string;
  /** Pantalla donde se hace. */
  href: string;
  /** Basta uno de estos permisos; vacío = cualquier persona con sesión. */
  permissions: readonly string[];
}

export const TASKS: readonly Task[] = [
  { id: "search", verb: "Buscar una pieza", description: "Encuentre una pieza por su código o su nombre.", href: "/busqueda", permissions: [] },
  { id: "register", verb: "Registrar una pieza nueva", description: "Anote una pieza nueva con sus datos y sus fotos.", href: "/piezas/nueva", permissions: ["pieces.create"] },
  { id: "load", verb: "Cargar datos o fotos", description: "Traiga piezas desde un Excel o fotos desde una carpeta.", href: "/importacion", permissions: ["imports.prepare"] },
  // Mientras no exista `/pendientes` (change `revisar-pendientes-unificado`) lleva a la cola de duplicados.
  { id: "review", verb: "Revisar pendientes", description: "Decida sobre posibles duplicados y sugerencias.", href: "/duplicados", permissions: ["duplicates.resolve", "ai.review", "reports.view"] },
  { id: "report", verb: "Sacar un reporte", description: "Inventarios y listas para imprimir o descargar.", href: "/reportes", permissions: ["reports.view"] },
  { id: "settings", verb: "Configuración", description: "Personas, permisos y listas del museo.", href: "/administracion", permissions: ["users.manage"] },
];

/** Tareas que el rol puede hacer, en el orden de la tabla. */
export function visibleTasks(hasPermission: (permission: string) => boolean, tasks: readonly Task[] = TASKS): Task[] {
  return tasks.filter((task) => task.permissions.length === 0 || task.permissions.some(hasPermission));
}

export interface CatalogStatus {
  total: number;
  withoutInventoryCode: number;
  withoutPhoto: number;
}

const count = (value: number) => value.toLocaleString("es-PE");

export interface StatusPart {
  kind: "all" | "inventory" | "photo";
  /** La cantidad, ya con separador de miles. */
  value: string;
  /** Lo que cuenta, en palabras completas y sin siglas. */
  label: string;
}

/** Fichas del estado del catálogo: el total y una sola medida de lo que falta (cuántas piezas). */
export function statusParts(status: CatalogStatus): StatusPart[] {
  return [
    { kind: "all", value: count(status.total), label: status.total === 1 ? "pieza en el catálogo" : "piezas en el catálogo" },
    { kind: "inventory", value: count(status.withoutInventoryCode), label: "sin código de inventario" },
    { kind: "photo", value: count(status.withoutPhoto), label: "sin foto" },
  ];
}

/** Número de la tarjeta «Revisar pendientes»: solo si hay algo por revisar. */
export function pendingLabel(pending: number | null | undefined): string | null {
  if (!pending || pending <= 0) return null;
  return `${count(pending)} por revisar`;
}
