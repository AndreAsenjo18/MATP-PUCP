import { describe, expect, it } from "vitest";

import { SessionProvider } from "@/lib/auth/session";
import type { AiDuplicateRun, AiGroupPair } from "@/lib/data/duplicates";
import { render, visibleText } from "@/test/render";

import { DuplicateQueue } from "./DuplicateQueue";
import {
  AiVerdictLine,
  approvableCount,
  confidencePercent,
  GeminiJudgeCard,
  GroupApprovalBar,
  runProgressText,
  SampleCheck,
  sampleComplete,
} from "./GeminiDuplicates";

// Spec ia-asistiva — Juicio de pares de duplicados por IA con aprobación por grupo (change
// `ia-juicio-duplicados`; RIA-02, RN-009). Datos sintéticos (RNF-014).

function run(overrides: Partial<AiDuplicateRun> = {}): AiDuplicateRun {
  return {
    id: "run-1",
    status: "SUCCEEDED",
    total_pairs: 102,
    processed_pairs: 102,
    failed_batches: 0,
    started_at: null,
    finished_at: null,
    error_message: null,
    groups: { same: 41, distinct: 46, unsure: 15, by_rule: 6 },
    min_confidence: 0.85,
    can_resume: false,
    ...overrides,
  };
}

function pair(id: string, overrides: Partial<AiGroupPair> = {}): AiGroupPair {
  return {
    candidate: { id } as AiGroupPair["candidate"],
    verdict: { verdict: "same", confidence: 0.92, reason: "Misma denominación y colección.", source: "ai" },
    ready_to_merge: true,
    merge_blocker: null,
    ...overrides,
  };
}

const noop = () => {};

describe("tarjeta «Deje que Gemini los ordene»", () => {
  it("sin análisis ofrece «Analizar con Gemini» con la insignia", () => {
    const text = visibleText(render(<GeminiJudgeCard run={null} error={null} starting={false} selected={null} onStart={noop} onResume={noop} onSelect={noop} />));
    expect(text).toContain("Deje que Gemini los ordene");
    expect(text).toContain("Powered by Gemini");
    expect(text).toContain("Analizar con Gemini");
    expect(text).toContain("nada se aplica sin su aprobación");
  });

  it("mientras analiza muestra el avance y los grupos que van saliendo", () => {
    const html = render(
      <GeminiJudgeCard run={run({ status: "RUNNING", processed_pairs: 40, groups: { same: 12, distinct: 20, unsure: 8, by_rule: 3 } })} error={null} starting={false} selected={null} onStart={noop} onResume={noop} onSelect={noop} />,
    );
    const text = visibleText(html);
    expect(text).toContain("Gemini está analizando: 40 de 102 pares.");
    expect(text).not.toContain("Analizar con Gemini");
    for (const count of ["12", "20", "8"]) expect(text).toContain(count);
  });

  it("al terminar, tres grupos con su número que se eligen como filtro; con lotes fallidos, reanudar", () => {
    const html = render(<GeminiJudgeCard run={run({ can_resume: true, failed_batches: 2, processed_pairs: 80 })} error={null} starting={false} selected="distinct" onStart={noop} onResume={noop} onSelect={noop} />);
    const text = visibleText(html);
    for (const title of ["Gemini cree que son la misma pieza", "Gemini cree que son distintas", "Gemini no está seguro"]) expect(text).toContain(title);
    expect(text).toContain("6 por regla");
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(text).toContain("Reanudar el análisis");
    expect(text).toContain("Gemini no respondió en algunos lotes");
  });
});

describe("motivo y confianza de cada par", () => {
  it("dice si lo decidió Gemini o una regla, con la confianza en llano", () => {
    expect(confidencePercent(0.924)).toBe("92 %");
    expect(visibleText(render(<AiVerdictLine item={pair("a")} />))).toContain("Misma denominación y colección. · Confianza 92 %");
    const rule = visibleText(render(<AiVerdictLine item={pair("b", { verdict: { verdict: "distinct", confidence: 1, reason: "Regla: dos códigos I vigentes distintos", source: "rule" } })} />));
    expect(rule).toContain("Regla");
    expect(rule).not.toContain("Confianza");
    expect(visibleText(render(<AiVerdictLine item={pair("c", { ready_to_merge: false, merge_blocker: "Elija los valores: son distintos en procedencia." })} />))).toContain("Elija los valores");
  });
});

describe("aprobar un grupo (RN-009)", () => {
  it("cuenta los pares que se aprobarían: sin los sacados ni los que esperan elegir valores", () => {
    const items = [pair("a"), pair("b"), pair("c", { ready_to_merge: false })];
    expect(approvableCount("same", items, new Set(["a"]))).toBe(1);
    expect(approvableCount("distinct", items, new Set(["a"]))).toBe(2);
  });

  it("«misma pieza» no se aprueba sin revisar la muestra al azar", () => {
    const sample = [pair("a"), pair("b")];
    expect(sampleComplete(sample, { a: "confirmed" })).toBe(false);
    expect(sampleComplete(sample, { a: "confirmed", b: "excluded" })).toBe(true);
    const blocked = render(<GroupApprovalBar group="same" count={3} needsChoice={1} blockedReason="Primero revise la muestra al azar." busy={false} onApprove={noop} />);
    expect(visibleText(blocked)).toContain("Aprobar 3 pares como la misma pieza");
    expect(visibleText(blocked)).toContain("1 par tiene valores distintos");
    expect(blocked).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*(<svg[\s\S]*?<\/svg>)?Aprobar 3 pares/);
    const ready = render(<GroupApprovalBar group="distinct" count={1} needsChoice={0} blockedReason={null} busy={false} onApprove={noop} />);
    expect(visibleText(ready)).toContain("Aprobar 1 par como distintas");
    expect(ready).not.toContain('disabled=""');
  });

  it("la muestra pide confirmar o sacar cada par", () => {
    const text = visibleText(
      render(<SampleCheck items={[pair("a"), pair("b")]} decisions={{ a: "confirmed" }} names={() => ["Retablo A", "Retablo B"]} onDecide={noop} />),
    );
    expect(text).toContain("revise esta muestra al azar (1 de 2)");
    expect(text).toContain("Sí, es la misma pieza");
    expect(text).toContain("No, sacar del grupo");
  });

  it("muestra el estado de cada análisis en llano", () => {
    expect(runProgressText(run())).toBe("Analizó 102 pares.");
    expect(runProgressText(run({ status: "FAILED" }))).toContain("Puede reanudar");
    expect(runProgressText(run({ status: "RUNNING", total_pairs: 0, processed_pairs: 0 }))).toBe("Gemini está empezando…");
  });
});

describe("sin Gemini, la cola de siempre", () => {
  it("en la demostración no aparece la tarjeta de Gemini", () => {
    const text = visibleText(
      render(
        <SessionProvider>
          <DuplicateQueue embedded />
        </SessionProvider>,
      ),
    );
    expect(text).not.toContain("Gemini");
    expect(text).toContain("Compare cada par y decida.");
  });
});
