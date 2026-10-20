import { describe, expect, it } from "vitest";

import type { IdentifierAddResult, SplitIdentifiersResult, SplitProposal } from "@/lib/data/pieces";
import { render, visibleText } from "@/test/render";

import {
  IDENTIFIER_VALUE_REQUIRED,
  IdentifierAddForm,
  outcomeFromSplit,
  remainingProposals,
  splitSuccessMessage,
  statusFromAdd,
} from "./IdentifierAddForm";

const PROPOSALS: SplitProposal[] = [
  { identifier_type_code: "I", original_value: "I 2362", normalized_value: "I-2362" },
  { identifier_type_code: "COLLECTION", original_value: "RA 28", normalized_value: "RA 28" },
  { identifier_type_code: "COLLECTION", original_value: "MMZ 15", normalized_value: "MMZ 15" },
];
const REGISTERED = [{}, {}] as never;

describe("IdentifierAddForm: formulario", () => {
  const types = [
    { code: "I", label: "Código de inventario general (I)" },
    { code: "COLLECTION", label: "Código de colección" },
  ];

  it("ofrece tipo, código y fuente opcional, con etiquetas visibles", () => {
    const html = render(<IdentifierAddForm pieceId="p-1" types={types} />);
    const text = visibleText(html);

    expect(html).toContain('aria-label="Registrar identificador"');
    expect(text).toContain("Registrar un identificador");
    expect(text).toContain("Tipo de código");
    expect(text).toContain("Código de inventario general (I)");
    expect(text).toContain("Código de colección");
    expect(text).toContain("Fuente (opcional)");
    expect(html).toMatch(/<button[^>]*type="submit"/);
    expect(text).toContain("Registrar identificador");
  });

  it("avisa de antemano que un valor con varios códigos se propondrá separar", () => {
    const text = visibleText(render(<IdentifierAddForm pieceId="p-1" types={types} />));

    expect(text).toContain("le propondrá separarlos");
  });

  it("al abrirse no muestra mensajes ni el diálogo de separación", () => {
    const html = render(<IdentifierAddForm pieceId="p-1" types={types} />);

    expect(html).not.toContain("<dialog");
    expect(html).not.toContain('role="status"');
    expect(visibleText(html)).not.toContain(IDENTIFIER_VALUE_REQUIRED);
  });
});

describe("statusFromAdd", () => {
  it("un registro correcto confirma el código escrito", () => {
    const result = { status: "ok", identifier: {} } as unknown as IdentifierAddResult;

    expect(statusFromAdd(result, "M.M.Z. 15")).toEqual({ kind: "registered", message: "El código «M.M.Z. 15» quedó registrado." });
  });

  it("un 422 con propuestas abre la separación en lugar de mostrar un error", () => {
    const result: IdentifierAddResult = { status: "needs_split", message: "Varios códigos.", proposals: PROPOSALS };

    expect(statusFromAdd(result, "I 2362 / RA 28 / MMZ 15")).toEqual({ kind: "needs_split", proposals: PROPOSALS });
  });

  it("un rechazo o un servicio no disponible muestran el mensaje del servidor", () => {
    expect(statusFromAdd({ status: "rejected", code: "inventory_code_not_allowed", message: "Una pieza en comodato no puede recibir código I (RN-003)." }, "I 1")).toEqual({
      kind: "error",
      message: "Una pieza en comodato no puede recibir código I (RN-003).",
    });
    expect(statusFromAdd({ status: "unavailable", message: "Operación no implementada." }, "I 1")).toEqual({
      kind: "error",
      message: "Operación no implementada.",
    });
  });
});

describe("separación confirmada: resultado y reintento", () => {
  it("si todos se registraron, el diálogo se cierra", () => {
    expect(outcomeFromSplit({ status: "ok", identifiers: REGISTERED })).toEqual({ ok: true });
    expect(splitSuccessMessage(2)).toBe("2 códigos quedaron registrados por separado.");
    expect(splitSuccessMessage(1)).toBe("1 código quedó registrado.");
  });

  it("si falla el primero, lo dice sin mencionar códigos ya registrados", () => {
    const result: SplitIdentifiersResult = {
      status: "failed",
      identifiers: [],
      failedValue: "I 2362",
      failure: { status: "rejected", code: "inventory_code_not_allowed", message: "No permitido (RN-003)." },
    };

    expect(outcomeFromSplit(result)).toEqual({ ok: false, message: "No se pudo registrar «I 2362»: No permitido (RN-003)." });
  });

  it("si falla uno a medias, avisa de los que ya quedaron y de que solo se reenviarán los que faltan", () => {
    const result: SplitIdentifiersResult = {
      status: "failed",
      identifiers: REGISTERED,
      failedValue: "MMZ 15",
      failure: { status: "unavailable", message: "No se pudo conectar con el servidor." },
    };
    const outcome = outcomeFromSplit(result);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.message).toContain("Ya quedaron registrados 2 códigos");
      expect(outcome.message).toContain("«MMZ 15»");
      expect(outcome.message).toContain("solo se enviarán los que faltan");
    }
  });

  it("tras un fallo parcial quedan solo las propuestas sin registrar, en su orden", () => {
    expect(remainingProposals(PROPOSALS, 2)).toEqual([PROPOSALS[2]]);
    expect(remainingProposals(PROPOSALS, 0)).toEqual(PROPOSALS);
    expect(remainingProposals(PROPOSALS, 3)).toEqual([]);
  });
});
