/**
 * Lista de secciones de la navegación principal (fondo `tinta`, docs/system-design.md §5). Se usa
 * en la barra lateral de escritorio y en el panel del menú móvil.
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
}

export function Sidebar({ items, pathname, onNavigate, className, id }: SidebarProps) {
  return (
    <nav id={id} aria-label="Navegación principal" className={cn("bg-tinta text-crema", className)}>
      <ul className="flex flex-col gap-1 p-3">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crema",
                  active ? "bg-crema text-tinta" : "text-crema hover:bg-white/10",
                )}
              >
                <Icon size={20} aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
