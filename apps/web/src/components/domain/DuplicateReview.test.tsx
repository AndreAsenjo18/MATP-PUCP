import { describe, expect, it } from "vitest";

import type { DuplicateCandidate, QualityJob } from "@/lib/data/duplicates";
import { DUPLICATE_CANDIDATES, getPieceDetail, ids } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import {
  COMPARISON_ROWS,
  DEFAULT_FILTERS,
  DuplicateCandidateCard,
  DuplicateFilters,
  MERGE_PENDING_NOTE,
  ScanPanel,
  canBeResolved,
  jobProgressText,
  markedRows,
  signalLabel,
  signalValueLines,
} from "./DuplicateReview";
import { qualityJobStatus } from "./status-intents";

type Signal = DuplicateCandidate["matched_fields"][number];

const noop = () => {};
const disabledButton = /<button[^>]*\sdisabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Fusionar/;

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
    const identifier: Signal = { signal: "identifier", field: "identifier:INC", similarity: 1 };
    expect(signalLabel(identifier)).toBe("Identificador INC igual");
    expect(signalLabel({ signal: "inventory_code_conflict", field: "identifier:I", similarity: 0 })).toBe("Códigos I vigentes distintos");
    expect(signalLabel({ signal: "collection", field: "collection_id", similarity: 0 })).toBe("Colecciones distintas");
    expect(signalLabel({ field: "denominación libre", similarity: 0.5 })).toBe("denominación libre");
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
      <DuplicateCandidateCard candidate={candidate()} pieceA={pieceA} pieceB={pieceB} piecesLoading={false} canResolve onDistinct={noop} onPostpone={noop} />,
    );
    const text = visibleText(html);
    expect(text).toContain("Similitud 93 %");
    expect(text).toContain("Pieza A: Toro de Pucará");
    expect(text).toContain("Pieza B: Toro de Pucará (3 cuernos)");
    for (const row of COMPARISON_ROWS) expect(text).toContain(row.label);
    expect(html.match(/data-mark="match"/g)).toHaveLength(3); // denominación, colección y otros códigos
    expect(text).toContain("Coincide");
    expect(text).toContain("Identificador COLLECTION igual · similitud 100 %");
    expect(text).toContain("Normalizado MMZ-015: A «M.M.Z. 015» · B «mmz 15»");
    expect(html).toContain(`href="/piezas/${ids.piece(1)}"`);
  });

  it("deja Fusionar deshabilitado con su nota y muestra distinto y posponer", () => {
    const html = render(
      <DuplicateCandidateCard candidate={candidate()} pieceA={pieceA} pieceB={pieceB} piecesLoading={false} canResolve onDistinct={noop} onPostpone={noop} />,
    );
    expect(html).toMatch(disabledButton);
    expect(visibleText(html)).toContain(MERGE_PENDING_NOTE);
    expect(visibleText(html)).toContain("Marcar como distinto");
    expect(visibleText(html)).toContain("Posponer");
  });

  it("sin duplicates.resolve o con el par cerrado no muestra acciones", () => {
    const withoutPermission = visibleText(
      render(<DuplicateCandidateCard candidate={candidate()} pieceA={pieceA} pieceB={pieceB} piecesLoading={false} canResolve={false} onDistinct={noop} onPostpone={noop} />),
    );
    const merged = visibleText(
      render(<DuplicateCandidateCard candidate={candidate({ status: "MERGED" })} pieceA={pieceA} pieceB={pieceB} piecesLoading={false} canResolve onDistinct={noop} onPostpone={noop} />),
    );
    for (const text of [withoutPermission, merged]) {
      expect(text).not.toContain("Marcar como distinto");
      expect(text).not.toContain("Posponer");
    }
    expect(merged).toContain("Fusionado");
  });

  it("avisa el bloqueo por códigos I distintos, la fecha de posposición y el motivo", () => {
    const text = visibleText(
      render(
        <DuplicateCandidateCard
          candidate={candidate({ blocking_conflict: true, status: "POSTPONED", postponed_until: "2026-12-01T12:00:00Z", resolution_note: "Esperar ficha física" })}
          pieceA={pieceA}
          pieceB={pieceB}
          piecesLoading={false}
          canResolve
          onDistinct={noop}
          onPostpone={noop}
        />,
      ),
    );
    expect(text).toContain("Códigos I distintos: fusión bloqueada (RN-002)");
    expect(text).toContain("Pospuesto hasta el");
    expect(text).toContain("Motivo registrado: Esperar ficha física");
  });

  it("una fila de importación enlaza al asistente y una ficha que no llega se indica", () => {
    const importRow = DUPLICATE_CANDIDATES.find((c) => c.import_row_id !== null)!;
    const html = render(<DuplicateCandidateCard candidate={importRow} pieceA={null} pieceB={null} piecesLoading={false} canResolve onDistinct={noop} onPostpone={noop} />);
    expect(visibleText(html)).toContain("Fila de importación");
    expect(visibleText(html)).toContain("Pieza del catálogo: ficha no disponible");
    expect(html).toContain('href="/importacion"');

    const loading = visibleText(
      render(<DuplicateCandidateCard candidate={candidate()} pieceA={undefined} pieceB={undefined} piecesLoading canResolve onDistinct={noop} onPostpone={noop} />),
    );
    expect(loading).toContain("Pieza A: cargando ficha…");
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
    for (const label of ["Estado", "Colección", "Similitud mínima", "Origen", "Pendientes", "Fila de importación", "60 % o más"]) expect(text).toContain(label);
    expect(text).toContain("— Subcolección RAB (ficticia)");
    expect(html).toMatch(/<option value="PENDING" selected="">Pendientes<\/option>/);
  });

  it("describe el avance, el resultado y el fallo de una detección", () => {
    expect(jobProgressText(JOB)).toBe("Revisadas 120 de 298 piezas · 610 pares evaluados.");
    expect(jobProgressText({ ...JOB, status: "SUCCEEDED" })).toMatch(/^Detección terminada en 1[.,]5 s: 610 pares evaluados, 3 pares nuevos y 1 reabiertos\.$/);
    expect(jobProgressText({ ...JOB, status: "FAILED", error_message: "Detección interrumpida." })).toBe("Detección interrumpida.");
    expect(qualityJobStatus("FAILED")).toEqual({ label: "Falló", intent: "danger" });
    expect(qualityJobStatus("RUNNING").intent).toBe("info");
  });

  it("el botón de detección se bloquea mientras hay una en curso", () => {
    const running = render(<ScanPanel job={JOB} error={null} starting={false} canScan onStart={noop} />);
    expect(running).toMatch(/<button[^>]*\sdisabled=""[^>]*>[\s\S]*?Detección en curso…/);
    expect(visibleText(running)).toContain("En curso");
    const idle = visibleText(render(<ScanPanel job={null} error="Sin conexión." starting={false} canScan onStart={noop} />));
    expect(idle).toContain("Buscar duplicados");
    expect(idle).toContain("Sin conexión.");
  });
});
