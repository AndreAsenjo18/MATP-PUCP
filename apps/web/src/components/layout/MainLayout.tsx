"use client";

/**
 * Estructura común de las pantallas autenticadas (docs/system-design.md §5): barra lateral en
 * escritorio, botón «Menú» con panel en móvil (RNF-001) y encabezado con usuario, rol, cambio de
 * rol y aviso de modo demostración. Las secciones se filtran por el permiso del rol simulado
 * (RF-039). Sin sesión (pantalla de acceso) devuelve solo el contenido. Al imprimir solo queda el
 * contenido (vista imprimible de reportes, `reportes-inventario` 3.2). En pantallas angostas el
 * cierre de sesión va al final del panel del menú, no en el encabezado (`rediseno-ux-deposito`).
 */
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/api";
import { getApiMode } from "@/lib/data/mode";

import { mobileMenuReducer, readSidebarCollapsed, visibleNavItems, writeSidebarCollapsed } from "./navigation";
import { MobileAccount } from "./MobileAccount";
import { Sidebar } from "./Sidebar";

const MOBILE_NAV_ID = "navegacion-movil";

/**
 * Preferencia de la barra lateral (contraída o expandida), guardada en el navegador. Se lee con
 * `useSyncExternalStore` para que el primer render del servidor y del navegador coincidan (siempre
 * expandida) y la preferencia se aplique justo después. Si el almacenamiento falla, `override`
 * mantiene la elección durante la sesión.
 */
let sidebarOverride: boolean | null = null;
const sidebarListeners = new Set<() => void>();

function localStorageOrNull(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function subscribeSidebar(listener: () => void): () => void {
  sidebarListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    sidebarListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const sidebarSnapshot = () => sidebarOverride ?? readSidebarCollapsed(localStorageOrNull());
const sidebarServerSnapshot = () => false;

function toggleSidebar() {
  sidebarOverride = !sidebarSnapshot();
  writeSidebarCollapsed(localStorageOrNull(), sidebarOverride);
  sidebarListeners.forEach((listener) => listener());
}

function Brand({ className }: { className?: string }) {
  return (
    <Link href="/inicio" className={className}>
      <span className="block font-heading text-xl font-bold">MATP</span>
      <span className="block text-sm opacity-80">Gestión de colecciones</span>
    </Link>
  );
}

export function MainLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, hasPermission, currentUser, currentRole, logout } = useSession();
  // El menú queda asociado a la ruta en que se abrió: al navegar se cierra solo, sin efectos.
  const [menuOpenAt, setMenuOpenAt] = useState<string | null>(null);
  const menuOpen = menuOpenAt === pathname;
  const collapsed = useSyncExternalStore(subscribeSidebar, sidebarSnapshot, sidebarServerSnapshot);

  const dispatchMenu = (action: Parameters<typeof mobileMenuReducer>[1]) =>
    setMenuOpenAt(mobileMenuReducer(menuOpen, action) ? pathname : null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpenAt(mobileMenuReducer(true, "escape") ? pathname : null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen, pathname]);

  if (!session) {
    return <>{children}</>;
  }

  const items = visibleNavItems(hasPermission);
  const live = getApiMode() === "live";
  const logoutLabel = live ? "Cerrar sesión" : "Cambiar de rol";
  const handleLogout = async () => {
    if (live) await signOut();
    logout();
    router.push("/");
  };

  return (
    <div className="flex min-h-full flex-1">
      <aside
        className={cn(
          "hidden shrink-0 print:!hidden bg-tinta text-crema transition-[width] duration-150 motion-reduce:transition-none md:sticky md:top-0 md:flex md:h-screen md:flex-col md:overflow-y-auto",
          collapsed ? "md:w-16" : "md:w-64",
        )}
      >
        {collapsed ? (
          <Link href="/inicio" aria-label="MATP, ir al inicio" title="MATP" className="px-2 pt-6 pb-4 text-center font-heading text-xl font-bold text-crema">
            M
          </Link>
        ) : (
          <Brand className="px-6 pt-6 pb-4 text-crema" />
        )}
        <Sidebar items={items} pathname={pathname} collapsed={collapsed} />
        <div className={cn("mt-auto", collapsed ? "p-2" : "p-3")}>
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
            title={collapsed ? "Expandir menú" : undefined}
            onClick={toggleSidebar}
            className={cn(
              "flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-base font-medium text-crema hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crema",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
            {!collapsed && "Contraer menú"}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-borde bg-white print:hidden">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                icon={menuOpen ? X : Menu}
                className="whitespace-nowrap md:hidden"
                aria-expanded={menuOpen}
                aria-controls={MOBILE_NAV_ID}
                onClick={() => dispatchMenu("toggle")}
              >
                {menuOpen ? "Cerrar menú" : "Menú"}
              </Button>
              <Link href="/inicio" className="font-heading text-lg font-bold text-tinta md:hidden">
                MATP
              </Link>
              {!live && <Badge intent="warning" className="whitespace-nowrap">Modo demostración (datos sintéticos)</Badge>}
            </div>
            <div className="flex min-w-0 items-center gap-3 text-sm">
              <span className="min-w-0 truncate text-gris-texto">
                <span className="hidden md:inline">{currentUser?.full_name} · </span>
                <span className="font-medium text-tinta">{currentRole?.name}</span>
              </span>
              <div className="hidden md:block">
                <Button variant="outline" icon={LogOut} onClick={handleLogout}>
                  {logoutLabel}
                </Button>
              </div>
            </div>
          </div>
        </header>

        {menuOpen && (
          <div className="bg-tinta text-crema md:hidden print:hidden">
            <Sidebar id={MOBILE_NAV_ID} items={items} pathname={pathname} onNavigate={() => dispatchMenu("navigate")} />
            <MobileAccount name={currentUser?.full_name} role={currentRole?.name} logoutLabel={logoutLabel} onLogout={handleLogout} />
          </div>
        )}

        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}
