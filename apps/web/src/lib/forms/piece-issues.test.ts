import { describe, expect, it } from "vitest";

import type { PieceIssue } from "@/lib/data/pieces";

import { EMPTY_PIECE_FORM } from "./piece-form";
import { ALL_FORM_FIELDS, fieldMessages, formFieldFor, groupIssuesByField } from "./piece-issues";

function issue(field: string, severity: "error" | "warning", message = `${severity} en ${field}`): PieceIssue {
  return { field, code: "regla_de_prueba", message, severity } as PieceIssue;
}

describe("ALL_FORM_FIELDS", () => {
  it("coincide con los campos del formulario: un campo nuevo no puede quedar sin reparto de incidencias", () => {
    expect([...ALL_FORM_FIELDS].sort()).toEqual(Object.keys(EMPTY_PIECE_FORM).sort());
  });
});

describe("formFieldFor", () => {
  it.each([
    ["code_i", "code_i"],
    ["denomination", "denomination"],
    ["tenure_regime", "tenure_regime"],
    ["  description  ", "description"],
    ["dimensions_text[0]", "dimensions_text"],
    ["notes.extra", "notes"],
  ])("«%s» apunta al campo %s", (serverField, expected) => {
    expect(formFieldFor(serverField)).toBe(expected);
  });

  it.each(["period.year_from", "identifiers[0].value", "parent_id", "", "campo_inexistente"])(
    "«%s» no corresponde a ningún campo del formulario",
    (serverField) => {
      expect(formFieldFor(serverField)).toBeNull();
    },
  );
});

describe("groupIssuesByField", () => {
  it("reparte errores y avisos en el campo que nombran, conservando el orden", () => {
    const first = issue("code_i", "error", "El código I ya existe.");
    const second = issue("code_i", "warning", "La pieza que lo usa fue eliminada.");
    const third = issue("denomination", "error");

    const grouped = groupIssuesByField([first, second, third]);

    expect(grouped.byField.code_i).toEqual([first, second]);
    expect(grouped.byField.denomination).toEqual([third]);
    expect(grouped.general).toEqual([]);
  });

  it("las incidencias sobre campos que el formulario no tiene van al resumen general", () => {
    const period = issue("period.year_from", "error", "El rango de época no es válido.");
    const nested = issue("identifiers[0].value", "warning");

    const grouped = groupIssuesByField([period, nested]);

    expect(grouped.byField).toEqual({});
    expect(grouped.general).toEqual([period, nested]);
  });

  it("al editar, el código I y el régimen no se muestran: sus incidencias van al resumen general", () => {
    const visibleInEdit = ["denomination", "description", "provenance", "dimensions_text", "notes"] as const;
    const code = issue("code_i", "error", "El código I ya existe.");
    const regime = issue("tenure_regime", "error");
    const name = issue("denomination", "error");

    const grouped = groupIssuesByField([code, regime, name], visibleInEdit);

    expect(grouped.byField).toEqual({ denomination: [name] });
    expect(grouped.general).toEqual([code, regime]);
  });

  it("ninguna incidencia se pierde", () => {
    const all = [issue("code_i", "error"), issue("period.text", "warning"), issue("notes", "warning"), issue("", "error")];

    const grouped = groupIssuesByField(all);

    const placed = Object.values(grouped.byField).flat().length + grouped.general.length;
    expect(placed).toBe(all.length);
  });
});

describe("fieldMessages", () => {
  it("separa los errores (bloquean guardar) de los avisos (no bloquean)", () => {
    const grouped = groupIssuesByField([
      issue("code_i", "error", "Código duplicado."),
      issue("code_i", "warning", "Formato de código no reconocido."),
      issue("code_i", "error", "Código con caracteres inválidos."),
    ]);

    expect(fieldMessages(grouped, "code_i")).toEqual({
      errors: ["Código duplicado.", "Código con caracteres inválidos."],
      warnings: ["Formato de código no reconocido."],
    });
  });

  it("un campo sin incidencias no tiene mensajes", () => {
    const grouped = groupIssuesByField([issue("code_i", "error")]);

    expect(fieldMessages(grouped, "notes")).toEqual({ errors: [], warnings: [] });
  });
});
