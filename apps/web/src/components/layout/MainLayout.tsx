"use client";

/**
 * Estructura común de las pantallas autenticadas (docs/system-design.md §5): barra lateral en
 * escritorio, botón «Menú» con panel en móvil (RNF-001) y encabezado con usuario, rol, cambio de
 * rol y aviso de modo demostración. Las secciones se filtran por el permiso del rol simulado
 * (RF-039). Sin sesión (pantalla de acceso) devuelve solo el contenido.
 */
import { LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/auth/session";
import { getApiMode } from "@/lib/data/mode";

import { mobileMenuReducer, visibleNavItems } from "./navigation";
import { Sidebar } from "./Sidebar";

const MOBILE_NAV_ID = "navegacion-movil";

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

  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-64 shrink-0 bg-tinta text-crema md:sticky md:top-0 md:flex md:h-screen md:flex-col md:overflow-y-auto">
        <Brand className="px-6 pt-6 pb-4 text-crema" />
        <Sidebar items={items} pathname={pathname} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-borde bg-white">
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
              {getApiMode() === "mock" && <Badge intent="warning" className="whitespace-nowrap">Modo demostración (datos sintéticos)</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-gris-texto">
                {currentUser?.full_name} · <span className="font-medium text-tinta">{currentRole?.name}</span>
              </span>
              <Button
                variant="outline"
                icon={LogOut}
                onClick={() => {
                  logout();
                  router.push("/");
                }}
              >
                Cambiar de rol
              </Button>
            </div>
          </div>
        </header>

        {menuOpen && (
          <Sidebar
            id={MOBILE_NAV_ID}
            items={items}
            pathname={pathname}
            onNavigate={() => dispatchMenu("navigate")}
            className="md:hidden"
          />
        )}

        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
