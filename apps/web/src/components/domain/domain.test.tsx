import { describe, expect, it } from "vitest";

import { BADGE_INTENTS } from "@/components/ui/Badge";
import { alertsForPiece, getPieceDetail, PIECES, toSummary } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import { canConfirm, ConfirmButton, confirmVariant } from "./ConfirmButton";
import { DEFAULT_EXCLUSION_REASON, ImportConflictModal, resolveConflictDecision } from "./ImportConflictModal";
import { PieceCard, pieceCardProps } from "./PieceCard";
import { PieceCurrentLocation, PieceGeneralData, PieceIdentifiersTable, PieceMediaGallery, PieceSheetHeader } from "./PieceSheet";
import {
  alertStatus,
  auditActionStatus,
  duplicateStatus,
  identifierCurrencyStatus,
  importClassificationStatus,
  importDecisionStatus,
  suggestionStatus,
  tenureStatus,
} from "./status-intents";
import { AlertBadge, LockBadge, StatusBadge, TenureBadge } from "./StatusBadges";

const loanPiece = PIECES.find((p) => p.tenure_regime === "LOAN_FOR_USE")!;
const pieceWithoutPhoto = PIECES.find((p) => p.media_count === 0)!;
const pieceWithCode = PIECES.find((p) => p.inventory_code && p.identifiers.some((i) => i.is_locked))!;

describe("status-intents", () => {
  it("comodato y préstamo temporal son info; propia es default", () => {
    expect(tenureStatus("LOAN_FOR_USE")).toEqual({ label: "Comodato", intent: "info" });
    expect(tenureStatus("TEMPORARY_LOAN")).toEqual({ label: "Préstamo temporal", intent: "info" });
    expect(tenureStatus("OWNED").intent).toBe("default");
  });

  it("información incompleta es warning y código no normalizable es danger", () => {
    expect(alertStatus("WITHOUT_PHOTO")).toEqual({ label: "Sin foto", intent: "warning" });
    expect(alertStatus("MISSING_REQUIRED_FIELDS").intent).toBe("warning");
    expect(alertStatus("UNPARSEABLE_CODE").intent).toBe("danger");
  });

  it("conflicto de importación es danger y posible duplicado warning", () => {
    expect(importClassificationStatus("CONFLICT")).toEqual({ label: "Conflicto", intent: "danger" });
    expect(importClassificationStatus("POSSIBLE_DUPLICATE").intent).toBe("warning");
    expect(importClassificationStatus(null)).toEqual({ label: "Sin clasificar", intent: "default" });
  });

  it("decisiones, sugerencias IA, duplicados, auditoría e identificadores tienen texto e intent", () => {
    expect(importDecisionStatus("REJECTED")).toEqual({ label: "Rechazada", intent: "danger" });
    expect(suggestionStatus("PENDING")).toEqual({ label: "Pendiente de revisión", intent: "warning" });
    expect(duplicateStatus("MERGED").intent).toBe("success");
    expect(auditActionStatus("CORRECTION").intent).toBe("danger");
    expect(identifierCurrencyStatus(true)).toEqual({ label: "Vigente", intent: "success" });
    expect(identifierCurrencyStatus(false).intent).toBe("default");
  });

  it("un valor no mapeado se muestra como default con texto legible", () => {
    expect(alertStatus("NEW_ALERT_TYPE")).toEqual({ label: "Alerta: NEW_ALERT_TYPE", intent: "default" });
    expect(tenureStatus("OTHER").intent).toBe("default");
    expect(suggestionStatus(undefined)).toEqual({ label: "Estado", intent: "default" });
  });
});

describe("badges de dominio", () => {
  it("TenureBadge muestra Comodato con intent info", () => {
    const html = render(<TenureBadge regime="LOAN_FOR_USE" />);
    expect(html).toContain(BADGE_INTENTS.info);
    expect(visibleText(html)).toBe("Comodato");
  });

  it("AlertBadge muestra texto, icono y mensaje; no se muestra si no aplica", () => {
    const html = render(<AlertBadge alert={{ type: "WITHOUT_PHOTO", applies: true, message: "Sin fotografías registradas." }} />);
    expect(visibleText(html)).toBe("Sin foto");
    expect(html).toContain(BADGE_INTENTS.warning);
    expect(html).toContain('title="Sin fotografías registradas."');
    expect(html).toContain("<svg");
    expect(render(<AlertBadge alert={{ type: "WITHOUT_PHOTO", applies: false, message: "" }} />)).toBe("");
  });

  it("LockBadge usa un icono de candado y no un emoji", () => {
    const html = render(<LockBadge label="Código I: I-0001" />);
    expect(html).toContain("<svg");
    expect(html).not.toContain("🔒");
    expect(visibleText(html)).toBe("Código I: I-0001");
  });

  it("StatusBadge acepta status o label con tone", () => {
    expect(render(<StatusBadge status={{ label: "Fusionado", intent: "success" }} />)).toContain(BADGE_INTENTS.success);
    expect(render(<StatusBadge label="Pendiente" tone="pending" />)).toContain(BADGE_INTENTS.warning);
    expect(render(<StatusBadge label="Otro" tone={"raro" as never} />)).toContain(BADGE_INTENTS.default);
  });
});

describe("ConfirmButton", () => {
  it("se apoya en Button y deja el diálogo cerrado hasta que se pulsa", () => {
    const html = render(
      <ConfirmButton label="Fusionar" variant="danger" confirmTitle="Fusionar duplicado" confirmDescription="Se conserva el historial." onConfirm={() => {}} />,
    );
    expect(html).toContain("bg-carmin-peligro");
    expect(html).toMatch(/<dialog(?![^>]*\sopen)[^>]*>/);
    expect(visibleText(html)).toContain("Fusionar duplicado");
  });

  it("pide motivo cuando es obligatorio y confirma con la variante correcta", () => {
    expect(canConfirm(true, "  ")).toBe(false);
    expect(canConfirm(true, "Error de digitación")).toBe(true);
    expect(canConfirm(false, "")).toBe(true);
    expect(confirmVariant("danger")).toBe("danger");
    expect(confirmVariant("secondary")).toBe("primary");
    const html = render(<ConfirmButton label="Rechazar" requireReason reasonLabel="Motivo del rechazo" confirmTitle="Rechazar" confirmDescription="" onConfirm={() => {}} />);
    expect(visibleText(html)).toContain("Motivo del rechazo");
    expect(html).toContain("required");
  });
});

describe("PieceCard", () => {
  it("una pieza en comodato muestra el badge Comodato y el aviso Sin código I", () => {
    const html = render(<PieceCard {...pieceCardProps(toSummary(loanPiece), alertsForPiece(loanPiece))} />);
    expect(html).toContain(`href="/piezas/${loanPiece.id}"`);
    expect(html).toContain(BADGE_INTENTS.info);
    expect(visibleText(html)).toContain("Comodato");
    if (!loanPiece.inventory_code) expect(visibleText(html)).toContain("Sin código I");
  });

  it("una pieza sin foto muestra «Sin foto» una sola vez, con icono", () => {
    const html = render(<PieceCard {...pieceCardProps(toSummary(pieceWithoutPhoto), alertsForPiece(pieceWithoutPhoto))} />);
    expect(visibleText(html).match(/Sin foto/g)).toHaveLength(1);
    expect(html).toContain("text-ambar-texto");
  });

  it("muestra el código en monoespaciada terracota y trunca títulos largos", () => {
    const html = render(
      <PieceCard
        href="/piezas/x"
        title={"Retablo sintético de demostración ".repeat(6)}
        inventoryCode="I-0001"
        collectionName={null}
        locationLabel={null}
        tenureRegime="OWNED"
        hasPhoto
      />,
    );
    expect(html).toContain("font-mono");
    expect(html).toContain("text-terracota");
    expect(html).toContain("line-clamp-2");
    expect(visibleText(html)).toContain("Sin colección");
    expect(visibleText(html)).toContain("Sin ubicación");
    expect(visibleText(html)).not.toContain("Sin foto");
  });
});

describe("PieceSheet", () => {
  it("el encabezado de una pieza en comodato muestra Comodato y las alertas", () => {
    const html = render(<PieceSheetHeader piece={loanPiece} alerts={alertsForPiece(loanPiece)} />);
    expect(html).toContain(`<h1`);
    expect(visibleText(html)).toContain(loanPiece.title);
    expect(visibleText(html)).toContain("Comodato");
  });

  it("los datos generales de un comodato incluyen comodante y convenio", () => {
    const text = visibleText(render(<PieceGeneralData piece={loanPiece} />));
    expect(text).toContain("Comodante");
    expect(text).toContain("Convenio de comodato");
    expect(text).toContain("Propietario legal");
  });

  it("los identificadores muestran el candado accesible del código I y el aviso RN-002", () => {
    const html = render(<PieceIdentifiersTable piece={pieceWithCode} />);
    expect(html).toContain('aria-label="Bloqueado"');
    expect(visibleText(html)).toContain("El código I está bloqueado una vez asignado (RN-002)");
    expect(html).not.toContain("🔒");
  });

  it("galería vacía y ubicación sin registrar se muestran con texto claro", () => {
    expect(visibleText(render(<PieceMediaGallery media={[]} pieceTitle="X" />))).toBe("Sin fotografías registradas.");
    const detail = getPieceDetail(pieceWithoutPhoto.id)!;
    expect(visibleText(render(<PieceCurrentLocation location={{ ...detail.location, path: [] }} />))).toContain("Sin ubicación registrada");
  });
});

describe("ImportConflictModal", () => {
  it("rechazar exige motivo; excluir usa un motivo por defecto; aceptar no lo exige", () => {
    expect(resolveConflictDecision("REJECTED", " ")).toEqual({ ok: false, error: expect.stringMatching(/motivo del rechazo/) });
    expect(resolveConflictDecision("REJECTED", "Código duplicado")).toEqual({ ok: true, decision: "REJECTED", reason: "Código duplicado" });
    expect(resolveConflictDecision("EXCLUDED", "")).toEqual({ ok: true, decision: "EXCLUDED", reason: DEFAULT_EXCLUSION_REASON });
    expect(resolveConflictDecision("ACCEPTED", "")).toEqual({ ok: true, decision: "ACCEPTED", reason: null });
    expect(resolveConflictDecision("OTRA" as never, "x").ok).toBe(false);
  });

  it("compara valor actual y de la fila, y el botón Cerrar tiene etiqueta accesible", () => {
    const row = {
      id: "row-1",
      batch_id: "b",
      source_row_number: 7,
      classification: "CONFLICT" as const,
      decision: "PENDING" as const,
      decision_reason: null,
      diff: [{ field: "inventory_code", current_value: "I-0001", incoming_value: "I-0002" }],
      mapped_data: {},
      matches: {},
      raw_data: {},
      target_piece_id: null,
      validation_errors: [],
    } as unknown as Parameters<typeof ImportConflictModal>[0]["row"];
    const html = render(<ImportConflictModal row={row} open={false} onClose={() => {}} onDecide={() => {}} />);
    const text = visibleText(html);
    expect(text).toContain("Revisar fila 7");
    expect(text).toContain("Conflicto");
    expect(text).toContain("I-0001");
    expect(text).toContain("I-0002");
    expect(html).toContain('aria-label="Cerrar"');
    expect(text).toContain("Aceptar fila");
    expect(text).toContain("Rechazar");
  });
});
