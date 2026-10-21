import { describe, expect, it } from "vitest";

import type { ApiSchemas } from "@/lib/api/client";
import { DUPLICATE_CANDIDATES, getPieceDetail, ids } from "@/lib/fixtures";

import {
  IMPORT_ROW_MERGE_MESSAGE,
  MERGE_REASON_REQUIRED,
  MERGE_ROWS,
  defaultSurvivorId,
  fieldChoicesFor,
  fieldSource,
  identifierFates,
  materialFates,
  mergeBlock,
  mergeReasonError,
  mergeReasonText,
  mergedPeriodError,
  mergedSheet,
  periodText,
  requiredSurvivorId,
  rowState,
  sheetChanges,
  survivorRestriction,
} from "./merge-plan";

type PieceDetail = ApiSchemas["PieceDetail"];

// Par 1 de los fixtures: «Toro de Pucará» (con código I-0236) y «Toro de Pucará (3 cuernos)» (sin código I).
const toro = getPieceDetail(ids.piece(1))!;
const toroB = getPieceDetail(ids.piece(2))!;

function row(key: string) {
  const found = MERGE_ROWS.find((r) => r.key === key);
  if (!found) throw new Error(`fila ${key} inexistente`);
  return found;
}

/** La conservada sin autor; la absorbida con otra procedencia y con autor. */
const surviving: PieceDetail = { ...toro, author: null };
const absorbed: PieceDetail = { ...toroB, provenance: "Cusco (sintético)", author: "Taller sintético" };

describe("valor de cada campo (design D4, paso 2)", () => {
  it("sigue la regla de la API: la elección manda, un vacío de la absorbida nunca reemplaza y sin elección se completa", () => {
    expect(fieldSource("provenance", surviving, absorbed, "ABSORBED")).toBe("ABSORBED");
    expect(fieldSource("provenance", surviving, absorbed, "SURVIVING")).toBe("SURVIVING");
    expect(fieldSource("provenance", surviving, absorbed)).toBe("SURVIVING");
    expect(fieldSource("author", surviving, absorbed)).toBe("ABSORBED");
    expect(fieldSource("author", surviving, absorbed, "SURVIVING")).toBe("SURVIVING");
    expect(fieldSource("temporary_inventory_number", surviving, absorbed, "ABSORBED")).toBe("SURVIVING");
    expect(fieldSource("collection_id", surviving, absorbed, "ABSORBED")).toBe("SURVIVING"); // misma colección
  });

  it("clasifica cada fila: conflicto, se completa, sin cambios o restringida", () => {
    expect(rowState(row("provenance"), surviving, absorbed)).toBe("conflict");
    expect(rowState(row("denomination"), surviving, absorbed)).toBe("conflict");
    expect(rowState(row("author"), surviving, absorbed)).toBe("fill");
    expect(rowState(row("collection"), surviving, absorbed)).toBe("same");
    expect(rowState(row("temporary_number"), surviving, absorbed)).toBe("same");
    const masked = { ...absorbed, masked_fields: ["lender_name"] };
    expect(rowState(row("lender"), surviving, masked)).toBe("masked");
  });

  it("envía una elección explícita por campo en conflicto; un grupo se elige completo", () => {
    const period = { ...absorbed, period: { text: "ca. 1950", type: "APPROXIMATE" as const, year_from: 1945, year_to: 1955 } };
    const choices = fieldChoicesFor({ provenance: period.id, period: period.id }, surviving, period);
    expect(choices).toMatchObject({
      provenance: "ABSORBED",
      denomination: "SURVIVING",
      epoch_original_text: "ABSORBED",
      epoch_type: "ABSORBED",
      epoch_start_year: "ABSORBED",
      epoch_end_year: "ABSORBED",
    });
    expect(choices.author).toBeUndefined(); // sin conflicto: la API la completa sola
    expect(choices.collection_id).toBeUndefined();
  });

  it("muestra la ficha resultante y lo que cambia en la conservada", () => {
    const choices = fieldChoicesFor({ provenance: absorbed.id }, surviving, absorbed);
    const merged = mergedSheet(surviving, absorbed, choices);
    expect(merged.provenance).toBe("Cusco (sintético)");
    expect(merged.author).toBe("Taller sintético");
    expect(merged.denomination).toBe("Toro de Pucará");
    expect(merged.id).toBe(surviving.id);
    const changes = sheetChanges(surviving, absorbed, choices).map((c) => [c.row.key, c.before, c.after, c.kind]);
    expect(changes).toEqual([
      ["author", "Sin registrar", "Taller sintético", "filled"],
      ["provenance", "Puno", "Cusco (sintético)", "chosen"],
    ]);
  });

  it("avisa si la época resultante quedaría incoherente", () => {
    const early = { ...surviving, period: { text: "1901-1920", type: "RANGE" as const, year_from: 1901, year_to: 1920 } };
    const late = { ...absorbed, period: { text: "1950", type: "YEAR" as const, year_from: 1950, year_to: null } };
    expect(mergedPeriodError(early, late, fieldChoicesFor({ period: late.id }, early, late))).toMatch(/desde 1950 hasta 1920/);
    expect(mergedPeriodError(early, late, fieldChoicesFor({}, early, late))).toBeNull();
    expect(periodText(early.period)).toBe("1901-1920 (1901–1920)");
    expect(periodText({ text: null, year_from: 1950, year_to: 1950 })).toBe("1950");
  });
});

describe("bloqueos y pieza que se conserva (design D4, paso 1)", () => {
  const pair = DUPLICATE_CANDIDATES[0];
  const otherCode = getPieceDetail(ids.piece(7))!;
  const comodato = getPieceDetail(ids.piece(5))!;

  it("bloquea una fila de importación, regímenes distintos y códigos I vigentes distintos", () => {
    expect(mergeBlock({ piece_b_id: null, blocking_conflict: false }, toro, null)).toEqual({ code: "merge_requires_two_pieces", message: IMPORT_ROW_MERGE_MESSAGE });
    expect(mergeBlock(pair, toro, comodato)).toMatchObject({ code: "merge_blocked_tenure" });
    expect(mergeBlock(pair, toro, otherCode)).toMatchObject({ code: "merge_blocked_inventory_code", message: expect.stringContaining("(I-0236 y I-0450)") });
    expect(mergeBlock({ ...pair, blocking_conflict: true }, undefined, undefined)?.code).toBe("merge_blocked_inventory_code");
    expect(mergeBlock(pair, toro, toroB)).toBeNull();
    expect(mergeBlock(pair, toro, { ...toroB, code_i: "I-0236" })).toBeNull(); // mismo código I
  });

  it("si solo una pieza tiene código I vigente, solo esa puede conservarse (RN-002)", () => {
    expect(requiredSurvivorId(toro, toroB)).toBe(toro.id);
    expect(requiredSurvivorId(toroB, toro)).toBe(toro.id);
    expect(defaultSurvivorId(toroB, toro)).toBe(toro.id);
    expect(survivorRestriction(toro.id, toro, toroB)).toBeNull();
    expect(survivorRestriction(toroB.id, toro, toroB)).toMatch(/^Solo «Toro de Pucará» tiene código I vigente \(I-0236\): debe conservarse esa pieza/);
    const withoutCodes = { ...toro, code_i: null };
    expect(requiredSurvivorId(withoutCodes, toroB)).toBeNull();
    expect(defaultSurvivorId(withoutCodes, toroB)).toBe(toro.id);
  });
});

describe("qué se traslada y qué se queda (design D4, pasos 3 a 5)", () => {
  it("los identificadores pasan; el repetido queda no vigente y el código I o uno bloqueado se queda", () => {
    expect(identifierFates(toro, toroB).map((f) => [f.identifier.original_value, f.fate])).toEqual([["mmz 15", "moves_not_current"]]);
    const locked = { ...toroB.identifiers[0], id: "locked", identifier_type_code: "INC", original_value: "INC 99", normalized_value: "000099", is_locked: true };
    const fates = identifierFates(toroB, { ...toro, identifiers: [...toro.identifiers, locked] }).map((f) => [f.identifier.identifier_type_code, f.fate]);
    expect(fates).toEqual([
      ["I", "stays_inventory_code"],
      ["COLLECTION", "moves_not_current"],
      ["INC", "stays_locked"],
    ]);
  });

  it("los materiales se unen sin repetir; los repetidos se quedan en la absorbida", () => {
    const extra = { id: "material-extra", code: "MADERA", label: "Madera" };
    const result = materialFates(toro, { ...toroB, materials: [toroB.materials[0], extra] });
    expect(result.moves).toEqual([extra]);
    expect(result.stays.map((m) => m.id)).toEqual([toroB.materials[0].id]);
  });

  it("el motivo es obligatorio y se muestra sin el prefijo técnico de la baja", () => {
    expect(mergeReasonError("  ")).toBe(MERGE_REASON_REQUIRED);
    expect(mergeReasonError("ok")).toBe(MERGE_REASON_REQUIRED);
    expect(mergeReasonError("Misma pieza")).toBeNull();
    expect(mergeReasonText(`Fusionada en ${toro.id}: Misma pieza en libro y sábana`)).toBe("Misma pieza en libro y sábana");
    expect(mergeReasonText("Motivo libre")).toBe("Motivo libre");
    expect(mergeReasonText(null)).toBeNull();
  });
});
