import { Plus, X } from "lucide-react";
import { describe, expect, it } from "vitest";

import { render, visibleText } from "@/test/render";

import { Badge, BADGE_INTENTS, badgeIntentClass } from "./Badge";
import { Button, BUTTON_VARIANTS, buttonClassName } from "./Button";
import { Card, cardClassName } from "./Card";
import { Input } from "./Input";
import { Select } from "./Select";
import { Textarea } from "./Textarea";

describe("Button", () => {
  it.each(Object.entries(BUTTON_VARIANTS))("aplica las clases de la variante %s", (variant, classes) => {
    const html = render(<Button variant={variant as keyof typeof BUTTON_VARIANTS}>Guardar</Button>);
    for (const cls of classes.split(" ")) expect(html).toContain(cls);
    expect(html).toContain('type="button"');
    expect(html).toContain("min-h-11");
  });

  it("usa primary por defecto y acepta className al final", () => {
    const html = render(<Button className="w-full">Nueva pieza</Button>);
    expect(html).toContain("bg-terracota");
    expect(html).toMatch(/w-full"/);
  });

  it("muestra el icono oculto a lectores de pantalla junto al texto", () => {
    const html = render(<Button icon={Plus}>Nueva pieza</Button>);
    expect(html).toContain('<svg');
    expect(html).toContain('aria-hidden="true"');
    expect(visibleText(html)).toBe("Nueva pieza");
  });

  it("acepta botón solo con icono si tiene aria-label", () => {
    const html = render(<Button icon={X} variant="outline" aria-label="Cerrar" />);
    expect(html).toContain('aria-label="Cerrar"');
    // Verificado por `tsc` (npm run typecheck): un botón sin texto ni aria-label no compila.
    // @ts-expect-error aria-label es obligatorio cuando no hay children
    void (<Button icon={X} />);
  });

  it("refleja el estado deshabilitado", () => {
    const html = render(<Button disabled>Aprobar</Button>);
    expect(html).toContain('disabled=""');
    expect(html).toContain("disabled:opacity-50");
  });

  it("buttonClassName recurre a primary/md ante valores desconocidos", () => {
    const cls = buttonClassName({ variant: "rara" as never, size: "xl" as never });
    expect(cls).toContain("bg-terracota");
    expect(cls).toContain("px-4 py-2");
  });

  it("size lg produce una acción grande para depósito", () => {
    expect(render(<Button size="lg">Registrar movimiento</Button>)).toContain("text-lg");
  });
});

describe("Badge", () => {
  it.each(Object.entries(BADGE_INTENTS))("aplica las clases del intent %s", (intent, classes) => {
    const html = render(<Badge intent={intent as keyof typeof BADGE_INTENTS}>Estado</Badge>);
    expect(html).toContain(classes);
    expect(visibleText(html)).toBe("Estado");
  });

  it("un intent desconocido se muestra como default", () => {
    expect(badgeIntentClass("nuevo-estado")).toBe(BADGE_INTENTS.default);
    expect(badgeIntentClass(undefined)).toBe(BADGE_INTENTS.default);
    const html = render(<Badge intent={"otro" as never}>Otro</Badge>);
    expect(html).toContain(BADGE_INTENTS.default);
  });

  it("usa texto de contraste AA para advertencia y peligro", () => {
    expect(BADGE_INTENTS.warning).toContain("text-ambar-texto");
    expect(BADGE_INTENTS.danger).toContain("text-carmin-texto");
  });

  it("usa text-sm y no fuerza mayúsculas", () => {
    const html = render(<Badge>Comodato</Badge>);
    expect(html).toContain("text-sm");
    expect(html).not.toContain("uppercase");
  });
});

describe("Card", () => {
  it("renderiza el elemento pedido con borde y fondo blanco", () => {
    const html = render(
      <Card as="section" aria-label="Resumen">
        Contenido
      </Card>,
    );
    expect(html.startsWith("<section")).toBe(true);
    expect(html).toContain("border-borde");
    expect(html).toContain("bg-white");
    expect(html).toContain('aria-label="Resumen"');
  });

  it("la variante interactiva añade realce", () => {
    expect(cardClassName({ interactive: true })).toContain("hover:border-terracota");
    expect(cardClassName()).not.toContain("hover:");
    expect(cardClassName({ padded: false })).not.toContain("p-4");
  });
});

describe("campos de formulario", () => {
  it("Input asocia la etiqueta visible por id", () => {
    const html = render(<Input id="title" label="Denominación" />);
    expect(html).toContain('<label for="title"');
    expect(html).toContain('id="title"');
    expect(html).not.toContain("aria-invalid");
  });

  it("Input enlaza ayuda y error con aria-describedby y marca aria-invalid", () => {
    const html = render(<Input id="code" label="Código" hint="Ejemplo: I-236" error="Ingrese el código sin espacios." />);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="code-hint code-error"');
    expect(html).toContain('id="code-error"');
    expect(html).toContain("text-carmin-texto");
    expect(html).toContain("border-carmin-peligro");
  });

  it("genera un id si no se indica", () => {
    const html = render(<Input label="Buscar" />);
    const id = /<input id="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`for="${id}"`);
  });

  it("Select y Textarea siguen la misma convención", () => {
    const select = render(
      <Select id="col" label="Colección" error="Elija una colección.">
        <option value="">Todas</option>
      </Select>,
    );
    expect(select).toContain('<label for="col"');
    expect(select).toContain('aria-describedby="col-error"');
    const textarea = render(<Textarea id="obs" label="Observaciones" hint="Opcional" />);
    expect(textarea).toContain('<label for="obs"');
    expect(textarea).toContain('aria-describedby="obs-hint"');
  });
});
