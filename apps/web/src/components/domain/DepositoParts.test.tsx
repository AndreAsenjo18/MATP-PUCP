import { describe, expect, it } from "vitest";

import type { DestinationOption } from "@/lib/data/locations";
import { render, visibleText } from "@/test/render";

import {
  CodeChip,
  DepositoLayout,
  DestinationPicker,
  PieceDetailPlaceholder,
  PiecePanel,
  PieceResult,
  PieceTitle,
} from "./DepositoParts";

// Datos sintéticos (RNF-014).
const noop = () => {};
const OPTIONS: DestinationOption[] = [
  { id: "n1", label: "Sede › Depósito 1 › Rack A › Nivel 1", level: "Nivel" },
  { id: "c1", label: "Sede › Depósito 1 › Rack A › Nivel 2 › Caja 01", level: "Contenedor" },
];

describe("nombre y código destacados", () => {
  it("el código I va en una etiqueta monoespaciada y destacada", () => {
    const html = render(<CodeChip code="I-0236" />);
    expect(visibleText(html)).toBe("I-0236");
    expect(html).toContain("font-mono");
    expect(html).toContain("font-bold");
    expect(html).toContain("bg-terracota-light");
  });

  it("sin código lo dice en la misma posición", () => {
    expect(visibleText(render(<CodeChip code={null} />))).toBe("Sin código I");
  });

  it("el nombre va en negrita y antes del código", () => {
    const html = render(<PieceTitle name="Retablo ayacuchano" code="I-0236" />);
    expect(html).toContain("font-bold");
    expect(visibleText(html).indexOf("Retablo ayacuchano")).toBeLessThan(visibleText(html).indexOf("I-0236"));
  });

  it("el resultado muestra nombre, código y la ubicación como dato secundario", () => {
    const html = render(<PieceResult name="Mate burilado" code="I-0100" location="Depósito 1 › Rack A" onSelect={noop} />);
    const text = visibleText(html);
    expect(text).toContain("Mate burilado");
    expect(text).toContain("I-0100");
    expect(text).toContain("Depósito 1 › Rack A");
    expect(html).toContain("text-gris-texto");
  });

  it("una pieza sin ubicación ni código se indica", () => {
    const text = visibleText(render(<PieceResult name="Tejido" code={null} location={null} onSelect={noop} />));
    expect(text).toContain("Sin código I");
    expect(text).toContain("Sin ubicación");
  });

  it("el resultado elegido queda marcado", () => {
    expect(render(<PieceResult name="A" code="I-1" location="x" active onSelect={noop} />)).toContain('aria-current="true"');
  });
});

describe("DestinationPicker", () => {
  it("lista solo los destinos recibidos con su ruta completa y explica por qué", () => {
    const html = render(<DestinationPicker options={OPTIONS} value="" onChange={noop} />);
    const text = visibleText(html);
    expect(text).toContain("Mover a");
    expect(text).toContain("Buscar destino");
    expect(text).toContain("Sede › Depósito 1 › Rack A › Nivel 1");
    expect(text).toContain("Solo lugares finales");
  });

  it("sin lugares finales remite a Administración", () => {
    const text = visibleText(render(<DestinationPicker options={[]} value="" onChange={noop} />));
    expect(text).toContain("No hay lugares finales disponibles");
    expect(text).toContain("Administración");
  });
});

describe("PiecePanel", () => {
  const panel = (
    <PiecePanel
      name="Retablo ayacuchano"
      code="I-0236"
      location="Sede › Depósito 1"
      href="/piezas/p1"
      onBack={noop}
      verify={<button type="button">Registrar verificación</button>}
      move={<button type="button">Registrar movimiento</button>}
    />
  );

  it("cabecera con nombre y código, ubicación y las dos acciones", () => {
    const text = visibleText(render(panel));
    for (const expected of ["Retablo ayacuchano", "I-0236", "Ubicación actual: Sede › Depósito 1", "Ver ficha completa", "Verificar", "Mover", "Registrar verificación", "Registrar movimiento"]) {
      expect(text).toContain(expected);
    }
  });

  it("«Buscar otra pieza» solo se ve en pantallas angostas", () => {
    const html = render(panel);
    expect(html).toContain("Buscar otra pieza");
    expect(html).toMatch(/lg:hidden/);
  });

  it("las acciones se reparten en dos columnas desde lg", () => {
    expect(render(panel)).toContain("lg:grid-cols-");
  });
});

describe("DepositoLayout", () => {
  const search = <p>Buscador</p>;

  it("en escritorio usa dos columnas y un panel vacío si no hay pieza", () => {
    const html = render(<DepositoLayout title="Vista de depósito" subtitle="Busque" search={search} detail={null} />);
    expect(html).toContain("lg:grid-cols-");
    expect(html).toContain("max-w-6xl");
    expect(visibleText(html)).toContain("Busque una pieza a la izquierda");
  });

  it("con una pieza elegida oculta la búsqueda en celular pero no en escritorio", () => {
    const html = render(<DepositoLayout title="T" subtitle="s" search={search} detail={<p>Panel</p>} />);
    expect(html).toContain("hidden lg:flex");
    expect(visibleText(html)).not.toContain("Busque una pieza a la izquierda");
  });

  it("sin pieza, la búsqueda se ve en todos los tamaños", () => {
    expect(render(<DepositoLayout title="T" subtitle="s" search={search} detail={null} />)).not.toContain("hidden lg:flex");
  });

  it("el panel vacío solo existe en escritorio", () => {
    expect(render(<PieceDetailPlaceholder />)).toContain("hidden");
  });
});
