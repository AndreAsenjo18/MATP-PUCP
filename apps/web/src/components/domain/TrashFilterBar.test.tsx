import { describe, expect, it } from "vitest";

import { EMPTY_TRASH_FILTERS } from "@/lib/data/trash";
import { ids } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import { TrashFilterBar } from "./TrashFilterBar";

const PEOPLE = [
  { id: ids.user(1), name: "Administrador MATP (sintético)" },
  { id: ids.user(2), name: "Gabriela Curadora (sintética)" },
];

describe("TrashFilterBar", () => {
  it("ofrece tipo, quién eliminó y rango de fechas con etiquetas visibles", () => {
    const html = render(<TrashFilterBar filters={EMPTY_TRASH_FILTERS} people={PEOPLE} onApply={() => {}} />);
    const text = visibleText(html);

    expect(html).toContain('aria-label="Filtros de la papelera"');
    expect(text).toContain("Tipo de registro");
    expect(text).toContain("Eliminado por");
    expect(text).toContain("Eliminado desde");
    expect(text).toContain("Eliminado hasta");
    expect(html.match(/type="date"/g)).toHaveLength(2);
    expect(text).toContain("Filtrar");
  });

  it("lista los ocho tipos restaurables y las personas conocidas", () => {
    const text = visibleText(render(<TrashFilterBar filters={EMPTY_TRASH_FILTERS} people={PEOPLE} onApply={() => {}} />));

    for (const label of [
      "Pieza",
      "Identificador de pieza",
      "Fotografía o documento",
      "Colección",
      "Término de vocabulario",
      "Vocabulario",
      "Ubicación",
      "Plantilla de mapeo",
    ]) {
      expect(text).toContain(label);
    }
    expect(text).toContain("Todos los tipos");
    expect(text).toContain("Cualquier persona");
    expect(text).toContain("Gabriela Curadora (sintética)");
  });

  it("parte de los filtros aplicados y solo ofrece quitarlos si hay alguno", () => {
    const empty = visibleText(render(<TrashFilterBar filters={EMPTY_TRASH_FILTERS} people={PEOPLE} onApply={() => {}} />));
    const html = render(<TrashFilterBar filters={{ ...EMPTY_TRASH_FILTERS, entityType: "term", from: "2026-10-01" }} people={PEOPLE} onApply={() => {}} />);

    expect(empty).not.toContain("Quitar filtros");
    expect(visibleText(html)).toContain("Quitar filtros");
    expect(html).toContain('value="2026-10-01"');
    expect(html).toMatch(/<option value="term" selected=""/);
  });

  it("mientras carga bloquea los campos", () => {
    const html = render(<TrashFilterBar filters={EMPTY_TRASH_FILTERS} people={PEOPLE} disabled onApply={() => {}} />);

    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(5);
  });
});
