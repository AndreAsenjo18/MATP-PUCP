import { describe, expect, it } from "vitest";

import type { ApiSchemas } from "@/lib/api/client";
import type { DuplicateCandidate } from "@/lib/data/duplicates";
import { DUPLICATE_CANDIDATES, getPieceDetail, ids } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import {
  DuplicateCandidateCard,
  DuplicateCandidateRow,
  DuplicateFilters,
  DEFAULT_FILTERS,
  IdentifierTypeNamesProvider,
  QueuePager,
  ScanPanel,
  SEEDED_IDENTIFIER_TYPE_NAMES,
  SIMILARITY_WORDS,
  UNKNOWN_SIGNAL,
  identifierTypeName,
  mainSignal,
  signalLabel,
  signalValueLines,
} from "./DuplicateReview";

// Change revisar-pendientes-unificado, tareas 3.2 a 3.4. HTML estático (ADR-012); datos sintéticos.

type Signal = DuplicateCandidate["matched_fields"][number];
type PieceDetail = ApiSchemas["PieceDetail"];

const noop = () => {};
const [PAIR, IMPORT_PAIR] = DUPLICATE_CANDIDATES;
const PIECE_A = getPieceDetail(ids.piece(1))!;
const PIECE_B = getPieceDetail(ids.piece(2))!;

/** Una pieza con los códigos de tipo tal como los siembra la API (`COLECCION`, `INC_RN`, `PROPIETARIO`, `OTRO`). */
function withSeededCodes(piece: PieceDetail): PieceDetail {
  const base = piece.identifiers[0]!;
  const codes = ["COLECCION", "INC_RN", "PROPIETARIO", "OTRO"];
  return {
    ...piece,
    identifiers: codes.map((code, n) => ({ ...base, id: `${base.id}-${n}`, identifier_type_code: code, original_value: `X-${n}`, is_current: true })),
  };
}

function row(candidate: DuplicateCandidate, options: { open?: boolean; pieceA?: PieceDetail | null; pieceB?: PieceDetail | null; piecesLoading?: boolean } = {}) {
  const pieceA = options.pieceA === undefined ? PIECE_A : options.pieceA;
  const pieceB = options.pieceB === undefined ? (candidate.piece_b_id ? PIECE_B : null) : options.pieceB;
  return render(
    <DuplicateCandidateRow
      candidate={candidate}
      pieceA={pieceA}
      pieceB={pieceB}
      piecesLoading={options.piecesLoading ?? false}
      open={options.open ?? false}
      onToggle={noop}
    >
      <DuplicateCandidateCard
        candidate={candidate}
        pieceA={pieceA}
        pieceB={pieceB}
        piecesLoading={false}
        canResolve
        onMerge={noop}
        onDistinct={noop}
        onPostpone={noop}
      />
    </DuplicateCandidateRow>,
  );
}

describe("nombres de los tipos de identificador (Req: Etiquetas de las señales de duplicado en español)", () => {
  it("el nombre de la API manda; si no, el sembrado; si no, «Otro código»", () => {
    expect(identifierTypeName("INC_RN", { INC_RN: "Registro Nacional (Ministerio)" })).toBe("Registro Nacional (Ministerio)");
    expect(identifierTypeName("INC_RN")).toBe("Código INC / Registro Nacional");
    expect(identifierTypeName("CATALOGO", { CATALOGO: "Número de catálogo" })).toBe("Número de catálogo");
    expect(identifierTypeName("CATALOGO")).toBe("Otro código");
  });

  it("cubre los códigos del seed de la API y los de los datos de demostración", () => {
    for (const code of ["I", "COLECCION", "INC_RN", "PUCP", "PROPIETARIO", "OTRO", "COLLECTION", "OWNER", "OTHER"]) {
      expect(SEEDED_IDENTIFIER_TYPE_NAMES[code]).toEqual(expect.any(String));
    }
  });

  it("señales conocidas en español; la desconocida es «Otro dato»", () => {
    const signals: Signal[] = [
      { signal: "denomination", field: "denomination", similarity: 0.9 },
      { signal: "collection", field: "collection_id", similarity: 1 },
      { signal: "identifier", field: "identifier:INC_RN", similarity: 1 },
      { signal: "material_overlap", field: "material_overlap", similarity: 0.6 },
    ];
    expect(signals.map((signal) => signalLabel(signal))).toEqual([
      "Denominación parecida",
      "Misma colección o subcolección",
      "Coincide: Código INC / Registro Nacional",
      UNKNOWN_SIGNAL,
    ]);
  });

  it("un valor comparado con nombre desconocido se rotula «Otro dato»", () => {
    expect(signalValueLines({ signal: "author_provenance", field: "author+provenance", similarity: 1, values: { author: ["A", "A"], weird_key: ["x", "y"] } })).toEqual([
      { label: "Autor", a: "A", b: "A" },
      { label: UNKNOWN_SIGNAL, a: "x", b: "y" },
    ]);
  });

  it("ningún nombre interno aparece en la fila ni en el detalle", () => {
    const candidate: DuplicateCandidate = {
      ...PAIR,
      matched_fields: [
        ...PAIR.matched_fields,
        { signal: "identifier", field: "identifier:INC_RN", similarity: 1, contribution: 0.4, values: { a: "RN 1", b: "RN 1" } },
        { signal: "material_overlap", field: "material_overlap", similarity: 0.6, values: { weird_key: ["x", "y"] } },
      ],
    };
    const html = row(candidate, { open: true, pieceA: withSeededCodes(PIECE_A), pieceB: withSeededCodes(PIECE_B) });
    const text = visibleText(html);
    const internal = new Set(["COLECCION", "INC_RN", "PROPIETARIO", "OTRO", "COLLECTION", "weird_key", "author_provenance"]);
    for (const signal of candidate.matched_fields) {
      if (signal.signal) internal.add(signal.signal);
      internal.add(signal.field);
    }
    // Los nombres internos están en inglés o son códigos en mayúsculas; el texto visible, en español (sensible a mayúsculas).
    for (const name of internal) expect(text, name).not.toContain(name);
    expect(text).toContain("Código de colección X-0");
    expect(text).toContain("Código INC / Registro Nacional X-1");
  });

  it("las fichas leen los nombres que da la API a través de la cola", () => {
    const html = render(
      <IdentifierTypeNamesProvider names={{ COLECCION: "Correlativo de colección" }}>
        <DuplicateCandidateCard
          candidate={PAIR}
          pieceA={withSeededCodes(PIECE_A)}
          pieceB={PIECE_B}
          piecesLoading={false}
          canResolve={false}
          onMerge={noop}
          onDistinct={noop}
          onPostpone={noop}
        />
      </IdentifierTypeNamesProvider>,
    );
    expect(visibleText(html)).toContain("Correlativo de colección X-0");
  });
});

describe("motivo principal de la fila", () => {
  it("un conflicto de códigos I manda; si no, lo que más aporta; si no, la mayor similitud", () => {
    const conflict: Signal = { signal: "inventory_code_conflict", field: "identifier:I", similarity: 0 };
    const big: Signal = { signal: "denomination", field: "denomination", similarity: 0.5, contribution: 0.4 };
    const small: Signal = { signal: "collection", field: "collection_id", similarity: 1, contribution: 0.1 };
    expect(mainSignal([small, conflict, big])).toBe(conflict);
    expect(mainSignal([small, big])).toBe(big);
    const a: Signal = { signal: "denomination", field: "denomination", similarity: 0.7 };
    const b: Signal = { signal: "epoch", field: "period", similarity: 0.9 };
    expect(mainSignal([a, b])).toBe(b);
    expect(mainSignal([])).toBeNull();
  });
});

describe("fila compacta (Req: Lista compacta de posibles duplicados)", () => {
  it("cerrada: las dos piezas, sus códigos, colección, nivel en palabras, motivo y «Revisar»; sin círculo ni explicación", () => {
    const html = row(PAIR);
    const text = visibleText(html);
    expect(text).toContain(PIECE_A.denomination);
    expect(text).toContain(PIECE_B.denomination);
    expect(text).toContain(`Código I ${PIECE_A.code_i}`);
    expect(text).toContain("Sin código I");
    expect(text).toContain(PIECE_A.collection!.name);
    expect(text).toContain(SIMILARITY_WORDS.high);
    expect(text).toContain("Coincide: Código de colección");
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*>Revisar<\/button>/);
    expect(html).not.toContain("conic-gradient");
    expect(text).not.toContain("Ver por qué se propone");
    expect(text).not.toMatch(/\d+ %/);
  });

  it("abierta: el detalle con la similitud destacada y las tres acciones, enlazado al botón", () => {
    const html = row(PAIR, { open: true });
    const controls = html.match(/aria-controls="([^"]+)"/)?.[1];
    expect(html).toMatch(/<button[^>]*aria-expanded="true"[^>]*>Cerrar<\/button>/);
    expect(controls).toBeTruthy();
    expect(html).toContain(`id="${controls}"`);
    expect(html).toContain("conic-gradient");
    for (const action of ["Fusionar", "Marcar como distinto", "Posponer"]) expect(visibleText(html)).toContain(action);
  });

  it("par con una fila de importación: la pieza y «Fila de importación»; al abrir, «Ver en Importación» y sin fusionar", () => {
    const closed = visibleText(row(IMPORT_PAIR));
    expect(closed).toContain("Fila de importación");
    const open = row(IMPORT_PAIR, { open: true });
    expect(visibleText(open)).toContain("Ver en Importación");
    expect(visibleText(open)).not.toContain("Fusionar");
  });

  it("ficha no disponible: lo dice en su lugar y conserva el nivel y «Revisar»", () => {
    const text = visibleText(row(PAIR, { pieceA: null }));
    expect(text).toContain("ficha no disponible");
    expect(text).toContain(SIMILARITY_WORDS.high);
    expect(text).toContain("Revisar");
  });

  it("par ya resuelto: muestra su estado en la fila", () => {
    expect(visibleText(row({ ...PAIR, status: "POSTPONED" }))).toMatch(/Pospuesto/i);
  });

  it("en celular apila las dos piezas y el botón ocupa el ancho", () => {
    const html = row(PAIR);
    expect(html).toMatch(/class="grid min-w-0 flex-1 gap-3 sm:grid-cols-2"/);
    expect(html).toMatch(/<button[^>]*class="[^"]*w-full lg:w-auto/);
    expect(html).toMatch(/<button[^>]*class="[^"]*min-h-11/);
  });
});

describe("legibilidad de la cola (Req: Legibilidad de la bandeja de pendientes)", () => {
  const html = [
    row(PAIR, { open: true }),
    row(IMPORT_PAIR, { open: true }),
    render(<DuplicateFilters value={DEFAULT_FILTERS} collections={[]} onChange={noop} />),
    render(<QueuePager page={1} pageCount={2} label="Páginas" onPage={noop} />),
    render(<ScanPanel job={null} error="Sin conexión" starting={false} canScan onStart={noop} />),
  ].join("");

  /** Etiquetas HTML con una clase de letra menor de 16 px. */
  function smallTags(markup: string): string[] {
    return (markup.match(/<[a-z]+ [^>]*>/g) ?? []).filter((tag) => /class="[^"]*\btext-(xs|sm)\b/.test(tag));
  }

  it("ningún texto de la fila, el detalle, los filtros, el paginador ni la detección baja de 16 px", () => {
    // Las únicas clases pequeñas que quedan son de átomos de components/ui (de la Base, C28), y esta
    // vista las sube a 16 px con un selector de su contenedor: las etiquetas de `Badge` en la tarjeta
    // y la etiqueta y ayuda de `Field` en los filtros. Cualquier otra clase pequeña es un error.
    const overridden = (tag: string) => /^<span [^>]*rounded-full/.test(tag) || /^<(label|p) /.test(tag);
    expect(smallTags(html).filter((tag) => !overridden(tag))).toEqual([]);
    expect(row(PAIR, { open: true })).toContain("[&amp;_span.rounded-full]:text-base");
    const filters = render(<DuplicateFilters value={DEFAULT_FILTERS} collections={[]} onChange={noop} />);
    expect(filters.match(/\[&amp;_label\]:text-base \[&amp;_p\]:text-base/g)).toHaveLength(4);
    // En la fila cerrada no hay ni siquiera esas: todo es de esta vista.
    expect(smallTags(row(PAIR))).toEqual([]);
  });

  it("botones, «Ver por qué se propone», enlaces de acción y filtros miden al menos 44 px", () => {
    for (const button of html.match(/<button\b[^>]*>/g) ?? []) expect(button).toMatch(/\bmin-h-11\b/);
    expect(html).toMatch(/<summary[^>]*class="[^"]*min-h-11/);
    const importLink = (html.match(/<a\b[^>]*>/g) ?? []).find((a) => a.includes('href="/importacion"'));
    expect(importLink).toMatch(/\bmin-h-11\b/);
    const selects = html.match(/<select\b[^>]*>/g) ?? [];
    expect(selects).toHaveLength(4);
    for (const select of selects) expect(select).toMatch(/\bmin-h-11\b/);
    expect(html).toContain("[&amp;_label]:text-base");
  });
});
