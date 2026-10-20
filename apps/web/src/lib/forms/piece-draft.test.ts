import { afterEach, describe, expect, it, vi } from "vitest";

import { memoryStorage } from "@/test/memory-storage";

import { DRAFT_VERSION, clearDraft, draftKey, loadDraft, sameFormValues, saveDraft, type DraftStorage } from "./piece-draft";
import { EMPTY_PIECE_FORM, type PieceFormValues } from "./piece-form";

const VALUES: PieceFormValues = {
  ...EMPTY_PIECE_FORM,
  denomination: "Toro de Pucará",
  description: "Cerámica policroma",
  notes: "Revisar la base",
};
const NOW = new Date("2026-10-19T15:30:00.000Z");
const KEY = draftKey({ kind: "edit", pieceId: "p-1" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("draftKey", () => {
  it("separa el borrador de un alta del de cada pieza en edición", () => {
    expect(draftKey({ kind: "new" })).toBe("matp:borrador-pieza:nueva");
    expect(draftKey({ kind: "edit", pieceId: "p-1" })).toBe("matp:borrador-pieza:p-1");
    expect(draftKey({ kind: "edit", pieceId: "p-2" })).not.toBe(draftKey({ kind: "edit", pieceId: "p-1" }));
  });
});

describe("saveDraft y loadDraft", () => {
  it("recupera los valores, la fecha y la marca de la ficha sobre la que se escribió", () => {
    const storage = memoryStorage();

    expect(saveDraft(KEY, VALUES, "2026-10-01T08:00:00Z", storage, NOW)).toBe(true);

    expect(loadDraft(KEY, storage)).toEqual({ savedAt: NOW.toISOString(), base: "2026-10-01T08:00:00Z", values: VALUES });
  });

  it("solo guarda versión, fecha, base y los siete campos del formulario", () => {
    const storage = memoryStorage();

    saveDraft(KEY, VALUES, null, storage, NOW);

    const raw = JSON.parse(storage.getItem(KEY) ?? "{}") as Record<string, unknown>;
    expect(Object.keys(raw).sort()).toEqual(["base", "savedAt", "v", "values"]);
    expect(raw.v).toBe(DRAFT_VERSION);
    expect(Object.keys(raw.values as object).sort()).toEqual(Object.keys(EMPTY_PIECE_FORM).sort());
    expect(storage.keys()).toEqual([KEY]);
  });

  it("en un alta la base es null", () => {
    const storage = memoryStorage();
    const key = draftKey({ kind: "new" });

    saveDraft(key, VALUES, null, storage, NOW);

    expect(loadDraft(key, storage)?.base).toBeNull();
  });

  it("acepta un borrador con la denominación todavía vacía", () => {
    const storage = memoryStorage();
    const values = { ...VALUES, denomination: "" };

    saveDraft(KEY, values, null, storage, NOW);

    expect(loadDraft(KEY, storage)?.values).toEqual(values);
  });

  it("el último guardado de una misma clave reemplaza al anterior", () => {
    const storage = memoryStorage();

    saveDraft(KEY, VALUES, null, storage, NOW);
    saveDraft(KEY, { ...VALUES, notes: "Otra nota" }, null, storage, NOW);

    expect(loadDraft(KEY, storage)?.values.notes).toBe("Otra nota");
    expect(storage.keys()).toHaveLength(1);
  });

  it("devuelve null si no hay borrador", () => {
    expect(loadDraft(KEY, memoryStorage())).toBeNull();
  });
});

describe("clearDraft", () => {
  it("borra solo el borrador indicado", () => {
    const storage = memoryStorage();
    const other = draftKey({ kind: "edit", pieceId: "p-2" });
    saveDraft(KEY, VALUES, null, storage, NOW);
    saveDraft(other, VALUES, null, storage, NOW);

    clearDraft(KEY, storage);

    expect(loadDraft(KEY, storage)).toBeNull();
    expect(loadDraft(other, storage)).not.toBeNull();
  });
});

describe("borradores ilegibles", () => {
  it.each([
    ["JSON corrupto", "{no es json"],
    ["otra versión", JSON.stringify({ v: DRAFT_VERSION + 1, savedAt: "x", base: null, values: VALUES })],
    ["régimen inválido", JSON.stringify({ v: DRAFT_VERSION, savedAt: "x", base: null, values: { ...VALUES, tenure_regime: "Otro" } })],
    ["sin valores", JSON.stringify({ v: DRAFT_VERSION, savedAt: "x", base: null })],
  ])("se ignoran sin romper el formulario: %s", (_name, raw) => {
    const storage = memoryStorage();
    storage.setItem(KEY, raw);

    expect(loadDraft(KEY, storage)).toBeNull();
  });
});

describe("sin almacenamiento utilizable", () => {
  it("con storage null no guarda, no lee y no falla al borrar", () => {
    expect(saveDraft(KEY, VALUES, null, null, NOW)).toBe(false);
    expect(loadDraft(KEY, null)).toBeNull();
    expect(() => clearDraft(KEY, null)).not.toThrow();
  });

  it("si el almacenamiento lanza (cuota llena o acceso bloqueado), devuelve false o null", () => {
    const broken: DraftStorage = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("cuota llena");
      },
      removeItem: () => {
        throw new Error("bloqueado");
      },
    };

    expect(saveDraft(KEY, VALUES, null, broken, NOW)).toBe(false);
    expect(loadDraft(KEY, broken)).toBeNull();
    expect(() => clearDraft(KEY, broken)).not.toThrow();
  });
});

describe("almacenamiento por defecto (window.sessionStorage)", () => {
  it("fuera del navegador (sin window) no hay borrador", () => {
    expect(saveDraft(KEY, VALUES, null)).toBe(false);
    expect(loadDraft(KEY)).toBeNull();
  });

  it("en el navegador usa sessionStorage", () => {
    const storage = memoryStorage();
    vi.stubGlobal("window", { sessionStorage: storage });

    expect(saveDraft(KEY, VALUES, null)).toBe(true);

    expect(storage.keys()).toEqual([KEY]);
    expect(loadDraft(KEY)?.values).toEqual(VALUES);
  });

  it("si leer window.sessionStorage lanza, se trata como sin almacenamiento", () => {
    vi.stubGlobal("window", {
      get sessionStorage(): Storage {
        throw new DOMException("Acceso denegado", "SecurityError");
      },
    });

    expect(saveDraft(KEY, VALUES, null)).toBe(false);
    expect(loadDraft(KEY)).toBeNull();
  });
});

describe("sameFormValues", () => {
  it("compara los siete campos", () => {
    expect(sameFormValues(VALUES, { ...VALUES })).toBe(true);
    expect(sameFormValues(VALUES, { ...VALUES, notes: "otra" })).toBe(false);
    expect(sameFormValues(VALUES, { ...VALUES, tenure_regime: "Comodato" })).toBe(false);
  });
});
