import { describe, expect, it } from "vitest";

import type { ApiSchemas } from "@/lib/api/client";
import type { DuplicateCandidate, QualityJob } from "@/lib/data/duplicates";
import { DUPLICATE_CANDIDATES, getPieceDetail, ids } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import {
  COMPARISON_ROWS,
  ComparisonTable,
  DEFAULT_FILTERS,
  DuplicateCandidateCard,
  DistinctDialog,
  DuplicateFilters,
  MERGE_LOADING_NOTE,
  PostponeDialog,
  QueuePager,
  MERGE_UNAVAILABLE_NOTE,
  SCAN_HINT,
  SCAN_STARTING_TEXT,
  ScanPanel,
  SimilarityMeter,
  canBeResolved,
  comparisonRowState,
  jobProgressText,
  markedRows,
  mergeUnavailableReason,
  pieceSide,
  scanLineText,
  signalLabel,
  signalValueLines,
  similarityLevel,
} from "./DuplicateReview";
import { qualityJobStatus } from "./status-intents";

type PieceDetail = ApiSchemas["PieceDetail"];

const noop = () => {};
// «Es la misma pieza» es la decisión que fusiona (change revisar-duplicados-comparacion).
const disabledButton = /<button[^>]*\sdisabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Es la misma pieza/;
const enabledMerge = /<button(?![^>]*\sdisabled="")[^>]*>(?:(?!<\/button>)[\s\S])*Es la misma pieza/;

function candidate(overrides: Partial<DuplicateCandidate> = {}): DuplicateCandidate {
  return { ...DUPLICATE_CANDIDATES[0], ...overrides };
}

const JOB: QualityJob = {
  id: "job-1",
  job_type: "FULL_SCAN",
  status: "RUNNING",
  requested_by_id: null,
  started_at: null,
  heartbeat_at: null,
  finished_at: null,
  total_pieces: 298,
  processed_pieces: 120,
  pairs_evaluated: 610,
  candidates_created: 3,
  candidates_reopened: 1,
  duration_ms: 1500,
  error_message: null,
};

describe("señales explicadas (RF-030)", () => {
  it("nombra cada señal y su tipo de identificador", () => {
    // revisar-pendientes-unificado 3.2: nombre del tipo en español; un tipo desconocido no muestra su código.
    expect(signalLabel({ signal: "identifier", field: "identifier:INC_RN", similarity: 1 })).toBe("Coincide: Código INC / Registro Nacional");
    expect(signalLabel({ signal: "identifier", field: "identifier:INC", similarity: 1 })).toBe("Coincide: Otro código");
    expect(signalLabel({ signal: "inventory_code_conflict", field: "identifier:I", similarity: 0 })).toBe("Códigos I vigentes distintos");
    expect(signalLabel({ signal: "collection", field: "collection_id", similarity: 0 })).toBe("Colecciones distintas");
    // Una señal desconocida es «Otro dato», nunca su nombre interno (antes devolvía el `field`).
    expect(signalLabel({ field: "denominación libre", similarity: 0.5 })).toBe("Otro dato");
  });

  it("los pares de una importación traen el tipo en `field`: ya no salen como «Otro dato»", () => {
    // revisar-duplicados-comparacion: el clasificador guarda {"field": "denomination"} sin `signal`.
    expect(signalLabel({ field: "denomination", similarity: 1 })).toBe("Denominación igual");
    expect(signalLabel({ field: "denomination", similarity: 0.8 })).toBe("Denominación parecida");
    expect(signalLabel({ field: "collection", similarity: 1 })).toBe("Misma colección o subcolección");
    expect(Object.fromEntries(markedRows([{ field: "denomination", similarity: 1 }, { field: "collection", similarity: 1 }]))).toEqual({ denomination: "match", collection: "match" });
  });

  it("muestra los valores comparados de cada forma de señal", () => {
    expect(signalValueLines({ signal: "identifier", field: "identifier:INC", similarity: 1, values: { normalized: "001234", a: "INC 1234", b: "001234" } })).toEqual([
      { label: "Normalizado 001234", a: "INC 1234", b: "001234" },
    ]);
    expect(
      signalValueLines({ signal: "author_provenance", field: "author+provenance", similarity: 0.9, values: { author: ["Taller A", "Taller A."], provenance: ["Puno", "Puno"] } }),
    ).toEqual([
      { label: "Autor", a: "Taller A", b: "Taller A." },
      { label: "Procedencia", a: "Puno", b: "Puno" },
    ]);
    expect(signalValueLines({ signal: "epoch", field: "epoch_start_year+epoch_end_year", similarity: 1, values: { a: [1901, 2000], b: [1950, 1950] } })).toEqual([
      { label: null, a: "1901–2000", b: "1950–1950" },
    ]);
    expect(signalValueLines({ signal: "collection", field: "collection_id", similarity: 1, values: { a: "x", b: "x" } })).toEqual([]);
    expect(signalValueLines({ signal: "denomination", field: "denomination", similarity: 1 })).toEqual([]);
  });

  it("marca las filas que motivan la sospecha y el conflicto de código I", () => {
    const marks = markedRows([
      { signal: "identifier", field: "identifier:COLLECTION", similarity: 1 },
      { signal: "denomination", field: "denomination", similarity: 0.9 },
      { signal: "collection", field: "collection_id", similarity: 0 },
      { signal: "author_provenance", field: "provenance", similarity: 1 },
      { signal: "inventory_code_conflict", field: "identifier:I", similarity: 0 },
    ]);
    expect(Object.fromEntries(marks)).toEqual({ identifiers: "match", denomination: "match", provenance: "match", code_i: "conflict" });
    expect(markedRows([{ signal: "identifier", field: "identifier:I", similarity: 1 }]).get("code_i")).toBe("match");
  });

  it("un par fusionado o reemplazado ya no se resuelve", () => {
    expect(canBeResolved({ status: "PENDING" })).toBe(true);
    expect(canBeResolved({ status: "DISTINCT" })).toBe(true);
    expect(canBeResolved({ status: "MERGED" })).toBe(false);
    expect(canBeResolved({ status: "SUPERSEDED" })).toBe(false);
  });
});

describe("DuplicateCandidateCard", () => {
  const pieceA = getPieceDetail(ids.piece(1));
  const pieceB = getPieceDetail(ids.piece(2));

  it("compara las dos fichas lado a lado con las filas de las señales resaltadas y con texto", () => {
    const html = render(
      <DuplicateCandidateCard candidate={candidate()} pieceA={pieceA} pieceB={pieceB} piecesLoading={false} canResolve onMerge={noop} onDistinct={noop} onPostpone={noop} />,
    );
    const text = visibleText(html);
    // Una pregunta, el nivel en palabras y el tipo de par; sin el círculo de porcentaje.
    expect(text).toContain("¿Es la misma pieza?");
    expect(text).toContain("Muy parecidas");
    expect(text).toContain("Dos piezas del catálogo");
    expect(html).not.toContain("conic-gradient");
    expect(text).toContain("Pieza A");
    expect(text).toContain("Toro de Pucará (3 cuernos)");
    for (const row of COMPARISON_ROWS) expect(text).toContain(row.label);
    // Las filas que motivan la sospecha (denominación, colección y otros códigos) son «Igual».
    expect(html.match(/data-mark="match"/g)?.length).toBeGreaterThanOrEqual(3);
    expect(text).toContain("Igual");
    // Los motivos, en palabras y sin porcentajes ni el detalle plegado de antes.
    expect(text).toContain("Se propone porque:");
    expect(text).toContain("Coincide: Código de colección");
    expect(text).not.toMatch(/\d+ %/);
    expect(text).not.toContain("Ver por qué se propone");
    expect(html).toContain(`href="/piezas/${ids.piece(1)}"`);
    expect(html).toMatch(/role="switch"[^>]*aria-checked="false"/);
    expect(text).toContain("Solo diferencias");
  });

  it("habilita Fusionar con las dos fichas y muestra distinto y posponer", () => {
    const html = render(
      <DuplicateCandidateCard candidate={candidate()} pieceA={pieceA} pieceB={pieceB} piecesLoading={false} canResolve onMerge={noop} onDistinct={noop} onPostpone={noop} />,
    );
    expect(html).toMatch(enabledMerge);
    expect(html).not.toMatch(disabledButton);
    const text = visibleText(html);
    // Cada decisión dice qué pasará al elegirla.
    expect(text).toContain("Se fusionan en una sola ficha");
    expect(text).toContain("Son piezas distintas");
    expect(text).toContain("El par sale de la cola");
    expect(text).toContain("Decidir después");
  });

  it("deshabilita Fusionar con el motivo a la vista: códigos I distintos, regímenes distintos o fichas sin cargar", () => {
    const otherCode = getPieceDetail(ids.piece(7))!; // código I-0450 frente a I-0236
    const comodato = getPieceDetail(ids.piece(5))!; // Comodato frente a Propiedad
    const cases: [DuplicateCandidate, PieceDetail | null | undefined, PieceDetail | null | undefined, boolean, RegExp | string][] = [
      [candidate({ blocking_conflict: true }), pieceA, otherCode, false, /códigos I vigentes distintos \(I-0236 y I-0450\)/],
      [candidate(), pieceA, comodato, false, /regímenes de tenencia distintos \(Propiedad y Comodato\)/],
      [candidate({ blocking_conflict: true }), undefined, undefined, true, /códigos I vigentes distintos\./],
      [candidate(), undefined, undefined, true, MERGE_LOADING_NOTE],
      [candidate(), pieceA, null, false, MERGE_UNAVAILABLE_NOTE],
    ];
    for (const [pair, a, b, loading, message] of cases) {
      const html = render(<DuplicateCandidateCard candidate={pair} pieceA={a} pieceB={b} piecesLoading={loading} canResolve onMerge={noop} onDistinct={noop} onPostpone={noop} />);
      expect(html).toMatch(disabledButton);
      const noteId = html.match(/<button[^>]*\sdisabled=""[^>]*aria-describedby="([^"]+)"|<button[^>]*aria-describedby="([^"]+)"[^>]*\sdisabled=""/);
      const id = noteId?.[1] ?? noteId?.[2];
      expect(id).toBeTruthy();
      expect(html).toContain(`id="${id}"`);
      expect(visibleText(html)).toMatch(message);
    }
    expect(mergeUnavailableReason(candidate(), pieceA, pieceB, false)).toBeNull();
  });

  it("sin duplicates.resolve o con el par cerrado no muestra acciones", () => {
    const withoutPermission = visibleText(
      render(<DuplicateCandidateCard candidate={candidate()} pieceA={pieceA} pieceB={pieceB} piecesLoading={false} canResolve={false} onMerge={noop} onDistinct={noop} onPostpone={noop} />),
    );
    const merged = visibleText(
      render(<DuplicateCandidateCard candidate={candidate({ status: "MERGED" })} pieceA={pieceA} pieceB={pieceB} piecesLoading={false} canResolve onMerge={noop} onDistinct={noop} onPostpone={noop} />),
    );
    for (const text of [withoutPermission, merged]) {
      expect(text).not.toContain("Son piezas distintas");
      expect(text).not.toContain("Decidir después");
    }
    expect(merged).toContain("Fusionado");
  });

  it("avisa el bloqueo por códigos I distintos, la fecha de posposición y el motivo", () => {
    const text = visibleText(
      render(
        <DuplicateCandidateCard
          candidate={candidate({ blocking_conflict: true, status: "POSTPONED", postponed_until: "2026-12-01T12:00:00Z", resolution_note: "Esperar ficha física" })}
          pieceA={pieceA}
          pieceB={getPieceDetail(ids.piece(7))}
          piecesLoading={false}
          canResolve
          onMerge={noop}
          onDistinct={noop}
          onPostpone={noop}
        />,
      ),
    );
    expect(text).toContain("Códigos I distintos: no se puede fusionar");
    expect(text).not.toMatch(/\b(RF|RN|RNF|RIA)-\d+/);
    expect(text).toContain("Pospuesto hasta el");
    expect(text).toContain("Motivo registrado: Esperar ficha física");
  });

  it("una fila del Excel se compara campo por campo con su lote; sin permiso de carga, se explica quién la decide", () => {
    const importRow = DUPLICATE_CANDIDATES.find((c) => c.import_row_id !== null)!;
    const html = render(<DuplicateCandidateCard candidate={importRow} pieceA={null} pieceB={null} piecesLoading={false} canResolve onMerge={noop} onDistinct={noop} onPostpone={noop} />);
    const text = visibleText(html);
    expect(text).toContain("Pieza y fila de un Excel");
    expect(text).toContain("Fila del Excel");
    expect(text).toContain("Fila 6 · Lote «Sábana de prueba (sintética)»");
    expect(text).toContain("Charango (sintético, fila de carga)");
    expect(text).toContain("Ficha no disponible");
    expect(text).toContain("Solo en el Excel"); // la procedencia solo la trae la fila
    // Sin `imports.prepare` no se decide aquí: la misma pieza queda deshabilitada y se enlaza al lote.
    expect(html).toMatch(disabledButton);
    expect(text).toContain("Decidir la fila le corresponde a quien prepara la carga.");
    expect(html).toContain(`href="/importacion?lote=${ids.importBatch(1)}"`);
  });

  it("con permiso de carga, la fila se decide aquí: actualiza la pieza o entra como nueva", () => {
    const importRow = DUPLICATE_CANDIDATES.find((c) => c.import_row_id !== null)!;
    const html = render(
      <DuplicateCandidateCard candidate={importRow} pieceA={getPieceDetail(ids.piece(9))} pieceB={null} piecesLoading={false} canResolve canDecideRow onRowDecision={noop} onMerge={noop} onDistinct={noop} onPostpone={noop} />,
    );
    const text = visibleText(html);
    expect(html).toMatch(enabledMerge);
    expect(text).toMatch(/La fila actualizará «[^»]+» al aprobar la carga/);
    expect(text).toContain("La fila entrará como pieza nueva al aprobar la carga.");
    expect(text).not.toContain("le corresponde a quien prepara la carga");

    const decided = visibleText(
      render(
        <DuplicateCandidateCard
          candidate={{ ...importRow, import_row: { ...importRow.import_row!, resolution: "new" } }}
          pieceA={null}
          pieceB={null}
          piecesLoading={false}
          canResolve
          canDecideRow
          onRowDecision={noop}
          onMerge={noop}
          onDistinct={noop}
          onPostpone={noop}
        />,
      ),
    );
    expect(decided).toContain("Su lote ya decidió que la fila entra como pieza nueva.");
  });

  it("una ficha que aún no llega se indica en su columna; una fila sin datos remite a su lote", () => {
    const loading = visibleText(
      render(<DuplicateCandidateCard candidate={candidate()} pieceA={undefined} pieceB={undefined} piecesLoading canResolve onMerge={noop} onDistinct={noop} onPostpone={noop} />),
    );
    expect(loading).toContain("Cargando ficha…");
    const importRow = DUPLICATE_CANDIDATES.find((c) => c.import_row_id !== null)!;
    const withoutRow = visibleText(
      render(<DuplicateCandidateCard candidate={{ ...importRow, import_row: null }} pieceA={null} pieceB={null} piecesLoading={false} canResolve onMerge={noop} onDistinct={noop} onPostpone={noop} />),
    );
    expect(withoutRow).toContain("Sus datos no están disponibles: revísela en su lote.");
  });
});

describe("filtros y detección completa", () => {
  it("los filtros parten de pendientes y listan colecciones con sus subcolecciones", () => {
    const html = render(
      <DuplicateFilters
        value={DEFAULT_FILTERS}
        collections={[
          { id: "c1", name: "Colección RA (ficticia)", parent_id: null },
          { id: "c2", name: "Subcolección RAB (ficticia)", parent_id: "c1" },
        ]}
        onChange={noop}
      />,
    );
    const text = visibleText(html);
    // Píldoras (revisar-duplicados-comparacion): «Origen» pasa a «Tipo de par».
    for (const label of ["Estado", "Colección", "Similitud", "Tipo de par", "Pendientes", "Pieza y fila de un Excel", "Dos piezas del catálogo", "60 % o más"]) expect(text).toContain(label);
    expect(text).not.toContain("Origen");
    expect(text).toContain("— Subcolección RAB (ficticia)");
    expect(html).toMatch(/<option value="PENDING" selected="">Pendientes<\/option>/);
    expect(html).toContain('aria-label="Colección (incluye sus subcolecciones)"');
    // «Estado» siempre tiene valor: sin ✕. Un filtro activo sí la tiene.
    expect(html).not.toContain("Quitar el filtro Estado");
    const active = render(<DuplicateFilters value={{ ...DEFAULT_FILTERS, origin: "IMPORT" }} collections={[]} onChange={noop} />);
    expect(visibleText(active)).toContain("Tipo de par: Pieza y fila de un Excel");
    expect(active).toContain('aria-label="Quitar el filtro Tipo de par: Pieza y fila de un Excel"');
  });

  it("describe el avance, el resultado y el fallo de una detección", () => {
    expect(jobProgressText(JOB)).toBe("Revisadas 120 de 298 piezas · 610 pares evaluados.");
    expect(jobProgressText({ ...JOB, total_pieces: 0, processed_pieces: 0, pairs_evaluated: 0 })).toBe(SCAN_STARTING_TEXT);
    expect(jobProgressText({ ...JOB, status: "SUCCEEDED" })).toMatch(/^Detección terminada en 1[.,]5 s: 610 pares evaluados, 3 pares nuevos y 1 reabiertos\.$/);
    expect(jobProgressText({ ...JOB, status: "FAILED", error_message: "Detección interrumpida." })).toBe("Detección interrumpida.");
    expect(qualityJobStatus("FAILED")).toEqual({ label: "Falló", intent: "danger" });
    expect(qualityJobStatus("RUNNING").intent).toBe("info");
  });

  it("la revisión de todo el catálogo es un botón discreto con su explicación, y su avance va en una línea", () => {
    const idleHtml = render(<ScanPanel job={null} error="Sin conexión." starting={false} canScan onStart={noop} />);
    const idle = visibleText(idleHtml);
    expect(idle).toContain("Revisar todo el catálogo");
    expect(idleHtml).toContain(`title="${SCAN_HINT}"`);
    expect(idle).toContain(SCAN_HINT); // también para lectores de pantalla
    expect(idle).toContain("Sin conexión.");
    expect(idleHtml).not.toContain("Buscar en todo el catálogo");
    // Mientras corre no se ofrece lanzar otra: se ve el avance con su barra.
    const running = render(<ScanPanel job={JOB} error={null} starting={false} canScan onStart={noop} />);
    expect(visibleText(running)).toContain("Revisando el catálogo… 120 de 298 piezas");
    expect(running).not.toContain("Revisar todo el catálogo");
    expect(running).toContain('style="width:40%"');
    expect(scanLineText({ ...JOB, total_pieces: 0, processed_pieces: 0 })).toBe(`Revisando el catálogo… ${SCAN_STARTING_TEXT}`);
    expect(scanLineText({ ...JOB, status: "SUCCEEDED" })).toBe("Revisión completa: 4 pares nuevos");
    expect(scanLineText({ ...JOB, status: "SUCCEEDED", candidates_created: 0, candidates_reopened: 0 })).toBe("Revisión completa: ningún par nuevo");
    expect(render(<ScanPanel job={null} error={null} starting={false} canScan={false} onStart={noop} />)).not.toContain("Revisar todo el catálogo");
  });
});

describe("similitud destacada", () => {
  it("clasifica la similitud en alta, media y baja con esos umbrales", () => {
    expect(similarityLevel(0.93)).toBe("high");
    expect(similarityLevel(0.85)).toBe("high");
    expect(similarityLevel(0.84)).toBe("medium");
    expect(similarityLevel(0.7)).toBe("medium");
    expect(similarityLevel(0.69)).toBe("low");
  });

  it("muestra el porcentaje en cifra grande y el nivel en palabras, no solo en color", () => {
    const html = render(<SimilarityMeter score={0.6} />);
    expect(visibleText(html)).toBe("60 % similitud baja");
    expect(html).toContain("text-3xl");
    expect(html).toContain("conic-gradient");
    expect(visibleText(render(<SimilarityMeter score={0.8714} />))).toBe("87 % similitud alta");
  });
});

describe("comparación campo por campo", () => {
  it("distingue igual, distinto, conflicto y vacío, ignorando mayúsculas, tildes y puntuación", () => {
    expect(comparisonRowState("Iglesia de Quinua", "IGLESIA DE QUINUA")).toBe("same");
    expect(comparisonRowState("COLECCION L R M 18", "COLECCION L.R.M. 018", "match")).toBe("same"); // señal de coincidencia
    expect(comparisonRowState("Puno", "Cusco")).toBe("different");
    expect(comparisonRowState("I-134", "Sin código I".replace("Sin código I", ""))).toBe("different");
    expect(comparisonRowState("I-134", "I-200", "conflict")).toBe("conflict");
    // Solo un lado con el dato nunca es «igual», aunque una señal diga que coinciden.
    expect(comparisonRowState("Colección LRM", "", "match")).toBe("different");
    expect(comparisonRowState("", "—".replace("—", ""))).toBe("empty");
    expect(comparisonRowState("Sin registrar", "")).toBe("empty");
  });

  it("la tabla pone el campo al centro (A | campo | B), con color, palabra e icono en cada fila marcada", () => {
    const pieceA = getPieceDetail(ids.piece(1));
    const pieceB = getPieceDetail(ids.piece(2));
    const html = render(
      <DuplicateCandidateCard candidate={candidate()} pieceA={pieceA} pieceB={pieceB} piecesLoading={false} canResolve onMerge={noop} onDistinct={noop} onPostpone={noop} />,
    );
    expect(html).toContain('role="table"');
    expect(html).toContain("sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_11rem]");
    expect(html).toMatch(/data-mark="different"[^>]*bg-ambar-bg|bg-ambar-bg[^>]*data-mark="different"/);
    const text = visibleText(html);
    expect(text).toMatch(/Distinto|Solo en la pieza/);
    expect(html).toContain("text-verde-exito"); // las filas iguales usan el verde
  });

  it("«Solo diferencias» deja solo las filas que no son iguales", () => {
    const pieceA = getPieceDetail(ids.piece(1));
    const pieceB = getPieceDetail(ids.piece(2));
    const sides = [pieceSide("Pieza A", "la pieza A", pieceA, false), pieceSide("Pieza B", "la pieza B", pieceB, false)] as const;
    const all = render(<ComparisonTable sideA={sides[0]} sideB={sides[1]} signals={candidate().matched_fields} />);
    const differences = render(<ComparisonTable sideA={sides[0]} sideB={sides[1]} signals={candidate().matched_fields} onlyDifferences />);
    expect(all).toContain('data-mark="match"');
    expect(differences).not.toContain('data-mark="match"');
    expect((differences.match(/role="row"/g) ?? []).length).toBeLessThan((all.match(/role="row"/g) ?? []).length);
  });

  it("un par con códigos I distintos marca esa fila en rojo con la palabra «conflicto»", () => {
    const pieceA = getPieceDetail(ids.piece(1));
    const html = render(
      <DuplicateCandidateCard
        candidate={candidate({ blocking_conflict: true, matched_fields: [{ signal: "inventory_code_conflict", field: "identifier:I", similarity: 0 }] })}
        pieceA={pieceA}
        pieceB={getPieceDetail(ids.piece(7))}
        piecesLoading={false}
        canResolve
        onMerge={noop}
        onDistinct={noop}
        onPostpone={noop}
      />,
    );
    expect(html).toMatch(/data-mark="conflict"[^>]*bg-carmin-bg|bg-carmin-bg[^>]*data-mark="conflict"/);
    expect(visibleText(html)).toContain("conflicto");
  });
});

describe("paginación de la cola", () => {
  it("muestra anterior, siguiente y la página actual, y se oculta con una sola página", () => {
    const html = render(<QueuePager page={2} pageCount={3} label="Páginas de la cola, arriba" onPage={noop} />);
    const text = visibleText(html);
    expect(text).toContain("Página 2 de 3");
    expect(text).toContain("Anterior");
    expect(text).toContain("Siguiente");
    expect(html).toContain('aria-label="Páginas de la cola, arriba"');
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>(?:(?!<\/button>)[\s\S])*(Anterior|Siguiente)/);
    expect(render(<QueuePager page={1} pageCount={1} label="x" onPage={noop} />)).toBe("");
  });

  it("deshabilita anterior en la primera página y siguiente en la última", () => {
    const first = render(<QueuePager page={1} pageCount={2} label="x" onPage={noop} />);
    expect(first).toMatch(/<button[^>]*\sdisabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Anterior/);
    expect(first).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Siguiente/);
    const last = render(<QueuePager page={2} pageCount={2} label="x" onPage={noop} />);
    expect(last).toMatch(/<button[^>]*\sdisabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Siguiente/);
  });
});

describe("lenguaje llano en la cola de duplicados", () => {
  const requirement = /\b(RF-0\d{2}|RNF-0\d{2}|RN-0\d{2}|RIA-0\d)\b/;

  it("ni la tarjeta, ni los diálogos, ni el panel de detección, ni los avisos citan requisitos", () => {
    const pieceA = getPieceDetail(ids.piece(1));
    const blocked = candidate({ blocking_conflict: true });
    const texts = [
      render(<DuplicateCandidateCard candidate={blocked} pieceA={pieceA} pieceB={getPieceDetail(ids.piece(7))} piecesLoading={false} canResolve onMerge={noop} onDistinct={noop} onPostpone={noop} />),
      render(<DistinctDialog open={false} onClose={noop} onSubmit={async () => ({ ok: true })} />),
      render(<PostponeDialog open={false} today={new Date("2026-10-27T12:00:00Z")} onClose={noop} onSubmit={async () => ({ ok: true })} />),
      render(<ScanPanel job={null} error={null} starting={false} canScan onStart={noop} />),
      render(<DuplicateFilters value={DEFAULT_FILTERS} collections={[]} onChange={noop} />),
    ].map(visibleText);
    for (const text of texts) expect(text).not.toMatch(requirement);
  });

  it("los diálogos de resolución son breves", () => {
    const distinct = visibleText(render(<DistinctDialog open={false} onClose={noop} onSubmit={async () => ({ ok: true })} />));
    expect(distinct).toContain("Son piezas distintas aunque se parezcan.");
    const postpone = visibleText(render(<PostponeDialog open={false} today={new Date("2026-10-27T12:00:00Z")} onClose={noop} onSubmit={async () => ({ ok: true })} />));
    expect(postpone).toContain("máximo 180 días");
  });
});
