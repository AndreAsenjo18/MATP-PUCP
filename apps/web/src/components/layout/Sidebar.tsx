/**
 * Lista de secciones de la navegación principal, sobre el panel oscuro del menú (docs/guia-visual.md);
 * sin fondo propio, para que se vea la pista de desplazamiento del panel.
 * Cada sección es una píldora; la actual va en crema con texto oscuro y `aria-current`. Se usa en el
 * menú flotante de escritorio y en el panel que abre el botón «Menú».
 */
import Link from "next/link";

import { cn } from "@/lib/cn";

import { isActive, type NavItem } from "./navigation";

export interface SidebarProps {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
  className?: string;
  id?: string;
  /** Riel de iconos: cada sección conserva su nombre accesible y una ayuda al pasar el cursor. */
  collapsed?: boolean;
}

export function Sidebar({ items, pathname, onNavigate, className, id, collapsed = false }: SidebarProps) {
  return (
    <nav id={id} aria-label="Navegación principal" className={cn("text-crema", className)}>
      <ul className={cn("flex flex-col gap-2", collapsed ? "px-2" : "px-3")}>
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-full px-4 py-2 text-base font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-crema",
                  collapsed && "justify-center px-0",
                  active ? "bg-crema text-tinta" : "text-crema hover:bg-white/10",
                )}
              >
                <Icon size={20} aria-hidden="true" className="shrink-0" />
                <span className={collapsed ? "sr-only" : undefined}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
