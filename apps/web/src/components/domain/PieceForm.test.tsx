import { afterEach, describe, expect, it, vi } from "vitest";

import { initialPieceCatalogs, type PieceUpdateResult } from "@/lib/data/pieces";
import { draftKey, saveDraft, type DraftStorage } from "@/lib/forms/piece-draft";
import { EMPTY_PIECE_FORM, type PieceFormValues } from "@/lib/forms/piece-form";
import { memoryStorage } from "@/test/memory-storage";
import { render, visibleText } from "@/test/render";

import { PieceForm, outcomeFromUpdate, type PieceFormProps } from "./PieceForm";

const BASE: PieceFormValues = {
  ...EMPTY_PIECE_FORM,
  denomination: "Toro de Pucará",
  description: "Cerámica policroma",
  provenance: "Puno",
  dimensions_text: "20 x 15 cm",
  notes: "",
};
const PIECE_ID = "p-1";
const OPENED_AT = "2026-10-01T08:00:00Z";
const noop = () => {};

const EDIT_PROPS: PieceFormProps = {
  mode: "edit",
  pieceId: PIECE_ID,
  initialValues: BASE,
  draftBase: OPENED_AT,
  onSave: async () => ({ status: "ok", message: "Guardado." }),
  onCancel: noop,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Renderiza con un `sessionStorage` simulado (el entorno de pruebas no tiene `window`). */
function renderWithSession(storage: DraftStorage, props: PieceFormProps): string {
  vi.stubGlobal("window", { sessionStorage: storage });
  try {
    return render(<PieceForm {...props} />);
  } finally {
    vi.unstubAllGlobals();
  }
}

describe("outcomeFromUpdate", () => {
  it("un guardado correcto conserva el mensaje recibido", () => {
    const result: PieceUpdateResult = { status: "ok", piece: {} as never };

    expect(outcomeFromUpdate(result, "Cambios guardados.")).toEqual({ status: "ok", message: "Cambios guardados." });
  });

  it("el 409 edit_conflict llega al formulario como conflict, con el mensaje del servidor", () => {
    const result: PieceUpdateResult = { status: "conflict", message: "Otra persona modificó la pieza." };

    expect(outcomeFromUpdate(result, "Cambios guardados.")).toEqual({ status: "conflict", message: "Otra persona modificó la pieza." });
  });

  it("otros rechazos (incluido otro 409) siguen siendo error, no conflict", () => {
    const immutable: PieceUpdateResult = { status: "rejected", code: "immutable_inventory_code", message: "El código I está bloqueado." };
    const offline: PieceUpdateResult = { status: "unavailable", message: "No se pudo conectar con el servidor." };

    expect(outcomeFromUpdate(immutable, "x")).toEqual({ status: "error", message: "El código I está bloqueado." });
    expect(outcomeFromUpdate(offline, "x")).toEqual({ status: "error", message: "No se pudo conectar con el servidor." });
  });
});

describe("PieceForm: render inicial", () => {
  it("muestra las seis secciones de design D8 en su orden, tanto al editar como al crear", () => {
    const sections = ["Identificación", "Descripción", "Procedencia y época", "Medidas y materiales", "Conservación", "Observaciones"];
    const create: PieceFormProps = { mode: "create", initialValues: EMPTY_PIECE_FORM, onSave: EDIT_PROPS.onSave, onCancel: noop };

    for (const props of [EDIT_PROPS, create]) {
      const html = renderWithSession(memoryStorage(), props);
      const legends = [...html.matchAll(/<legend[^>]*>(.*?)<\/legend>/g)].map((match) => visibleText(match[1] ?? ""));

      expect(legends.filter((legend) => sections.includes(legend))).toEqual(sections);
    }
  });

  it("muestra los campos de cada sección con su etiqueta, incluidos autor, época, materiales y estado de conservación", () => {
    const text = visibleText(renderWithSession(memoryStorage(), EDIT_PROPS));

    for (const label of ["Autor", "Época (texto original)", "Materiales", "Estado de conservación", "Sin registrar"]) {
      expect(text).toContain(label);
    }
  });

  it("ofrece los materiales y estados de conservación del catálogo", () => {
    const html = renderWithSession(memoryStorage(), EDIT_PROPS);
    const text = visibleText(html);

    expect(html).toContain('type="checkbox"');
    for (const label of ["Madera", "Arcilla", "Bueno", "Regular"]) expect(text).toContain(label);
  });

  it("marca los materiales de la pieza y selecciona su estado de conservación", () => {
    const [wood, clay] = initialPieceCatalogs().materials;
    const [good] = initialPieceCatalogs().conservationStates;
    if (!wood || !clay || !good) throw new Error("Faltan términos de catálogo en los fixtures");
    const props: PieceFormProps = {
      ...EDIT_PROPS,
      initialValues: { ...BASE, material_term_ids: [wood.id], conservation_state_id: good.id },
    };

    const html = renderWithSession(memoryStorage(), props);

    expect(html).toMatch(new RegExp(`<input[^>]*value="${wood.id}"[^>]*checked|<input[^>]*checked[^>]*value="${wood.id}"`));
    expect(html).not.toMatch(new RegExp(`<input[^>]*value="${clay.id}"[^>]*checked|<input[^>]*checked[^>]*value="${clay.id}"`));
    expect(html).toMatch(new RegExp(`<option[^>]*value="${good.id}"[^>]*selected|<option[^>]*selected[^>]*value="${good.id}"`));
  });

  it("en edición muestra los campos editables y Guardar, sin aviso de conflicto ni borrador", () => {
    const html = renderWithSession(memoryStorage(), EDIT_PROPS);
    const text = visibleText(html);

    for (const label of ["Denominación", "Descripción", "Procedencia", "Medidas (texto original)", "Observaciones"]) {
      expect(text).toContain(label);
    }
    expect(text).toContain("Guardar cambios");
    expect(text).not.toContain("Código I (opcional)");
    expect(text).not.toContain("Ver cambios del otro usuario");
    expect(text).not.toContain("Se recuperó un borrador");
    expect(html).toContain('value="Toro de Pucará"');
  });

  it("en alta muestra además régimen y código I", () => {
    const props: PieceFormProps = { mode: "create", initialValues: EMPTY_PIECE_FORM, onSave: EDIT_PROPS.onSave, onCancel: noop };

    const text = visibleText(renderWithSession(memoryStorage(), props));

    expect(text).toContain("Registrar pieza");
    expect(text).toContain("Régimen de tenencia");
    expect(text).toContain("Código I (opcional)");
  });
});

describe("PieceForm: campos de catalogación y tenencia", () => {
  const CREATE_PROPS: PieceFormProps = { mode: "create", initialValues: EMPTY_PIECE_FORM, onSave: EDIT_PROPS.onSave, onCancel: noop };
  const COMODATO: PieceFormValues = { ...BASE, tenure_regime: "Comodato", lender_name: "Familia Bermúdez", loan_agreement_ref: "Conv. 2024-03" };

  it("al editar y al crear permite capturar colección, categoría, tipo de bien, disponibilidad, adquisición y fecha de ingreso", () => {
    for (const props of [EDIT_PROPS, CREATE_PROPS]) {
      const text = visibleText(renderWithSession(memoryStorage(), props));

      for (const label of ["Colección", "Categoría", "Tipo de bien", "Disponibilidad", "Forma de adquisición", "Fecha de ingreso"]) {
        expect(text).toContain(label);
      }
    }
  });

  it("ofrece las opciones del catálogo y marca las de la pieza", () => {
    const catalogs = initialPieceCatalogs();
    const [collection] = catalogs.collections;
    const [category] = catalogs.categories;
    const [availability] = catalogs.availabilities;
    const [acquisition] = catalogs.acquisitionMethods;
    if (!collection || !category || !availability || !acquisition) throw new Error("Faltan catálogos en los fixtures");
    const props: PieceFormProps = {
      ...EDIT_PROPS,
      initialValues: {
        ...BASE,
        collection_id: collection.id,
        category_id: category.id,
        availability_term_id: availability.id,
        acquisition_method_term_id: acquisition.id,
        entry_date: "1998-05-12",
      },
    };

    const html = renderWithSession(memoryStorage(), props);
    const text = visibleText(html);

    for (const option of [collection, category, availability, acquisition]) {
      expect(text).toContain(option.label);
      expect(html).toMatch(new RegExp(`<option[^>]*value="${option.id}"[^>]*selected|<option[^>]*selected[^>]*value="${option.id}"`));
    }
    expect(html).toMatch(/<input[^>]*type="date"[^>]*value="1998-05-12"|<input[^>]*value="1998-05-12"[^>]*type="date"/);
  });

  it("conserva como opción un valor de la ficha que aún no está en el catálogo cargado", () => {
    const props: PieceFormProps = { ...EDIT_PROPS, initialValues: { ...BASE, category_id: "id-que-no-esta-en-la-lista" } };

    const html = renderWithSession(memoryStorage(), props);

    expect(visibleText(html)).toContain("Valor actual de la ficha");
    expect(html).toMatch(/<option[^>]*value="id-que-no-esta-en-la-lista"/);
  });

  it("al editar muestra el régimen y el propietario legal como datos de solo lectura", () => {
    const html = renderWithSession(memoryStorage(), { ...EDIT_PROPS, legalOwner: "Familia Bermúdez" });
    const text = visibleText(html);

    expect(text).toContain("Régimen de tenencia");
    expect(text).toContain("Propiedad");
    expect(text).toContain("Propietario legal");
    expect(text).toContain("Familia Bermúdez");
    expect(html).not.toMatch(/<select[^>]*id="tenure_regime"/);
    expect(html).not.toMatch(/<(input|select|textarea)[^>]*name="legal_owner"/);
  });

  it("el propietario legal sin dato se muestra como PUCP, igual que en la ficha", () => {
    expect(visibleText(renderWithSession(memoryStorage(), EDIT_PROPS))).toContain("PUCP");
  });

  it("al crear el régimen sí es editable y no hay propietario legal", () => {
    const html = renderWithSession(memoryStorage(), CREATE_PROPS);

    expect(html).toMatch(/<select[^>]*id="tenure_regime"/);
    expect(visibleText(html)).not.toContain("Propietario legal");
  });

  it("comodante y convenio solo aparecen con régimen Comodato", () => {
    const owned = visibleText(renderWithSession(memoryStorage(), EDIT_PROPS));
    const loan = renderWithSession(memoryStorage(), { ...EDIT_PROPS, initialValues: COMODATO });

    expect(owned).not.toContain("Comodante");
    expect(owned).not.toContain("Convenio de comodato");
    expect(visibleText(loan)).toContain("Comodante");
    expect(visibleText(loan)).toContain("Convenio de comodato");
    expect(loan).toContain('value="Familia Bermúdez"');
    expect(loan).toContain('value="Conv. 2024-03"');
  });

  it("si el rol no puede ver los datos del comodato, no se muestran ni se editan", () => {
    const masked = { ...EDIT_PROPS, initialValues: { ...COMODATO, lender_name: "", loan_agreement_ref: "" } };

    const both = visibleText(renderWithSession(memoryStorage(), { ...masked, maskedFields: ["lender_name", "loan_agreement_ref"] }));
    const onlyAgreement = visibleText(renderWithSession(memoryStorage(), { ...masked, maskedFields: ["loan_agreement_ref"] }));

    expect(both).not.toContain("Comodante");
    expect(both).not.toContain("Convenio de comodato");
    expect(onlyAgreement).toContain("Comodante");
    expect(onlyAgreement).not.toContain("Convenio de comodato");
  });

  it("no ofrece campos derivados ni de otros changes (registrado por, ubicación, fotos, número temporal)", () => {
    for (const props of [EDIT_PROPS, CREATE_PROPS]) {
      const text = visibleText(renderWithSession(memoryStorage(), props));

      for (const label of ["Registrado por", "Ubicación", "Fotograf", "Número de inventario temporal"]) {
        expect(text).not.toContain(label);
      }
    }
  });
});

describe("PieceForm: recuperación del borrador", () => {
  it("recupera el borrador de la pieza y avisa de que no está guardado", () => {
    const storage = memoryStorage();
    saveDraft(draftKey({ kind: "edit", pieceId: PIECE_ID }), { ...BASE, denomination: "Toro de Pucará (borrador)" }, OPENED_AT, storage);

    const html = renderWithSession(storage, EDIT_PROPS);

    expect(visibleText(html)).toContain("Se recuperó un borrador sin guardar");
    expect(visibleText(html)).toContain("Descartar borrador");
    expect(html).toContain('value="Toro de Pucará (borrador)"');
    expect(visibleText(html)).not.toContain("La ficha cambió después de escribirlo");
  });

  it("avisa si la ficha cambió después de escribir el borrador (la marca updated_at ya no coincide)", () => {
    const storage = memoryStorage();
    saveDraft(draftKey({ kind: "edit", pieceId: PIECE_ID }), { ...BASE, notes: "Mi nota" }, "2026-09-01T00:00:00Z", storage);

    const text = visibleText(renderWithSession(storage, EDIT_PROPS));

    expect(text).toContain("La ficha cambió después de escribirlo");
  });

  it("ignora un borrador idéntico a los valores de partida", () => {
    const storage = memoryStorage();
    saveDraft(draftKey({ kind: "edit", pieceId: PIECE_ID }), BASE, OPENED_AT, storage);

    expect(visibleText(renderWithSession(storage, EDIT_PROPS))).not.toContain("Se recuperó un borrador");
  });

  it("el borrador de otra pieza no se mezcla", () => {
    const storage = memoryStorage();
    saveDraft(draftKey({ kind: "edit", pieceId: "otra-pieza" }), { ...BASE, notes: "Nota ajena" }, OPENED_AT, storage);

    expect(visibleText(renderWithSession(storage, EDIT_PROPS))).not.toContain("Se recuperó un borrador");
  });
});
