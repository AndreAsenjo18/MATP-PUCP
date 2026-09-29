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
