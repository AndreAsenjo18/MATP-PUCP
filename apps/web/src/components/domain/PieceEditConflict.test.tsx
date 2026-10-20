import { describe, expect, it } from "vitest";

import { EMPTY_PIECE_FORM, type PieceFormValues } from "@/lib/forms/piece-form";
import { render, visibleText } from "@/test/render";

import { CONFLICT_FIELDS, PieceEditConflict, computeConflictChanges, type ConflictChange } from "./PieceEditConflict";

const BASE: PieceFormValues = {
  ...EMPTY_PIECE_FORM,
  denomination: "Toro de Pucará",
  description: "Cerámica policroma",
  provenance: "Puno",
  dimensions_text: "20 x 15 cm",
  notes: "",
};
const MESSAGE = "La pieza fue modificada por otra persona mientras usted la editaba.";
const noop = () => {};

const CHANGES: ConflictChange[] = [
  { field: "denomination", label: "Denominación", mine: "Toro de Pucará (revisado)", theirs: "Toro de Pucará, siglo XX" },
  { field: "notes", label: "Observaciones", mine: "Revisar la base", theirs: "" },
];

describe("PieceEditConflict: aviso", () => {
  it("anuncia el conflicto como alerta y muestra el mensaje del servidor", () => {
    const html = render(<PieceEditConflict message={MESSAGE} changes={null} open={false} onViewChanges={noop} />);
    const text = visibleText(html);

    expect(html).toContain('role="alert"');
    expect(text).toContain("Otra persona modificó esta pieza");
    expect(text).toContain(MESSAGE);
    expect(text).toContain("Sus cambios no se perdieron");
  });

  it("ofrece siempre, visible, la opción «Ver cambios del otro usuario»", () => {
    const html = render(<PieceEditConflict message={MESSAGE} changes={null} open={false} onViewChanges={noop} />);

    expect(visibleText(html)).toContain("Ver cambios del otro usuario");
    expect(html).toMatch(/<button[^>]*type="button"/);
    expect(html).toMatch(/<button[^>]*aria-expanded="false"/);
    // `disabled=""` es el atributo; las clases `disabled:...` de Tailwind no cuentan.
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
  });

  it("antes de abrirlo no muestra la tabla ni el aviso de «sin diferencias»", () => {
    const html = render(<PieceEditConflict message={MESSAGE} changes={null} open={false} onViewChanges={noop} />);

    expect(html).not.toContain("<table");
    expect(visibleText(html)).not.toContain("No hay diferencias");
  });

  it("abierto pero sin cambios cargados todavía no muestra nada del detalle", () => {
    const html = render(<PieceEditConflict message={MESSAGE} changes={null} open={true} onViewChanges={noop} />);

    expect(html).not.toContain("<table");
    expect(visibleText(html)).not.toContain("No hay diferencias");
  });
});

describe("PieceEditConflict: carga de la versión del otro usuario", () => {
  it("mientras carga, deshabilita el botón e informa el estado", () => {
    const html = render(<PieceEditConflict message={MESSAGE} changes={null} open={false} loading onViewChanges={noop} />);

    expect(html).toMatch(/<button[^>]*\sdisabled=""/);
    expect(html).toContain('role="status"');
    expect(visibleText(html)).toContain("Cargando la versión actual…");
  });

  it("si la carga falla, muestra el motivo y mantiene el botón disponible para reintentar", () => {
    const loadError = "No se pudo cargar la versión actual de la pieza. Recargue la página e intente de nuevo.";
    const html = render(<PieceEditConflict message={MESSAGE} changes={null} open={false} loadError={loadError} onViewChanges={noop} />);

    expect(visibleText(html)).toContain(loadError);
    expect(visibleText(html)).toContain("Ver cambios del otro usuario");
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
  });
});

describe("PieceEditConflict: detalle de cambios", () => {
  it("abierto, compara la versión de la persona con la del otro usuario, campo por campo", () => {
    const html = render(<PieceEditConflict message={MESSAGE} changes={CHANGES} open={true} onViewChanges={noop} />);
    const text = visibleText(html);

    expect(html).toMatch(/<button[^>]*aria-expanded="true"/);
    expect(html).toContain("<table");
    for (const header of ["Campo", "Su versión", "Versión del otro usuario"]) expect(text).toContain(header);
    expect(text).toContain("Denominación");
    expect(text).toContain("Toro de Pucará (revisado)");
    expect(text).toContain("Toro de Pucará, siglo XX");
    expect(text).toContain("Observaciones");
    expect(text).toContain("Revisar la base");
  });

  it("un valor vacío se muestra como «(vacío)»", () => {
    const html = render(<PieceEditConflict message={MESSAGE} changes={CHANGES} open={true} onViewChanges={noop} />);

    expect(visibleText(html)).toContain("(vacío)");
  });

  it("si el otro usuario no cambió campos del editor, lo dice en lugar de mostrar una tabla vacía", () => {
    const html = render(<PieceEditConflict message={MESSAGE} changes={[]} open={true} onViewChanges={noop} />);

    expect(html).not.toContain("<table");
    expect(visibleText(html)).toContain("No hay diferencias en los campos que usted edita");
  });

  it("escapa el texto escrito por la otra persona", () => {
    const hostile: ConflictChange[] = [{ field: "notes", label: "Observaciones", mine: "ok", theirs: "<b>negrita</b>" }];

    const html = render(<PieceEditConflict message={MESSAGE} changes={hostile} open={true} onViewChanges={noop} />);

    expect(html).not.toContain("<b>negrita</b>");
    expect(html).toContain("&lt;b&gt;negrita&lt;/b&gt;");
  });
});

describe("computeConflictChanges", () => {
  it("lista los campos que el otro usuario cambió respecto de la ficha tal como se abrió", () => {
    const mine = { ...BASE, denomination: "Toro de Pucará (revisado)" };
    const theirs = { ...BASE, denomination: "Toro de Pucará, siglo XX", notes: "Pieza restaurada en 2026" };

    expect(computeConflictChanges(BASE, mine, theirs)).toEqual([
      { field: "denomination", label: "Denominación", mine: "Toro de Pucará (revisado)", theirs: "Toro de Pucará, siglo XX" },
      { field: "notes", label: "Observaciones", mine: "", theirs: "Pieza restaurada en 2026" },
    ]);
  });

  it("un campo que solo cambió esta persona no es un cambio del otro usuario", () => {
    const mine = { ...BASE, provenance: "Cusco" };

    expect(computeConflictChanges(BASE, mine, BASE)).toEqual([]);
  });

  it("si el servidor no cambió nada de lo que el editor muestra, no hay diferencias", () => {
    expect(computeConflictChanges(BASE, BASE, { ...BASE })).toEqual([]);
  });

  it("ignora el régimen de tenencia y el código I, que este editor no modifica", () => {
    const theirs = { ...BASE, tenure_regime: "Comodato" as const, code_i: "I-0236" };

    expect(computeConflictChanges(BASE, BASE, theirs)).toEqual([]);
  });

  it("mantiene el orden y las etiquetas de los campos del editor", () => {
    const theirs: PieceFormValues = {
      ...BASE,
      denomination: "A",
      description: "B",
      provenance: "C",
      dimensions_text: "D",
      notes: "E",
    };

    const changes = computeConflictChanges(BASE, BASE, theirs);

    expect(changes.map((change) => change.field)).toEqual(CONFLICT_FIELDS.map(({ field }) => field));
    expect(changes.map((change) => change.label)).toEqual(CONFLICT_FIELDS.map(({ label }) => label));
  });
});
