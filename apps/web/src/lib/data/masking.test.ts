import { describe, expect, it } from "vitest";

import { getPieceDetail } from "@/lib/fixtures";

import { maskPieceForRole } from "./masking";

const ADMIN_PERMISSIONS = new Set([
  "sensitive.exact_location",
  "sensitive.loan_terms",
  "sensitive.donor_data",
]);
const hasAll = (code: string) => ADMIN_PERMISSIONS.has(code);
const hasNone = () => false;

describe("maskPieceForRole (RF-041)", () => {
  it("no cambia nada cuando el rol tiene todos los permisos sensibles", () => {
    const piece = getPieceDetail("0f1c0000-0000-7000-0008-000000000005")!; // Niño Manuelito (AJB, comodato)
    const masked = maskPieceForRole(piece, hasAll);
    expect(masked).toBe(piece);
  });

  it("oculta el comodante y el convenio de comodato a un rol sin sensitive.donor_data/loan_terms", () => {
    const piece = getPieceDetail("0f1c0000-0000-7000-0008-000000000005")!; // Niño Manuelito
    expect(piece.lender_name).not.toBeNull();
    expect(piece.loan_agreement_ref).not.toBeNull();

    const masked = maskPieceForRole(piece, hasNone);
    expect(masked.lender_name).toBeNull();
    expect(masked.loan_agreement_ref).toBeNull();
    expect(masked.masked_fields).toEqual(expect.arrayContaining(["lender_name", "loan_agreement_ref"]));
  });

  it("no restringe comodante/convenio de una pieza propia (el régimen de tenencia no es comodato)", () => {
    const piece = getPieceDetail("0f1c0000-0000-7000-0008-000000000001")!; // Toro de Pucará (propia)
    const masked = maskPieceForRole(piece, hasNone);
    expect(masked.masked_fields).not.toContain("lender_name");
    expect(masked.masked_fields).not.toContain("loan_agreement_ref");
  });

  it("recorta la ubicación a sede/espacio para un rol sin sensitive.exact_location", () => {
    const piece = getPieceDetail("0f1c0000-0000-7000-0008-000000000001")!; // Toro de Pucará, ubicado hasta Nivel 2
    expect(piece.location.path.length).toBeGreaterThan(2);

    const masked = maskPieceForRole(piece, hasNone);
    expect(masked.location.path).toHaveLength(2);
    expect(masked.location.is_exact).toBe(false);
    expect(masked.masked_fields).toContain("location");
  });
});
