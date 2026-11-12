import { describe, expect, it } from "vitest";

import { TASKS, visibleTasks } from "@/lib/help/tasks";
import { render, visibleText } from "@/test/render";

import { CatalogStatusLine, TaskCards } from "./HomeGuide";

// Spec plataforma — Inicio como guía de tareas. Datos sintéticos (RNF-014).

const ALL = visibleTasks(() => true);

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

  it("muestra el número en «Revisar pendientes» solo cuando es mayor que cero", () => {
    expect(visibleText(render(<TaskCards tasks={ALL} pending={90} />))).toContain("90 por revisar");
    expect(visibleText(render(<TaskCards tasks={ALL} pending={0} />))).not.toContain("por revisar");
    expect(visibleText(render(<TaskCards tasks={ALL} pending={null} />))).not.toContain("por revisar");
  });

  it("el Personal de depósito no ve cargar, revisar ni configuración", () => {
    const text = visibleText(render(<TaskCards tasks={visibleTasks((permission) => permission === "pieces.create")} />));
    expect(text).toContain("Buscar una pieza");
    expect(text).toContain("Registrar una pieza nueva");
    expect(text).not.toContain("Cargar datos o fotos");
    expect(text).not.toContain("Revisar pendientes");
    expect(text).not.toContain("Configuración");
  });

  it("se apilan en una columna en pantallas estrechas y tienen objetivos táctiles de 44 px o más", () => {
    const html = render(<TaskCards tasks={ALL} />);
    expect(html).toContain("grid-cols-1");
    expect(html).toContain("min-h-11");
    expect(html).toContain("text-lg");
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

describe("línea de estado del catálogo", () => {
  it("muestra una sola línea con cantidades y enlaces, sin porcentajes", () => {
    const html = render(<CatalogStatusLine status={{ total: 318, withoutInventoryCode: 117, withoutPhoto: 138 }} failed={false} />);
    const text = visibleText(html);
    expect(text).toContain("318 piezas");
    expect(text).toContain("117 sin código I");
    expect(text).toContain("138 sin foto");
    expect(text).not.toContain("%");
    expect(html).toContain('href="/busqueda?hasInventoryCode=false"');
    expect(html.match(/<a /g)).toHaveLength(3);
  });

  it("si la consulta falla, la reemplaza por un aviso breve", () => {
    const text = visibleText(render(<CatalogStatusLine status={null} failed />));
    expect(text).toContain("No pudimos leer el estado del catálogo");
    expect(text).not.toContain("piezas");
  });

  it("mientras lee dice que está leyendo", () => {
    expect(visibleText(render(<CatalogStatusLine status={null} failed={false} />))).toContain("Leyendo el estado del catálogo");
  });
});
