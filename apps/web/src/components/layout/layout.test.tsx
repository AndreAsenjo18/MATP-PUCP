import { describe, expect, it } from "vitest";

import { ROLES } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import { memoryStorage } from "@/test/memory-storage";

import { isActive, mobileMenuReducer, NAV_ITEMS, readSidebarCollapsed, SIDEBAR_STORAGE_KEY, visibleNavItems, writeSidebarCollapsed } from "./navigation";
import { MenuAccount, roleIsRedundant } from "./MenuAccount";
import { headerActionClassName, PageHeader } from "./PageHeader";
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

  it("el menú tiene como máximo seis entradas, con nombre de tarea (remodelacion-visual, D5)", () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual(["Inicio", "Buscar", "Cargar datos", "Revisar pendientes", "Reportes", "Administración"]);
    expect(NAV_ITEMS.find((item) => item.label === "Revisar pendientes")?.href).toBe("/pendientes");
  });

  it("«Revisar pendientes» se ve con cualquiera de sus permisos", () => {
    for (const permission of ["duplicates.resolve", "ai.review", "reports.view"]) {
      const labels = visibleNavItems((p) => p === permission).map((item) => item.label);
      expect(labels).toContain("Revisar pendientes");
    }
    expect(visibleNavItems(() => false).map((item) => item.label)).not.toContain("Revisar pendientes");
  });

  it("el Personal auxiliar de depósito ve Inicio y Buscar, donde verifica y mueve, sin Administración", () => {
    const labels = labelsFor("STORAGE_STAFF");
    expect(labels).toContain("Inicio");
    expect(labels).toContain("Buscar");
    // La vista de depósito se fusionó con la búsqueda (fusion-busqueda-deposito 4.1).
    expect(labels).not.toContain("Vista de depósito");
    expect(NAV_ITEMS.some((item) => item.href === "/deposito")).toBe(false);
    expect(labels).not.toContain("Administración");
    expect(labels).not.toContain("Cargar datos");
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
    // Sin fondo propio: va sobre el panel oscuro y deja ver la pista de desplazamiento.
    expect(html).toMatch(/<nav[^>]*class="text-crema"/);
    expect(html).toMatch(/aria-current="page"[^>]*class="[^"]*bg-crema text-tinta[^"]*"[^>]*href="\/busqueda"|href="\/busqueda"[^>]*aria-current="page"/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(3);
    expect(visibleText(html)).toBe("Inicio Buscar Cargar datos");
    // Cada sección es una píldora de 44 px.
    expect(html.match(/rounded-full/g)).toHaveLength(3);
    expect(html.match(/min-h-11/g)).toHaveLength(3);
  });
});

describe("Sidebar contraída", () => {
  it("deja solo los iconos, con el nombre de cada sección como ayuda y para el lector de pantalla", () => {
    const html = render(<Sidebar items={NAV_ITEMS.slice(0, 3)} pathname="/busqueda" collapsed />);
    expect(html.match(/title="(Inicio|Buscar|Cargar datos)"/g)).toHaveLength(3);
    expect(html.match(/class="sr-only"/g)).toHaveLength(3);
    expect(html).toContain("justify-center");
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("expandida no repite el nombre como ayuda ni lo oculta", () => {
    const html = render(<Sidebar items={NAV_ITEMS.slice(0, 3)} pathname="/busqueda" />);
    expect(html).not.toContain("title=");
    expect(html).not.toContain("sr-only");
  });
});

describe("preferencia de la barra lateral", () => {
  it("empieza expandida y recuerda lo que se guardó", () => {
    const storage = memoryStorage();
    expect(readSidebarCollapsed(storage)).toBe(false);
    writeSidebarCollapsed(storage, true);
    expect(storage.getItem(SIDEBAR_STORAGE_KEY)).toBe("collapsed");
    expect(readSidebarCollapsed(storage)).toBe(true);
    writeSidebarCollapsed(storage, false);
    expect(readSidebarCollapsed(storage)).toBe(false);
  });

  it("si el almacenamiento no está disponible o falla, la barra queda expandida y no hay error", () => {
    const blocked = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(readSidebarCollapsed(null)).toBe(false);
    expect(readSidebarCollapsed(blocked)).toBe(false);
    expect(() => writeSidebarCollapsed(blocked, true)).not.toThrow();
    expect(() => writeSidebarCollapsed(null, true)).not.toThrow();
  });
});

describe("PermissionNotice", () => {
  it("muestra el texto por defecto con colores de advertencia accesibles", () => {
    const html = render(<PermissionNotice />);
    expect(html).toContain("text-ambar-texto");
    expect(visibleText(html)).toMatch(/Su rol actual no tiene permiso/);
  });
});

describe("MenuAccount (cuenta al pie del menú)", () => {
  it("muestra nombre, rol y el botón de cierre de sesión a todo el ancho, sin cortar el texto", () => {
    const html = render(<MenuAccount name="Ana García" role="Administrador" logoutLabel="Cerrar sesión" onLogout={() => {}} />);
    expect(visibleText(html)).toContain("Ana García");
    expect(visibleText(html)).toContain("Administrador");
    expect(visibleText(html)).toContain("Cerrar sesión");
    expect(html).toContain("w-full");
    expect(html).toContain("min-h-11");
    expect(html).not.toContain("truncate");
    expect(visibleText(html)).not.toContain("Modo demostración");
  });

  it("en demostración dice «Cambiar de rol» y muestra la insignia una sola vez", () => {
    const text = visibleText(render(<MenuAccount name="Ana García" role="Administrador" logoutLabel="Cambiar de rol" onLogout={() => {}} demo />));
    expect(text).toContain("Cambiar de rol");
    expect(text.match(/Modo demostración/g)).toHaveLength(1);
  });

  it("la insignia de demostración es compacta, de 16 px, y conserva «datos sintéticos» para el lector y como ayuda", () => {
    const html = render(<MenuAccount name="Ana García" role="Administrador" logoutLabel="Cambiar de rol" onLogout={() => {}} demo />);
    const badge = html.match(/<span title="Modo demostración \(datos sintéticos\)"[^>]*>/)?.[0] ?? "";
    expect(badge).toContain("text-base");
    expect(badge).toContain("py-0.5");
    expect(badge).not.toMatch(/text-(xs|sm)\b/);
    expect(html).toContain('class="sr-only"> (datos sintéticos)');
  });

  it("no repite el rol si el nombre ya lo dice, y si no lo dice lo pone debajo del nombre", () => {
    expect(roleIsRedundant("Administrador MATP (sintético)", "Administrador")).toBe(true);
    expect(roleIsRedundant("Gabriela Curadora (sintética)", "Gestor de colecciones (Curadora)")).toBe(false);
    expect(roleIsRedundant("Ana García", undefined)).toBe(true);
    const admin = visibleText(render(<MenuAccount name="Administrador MATP (sintético)" role="Administrador" logoutLabel="Cambiar de rol" onLogout={() => {}} />));
    expect(admin.match(/Administrador/g)).toHaveLength(1);
    const curator = render(<MenuAccount name="Gabriela Curadora (sintética)" role="Gestor de colecciones (Curadora)" logoutLabel="Cambiar de rol" onLogout={() => {}} />);
    expect(visibleText(curator)).toContain("Gabriela Curadora (sintética) Gestor de colecciones (Curadora)");
    expect(curator).not.toContain("·");
    expect(curator.match(/<p /g)).toHaveLength(1);
  });

  it("contraída deja botones de icono de 44 px con su nombre como ayuda y para el lector de pantalla", () => {
    const html = render(<MenuAccount name="Ana García" role="Administrador" logoutLabel="Cambiar de rol" onLogout={() => {}} demo collapsed />);
    expect(html).toContain('aria-label="Cambiar de rol"');
    expect(html).toContain('title="Cambiar de rol"');
    expect(html).toContain("size-11");
    expect(html).toContain('class="sr-only">Modo demostración');
    expect(visibleText(html)).not.toContain("Ana García");
  });
});

describe("PageHeader (cabecera terracota)", () => {
  it("compacta: el título como único h1, la ayuda y la trama decorativa solo desde 768 px", () => {
    const html = render(<PageHeader title="Reportes" description="Calculados en el momento." />);
    expect(html.match(/<h1\b[^>]*>([^<]+)</)?.[1]).toBe("Reportes");
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(visibleText(html)).toContain("Calculados en el momento.");
    expect(html).toContain("bg-terracota");
    expect(html).toContain("rounded-panel");
    expect(html).toContain("text-crema");
    expect(html).toContain("text-titulo-trabajo");
    const trama = html.match(/<span aria-hidden="true" data-trama=""[^>]*>/)?.[0] ?? "";
    expect(trama).toContain("trama-rombos");
    expect(trama).toContain("hidden md:block");
    expect(html).not.toMatch(/text-(xs|sm)\b/);
  });

  it("compacta deja libre la franja de la trama para que nunca quede detrás del texto", () => {
    const html = render(<PageHeader title="Administración" />);
    expect(html).toMatch(/md:pr-\[min\(28%,16rem\)\]/);
    expect(html).toContain("w-[min(34%,20rem)]");
  });

  it("grande: nombre del museo, título grande y el contenido que se le pase, en la parte libre de la trama", () => {
    const html = render(
      <PageHeader size="grande" eyebrow="Museo de prueba" title="¿Qué desea hacer?">
        <p>Buscador</p>
      </PageHeader>,
    );
    const text = visibleText(html);
    expect(text).toContain("Museo de prueba");
    expect(text).toContain("Buscador");
    expect(html).toContain("text-titulo");
    expect(html).not.toContain("text-titulo-trabajo");
    expect(html).toContain("md:pr-[36%]");
  });

  it("las acciones van dentro de la banda, en píldora crema de 44 px con foco crema", () => {
    const html = render(<PageHeader title="Búsqueda" actions={<span className={headerActionClassName}>Nueva pieza</span>} />);
    expect(visibleText(html)).toContain("Nueva pieza");
    expect(headerActionClassName).toContain("bg-crema");
    expect(headerActionClassName).toContain("text-tinta");
    expect(headerActionClassName).toContain("min-h-11");
    expect(headerActionClassName).toContain("focus-visible:outline-crema");
  });

  it("«Volver a …» va dentro de la banda como píldora crema, con área de toque de 44 px y foco visible", () => {
    const html = render(<PageHeader back={{ href: "/busqueda", label: "Volver a la búsqueda" }} title="Registrar una pieza" />);
    const link = html.match(/<a [^>]*href="\/busqueda"[^>]*>/)?.[0] ?? "";
    expect(link).toContain("min-h-11");
    expect(html).toContain("bg-crema");
    expect(html).toContain("group-focus-visible:outline-crema");
    expect(visibleText(html)).toContain("Volver a la búsqueda");
    expect(html.indexOf("Volver a la búsqueda")).toBeLessThan(html.indexOf("<h1"));
  });

  it("las insignias junto al título van en la misma línea si caben", () => {
    const html = render(<PageHeader title="Toro de Pucará" meta={<span>Código I: I-0236</span>} />);
    expect(visibleText(html)).toContain("Código I: I-0236");
    expect(html).toMatch(/<div class="flex flex-wrap items-center gap-x-3 gap-y-2"><h1/);
  });
});
