import { afterEach, describe, expect, it, vi } from "vitest";

import type { PieceUpdateResult } from "@/lib/data/pieces";
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
  it("en edición muestra los cinco campos editables y Guardar, sin aviso de conflicto ni borrador", () => {
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
