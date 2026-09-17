"use client";

/**
 * Cabecera y navegación compartidas por las pantallas autenticadas de la maqueta. Los enlaces se
 * ocultan según el permiso del rol simulado (RF-039), y siempre se puede "cambiar de rol" para
 * demostrar la matriz completa en una sola sesión de navegador.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode } from "react";

import { useSession } from "@/lib/auth/session";
import { getApiMode } from "@/lib/data/mode";

interface NavItem {
  href: string;
  label: string;
  permission?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/inicio", label: "Inicio" },
  { href: "/busqueda", label: "Búsqueda" },
  { href: "/importacion", label: "Importación", permission: "imports.prepare" },
  { href: "/duplicados", label: "Duplicados", permission: "duplicates.resolve" },
  { href: "/ia/sugerencias", label: "Sugerencias IA", permission: "ai.review" },
  { href: "/reportes", label: "Reportes", permission: "reports.view" },
  { href: "/administracion", label: "Administración", permission: "users.manage" },
  { href: "/deposito", label: "Vista de depósito", permission: "movements.register" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, hasPermission, currentUser, currentRole, logout } = useSession();

  if (!session) {
    return <>{children}</>;
  }

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission));

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/inicio" className="text-lg font-bold text-stone-900">
              MATP · Colecciones
            </Link>
            {getApiMode() === "mock" && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-900">
                Modo demostración (datos sintéticos)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-stone-700">
              {currentUser?.full_name} · <span className="font-medium">{currentRole?.name}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-stone-700 hover:bg-stone-100"
            >
              Cambiar de rol
            </button>
          </div>
        </div>
        <nav aria-label="Navegación principal" className="border-t border-stone-100">
          <ul className="mx-auto flex w-full max-w-6xl flex-nowrap gap-1 overflow-x-auto px-2 py-1 sm:flex-wrap sm:overflow-visible">
            {visibleItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href} className="shrink-0">
                  <Link
                    href={item.href}
                    className={`block rounded-md px-3 py-2 text-base font-medium whitespace-nowrap ${
                      active ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">{children}</main>
    </div>
  );
}

/** Mensaje uniforme cuando el rol activo no tiene el permiso necesario para ver algo. */
export function PermissionNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-base text-amber-900">
      {children ?? "Su rol actual no tiene permiso para ver esta sección. Cambie de rol desde la cabecera para probar otra vista."}
    </div>
  );
}
