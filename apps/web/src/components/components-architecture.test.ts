/**
 * Dirección de dependencias entre niveles del sistema de diseño (docs/system-design.md §1, ADR-012):
 * los átomos de `components/ui` no pueden depender de moléculas, estructura ni datos del museo.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const COMPONENTS_DIR = __dirname;

const FORBIDDEN_FOR_UI = [
  { pattern: /^@\/components\/domain(\/|$)/, reason: "moléculas del museo (components/domain)" },
  { pattern: /^@\/components\/layout(\/|$)/, reason: "estructura de pantalla (components/layout)" },
  { pattern: /^@\/lib\/fixtures(\/|$)/, reason: "datos sintéticos (lib/fixtures)" },
  { pattern: /^@\/lib\/data(\/|$)/, reason: "capa de datos (lib/data)" },
  { pattern: /^@\/lib\/auth(\/|$)/, reason: "sesión y permisos (lib/auth)" },
  { pattern: /^\.\.\//, reason: "archivos fuera de components/ui (use el alias @/)" },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf-8" })
    .filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file))
    .map((file) => path.join(dir, file));
}

function importsOf(source: string): string[] {
  return [...source.matchAll(/(?:import|export)\s[^'"]*?from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g)].map(
    (match) => match[1] ?? match[2],
  );
}

/** Devuelve una descripción en español de cada importación prohibida en los archivos dados. */
export function forbiddenUiImports(files: { file: string; source: string }[]): string[] {
  const violations: string[] = [];
  for (const { file, source } of files) {
    for (const specifier of importsOf(source)) {
      const rule = FORBIDDEN_FOR_UI.find(({ pattern }) => pattern.test(specifier));
      if (rule) {
        violations.push(`${file} importa "${specifier}": un átomo de components/ui no puede depender de ${rule.reason}.`);
      }
    }
  }
  return violations;
}

describe("arquitectura de componentes", () => {
  it("components/ui no importa de domain, layout ni datos del museo", () => {
    const files = sourceFiles(path.join(COMPONENTS_DIR, "ui")).map((file) => ({
      file: path.relative(COMPONENTS_DIR, file),
      source: readFileSync(file, "utf-8"),
    }));
    expect(files.length).toBeGreaterThan(0);
    expect(forbiddenUiImports(files)).toEqual([]);
  });

  it("detecta y describe una importación prohibida", () => {
    const violations = forbiddenUiImports([
      { file: "ui/Rogue.tsx", source: 'import { PieceCard } from "@/components/domain/PieceCard";\nimport { cn } from "@/lib/cn";' },
      { file: "ui/Other.tsx", source: 'import { FIXTURE_PIECES } from "@/lib/fixtures";' },
    ]);
    expect(violations).toHaveLength(2);
    expect(violations[0]).toMatch(/ui\/Rogue\.tsx importa "@\/components\/domain\/PieceCard".*components\/domain/);
    expect(violations[1]).toMatch(/lib\/fixtures/);
  });
});
