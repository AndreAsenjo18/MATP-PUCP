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
      collection_id: "col-1",
      category_id: "cat-1",
      object_type_term_id: "ot-1",
      availability_term_id: "av-1",
      lender_name: "L",
      loan_agreement_ref: "R",
      description: "B",
      author: "C",
      provenance: "D",
      period_text: "E",
      acquisition_method_term_id: "aq-1",
      entry_date: "1998-05-12",
      dimensions_text: "F",
      material_term_ids: ["m-1"],
      conservation_state_id: "c-1",
      notes: "G",
    };

    const changes = computeConflictChanges(BASE, BASE, theirs);

    expect(changes.map((change) => change.field)).toEqual(CONFLICT_FIELDS.map(({ field }) => field));
    expect(changes.map((change) => change.label)).toEqual(CONFLICT_FIELDS.map(({ label }) => label));
  });

  it("cubre todos los campos que el editor permite modificar (el régimen y el código I no)", () => {
    const covered = CONFLICT_FIELDS.map(({ field }) => field as string).sort();
    const editable = Object.keys(EMPTY_PIECE_FORM)
      .filter((field) => field !== "tenure_regime" && field !== "code_i")
      .sort();

    expect(covered).toEqual(editable);
  });

  it("muestra por su etiqueta los campos de lista (colección, categoría, tipo de bien, disponibilidad, adquisición)", () => {
    const catalogs = {
      collections: [{ id: "col-1", label: "Colección MMZ" }],
      categories: [{ id: "cat-1", label: "Retablo" }],
      objectTypes: [{ id: "ot-1", label: "Bien mueble" }],
      availabilities: [{ id: "av-1", label: "En sala" }],
      acquisitionMethods: [{ id: "aq-1", label: "Donación" }],
    };
    const theirs: PieceFormValues = {
      ...BASE,
      collection_id: "col-1",
      category_id: "cat-1",
      object_type_term_id: "ot-1",
      availability_term_id: "av-1",
      acquisition_method_term_id: "aq-1",
      entry_date: "1998-05-12",
    };

    expect(computeConflictChanges(BASE, BASE, theirs, catalogs)).toEqual([
      { field: "collection_id", label: "Colección", mine: "", theirs: "Colección MMZ" },
      { field: "category_id", label: "Categoría", mine: "", theirs: "Retablo" },
      { field: "object_type_term_id", label: "Tipo de bien", mine: "", theirs: "Bien mueble" },
      { field: "availability_term_id", label: "Disponibilidad", mine: "", theirs: "En sala" },
      { field: "acquisition_method_term_id", label: "Forma de adquisición", mine: "", theirs: "Donación" },
      { field: "entry_date", label: "Fecha de ingreso", mine: "", theirs: "1998-05-12" },
    ]);
  });

  it("muestra materiales y estado de conservación por su etiqueta cuando hay catálogos", () => {
    const catalogs = {
      materials: [
        { id: "m-1", label: "Madera" },
        { id: "m-2", label: "Arcilla" },
      ],
      conservationStates: [
        { id: "c-1", label: "Bueno" },
        { id: "c-2", label: "Regular" },
      ],
    };
    const mine = { ...BASE, material_term_ids: ["m-1"], conservation_state_id: "c-1" };
    const theirs = { ...BASE, material_term_ids: ["m-2", "m-1"], conservation_state_id: "c-2" };

    expect(computeConflictChanges(BASE, mine, theirs, catalogs)).toEqual([
      { field: "material_term_ids", label: "Materiales", mine: "Madera", theirs: "Arcilla, Madera" },
      { field: "conservation_state_id", label: "Estado de conservación", mine: "Bueno", theirs: "Regular" },
    ]);
  });

  it("la lista de materiales no cuenta como cambio si solo difiere el orden", () => {
    const base = { ...BASE, material_term_ids: ["m-1", "m-2"] };
    const theirs = { ...BASE, material_term_ids: ["m-2", "m-1"] };

    expect(computeConflictChanges(base, base, theirs)).toEqual([]);
  });

  it("sin catálogos muestra el id en lugar de fallar", () => {
    const theirs = { ...BASE, conservation_state_id: "c-9" };

    expect(computeConflictChanges(BASE, BASE, theirs)).toEqual([
      { field: "conservation_state_id", label: "Estado de conservación", mine: "", theirs: "c-9" },
    ]);
  });
});
