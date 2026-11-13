"use client";

/**
 * Estructura común de las pantallas autenticadas (change `remodelacion-visual`, D4 y D6;
 * docs/guia-visual.md):
 *
 * - Desde 1024 px, un menú lateral flotante y oscuro que ocupa toda la altura visible, con «Contraer
 *   menú» y, al pie, la cuenta de la persona (`MenuAccount`).
 * - Bajo 1024 px, un botón «Menú» abre el mismo menú como diálogo modal: atrapa el foco, se cierra con
 *   Escape, al tocar fuera o al elegir una sección, y devuelve el foco al botón.
 * - Sin franja superior. El contenido va centrado con un ancho máximo.
 *
 * Las secciones se filtran por el permiso del rol (RF-039). Sin sesión (pantalla de acceso) devuelve
 * solo el contenido. Al imprimir solo queda el contenido (vista imprimible de reportes).
 */
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";

import { BrandMark } from "@/components/brand/TextileMotif";
import { buttonClassName } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/api";
import { getApiMode } from "@/lib/data/mode";

import { MenuAccount } from "./MenuAccount";
import { mobileMenuReducer, readSidebarCollapsed, visibleNavItems, writeSidebarCollapsed, type NavItem } from "./navigation";
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

const ON_DARK_CONTROL =
  "rounded-full text-crema hover:bg-white/10 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-crema";

function Brand({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <Link href="/inicio" translate="no" aria-label="MATP, ir al inicio" title="MATP" className={cn(ON_DARK_CONTROL, "flex size-12 items-center justify-center font-heading text-xl font-extrabold")}>
        M
      </Link>
    );
  }
  return (
    <Link href="/inicio" translate="no" className={cn(ON_DARK_CONTROL, "flex items-center gap-3 rounded-2xl px-3 py-1")}>
      <BrandMark />
      <span className="flex flex-col">
        <span className="text-2xl font-extrabold tracking-tight">MATP</span>
        <span className="text-base text-crema/80">Gestión de colecciones</span>
      </span>
    </Link>
  );
}

interface MenuPanelProps {
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
  /** Control junto a la marca: cerrar el panel en pantallas estrechas. */
  topControl?: ReactNode;
  /** Control pegado a la lista de secciones: contraer o expandir el menú en escritorio. */
  collapseControl?: ReactNode;
  account: ReactNode;
}

/**
 * Panel del menú, alto como la ventana. Las secciones hacen scroll dentro de su zona solo si no
 * caben, y el pie (cuenta y cierre de sesión) queda siempre a la vista. Si la ventana es tan baja
 * que ni así cabe la zona mínima de secciones, se desplaza el panel entero y el cierre de sesión
 * queda al final, nunca oculto.
 */
function MenuPanel({ items, pathname, collapsed, onNavigate, topControl, collapseControl, account }: MenuPanelProps) {
  return (
    <div className="scroll-menu flex h-full flex-col overflow-y-auto overscroll-contain rounded-panel bg-tinta text-crema shadow-md">
      <div className={cn("flex shrink-0 items-start justify-between gap-2 pt-4 pb-2", collapsed ? "flex-col items-center px-2" : "px-3")}>
        <Brand collapsed={collapsed} />
        {topControl}
      </div>
      {/* Si no caben, un brillo en el borde (scroll-pista) y la barra fina avisan de que hay más. */}
      <div data-menu-sections className="scroll-menu scroll-pista min-h-28 flex-1 scroll-py-2 overflow-y-auto overscroll-contain py-1">
        <Sidebar items={items} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
        {collapseControl && <div className={cn("pt-1", collapsed ? "px-2" : "px-3")}>{collapseControl}</div>}
      </div>
      <div data-menu-account className="shrink-0 border-t border-white/15 pt-3 pb-3">
        {account}
      </div>
    </div>
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  // Al elegir una sección el foco sigue a la pantalla nueva, no vuelve al botón «Menú».
  const closingForNavigation = useRef(false);

  const dispatchMenu = (action: Parameters<typeof mobileMenuReducer>[1]) => {
    if (action === "navigate") closingForNavigation.current = true;
    setMenuOpenAt(mobileMenuReducer(menuOpen, action) ? pathname : null);
  };

  // El diálogo nativo atrapa el foco y deja inerte el resto de la pantalla mientras está abierto.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (menuOpen && !dialog.open) {
      dialog.showModal();
      // Al abrir, el foco va a la sección actual (o a «Cerrar menú»), no a la marca.
      const target = dialog.querySelector<HTMLElement>("[aria-current='page']") ?? dialog.querySelector<HTMLElement>("button[aria-label='Cerrar menú']");
      target?.focus();
    }
    if (!menuOpen && dialog.open) dialog.close();
  }, [menuOpen]);

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

  // El diálogo deja inerte la pantalla, pero el navegador saca el foco a su propia barra tras el
  // último control: aquí el Tab da la vuelta dentro del panel.
  const keepFocusInside = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab") return;
    const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleDialogClose = () => {
    setMenuOpenAt(null);
    if (!closingForNavigation.current) menuButtonRef.current?.focus();
    closingForNavigation.current = false;
  };

  const account = (isCollapsed: boolean) => (
    <MenuAccount
      name={currentUser?.full_name}
      role={currentRole?.name}
      logoutLabel={logoutLabel}
      onLogout={handleLogout}
      demo={!live}
      collapsed={isCollapsed}
    />
  );

  return (
    <div className="flex min-h-dvh flex-1">
      <div className={cn("hidden shrink-0 print:hidden lg:block", collapsed ? "w-24" : "w-72")}>
        <div className="sticky top-0 h-dvh p-3">
          <MenuPanel
            items={items}
            pathname={pathname}
            collapsed={collapsed}
            account={account(collapsed)}
            collapseControl={
              <button
                type="button"
                aria-expanded={!collapsed}
                aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
                title={collapsed ? "Expandir menú" : undefined}
                onClick={toggleSidebar}
                className={cn(ON_DARK_CONTROL, "flex min-h-11 w-full items-center gap-3 px-4 py-2 text-base font-semibold", collapsed && "justify-center px-0")}
              >
                {collapsed ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
                {!collapsed && "Contraer menú"}
              </button>
            }
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-3 px-4 pt-4 sm:px-6 lg:hidden print:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-controls={MOBILE_NAV_ID}
            onClick={() => dispatchMenu("toggle")}
            className={buttonClassName({ variant: "secondary" })}
          >
            <Menu size={20} aria-hidden="true" />
            Menú
          </button>
          <Link href="/inicio" translate="no" className="inline-flex min-h-11 items-center rounded-full px-2 font-heading text-xl font-extrabold text-tinta">
            MATP
          </Link>
        </div>

        <dialog
          ref={dialogRef}
          id={MOBILE_NAV_ID}
          aria-label="Menú"
          onClose={handleDialogClose}
          onKeyDown={keepFocusInside}
          onClick={(event) => {
            if (event.target === event.currentTarget) dispatchMenu("close");
          }}
          className="m-0 h-dvh max-h-dvh w-[min(22rem,calc(100vw-1rem))] max-w-none bg-transparent p-2 lg:hidden"
        >
          <MenuPanel
            items={items}
            pathname={pathname}
            collapsed={false}
            onNavigate={() => dispatchMenu("navigate")}
            account={account(false)}
            topControl={
              <button type="button" aria-label="Cerrar menú" onClick={() => dispatchMenu("close")} className={cn(ON_DARK_CONTROL, "flex size-12 shrink-0 items-center justify-center")}>
                <X size={22} aria-hidden="true" />
              </button>
            }
          />
        </dialog>

        <main className="mx-auto flex w-full max-w-contenido min-w-0 flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}
