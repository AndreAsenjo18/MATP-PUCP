/**
 * Secciones de la navegación principal y reglas puras de visibilidad por permiso (RF-039) y de
 * apertura/cierre del menú móvil (RNF-001). Sin React, para poder probarlas directamente.
 */
import {
  ChartColumn,
  CopyCheck,
  FileSpreadsheet,
  House,
  Search,
  Sparkles,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/inicio", label: "Inicio", icon: House },
  { href: "/busqueda", label: "Búsqueda", icon: Search },
  { href: "/importacion", label: "Importación", icon: FileSpreadsheet, permission: "imports.prepare" },
  { href: "/duplicados", label: "Duplicados", icon: CopyCheck, permission: "duplicates.resolve" },
  { href: "/ia/sugerencias", label: "Sugerencias IA", icon: Sparkles, permission: "ai.review" },
  { href: "/reportes", label: "Reportes", icon: ChartColumn, permission: "reports.view" },
  { href: "/administracion", label: "Administración", icon: Users, permission: "users.manage" },
  { href: "/deposito", label: "Vista de depósito", icon: Warehouse, permission: "movements.register" },
];

export function visibleNavItems(hasPermission: (permission: string) => boolean, items: NavItem[] = NAV_ITEMS): NavItem[] {
  return items.filter((item) => !item.permission || hasPermission(item.permission));
}

/** La sección está activa si la ruta es la suya o una subruta (p. ej. `/busqueda/...`). */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type MobileMenuAction = "toggle" | "close" | "escape" | "navigate";

/** Estado del menú móvil: se abre y cierra con el botón, y se cierra con Escape o al navegar. */
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
