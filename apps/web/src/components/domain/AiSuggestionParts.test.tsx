import { describe, expect, it } from "vitest";

import { AI_PURPOSE, AI_SCOPE_LABEL, AI_SCOPE_TEXT, AI_TITLE, dataView, describeValue, FieldList, fieldLabel, functionLabel, ScopeNotice } from "./AiSuggestionParts";
import { render, visibleText } from "@/test/render";

// Datos sintéticos (RNF-014). Ningún texto visible cita requisitos ni valores de configuración.
const REQUIREMENT = /\b(RF-0\d{2}|RNF-0\d{2}|RN-0\d{2}|RIA-0\d)\b|AI_PROVIDER|mock/i;

describe("funciones de IA en lenguaje llano", () => {
  it("nombra las cinco funciones sin identificadores", () => {
    const labels = ["RIA_01", "RIA_02", "RIA_03", "RIA_04", "RIA_05"].map(functionLabel);
    expect(labels).toEqual(["Extraer datos de un texto", "Detectar posibles duplicados", "Sugerir términos", "Redactar una descripción", "Responder consultas"]);
    for (const label of labels) expect(label).not.toMatch(REQUIREMENT);
  });

  it("un código desconocido se muestra tal cual", () => {
    expect(functionLabel("RIA_99")).toBe("RIA_99");
  });
});

describe("propuesta legible", () => {
  it("convierte campos conocidos y deja la confianza como porcentaje", () => {
    const view = dataView({ category: "CERAMICA", conservation_status: "BUENO", provenance: "Puno", confidence: 0.82 });
    expect(view.fields.map((f) => `${f.label}: ${f.value}`)).toEqual(["Categoría: CERAMICA", "Estado de conservación: BUENO", "Procedencia: Puno"]);
    expect(view.confidence).toBe("82 % de confianza");
  });

  it("los campos sin etiqueta conservan su nombre", () => {
    expect(fieldLabel("campo_raro")).toBe("campo_raro");
    expect(dataView({ campo_raro: "x" }).fields[0]).toEqual({ key: "campo_raro", label: "campo_raro", value: "x" });
  });

  it("una confianza fuera de 0 a 1 es un campo más", () => {
    const view = dataView({ confidence: 7 });
    expect(view.confidence).toBeNull();
    expect(view.fields).toHaveLength(1);
  });

  it("describe listas, booleanos, vacíos y objetos anidados", () => {
    expect(describeValue(["A", "B"])).toBe("A, B");
    expect(describeValue([])).toBe("—");
    expect(describeValue(null)).toBe("—");
    expect(describeValue(true)).toBe("Sí");
    expect(describeValue({ category: "CERAMICA", extra: ["x"] })).toBe("Categoría: CERAMICA; extra: x");
  });

  it("datos que no son un objeto no rompen", () => {
    expect(dataView(null)).toEqual({ fields: [], confidence: null });
    expect(dataView([1, 2])).toEqual({ fields: [], confidence: null });
  });

  it("la lista no muestra llaves ni comillas de JSON", () => {
    const text = visibleText(render(<FieldList view={dataView({ category: "CERAMICA", suggested_terms: ["INSTRUMENTO_MUSICAL"], confidence: 0.91 })} />));
    expect(text).toContain("Términos sugeridos");
    expect(text).toContain("91 % de confianza");
    expect(text).not.toMatch(/[{}"]/);
  });
});

describe("propósito y alcance", () => {
  it("el propósito cabe en dos frases y dice que nada se guarda sin aprobación", () => {
    expect(AI_PURPOSE.split(/(?<=\.)\s/).length).toBeLessThanOrEqual(2);
    expect(AI_PURPOSE).toMatch(/aprueba/);
    expect(AI_PURPOSE).toMatch(/no se guarda nada/);
  });

  it("el aviso lleva la etiqueta «Fuera del MVP» y aclara que son ejemplos que no cambian el catálogo", () => {
    const text = visibleText(render(<ScopeNotice />));
    expect(text).toContain(AI_SCOPE_LABEL);
    expect(AI_SCOPE_LABEL).toBe("Fuera del MVP");
    expect(text).toContain("ejemplos de demostración");
    expect(text).toContain("no cambia el catálogo");
  });

  it("ningún texto visible cita requisitos ni valores de configuración", () => {
    for (const text of [AI_TITLE, AI_PURPOSE, AI_SCOPE_TEXT, visibleText(render(<ScopeNotice />))]) expect(text).not.toMatch(REQUIREMENT);
  });
});
