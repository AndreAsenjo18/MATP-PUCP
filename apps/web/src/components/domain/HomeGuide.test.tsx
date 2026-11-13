import { describe, expect, it } from "vitest";

import { BrandMark } from "@/components/brand/TextileMotif";
import { TASKS, visibleTasks } from "@/lib/help/tasks";
import { render, visibleText } from "@/test/render";

import { CatalogStatusChips, HomeSearch, TaskCards } from "./HomeGuide";

// Spec plataforma — Inicio como guía de tareas y la maqueta B de `remodelacion-visual`.
// Datos sintéticos (RNF-014).

const ALL = visibleTasks(() => true);
const SEARCH = TASKS.find((task) => task.id === "search")!;

/** El HTML de la lista con esa etiqueta accesible. */
function list(html: string, label: string): string {
  const start = html.indexOf(`aria-label="${label}"`);
  return start < 0 ? "" : html.slice(start, html.indexOf("</ul>", start));
}

describe("tarjetas de tarea", () => {
  it("la Gestora ve registrar y las otras cuatro tareas, cada una con verbo, una línea y un enlace; buscar es el buscador", () => {
    const html = render(<TaskCards tasks={ALL} pending={90} />);
    const text = visibleText(html);
    for (const task of TASKS.filter((task) => task.id !== "search")) {
      expect(text).toContain(task.verb);
      expect(text).toContain(task.description);
      expect(html).toContain(`href="${task.href}"`);
    }
    expect(text).not.toContain(SEARCH.verb);
    expect(html.match(/<a /g)).toHaveLength(5);
  });

  it("registrar va primero, en una tarjeta verde ancha con letra más grande; las demás, en una fila aparte", () => {
    const html = render(<TaskCards tasks={ALL} />);
    const others = list(html, "Otras tareas");
    const register = html.slice(0, html.indexOf("Otras tareas"));
    expect(visibleText(register)).toContain("Registrar una pieza nueva");
    expect(register).toContain("bg-verde-exito");
    expect(register).toContain("text-2xl");
    expect(register.match(/<a /g)).toHaveLength(1);
    expect(others.match(/<a /g)).toHaveLength(4);
    expect(others).not.toContain("text-2xl");
  });

  it("da a cada tipo de tarea un cuadro de color distinto, siempre con su icono y su nombre", () => {
    const html = render(<TaskCards tasks={ALL} />);
    for (const tone of ["bg-verde-exito ", "bg-anil-bg", "bg-ambar-bg", "bg-ciruela-bg", "bg-borde"]) expect(html).toContain(tone);
    expect(list(html, "Otras tareas").match(/rounded-md/g)).toHaveLength(4);
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
    expect(html).toContain("hover:shadow-md");
    expect(html).toContain("motion-safe:active:translate-y-0");
    expect(html).toContain("focus-visible:outline-3");
    // El desplazamiento solo ocurre si la persona no pidió menos movimiento.
    expect(html).toContain("motion-safe:hover:-translate-y-0.5");
    expect(html).not.toMatch(/(?<!motion-safe:)hover:-translate/);
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

  it("el total va en blanco y lo que falta en ámbar; los enlaces llevan flecha además de color, miden 44 px y las cifras no bailan", () => {
    const html = render(<CatalogStatusChips status={status} failed={false} />);
    expect(html.match(/min-h-11/g)).toHaveLength(3);
    expect(html.match(/tabular-nums/g)).toHaveLength(3);
    expect(html.match(/bg-white/g)).toHaveLength(1);
    expect(html.match(/bg-ambar-bg/g)).toHaveLength(2);
    expect(html.match(/<svg /g)).toHaveLength(2);
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

describe("buscador de la cabecera", () => {
  it("es un formulario real hacia Buscar con el parámetro de siempre, etiqueta visible y ayuda enlazada", () => {
    const html = render(<HomeSearch task={SEARCH} />);
    const text = visibleText(html);
    expect(html).toMatch(/<form[^>]*action="\/busqueda"/);
    expect(html).toContain('role="search"');
    expect(html).toContain('name="q"');
    expect(html).toContain('placeholder="Código o nombre, por ejemplo I-0236"');
    expect(text).toContain("Buscar una pieza");
    expect(text).toContain("Encuentre una pieza por su código o su nombre.");
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Buscar<\/button>/);
    const inputId = html.match(/<input[^>]*id="([^"]+)"/)![1];
    expect(html).toContain(`for="${inputId}"`);
    expect(html).toContain(`aria-describedby="${inputId}-ayuda"`);
  });

  it("el campo y el botón miden 44 px y el foco se ve sobre la cabecera", () => {
    const html = render(<HomeSearch task={SEARCH} />);
    expect(html.match(/min-h-11/g)).toHaveLength(2);
    expect(html).toContain("has-[input:focus-visible]:outline-crema");
    expect(html).not.toMatch(/text-(xs|sm)\b/);
  });
});

describe("rombo de la marca", () => {
  it("es decorativo: oculto a lectores de pantalla, sin texto y con el color del token", () => {
    const html = render(<BrandMark />);
    expect(html).toContain('aria-hidden="true"');
    expect(visibleText(html)).toBe("");
    expect(html).toContain("stroke-terracota-vivo");
    expect(html).not.toMatch(/#[0-9a-f]{6}/i);
  });
});
