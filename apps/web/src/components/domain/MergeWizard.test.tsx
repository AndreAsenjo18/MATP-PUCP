import { describe, expect, it } from "vitest";

import type { ApiSchemas } from "@/lib/api/client";
import { fieldChoicesFor } from "@/lib/data/merge-plan";
import { DUPLICATE_CANDIDATES, getPieceDetail, ids } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import { MergeLinks, MergedFromNotice, MergedIntoNotice } from "./MergedPieceLinks";
import { IdentifierTypeNamesProvider } from "./DuplicateReview";
import {
  ABSORBED_FATE,
  BLOCKED_SURVIVOR_REASON,
  MERGE_CONFIRM_LABEL,
  MergeFieldsStep,
  MergeSummaryStep,
  MergeSurvivorStep,
  MergeWizard,
  PieceCodes,
  REQUIRED_SURVIVOR_REASON,
  SURVIVOR_FATE,
  type MergeStep,
} from "./MergeWizard";

type PieceDetail = ApiSchemas["PieceDetail"];

const noop = () => {};
const ok = async () => ({ ok: true as const });
const pair = DUPLICATE_CANDIDATES[0];
// «Toro de Pucará» (código I-0236) y «Toro de Pucará (3 cuernos)» (sin código I): solo la primera puede conservarse.
const toro = getPieceDetail(ids.piece(1))!;
const toroB: PieceDetail = { ...getPieceDetail(ids.piece(2))!, provenance: "Cusco (sintético)", author: "Taller sintético", media_count: 2 };
const titles = { [toro.id]: "Pieza A", [toroB.id]: "Pieza B" };

function wizard(step: MergeStep, pieceB: PieceDetail = toroB) {
  return render(<MergeWizard candidate={pair} pieceA={toro} pieceB={pieceB} onClose={noop} onSubmit={ok} initialStep={step} />);
}

function radio(html: string, value: string): string {
  const match = new RegExp(`<input[^>]*value="${value}"[^>]*>`).exec(html);
  if (!match) throw new Error(`no hay opción ${value}`);
  return match[0];
}

describe("MergeWizard: paso 1, pieza que se conserva", () => {
  it("propone conservar la pieza con código I y no deja elegir la otra, con el motivo a la vista", () => {
    const html = wizard(1);
    const text = visibleText(html);
    expect(text).toContain("Fusionar piezas duplicadas");
    expect(html).toMatch(/<li aria-current="step"[^>]*>1\. Pieza que se conserva<\/li>/);
    expect(text).toContain("Pieza A: Toro de Pucará");
    expect(text).toContain("Código I I-0236");
    expect(text).toContain("Pieza B: Toro de Pucará (3 cuernos)");
    expect(text).toContain("Sin código I");
    expect(radio(html, toro.id)).toContain('checked=""');
    expect(radio(html, toroB.id)).toContain('disabled=""');
    expect(radio(html, toroB.id)).toContain("aria-describedby=");
    // Prueba humana de HU-04: la razón, corta, junto a cada opción (antes, una frase larga solo en la que no se elige).
    expect(text).toContain(REQUIRED_SURVIVOR_REASON);
    expect(text).toContain(BLOCKED_SURVIVOR_REASON);
    expect(text).toContain("Siguiente");
    expect(html).not.toContain(`${MERGE_CONFIRM_LABEL}</button>`);
  });

  it("sin código I en ninguna, las dos se pueden conservar y se propone la pieza A", () => {
    const withoutCode = { ...toro, code_i: null };
    const html = render(<MergeSurvivorStep pieceA={withoutCode} pieceB={toroB} survivingId={withoutCode.id} block={null} onChange={noop} />);
    expect(radio(html, toro.id)).toContain('checked=""');
    expect(radio(html, toroB.id)).not.toContain("disabled");
  });

  it.each([
    ["regímenes de tenencia distintos", getPieceDetail(ids.piece(5))!, /regímenes de tenencia distintos \(Propiedad y Comodato\)\. Primero corrija el régimen/],
    ["códigos I vigentes distintos", getPieceDetail(ids.piece(7))!, /códigos I vigentes distintos \(I-0236 y I-0450\)\. Un código I nunca cambia de pieza:/],
  ])("un par bloqueado por %s solo explica el motivo y se cierra", (_label, other, message) => {
    const html = wizard(1, other);
    const text = visibleText(html);
    expect(text).toContain("No se puede fusionar este par.");
    expect(text).toMatch(message);
    expect(text).toContain("Cerrar");
    expect(text).not.toContain("Siguiente");
    expect(html).not.toContain(`${MERGE_CONFIRM_LABEL}</button>`);
  });
});

describe("MergeWizard: paso 2, valores de la ficha", () => {
  it("pide elegir cada campo en conflicto, propone el de la conservada y lista lo que se completa", () => {
    const html = wizard(2);
    const text = visibleText(html);
    expect(html).toMatch(/<li aria-current="step"[^>]*>2\. Valores de la ficha<\/li>/);
    for (const label of ["Denominación", "Descripción", "Procedencia", "Fecha de ingreso", "Observaciones"]) expect(html).toContain(`>${label}</legend>`);
    expect(html).not.toContain(">Colección</legend>");
    expect(text).toContain("Puno Pieza A · se conserva");
    expect(text).toContain("Cusco (sintético) Pieza B · se absorbe");
    expect(text).toContain("Se completan con la pieza absorbida (la conservada no los tiene)");
    expect(text).toContain("Autor: «Taller sintético»");
    expect(text).toMatch(/\d+ campos no cambian/);
    expect(text).toContain("La ubicación y la pieza contenedora son las de la conservada.");
  });

  it("marca la pieza elegida en cada fila y avisa si la época quedaría incoherente", () => {
    const early = { ...toro, period: { text: "1901-1920", type: "RANGE" as const, year_from: 1901, year_to: 1920 } };
    const late = { ...toroB, period: { text: "1950", type: "YEAR" as const, year_from: 1950, year_to: null } };
    const html = render(<MergeFieldsStep surviving={early} absorbed={late} titles={titles} picks={{ provenance: late.id, period: late.id }} onPick={noop} />);
    const provenance = /<input[^>]*name="[^"]*-provenance"[^>]*>/g;
    const inputs = html.match(provenance) ?? [];
    expect(inputs).toHaveLength(2);
    expect(inputs.find((input) => input.includes(`value="${late.id}"`))).toContain('checked=""');
    expect(visibleText(html)).toMatch(/La época resultante sería incoherente \(desde 1950 hasta 1920\)/);
  });

  it("sin conflictos lo dice y los campos restringidos no se eligen", () => {
    const twin = { ...toro, id: toroB.id, masked_fields: ["lender_name"] };
    const text = visibleText(render(<MergeFieldsStep surviving={toro} absorbed={twin} titles={titles} picks={{}} onPick={noop} />));
    expect(text).toContain("Las dos fichas no tienen valores en conflicto: no hay nada que elegir.");
    expect(text).toContain("Comodante: restringido para su rol");
  });
});

describe("MergeWizard: paso 3, resumen y confirmación", () => {
  it("resume lo que cambia, lo que pasa a la conservada y lo que se queda, y pide el motivo", () => {
    const choices = fieldChoicesFor({ provenance: toroB.id }, toro, toroB);
    const text = visibleText(render(<MergeSummaryStep surviving={toro} absorbed={toroB} choices={choices} note="" noteError={null} onNoteChange={noop} />));
    expect(text).toContain("La ficha de «Toro de Pucará» después de fusionar");
    expect(text).toContain("Procedencia : «Puno» → «Cusco (sintético)» Elegido");
    expect(text).toContain("Autor : «Sin registrar» → «Taller sintético» Se completa");
    expect(text).toContain("Pasa de «Toro de Pucará (3 cuernos)» a «Toro de Pucará»");
    expect(text).toContain("Código de colección mmz 15 (como no vigente: ya lo tiene la conservada)");
    expect(text).toContain("2 fotografías.");
    expect(text).toContain("Sus componentes, préstamos y sugerencias de IA.");
    expect(text).toContain("Qué se queda en «Toro de Pucará (3 cuernos)»");
    expect(text).toContain("Movimientos, datos de origen y evaluaciones de conservación: se consultan desde la ficha de");
    expect(text).toContain("Se da de baja lógica con el motivo: no se borra");
    expect(text).toContain("Sus otros pares de la cola pasan a «Reemplazado».");
    expect(text).toContain("Motivo de la fusión (obligatorio)");
  });

  it("el código I de la absorbida se queda en ella y el error del motivo se muestra junto al campo", () => {
    const sameCode = { ...toroB, code_i: "I-0236" };
    const html = render(<MergeSummaryStep surviving={sameCode} absorbed={toro} choices={{}} note="" noteError="Indique el motivo." onNoteChange={noop} />);
    expect(visibleText(html)).toContain("Código I I-0236 / M.M.Z. 015: un código I nunca cambia de pieza.");
    expect(html).toContain('aria-invalid="true"');
    expect(visibleText(html)).toContain("Indique el motivo.");
  });

  it("el último paso confirma con «Juntar las dos fichas» y permite volver atrás", () => {
    const html = wizard(3);
    expect(html).toMatch(/<li aria-current="step"[^>]*>3\. Resumen y confirmación<\/li>/);
    expect(html).toMatch(/<button type="submit"[^>]*>(?:(?!<\/button>)[\s\S])*Juntar las dos fichas<\/button>/);
    expect(visibleText(html)).toContain("Anterior");
    expect(visibleText(html)).not.toContain("Siguiente");
  });
});

describe("enlaces de fusión en la ficha (calidad-datos, «Consulta de la pieza absorbida»)", () => {
  it("la absorbida muestra que fue fusionada, la fecha, el motivo y el enlace a la conservada", () => {
    const html = render(<MergedIntoNotice mergedInto={{ piece_id: toro.id, merged_at: "2026-10-20T15:00:00Z", reason: `Fusionada en ${toro.id}: Misma pieza en libro y sábana` }} />);
    const text = visibleText(html);
    expect(text).toContain("Pieza fusionada");
    expect(text).toMatch(/fue fusionada en otra el \d{1,2}\/\d{1,2}\/2026/);
    expect(text).toContain("Motivo: Misma pieza en libro y sábana");
    expect(html).toContain(`href="/piezas/${toro.id}"`);
    expect(text).toContain("Ir a la pieza conservada");
  });

  it("la conservada lista las piezas fusionadas en ella con su enlace", () => {
    const html = render(
      <MergedFromNotice mergedFrom={[{ piece_id: toroB.id, denomination: toroB.denomination, merged_at: "2026-10-20T15:00:00Z", reason: `Fusionada en ${toro.id}: Duplicado` }]} />,
    );
    const text = visibleText(html);
    expect(text).toContain("Pieza fusionada en esta");
    expect(html).toContain(`href="/piezas/${toroB.id}"`);
    expect(text).toContain("Toro de Pucará (3 cuernos) · fusionada el");
    expect(text).toContain("Motivo: Duplicado");
    expect(text).toContain("Sus movimientos, datos de origen y evaluaciones de conservación siguen en cada una");
  });

  it("una pieza que no participó en una fusión no muestra nada", () => {
    expect(render(<MergeLinks piece={toro} />)).toBe("");
    expect(render(<MergeLinks piece={{ merged_into: null, merged_from: [] }} />)).toBe("");
  });
});

function historic(piece: PieceDetail): PieceDetail {
  const identifier = { id: "id-historico", identifier_type_code: "INC_RN", original_value: "4521", is_current: false } as unknown as PieceDetail["identifiers"][number];
  return { ...piece, identifiers: [...piece.identifiers, identifier] };
}

describe("códigos a la vista durante la fusión", () => {
  it("muestra el código I y los demás códigos de la pieza, con los históricos marcados", () => {
    const text = visibleText(render(<PieceCodes piece={historic(toro)} />));
    expect(text).toContain("Código I I-0236");
    expect(text).toContain("Código de colección M.M.Z. 015");
    // revisar-pendientes-unificado: antes se veía el código interno «INC_RN 4521».
    expect(text).toContain("Código INC / Registro Nacional 4521 · histórico");
  });

  it("una pieza sin ningún código dice «Sin código I» y no pinta una lista vacía", () => {
    const bare = { ...toro, code_i: null, identifiers: [] };
    const html = render(<PieceCodes piece={bare} />);
    expect(visibleText(html)).toBe("Sin código I");
    expect(html).not.toContain("<ul");
  });

  it("los tres pasos muestran los códigos de las dos piezas", () => {
    expect(visibleText(wizard(1))).toContain("Código I I-0236");
    expect(visibleText(wizard(1))).toContain("Código de colección M.M.Z. 015");
    for (const step of [2, 3] as const) {
      const text = visibleText(wizard(step));
      expect(text).toContain("Se conserva");
      expect(text).toContain("Se absorbe");
      expect(text).toContain("Código I I-0236");
      expect(text).toContain("Sin código I");
    }
  });
});

describe("diálogo de fusión compacto", () => {
  it("tiene el cuerpo con desplazamiento propio y los botones fuera de él, siempre a la vista", () => {
    const html = wizard(3);
    expect(html).toContain("overflow-y-auto");
    expect(html).toContain("open:flex");
    expect(html).toContain("max-h-[calc(100dvh-2rem)]");
    const body = html.indexOf("overflow-y-auto");
    const footer = html.indexOf(`${MERGE_CONFIRM_LABEL}</button>`);
    expect(footer).toBeGreaterThan(body);
    // El pie queda fuera del cuerpo: su contenedor se abre después de cerrar el cuerpo.
    expect(html.slice(body, footer)).toContain("border-t border-borde");
  });

  it("el motivo va primero en el documento (arriba en móvil) y a la derecha en escritorio", () => {
    const html = wizard(3);
    expect(html.indexOf("Motivo de la fusión (obligatorio)")).toBeLessThan(html.indexOf("La ficha de"));
    expect(html).toContain("md:grid-cols-[minmax(0,1fr)_17rem]");
    expect(html).toMatch(/md:order-2[^"]*md:sticky/);
  });

  it("el detalle de lo que queda en la pieza absorbida está plegado", () => {
    const html = wizard(3);
    expect(html).toMatch(/<details[^>]*>\s*<summary[^>]*>[^<]*Qué se queda en/);
    expect(html).not.toMatch(/<details[^>]*\sopen/);
  });

  it("no muestra identificadores de requisitos en ningún paso", () => {
    // Un código de pieza como «RN-004521» (Ministerio de Cultura) no es un requisito: se buscan RN-001..010, RF-001..044, etc.
    const requirement = /\b(RF-0\d{2}|RNF-0\d{2}|RN-0\d{2}|RIA-0\d)\b/;
    // Los datos de la ficha de prueba pueden citar un requisito en su texto libre; aquí solo se comprueba la copia del asistente.
    const clean = { ...toroB, description: "Descripción de prueba", notes: null };
    for (const step of [1, 2, 3] as const) expect(visibleText(wizard(step, clean))).not.toMatch(requirement);
    expect(visibleText(wizard(1, getPieceDetail(ids.piece(7))!))).not.toMatch(requirement);
    expect(visibleText(wizard(1, getPieceDetail(ids.piece(5))!))).not.toMatch(requirement);
  });
});

describe("nombres de los tipos de código en la fusión (revisar-pendientes-unificado)", () => {
  /** La pieza B con los códigos tal como los siembra la API, uno de ellos bloqueado. */
  function withSeededCodes(piece: PieceDetail): PieceDetail {
    const base = piece.identifiers.find((i) => i.identifier_type_code !== "I") ?? piece.identifiers[0]!;
    const codes: [string, boolean][] = [["COLECCION", false], ["INC_RN", false], ["PROPIETARIO", true], ["OTRO", false], ["CATALOGO", false]];
    return {
      ...piece,
      identifiers: codes.map(([code, locked], n) => ({ ...base, id: `seed-${n}`, identifier_type_code: code, original_value: `S-${n}`, is_current: true, is_locked: locked })),
    };
  }
  const seededB = withSeededCodes(toroB);
  const INTERNAL = ["COLECCION", "INC_RN", "PROPIETARIO", "OTRO", "CATALOGO"];

  it("con los códigos del seed real, ningún paso muestra un código interno", () => {
    for (const step of [1, 2, 3] as const) {
      const text = visibleText(wizard(step, seededB));
      for (const code of INTERNAL) expect(text, `paso ${step}: ${code}`).not.toContain(code);
    }
    const summary = visibleText(wizard(3, seededB));
    expect(summary).toContain("Código de colección S-0");
    expect(summary).toContain("Código INC / Registro Nacional S-1");
    expect(summary).toContain("Identificador bloqueado: Código del propietario o comodante S-2.");
    expect(summary).toContain("Otro código histórico S-3");
    // Un tipo que nadie conoce se muestra como «Otro código», nunca con su código.
    expect(summary).toContain("Otro código S-4");
  });

  it("usa el nombre que da la API cuando la cola lo provee", () => {
    const html = render(
      <IdentifierTypeNamesProvider names={{ CATALOGO: "Número de catálogo", INC_RN: "Registro Nacional (Ministerio)" }}>
        <PieceCodes piece={seededB} />
      </IdentifierTypeNamesProvider>,
    );
    expect(visibleText(html)).toContain("Número de catálogo S-4");
    expect(visibleText(html)).toContain("Registro Nacional (Ministerio) S-1");
  });
});

describe("fusión que no se confirma sin leer (prueba humana de HU-04)", () => {
  it("paso 1: la razón va junto a la pieza que se conserva y a la que no se puede elegir, no a las dos", () => {
    const html = wizard(1);
    const options = html.match(/<label\b[\s\S]*?<\/label>/g) ?? [];
    const [optionA, optionB] = options.map((o) => visibleText(o));
    expect(optionA).toContain(REQUIRED_SURVIVOR_REASON);
    expect(optionA).not.toContain(BLOCKED_SURVIVOR_REASON);
    expect(optionB).toContain(BLOCKED_SURVIVOR_REASON);
    expect(optionB).not.toContain(REQUIRED_SURVIVOR_REASON);
    // La opción que no se elige ya no se apaga entera: su razón se lee con el contraste normal.
    expect(options[1]).not.toContain("opacity-60");
    expect(options[1]).toContain("border-dashed");
  });

  it("paso 1: sin código I en ninguna pieza no aparece ninguna de las dos razones", () => {
    const sinCodigo = { ...toro, code_i: null, identifiers: [] };
    const text = visibleText(render(<MergeWizard candidate={pair} pieceA={sinCodigo} pieceB={toroB} onClose={noop} onSubmit={ok} initialStep={1} />));
    expect(text).not.toContain(REQUIRED_SURVIVOR_REASON);
    expect(text).not.toContain(BLOCKED_SURVIVOR_REASON);
  });

  it("paso 3: las etiquetas de las piezas dicen qué pasa con cada ficha, sin párrafos nuevos", () => {
    const html = wizard(3);
    const text = visibleText(html);
    expect(html).toContain('aria-label="Qué pasa con cada ficha"');
    expect(text).toContain(`${SURVIVOR_FATE} Toro de Pucará`);
    expect(text).toContain(`${ABSORBED_FATE} Toro de Pucará (3 cuernos)`);
    // El resumen recibe el foco al llegar: es lo primero que se lee, no el botón.
    expect(html).toMatch(/<div tabindex="-1"[^>]*><div [^>]*aria-label="Qué pasa con cada ficha"/);
  });

  it("los pasos 1 y 2 conservan las etiquetas cortas «Se conserva» y «Se absorbe»", () => {
    const text = visibleText(wizard(2));
    expect(text).toContain("Se conserva");
    expect(text).not.toContain(SURVIVOR_FATE);
  });
});

describe("legibilidad del asistente de fusión (Req: Legibilidad de la bandeja de pendientes)", () => {
  function smallTags(markup: string): string[] {
    return (markup.match(/<[a-z]+ [^>]*>/g) ?? []).filter((tag) => /class="[^"]*\btext-(xs|sm)\b/.test(tag));
  }

  it("ningún texto de los tres pasos baja de 16 px, salvo los átomos que el asistente sube", () => {
    for (const step of [1, 2, 3] as const) {
      const html = wizard(step);
      // `Field` (etiqueta y ayuda del motivo) y `Badge` son de components/ui (la Base); el diálogo los sube a 16 px.
      const overridden = (tag: string) => /^<span [^>]*rounded-full/.test(tag) || /^<(label|p) /.test(tag);
      expect(smallTags(html).filter((tag) => !overridden(tag)), `paso ${step}`).toEqual([]);
      expect(html).toContain("[&amp;_label]:text-base [&amp;_p]:text-base [&amp;_span.rounded-full]:text-base");
    }
  });

  it("los códigos de la pieza se leen a 16 px", () => {
    expect(smallTags(render(<PieceCodes piece={toro} />))).toEqual([]);
  });

  it("opciones, botones y el desplegable del resumen miden al menos 44 px", () => {
    for (const step of [1, 2, 3] as const) {
      const html = wizard(step);
      for (const button of html.match(/<button\b[^>]*>/g) ?? []) expect(button, `paso ${step}`).toMatch(/\bmin-h-11\b/);
      for (const option of html.match(/<label class="[^"]*rounded-md border[^"]*"/g) ?? []) expect(option).toMatch(/\bmin-h-11\b/);
    }
    expect(wizard(3)).toMatch(/<summary[^>]*class="[^"]*min-h-11/);
  });
});
