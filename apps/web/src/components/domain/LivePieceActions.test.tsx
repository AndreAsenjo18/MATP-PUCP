import { describe, expect, it } from "vitest";

import type { ApiSchemas } from "@/lib/api/client";
import { getPieceDetail, ids } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import { LiveIdentifierActions, LivePieceHeaderActions, inventoryIdentifierOf, pieceActionsCan } from "./LivePieceActions";
import { PieceIdentifiersTable } from "./PieceSheet";

// Datos sintéticos (RNF-014). Los permisos son los que da la semilla a cada rol (`seed/reference.py`).
const ADMIN = ["pieces.update", "pieces.create", "pieces.delete", "pieces.restore", "identifiers.manage", "identifiers.correct_inventory_code"];
const MANAGER = ["pieces.update", "pieces.create", "pieces.delete", "identifiers.manage"];
const CATALOGUER = ["pieces.update", "pieces.create", "identifiers.manage"];
const VIEWER = ["pieces.read"];

const can = (permissions: string[]) => (permission: string) => permissions.includes(permission);
const noop = () => {};
const correct = async () => ({ ok: true as const });

type Identifier = ApiSchemas["PieceDetail"]["identifiers"][number];

function pieceWithCode(): ApiSchemas["PieceDetail"] {
  const piece = getPieceDetail(ids.piece(1));
  if (!piece) throw new Error("Falta la pieza del fixture");
  const code: Identifier = {
    id: "codigo-vigente",
    piece_id: piece.id,
    identifier_type_code: "I",
    original_value: "I-4321",
    normalized_value: "I-4321",
    detected_format: null,
    normalization_status: "NORMALIZED",
    is_current: true,
    is_locked: true,
    notes: null,
    source: null,
    recorded_at: "2026-10-25T10:00:00Z",
    replaced_by_id: null,
  };
  return { ...piece, denomination: "Mate sintético", code_i: "I-4321", identifiers: [code] };
}

const TYPES = [
  { code: "I", label: "Código de inventario general (I)", is_active: true },
  { code: "COLECCION", label: "Código de colección", is_active: true },
  { code: "ANTIGUO", label: "Código en desuso", is_active: false },
] as ApiSchemas["IdentifierTypeOut"][];

function identifierActions(permissions: string[], overrides: Partial<Parameters<typeof LiveIdentifierActions>[0]> = {}) {
  return render(<LiveIdentifierActions piece={pieceWithCode()} can={can(permissions)} types={TYPES} onRegistered={noop} onCorrect={correct} {...overrides} />);
}

describe("eliminar desde la ficha conectada", () => {
  const header = (permissions: string[]) => render(<LivePieceHeaderActions pieceId="p-1" can={can(permissions)} onDelete={noop} />);

  it("lo ofrece a quien tiene `pieces.delete`: Administrador y Gestora de colecciones", () => {
    expect(visibleText(header(ADMIN))).toContain("Eliminar pieza");
    expect(visibleText(header(MANAGER))).toContain("Eliminar pieza");
  });

  it("no lo ofrece al Catalogador, que sí puede editar", () => {
    const text = visibleText(header(CATALOGUER));
    expect(text).not.toContain("Eliminar pieza");
    expect(text).toContain("Editar ficha");
  });

  it("no muestra nada a Consulta interna", () => {
    expect(header(VIEWER)).toBe("");
  });

  it("enlaza a la edición de esa pieza y deja «Registrar a partir de esta pieza» a la pantalla", () => {
    const html = render(<LivePieceHeaderActions pieceId="p-1" can={can(CATALOGUER)} registerSimilar={<span>Registrar similar</span>} onDelete={noop} />);
    expect(html).toContain('href="/piezas/p-1/editar"');
    expect(visibleText(html)).toContain("Registrar similar");
  });
});

describe("registrar códigos desde la ficha conectada", () => {
  it("lo ofrece con `identifiers.manage` y solo con los tipos activos", () => {
    const html = identifierActions(CATALOGUER);
    const text = visibleText(html);
    expect(html).toContain('aria-label="Registrar identificador"');
    expect(text).toContain("Código de colección");
    expect(text).not.toContain("Código en desuso");
  });

  it("no lo ofrece a Consulta interna", () => {
    expect(identifierActions(VIEWER)).not.toContain("Registrar identificador");
  });

  it("no lo muestra mientras cargan los tipos", () => {
    expect(identifierActions(CATALOGUER, { types: null })).not.toContain("Registrar identificador");
  });

  it("explica si no pudo cargar los tipos, sin ofrecer un formulario vacío", () => {
    const html = identifierActions(CATALOGUER, { types: null, typesError: "No se pudo conectar con el servidor." });
    expect(html).toContain('role="alert"');
    expect(visibleText(html)).toContain("No se pudo preparar el registro de códigos");
    expect(html).not.toContain('aria-label="Registrar identificador"');
  });

  it("no avisa del error a quien no puede registrar", () => {
    expect(identifierActions(VIEWER, { types: null, typesError: "Sin permiso" })).toBe("");
  });
});

describe("corregir el código I desde la ficha conectada", () => {
  it("lo ofrece al Administrador, con la pieza y el código vigente en el diálogo", () => {
    const text = visibleText(identifierActions(ADMIN));
    expect(text).toContain("Corregir código I (procedimiento auditado)");
    expect(text).toContain("Corregir el código I");
    expect(text).toContain("Mate sintético");
    expect(text).toContain("I-4321");
  });

  it("no lo ofrece a la Gestora de colecciones ni al Catalogador", () => {
    expect(visibleText(identifierActions(MANAGER))).not.toContain("Corregir código I");
    expect(visibleText(identifierActions(CATALOGUER))).not.toContain("Corregir código I");
  });

  it("no lo ofrece si la pieza no tiene código I", () => {
    const piece = { ...pieceWithCode(), code_i: null, identifiers: [] };
    expect(visibleText(identifierActions(ADMIN, { piece }))).not.toContain("Corregir código I");
  });
});

describe("una pieza fusionada", () => {
  const merged_into = { piece_id: "sobreviviente", merged_at: "2026-10-25T10:00:00Z", reason: "Duplicado sintético" };
  const mergedCan = pieceActionsCan({ merged_into }, can(ADMIN));

  it("no ofrece ninguna acción, ni al Administrador", () => {
    expect(render(<LivePieceHeaderActions pieceId="p-1" can={mergedCan} onDelete={noop} />)).toBe("");
    expect(render(<LiveIdentifierActions piece={{ ...pieceWithCode(), merged_into }} can={mergedCan} types={TYPES} onRegistered={noop} onCorrect={correct} />)).toBe("");
  });

  it("una pieza sin fusionar conserva los permisos del rol", () => {
    const notMerged = pieceActionsCan({ merged_into: null }, can(MANAGER));
    expect(notMerged("pieces.delete")).toBe(true);
    expect(notMerged("pieces.restore")).toBe(false);
  });
});

describe("el historial de códigos en la ficha conectada", () => {
  it("muestra el código anterior como histórico junto al vigente (RF-002, RN-005)", () => {
    const piece = pieceWithCode();
    const previous: Identifier = { ...piece.identifiers[0], id: "codigo-anterior", original_value: "I-1234", normalized_value: "I-1234", is_current: false };
    const rows = render(<PieceIdentifiersTable piece={{ ...piece, identifiers: [previous, ...piece.identifiers] }} />).split("</tr>");

    expect(visibleText(rows.find((row) => row.includes("I-1234")) ?? "")).toContain("Histórico");
    expect(visibleText(rows.find((row) => row.includes("I-4321")) ?? "")).toContain("Vigente");
  });

  it("avisa si solo puede mostrar los vigentes, también a quien no puede registrar", () => {
    const html = identifierActions(VIEWER, { types: null, historyError: "No se pudo conectar con el servidor." });
    expect(visibleText(html)).toContain("Solo se muestran los códigos vigentes");
    expect(visibleText(html)).toContain("No se pudo conectar con el servidor.");
  });

  it("no avisa nada si el historial se leyó bien", () => {
    expect(visibleText(identifierActions(CATALOGUER))).not.toContain("Solo se muestran");
  });
});

describe("el código I que se corrige", () => {
  const code = (id: string, is_current: boolean, identifier_type_code = "I") => ({ ...pieceWithCode().identifiers[0], id, is_current, identifier_type_code });

  it("es el vigente, aunque haya otros anteriores", () => {
    expect(inventoryIdentifierOf({ identifiers: [code("antiguo", false), code("vigente", true)] })?.id).toBe("vigente");
  });

  it("no confunde otros tipos de código", () => {
    expect(inventoryIdentifierOf({ identifiers: [code("coleccion", true, "COLECCION")] })).toBeUndefined();
  });

  it("si ninguno está vigente, es el último que tuvo", () => {
    expect(inventoryIdentifierOf({ identifiers: [code("antiguo", false)] })?.id).toBe("antiguo");
  });
});
