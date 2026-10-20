import { describe, expect, it } from "vitest";

import { render, visibleText } from "@/test/render";

import {
  CORRECTION_CODE_REQUIRED,
  CORRECTION_CODE_UNCHANGED,
  CORRECTION_REASON_REQUIRED,
  ConcatenatedCodesDialog,
  DELETE_REASON_REQUIRED,
  InventoryCodeCorrectionDialog,
  PieceDeleteDialog,
  PieceRestoreDialog,
  comparableCode,
  splitConfirmLabel,
  toDialogOutcome,
  validateCorrection,
  validateDeleteReason,
  type SplitProposalItem,
} from "./PieceActionDialogs";

const noop = async () => ({ ok: true as const });
/** Diálogo cerrado: el elemento `<dialog>` no lleva el atributo `open`. */
const closedDialog = /<dialog(?![^>]*\sopen)[^>]*>/;
/** `required=""` es el atributo; las clases de Tailwind no cuentan. */
const requiredTextarea = /<textarea[^>]*\srequired=""/;
const disabledButton = /<button[^>]*\sdisabled=""/;

const PROPOSALS: SplitProposalItem[] = [
  { identifier_type_code: "I", original_value: "I 2362", normalized_value: "I-2362" },
  { identifier_type_code: "RA", original_value: "RA 28", normalized_value: null },
];

describe("reglas puras de los diálogos", () => {
  it("el motivo de eliminación es obligatorio y los espacios no cuentan", () => {
    expect(validateDeleteReason("")).toBe(DELETE_REASON_REQUIRED);
    expect(validateDeleteReason("   \n ")).toBe(DELETE_REASON_REQUIRED);
    expect(validateDeleteReason("Pieza duplicada por error de digitación")).toBeNull();
  });

  it("la corrección exige código nuevo y motivo", () => {
    expect(validateCorrection({ currentCode: "I-0236", newValue: "", reason: "" })).toEqual({
      newValue: CORRECTION_CODE_REQUIRED,
      reason: CORRECTION_REASON_REQUIRED,
    });
    expect(validateCorrection({ currentCode: "I-0236", newValue: "I-0237", reason: "  " })).toEqual({ reason: CORRECTION_REASON_REQUIRED });
    expect(validateCorrection({ currentCode: "I-0236", newValue: "I-0237", reason: "Error de transcripción" })).toEqual({});
  });

  it("la corrección rechaza un código igual al actual, sin distinguir mayúsculas ni espacios", () => {
    expect(validateCorrection({ currentCode: "I-0236", newValue: "  i-0236 ", reason: "x" })).toEqual({ newValue: CORRECTION_CODE_UNCHANGED });
    expect(comparableCode("  i   0236 ")).toBe("I 0236");
  });

  it("toDialogOutcome pasa el mensaje del servidor y usa uno genérico si falta", () => {
    expect(toDialogOutcome({ status: "ok" })).toEqual({ ok: true });
    expect(toDialogOutcome({ status: "rejected", message: "El código I ya pertenece a otra pieza." })).toEqual({
      ok: false,
      message: "El código I ya pertenece a otra pieza.",
    });
    expect(toDialogOutcome({ status: "unavailable" })).toEqual({ ok: false, message: expect.stringMatching(/No se pudo completar/) });
  });

  it("el botón de separación cuenta los códigos", () => {
    expect(splitConfirmLabel(2)).toBe("Registrar 2 códigos por separado");
    expect(splitConfirmLabel(1)).toBe("Registrar 1 código");
  });
});

describe("PieceDeleteDialog", () => {
  it("pide un motivo obligatorio y deja claro que la eliminación es lógica", () => {
    const html = render(<PieceDeleteDialog pieceName="Toro de Pucará" open={false} onClose={() => {}} onDelete={noop} />);
    const text = visibleText(html);

    expect(html).toMatch(closedDialog);
    expect(text).toContain("Eliminar pieza");
    expect(text).toContain("Toro de Pucará");
    expect(text).toContain("No se borra de forma definitiva");
    expect(text).toContain("Motivo de la eliminación (obligatorio)");
    expect(html).toMatch(requiredTextarea);
  });

  it("el botón que confirma usa la variante de peligro y no está deshabilitado al abrir", () => {
    const html = render(<PieceDeleteDialog pieceName="Toro de Pucará" open={false} onClose={() => {}} onDelete={noop} />);

    expect(html).toContain("bg-carmin-peligro");
    expect(html).toContain('type="submit"');
    expect(html).not.toMatch(disabledButton);
  });

  it("no muestra errores ni avisos hasta que se intenta enviar", () => {
    const html = render(<PieceDeleteDialog pieceName="Toro de Pucará" open={false} onClose={() => {}} onDelete={noop} />);

    expect(visibleText(html)).not.toContain(DELETE_REASON_REQUIRED);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('role="status"');
  });

  it("escapa el nombre de la pieza", () => {
    const html = render(<PieceDeleteDialog pieceName="<b>Toro</b>" open={false} onClose={() => {}} onDelete={noop} />);

    expect(html).not.toContain("<b>Toro</b>");
    expect(html).toContain("&lt;b&gt;Toro&lt;/b&gt;");
  });
});

describe("PieceRestoreDialog", () => {
  it("explica el efecto, avisa del conflicto por código I y deja el motivo opcional", () => {
    const html = render(<PieceRestoreDialog pieceName="Toro de Pucará" open={false} onClose={() => {}} onRestore={noop} />);
    const text = visibleText(html);

    expect(html).toMatch(closedDialog);
    expect(text).toContain("Restaurar pieza");
    expect(text).toContain("Toro de Pucará");
    expect(text).toContain("ya lo usa otra pieza activa");
    expect(text).toContain("Motivo (opcional)");
    expect(html).not.toMatch(/<textarea[^>]*\srequired/);
    expect(html).not.toContain("bg-carmin-peligro");
  });
});

describe("InventoryCodeCorrectionDialog", () => {
  it("muestra el código actual y exige código nuevo y motivo", () => {
    const html = render(
      <InventoryCodeCorrectionDialog pieceName="Toro de Pucará" currentCode="I-0236" open={false} onClose={() => {}} onCorrect={noop} />,
    );
    const text = visibleText(html);

    expect(html).toMatch(closedDialog);
    expect(text).toContain("Corregir el código I");
    expect(text).toContain("I-0236");
    expect(text).toContain("Toro de Pucará");
    expect(text).toContain("queda en el historial como no vigente");
    expect(text).toContain("Código I nuevo (obligatorio)");
    expect(text).toContain("Motivo de la corrección (obligatorio)");
    expect(html).toMatch(requiredTextarea);
    expect(html).toContain("bg-carmin-peligro");
  });

  it("no muestra errores hasta que se intenta enviar", () => {
    const html = render(
      <InventoryCodeCorrectionDialog pieceName="Toro de Pucará" currentCode="I-0236" open={false} onClose={() => {}} onCorrect={noop} />,
    );
    const text = visibleText(html);

    expect(text).not.toContain(CORRECTION_CODE_REQUIRED);
    expect(text).not.toContain(CORRECTION_REASON_REQUIRED);
    expect(html).not.toContain('role="alert"');
  });
});

describe("ConcatenatedCodesDialog", () => {
  it("lista cada código propuesto y pide confirmación explícita antes de separar", () => {
    const html = render(<ConcatenatedCodesDialog originalValue="I 2362 / RA 28" proposals={PROPOSALS} open={false} onClose={() => {}} onConfirm={noop} />);
    const text = visibleText(html);

    expect(html).toMatch(closedDialog);
    expect(text).toContain("Confirmar separación de códigos");
    expect(text).toContain("I 2362 / RA 28");
    expect(text).toContain("no los separa solo");
    expect(text).toContain("I 2362");
    expect(text).toContain("I-2362");
    expect(text).toContain("RA 28");
    expect(text).toContain("Registrar 2 códigos por separado");
    expect(text).toContain("No separar, volver a editar");
    expect(html).toContain('aria-label="Códigos propuestos"');
    expect(html.match(/<li/g)).toHaveLength(2);
    expect(html).not.toMatch(disabledButton);
  });

  it("un código que el servidor no pudo normalizar se muestra como tal", () => {
    const html = render(<ConcatenatedCodesDialog originalValue="I 2362 / RA 28" proposals={PROPOSALS} open={false} onClose={() => {}} onConfirm={noop} />);

    expect(visibleText(html)).toContain("No normalizable");
  });

  it("sin propuestas no se puede confirmar", () => {
    const html = render(<ConcatenatedCodesDialog originalValue="I 2362" proposals={[]} open={false} onClose={() => {}} onConfirm={noop} />);

    expect(visibleText(html)).toContain("El servidor no propuso ninguna separación.");
    expect(html).toMatch(disabledButton);
  });

  it("escapa los códigos escritos por la persona", () => {
    const hostile: SplitProposalItem[] = [{ identifier_type_code: "I", original_value: "<i>I 1</i>", normalized_value: null }];
    const html = render(<ConcatenatedCodesDialog originalValue="<i>I 1</i>" proposals={hostile} open={false} onClose={() => {}} onConfirm={noop} />);

    expect(html).not.toContain("<i>I 1</i>");
    expect(html).toContain("&lt;i&gt;I 1&lt;/i&gt;");
  });
});
