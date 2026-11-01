import { describe, expect, it } from "vitest";

import { render, visibleText } from "@/test/render";

import { AdminList, RetireDialog, reasonError, type AdminColumn, type AdminRetired } from "./AdminList";

// Datos sintéticos (RNF-014).
interface Row {
  id: string;
  name: string;
  pieces: number;
}

const ROWS: Row[] = [
  { id: "c1", name: "Colección RA (ficticia)", pieces: 12 },
  { id: "c2", name: "Colección MMZ (ficticia)", pieces: 0 },
];
const COLUMNS: AdminColumn<Row>[] = [
  { header: "Colección", cell: (row) => row.name },
  { header: "Piezas", cell: (row) => row.pieces, align: "right" },
];
const noop = () => {};

function list(props: Partial<Parameters<typeof AdminList<Row, Row>>[0]> = {}) {
  return render(
    <AdminList<Row, Row>
      label="Colecciones"
      items={ROWS}
      columns={COLUMNS}
      rowKey={(row) => row.id}
      rowName={(row) => row.name}
      query=""
      onQueryChange={noop}
      emptyMessage="No hay colecciones con esa búsqueda."
      {...props}
    />,
  );
}

function retired(overrides: Partial<AdminRetired<Row>> = {}): AdminRetired<Row> {
  return {
    toggleLabel: "Ver retiradas",
    shown: true,
    onToggle: noop,
    items: [{ id: "c9", name: "Colección vieja (ficticia)", pieces: 0 }],
    columns: COLUMNS,
    rowKey: (row) => row.id,
    rowName: (row) => row.name,
    emptyMessage: "No hay colecciones retiradas.",
    ...overrides,
  };
}

describe("lista administrable", () => {
  it("muestra el buscador, las columnas y las acciones de cada fila con permiso", () => {
    const html = list({ addLabel: "Nueva colección", onAdd: noop, onEdit: noop, onRetire: noop });
    const text = visibleText(html);
    expect(text).toContain("Buscar");
    expect(text).toContain("Nueva colección");
    expect(text).toContain("Colección RA (ficticia)");
    expect(text).toContain("Acciones");
    expect(html).toContain('aria-label="Editar Colección RA (ficticia)"');
    expect(html).toContain('aria-label="Retirar Colección MMZ (ficticia)"');
  });

  it("sin permiso no hay alta ni acciones por fila", () => {
    const html = list();
    expect(visibleText(html)).not.toContain("Acciones");
    expect(html).not.toContain("Editar ");
    expect(html).not.toContain("<button");
  });

  it("sin filas lo dice", () => {
    expect(visibleText(list({ items: [] }))).toContain("No hay colecciones con esa búsqueda.");
  });

  it("«Ver retiradas» muestra lo retirado y, solo con permiso, «Restaurar»", () => {
    const withRestore = list({ retired: retired({ onRestore: noop }) });
    expect(withRestore).toContain('aria-pressed="true"');
    expect(visibleText(withRestore)).toContain("Colección vieja (ficticia)");
    expect(withRestore).toContain('aria-label="Restaurar Colección vieja (ficticia)"');
    const withoutRestore = list({ retired: retired() });
    expect(withoutRestore).not.toContain("Restaurar Colección vieja");
    expect(visibleText(list({ retired: retired({ items: [] }) }))).toContain("No hay colecciones retiradas.");
    const hidden = list({ retired: retired({ shown: false }) });
    expect(hidden).toContain('aria-pressed="false"');
    expect(visibleText(hidden)).not.toContain("Colección vieja (ficticia)");
  });

  it("se usa con teclado: todos los controles son botones con nombre y el buscador tiene etiqueta", () => {
    const html = list({ onAdd: noop, onEdit: noop, onRetire: noop, retired: retired({ onRestore: noop }) });
    const buttons = html.match(/<button[^>]*>.*?<\/button>/g) ?? [];
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button).toMatch(/^<button[^>]*type="button"/);
      // Sin aria-label, su nombre es el texto visible.
      if (!/^<button[^>]*aria-label=/.test(button)) expect(visibleText(button)).not.toBe("");
    }
    expect(html).toMatch(/<label[^>]*for="[^"]+"[^>]*>Buscar<\/label>/);
  });
});

describe("retirar con motivo", () => {
  it("el motivo es obligatorio y tiene al menos 3 caracteres", () => {
    expect(reasonError("")).not.toBeNull();
    expect(reasonError(" ab ")).not.toBeNull();
    expect(reasonError("Duplicada")).toBeNull();
  });

  it("explica la consecuencia y pide el motivo", () => {
    const text = visibleText(
      render(
        <RetireDialog
          open
          title="Retirar «Colección MMZ (ficticia)»"
          consequence="Deja de ofrecerse en las fichas; se puede restaurar."
          onClose={noop}
          onSubmit={async () => true}
        />,
      ),
    );
    expect(text).toContain("Retirar «Colección MMZ (ficticia)»");
    expect(text).toContain("Deja de ofrecerse en las fichas; se puede restaurar.");
    expect(text).toContain("Motivo (obligatorio)");
  });
});
