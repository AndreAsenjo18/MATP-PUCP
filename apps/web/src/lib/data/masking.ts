/**
 * Restricción de campos sensibles por rol (RF-041, RNF-014): ubicación exacta (mueble, nivel,
 * contenedor), condiciones del comodato y datos de comodantes. Se aplica en el cliente sobre
 * los datos sintéticos, igual que la API real lo hace sobre la base de datos, para que la
 * maqueta demuestre el mismo comportamiento con cualquier rol simulado.
 */
import type { ApiSchemas } from "@/lib/api/client";

type PieceDetail = ApiSchemas["PieceDetail"];

export function maskPieceForRole(piece: PieceDetail, hasPermission: (code: string) => boolean): PieceDetail {
  const maskedFields: string[] = [];
  let location = piece.location;
  if (!hasPermission("sensitive.exact_location") && piece.location.path.length > 2) {
    location = { ...piece.location, path: piece.location.path.slice(0, 2), is_exact: false };
    maskedFields.push("location");
  }

  let lenderName = piece.lender_name;
  let loanAgreementRef = piece.loan_agreement_ref;
  if (piece.tenure_regime === "LOAN_FOR_USE") {
    if (!hasPermission("sensitive.donor_data") && lenderName) {
      lenderName = null;
      maskedFields.push("lender_name");
    }
    if (!hasPermission("sensitive.loan_terms") && loanAgreementRef) {
      loanAgreementRef = null;
      maskedFields.push("loan_agreement_ref");
    }
  }

  if (maskedFields.length === 0) return piece;
  return { ...piece, location, lender_name: lenderName, loan_agreement_ref: loanAgreementRef, masked_fields: maskedFields };
}
