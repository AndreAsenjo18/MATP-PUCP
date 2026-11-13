import { describe, expect, it } from "vitest";

import { TextileBand, TextileMark } from "@/components/brand/TextileMotif";
import { TASKS, visibleTasks } from "@/lib/help/tasks";
import { render, visibleText } from "@/test/render";

import { CatalogStatusChips, TaskCards } from "./HomeGuide";

// Spec plataforma — Inicio como guía de tareas y «Piloto de identidad visual en el Inicio».
// Datos sintéticos (RNF-014).

const ALL = visibleTasks(() => true);

/** El HTML de la lista con esa etiqueta accesible. */
function list(html: string, label: string): string {
  const start = html.indexOf(`aria-label="${label}"`);
  return start < 0 ? "" : html.slice(start, html.indexOf("</ul>", start));
}

describe("tarjetas de tarea", () => {
  it("la Gestora ve las seis tarjetas, cada una con verbo, una línea y un enlace", () => {
    const html = render(<TaskCards tasks={ALL} pending={90} />);
    const text = visibleText(html);
    for (const task of TASKS) {
      expect(text).toContain(task.verb);
      expect(text).toContain(task.description);
      expect(html).toContain(`href="${task.href}"`);
    }
    expect(html.match(/<a /g)).toHaveLength(6);
  });

  it("destaca buscar y registrar: van primero, aparte y con letra más grande", () => {
    const html = render(<TaskCards tasks={ALL} />);
    const main = list(html, "Lo más frecuente");
    const others = list(html, "Otras tareas");
    expect(visibleText(main)).toContain("Buscar una pieza");
    expect(visibleText(main)).toContain("Registrar una pieza nueva");
    expect(main.match(/<a /g)).toHaveLength(2);
    expect(others.match(/<a /g)).toHaveLength(4);
    expect(html.indexOf("Lo más frecuente")).toBeLessThan(html.indexOf("Otras tareas"));
    expect(main).toContain("text-2xl");
    expect(main).toContain("font-display");
    expect(others).not.toContain("text-2xl");
  });

  it("da a cada tipo de tarea un círculo de color distinto, siempre con su icono y su nombre", () => {
    const html = render(<TaskCards tasks={ALL} />);
    for (const tone of ["bg-terracota ", "bg-verde-exito ", "bg-anil-bg", "bg-ambar-bg", "bg-ciruela-bg", "bg-borde"]) expect(html).toContain(tone);
    expect(html.match(/<svg /g)!.length).toBeGreaterThanOrEqual(6);
    expect(html.match(/aria-hidden="true"/g)!.length).toBeGreaterThanOrEqual(6);
  });

  it("muestra el número en «Revisar pendientes» solo cuando es mayor que cero", () => {
    expect(visibleText(render(<TaskCards tasks={ALL} pending={90} />))).toContain("90 por revisar");
    expect(visibleText(render(<TaskCards tasks={ALL} pending={0} />))).not.toContain("por revisar");
    expect(visibleText(render(<TaskCards tasks={ALL} pending={null} />))).not.toContain("por revisar");
  });

  it("el Personal de depósito no ve cargar, revisar ni configuración", () => {
    const html = render(<TaskCards tasks={visibleTasks((permission) => permission === "pieces.create")} />);
    const text = visibleText(html);
    expect(text).toContain("Buscar una pieza");
    expect(text).toContain("Registrar una pieza nueva");
    expect(text).not.toContain("Cargar datos o fotos");
    expect(text).not.toContain("Revisar pendientes");
    expect(text).not.toContain("Configuración");
    expect(html).not.toContain("Otras tareas");
  });

  it("se apilan en una columna en pantallas estrechas, con letra de 16 px o más y objetivos de 44 px o más", () => {
    const html = render(<TaskCards tasks={ALL} pending={3} />);
    expect(html).toContain("grid-cols-1");
    expect(html).toContain("min-h-11");
    expect(html).not.toMatch(/text-(xs|sm)\b/);
  });

  it("responde a cursor, pulsación y teclado, y respeta el movimiento reducido", () => {
    const html = render(<TaskCards tasks={ALL} />);
    expect(html).toContain("hover:shadow-elevada");
    expect(html).toContain("active:translate-y-0");
    expect(html).toContain("focus-visible:outline-3");
    expect(html).toContain("motion-reduce:transition-none");
    expect(html).not.toContain("transition-all");
  });

  it("sin ninguna tarea explica que el rol no tiene tareas y a quién pedir acceso", () => {
    const text = visibleText(render(<TaskCards tasks={[]} />));
    expect(text).toContain("no tiene tareas disponibles");
    expect(text).toContain("quien administra");
  });

  it("no usa identificadores de requisitos ni texto de demostración", () => {
    const text = visibleText(render(<TaskCards tasks={ALL} pending={3} />));
    expect(text).not.toMatch(/\b(RF|RN|RNF|RIA)-\d+/);
    expect(text).not.toMatch(/demostraci[oó]n/i);
  });
});

describe("fichas del estado del catálogo", () => {
  const status = { total: 318, withoutInventoryCode: 117, withoutPhoto: 138 };

  it("muestra tres fichas con cantidades y palabras completas, sin siglas ni porcentajes", () => {
    const html = render(<CatalogStatusChips status={status} failed={false} />);
    const text = visibleText(html);
    expect(text).toContain("318 piezas en el catálogo");
    expect(text).toContain("117 sin código de inventario");
    expect(text).toContain("138 sin foto");
    expect(text).not.toContain("%");
    expect(text).not.toContain("código I");
    expect(html.match(/<li>/g)).toHaveLength(3);
  });

  it("las fichas de faltantes llevan a esas piezas; el total no repite el enlace de buscar", () => {
    const html = render(<CatalogStatusChips status={status} failed={false} />);
    expect(html).toContain('href="/busqueda?hasInventoryCode=false"');
    expect(html).toContain('href="/busqueda?incompleteOnly=1"');
    expect(html.match(/<a /g)).toHaveLength(2);
  });

  it("cada ficha lleva icono además de color, miden 44 px o más y las cifras no bailan", () => {
    const html = render(<CatalogStatusChips status={status} failed={false} />);
    expect(html.match(/min-h-12/g)).toHaveLength(3);
    expect(html.match(/tabular-nums/g)).toHaveLength(3);
    expect(html.match(/<svg /g)!.length).toBeGreaterThanOrEqual(3);
    expect(html).toContain("focus-visible:outline-3");
  });

  it("si la consulta falla, las reemplaza por un aviso breve", () => {
    const text = visibleText(render(<CatalogStatusChips status={null} failed />));
    expect(text).toContain("No pudimos leer el estado del catálogo");
    expect(text).not.toContain("piezas");
  });

  it("mientras lee dice que está leyendo", () => {
    expect(visibleText(render(<CatalogStatusChips status={null} failed={false} />))).toContain("Leyendo el estado del catálogo…");
  });
});

describe("motivo de tejido", () => {
  it("es decorativo: oculto a lectores de pantalla, sin texto y con colores de los tokens", () => {
    for (const html of [render(<TextileBand />), render(<TextileMark />)]) {
      expect(html).toContain('aria-hidden="true"');
      expect(visibleText(html)).toBe("");
      expect(html).toContain("fill-terracota");
      expect(html).not.toMatch(/#[0-9a-f]{6}/i);
    }
  });
});
