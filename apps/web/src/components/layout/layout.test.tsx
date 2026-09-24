import { describe, expect, it } from "vitest";

import { ROLES } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import { isActive, mobileMenuReducer, NAV_ITEMS, visibleNavItems } from "./navigation";
import { PermissionNotice } from "./PermissionNotice";
import { Sidebar } from "./Sidebar";

function labelsFor(roleCode: string): string[] {
  const role = ROLES.find((r) => r.code === roleCode);
  if (!role) throw new Error(`Rol ${roleCode} no encontrado en los datos sintéticos`);
  return visibleNavItems((permission) => role.permissions.includes(permission)).map((item) => item.label);
}

describe("visibleNavItems", () => {
  it("el Administrador ve todas las secciones", () => {
    expect(labelsFor("ADMIN")).toEqual(NAV_ITEMS.map((item) => item.label));
  });

  it("el Personal auxiliar de depósito ve Inicio, Búsqueda y Vista de depósito, sin Administración", () => {
    const labels = labelsFor("STORAGE_STAFF");
    expect(labels).toContain("Inicio");
    expect(labels).toContain("Búsqueda");
    expect(labels).toContain("Vista de depósito");
    expect(labels).not.toContain("Administración");
    expect(labels).not.toContain("Importación");
  });

  it("sin permisos solo quedan las secciones públicas del sistema interno", () => {
    expect(visibleNavItems(() => false).map((item) => item.href)).toEqual(["/inicio", "/busqueda"]);
  });
});

describe("isActive", () => {
  it("marca la sección exacta y sus subrutas", () => {
    expect(isActive("/busqueda", "/busqueda")).toBe(true);
    expect(isActive("/ia/sugerencias/123", "/ia/sugerencias")).toBe(true);
  });

  it("no confunde prefijos parecidos", () => {
    expect(isActive("/inicios", "/inicio")).toBe(false);
    expect(isActive("/", "/inicio")).toBe(false);
  });
});

describe("mobileMenuReducer", () => {
  it("abre y cierra con el botón", () => {
    expect(mobileMenuReducer(false, "toggle")).toBe(true);
    expect(mobileMenuReducer(true, "toggle")).toBe(false);
  });

  it("se cierra con Escape, al navegar y al cerrar", () => {
    expect(mobileMenuReducer(true, "escape")).toBe(false);
    expect(mobileMenuReducer(true, "navigate")).toBe(false);
    expect(mobileMenuReducer(true, "close")).toBe(false);
  });

  it("ignora acciones desconocidas", () => {
    expect(mobileMenuReducer(true, "otra" as never)).toBe(true);
  });
});

describe("Sidebar", () => {
  it("marca la sección actual con aria-current y fondo crema, y oculta los iconos al lector de pantalla", () => {
    const html = render(<Sidebar items={NAV_ITEMS.slice(0, 3)} pathname="/busqueda" />);
    expect(html).toContain('aria-label="Navegación principal"');
    expect(html).toContain("bg-tinta");
    expect(html).toMatch(/aria-current="page"[^>]*class="[^"]*bg-crema text-tinta[^"]*"[^>]*href="\/busqueda"|href="\/busqueda"[^>]*aria-current="page"/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(3);
    expect(visibleText(html)).toBe("Inicio Búsqueda Importación");
  });
});

describe("PermissionNotice", () => {
  it("muestra el texto por defecto con colores de advertencia accesibles", () => {
    const html = render(<PermissionNotice />);
    expect(html).toContain("text-ambar-texto");
    expect(visibleText(html)).toMatch(/Su rol actual no tiene permiso/);
  });
});
