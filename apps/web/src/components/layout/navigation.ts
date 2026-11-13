/**
 * Secciones de la navegación principal y reglas puras de visibilidad por permiso (RF-039) y de
 * apertura/cierre del menú en pantallas estrechas (RNF-001). Sin React, para poder probarlas
 * directamente.
 */
import { ChartColumn, ClipboardCheck, FileUp, House, Search, Settings, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Basta uno de estos permisos; sin permisos, la ve cualquier persona con sesión. */
  permissions?: readonly string[];
}

/**
 * Seis entradas con nombre de tarea (change `remodelacion-visual`, D5). «Revisar pendientes» reúne
 * duplicados, sugerencias y piezas incompletas en la bandeja (`revisar-pendientes-unificado`); las
 * direcciones `/duplicados` y `/ia/sugerencias` siguen llevando allí.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/inicio", label: "Inicio", icon: House },
  { href: "/busqueda", label: "Buscar", icon: Search },
  { href: "/importacion", label: "Cargar datos", icon: FileUp, permissions: ["imports.prepare"] },
  { href: "/pendientes", label: "Revisar pendientes", icon: ClipboardCheck, permissions: ["duplicates.resolve", "ai.review", "reports.view"] },
  { href: "/reportes", label: "Reportes", icon: ChartColumn, permissions: ["reports.view"] },
  { href: "/administracion", label: "Administración", icon: Settings, permissions: ["users.manage"] },
];

export function visibleNavItems(hasPermission: (permission: string) => boolean, items: NavItem[] = NAV_ITEMS): NavItem[] {
  return items.filter((item) => !item.permissions?.length || item.permissions.some(hasPermission));
}

/** La sección está activa si la ruta es la suya o una subruta (p. ej. `/busqueda/...`). */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type MobileMenuAction = "toggle" | "close" | "escape" | "navigate";

/** Estado del menú en pantallas estrechas: se abre y cierra con el botón, y se cierra con Escape o al navegar. */
export function mobileMenuReducer(open: boolean, action: MobileMenuAction): boolean {
  switch (action) {
    case "toggle":
      return !open;
    case "close":
    case "escape":
    case "navigate":
      return false;
    default:
      return open;
  }
}

/** Clave del navegador donde se recuerda si la barra lateral está contraída. */
export const SIDEBAR_STORAGE_KEY = "matp.sidebar";

type SidebarStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * Preferencia guardada de la barra lateral: `true` = contraída. Si el navegador no deja leer el
 * almacenamiento (ventana privada, datos bloqueados) la barra queda expandida.
 */
export function readSidebarCollapsed(storage: SidebarStorage | null): boolean {
  try {
    return storage?.getItem(SIDEBAR_STORAGE_KEY) === "collapsed";
  } catch {
    return false;
  }
}

/** Guarda la preferencia; si el almacenamiento falla, la barra sigue funcionando en la sesión. */
export function writeSidebarCollapsed(storage: SidebarStorage | null, collapsed: boolean): void {
  try {
    storage?.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "collapsed" : "expanded");
  } catch {
    // Sin almacenamiento solo se pierde la preferencia entre visitas.
  }
}
