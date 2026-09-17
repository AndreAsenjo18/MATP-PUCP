import { describe, expect, it } from "vitest";

import { alertsForPiece, getPieceDetail, listPieces, PIECES } from "./index";

describe("catálogo sintético de la maqueta (maqueta-ui-navegable)", () => {
  it("reproduce el caos de codificación con al menos 14 piezas y todos los regímenes de tenencia", () => {
    expect(PIECES.length).toBeGreaterThanOrEqual(14);
    const regimes = new Set(PIECES.map((p) => p.tenure_regime));
    expect(regimes).toEqual(new Set(["OWNED", "LOAN_FOR_USE", "TEMPORARY_LOAN"]));
  });

  it("nunca asigna un código I vigente a una pieza en comodato (RN-003)", () => {
    const onLoanForUse = PIECES.filter((p) => p.tenure_regime === "LOAN_FOR_USE");
    expect(onLoanForUse.length).toBeGreaterThan(0);
    for (const piece of onLoanForUse) {
      expect(piece.inventory_code).toBeNull();
      const currentInventoryIdentifier = piece.identifiers.find((i) => i.identifier_type_code === "I" && i.is_current);
      expect(currentInventoryIdentifier).toBeUndefined();
    }
  });

  it("nunca asigna un código I a una pieza en préstamo temporal (RN-004)", () => {
    const onTemporaryLoan = PIECES.filter((p) => p.tenure_regime === "TEMPORARY_LOAN");
    expect(onTemporaryLoan.length).toBeGreaterThan(0);
    for (const piece of onTemporaryLoan) {
      expect(piece.inventory_code).toBeNull();
    }
  });

  it("bloquea todo identificador de tipo I (RN-002)", () => {
    const inventoryIdentifiers = PIECES.flatMap((p) => p.identifiers).filter((i) => i.identifier_type_code === "I");
    expect(inventoryIdentifiers.length).toBeGreaterThan(0);
    for (const identifier of inventoryIdentifiers) {
      expect(identifier.is_locked).toBe(true);
    }
  });

  it("marca la alerta WITHOUT_INVENTORY_CODE solo para piezas propias sin código I", () => {
    const cajonSanMarcos = getPieceDetail(
      PIECES.find((p) => p.title === "Cajón San Marcos")!.id,
    )!;
    const alerts = alertsForPiece(cajonSanMarcos);
    expect(alerts.find((a) => a.type === "WITHOUT_INVENTORY_CODE")?.applies).toBe(true);

    const comodatoPiece = PIECES.find((p) => p.tenure_regime === "LOAN_FOR_USE")!;
    const comodatoAlerts = alertsForPiece(comodatoPiece);
    expect(comodatoAlerts.find((a) => a.type === "WITHOUT_INVENTORY_CODE")?.applies).toBe(false);
  });

  it("marca un código como no normalizable cuando el original es ilegible", () => {
    const tabla = PIECES.find((p) => p.title === "Tabla pintada de Sarhua")!;
    const alerts = alertsForPiece(tabla);
    expect(alerts.find((a) => a.type === "UNPARSEABLE_CODE")?.applies).toBe(true);
  });

  it("combina filtros con AND (RF-032) y respeta el filtro de solo incompletas", () => {
    const all = listPieces({});
    const onlyIncomplete = listPieces({ incompleteOnly: true });
    expect(onlyIncomplete.total).toBeLessThan(all.total);
    expect(onlyIncomplete.items.every((summary) => alertsForPiece(getPieceDetail(summary.id)!).some((a) => a.applies))).toBe(true);
  });

  it("busca por un código tal como está escrito en la fuente (sucio) y por el código normalizado (RF-023)", () => {
    const byDirtyCode = listPieces({ q: "mmz 15" });
    expect(byDirtyCode.items).toHaveLength(1);
    expect(byDirtyCode.items[0].title).toBe("Toro de Pucará (3 cuernos)");

    const byNormalizedCode = listPieces({ q: "I-0236" });
    expect(byNormalizedCode.items).toHaveLength(1);
    expect(byNormalizedCode.items[0].title).toBe("Toro de Pucará");
  });
});
