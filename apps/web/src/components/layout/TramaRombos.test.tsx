import { describe, expect, it } from "vitest";

import { render } from "@/test/render";

import { PageHeader } from "./PageHeader";
import { duracionTejido, rombosDeTrama } from "./TramaRombos";

// Spec plataforma — Búsqueda con IA desde el Inicio: trama animada de la cabecera grande (change `inicio-busqueda-ia`, D4).

describe("trama de rombos animada", () => {
  it("cubre el área con celdas de 72 px ancladas arriba a la derecha", () => {
    const rombos = rombosDeTrama(500, 300);
    expect(rombos).toHaveLength(7 * 5);
    expect(rombos[0]).toEqual({ x: 464, y: 36, k: 0, c: 0 });
    expect(Math.max(...rombos.map((rombo) => rombo.c))).toBe(6);
  });

  it("el tejido termina cuando se dibuja el último rombo de la diagonal", () => {
    expect(duracionTejido(rombosDeTrama(144, 144))).toBe(2 * 45 + 800);
    expect(duracionTejido([])).toBe(800);
  });

  it("solo la cabecera grande la usa; es decorativa y el servidor no dibuja rombos", () => {
    const grande = render(<PageHeader size="grande" title="¿Qué desea hacer?" />);
    expect(grande).toMatch(/<span aria-hidden="true" data-trama=""[^>]*w-\[40%\]/);
    expect(grande).not.toContain("trama-rombos");
    expect(grande).not.toContain("<svg");
    expect(render(<PageHeader title="Búsqueda" />)).toContain("trama-rombos");
  });

  it("las animaciones viven solo para quien no pidió reducir el movimiento", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf-8");
    const block = css.slice(css.indexOf(".trama-svg .rombo-nudo"), css.indexOf("@keyframes trama-tejer"));
    const motion = block.indexOf("@media (prefers-reduced-motion: no-preference)");
    expect(motion).toBeGreaterThan(-1);
    for (const name of ["trama-tejer", "trama-nudo", "trama-ola", "trama-hilo"]) expect(block.indexOf(`animation: ${name}`)).toBeGreaterThan(motion);
  });
});
