import { afterEach, describe, expect, it, vi } from "vitest";

import { EMPTY_AUDIT_FILTERS, type AuditQueryFilters } from "@/lib/data/audit-query";
import { ids } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import { AuditLogExport, CSV_DEMO_NOTICE, CSV_INTRO } from "./AuditLogExport";

const BASE_URL = "http://api.test";

function filters(partial: Partial<AuditQueryFilters> = {}): AuditQueryFilters {
  return { ...EMPTY_AUDIT_FILTERS, ...partial };
}

/** Los `href` de los enlaces de descarga, ya decodificados. */
function downloadUrls(html: string): URL[] {
  return [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*download/g)].map((match) => new URL(match[1].replace(/&amp;/g, "&")));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AuditLogExport", () => {
  it("con servidor ofrece dos descargas que llevan los filtros activos", () => {
    vi.stubEnv("API_INTERNAL_URL", BASE_URL);

    const html = render(<AuditLogExport filters={filters({ origin: "IMPORT", originRef: ids.importBatch(1), from: "2026-09-01" })} available />);
    const [grouped, entries] = downloadUrls(html);
    const text = visibleText(html);

    expect(text).toContain("Descargar conjuntos de cambios (CSV)");
    expect(text).toContain("Descargar campo por campo (CSV)");
    expect(grouped.pathname).toBe("/api/v1/audit-logs");
    expect(grouped.searchParams.get("format")).toBe("csv");
    expect(grouped.searchParams.get("group_by")).toBe("change_set");
    expect(grouped.searchParams.get("origin")).toBe("IMPORT");
    expect(grouped.searchParams.get("origin_ref")).toBe(ids.importBatch(1));
    expect(grouped.searchParams.get("occurred_from")).toBe("2026-09-01T00:00:00-05:00");
    expect(entries.searchParams.get("format")).toBe("csv");
    expect(entries.searchParams.has("group_by")).toBe(false);
    expect(entries.searchParams.get("origin")).toBe("IMPORT");
    expect(text).not.toContain(CSV_DEMO_NOTICE);
  });

  it("explica que los valores ocultos siguen ocultos y que el archivo lo genera el servidor", () => {
    vi.stubEnv("API_INTERNAL_URL", BASE_URL);

    const text = visibleText(render(<AuditLogExport filters={EMPTY_AUDIT_FILTERS} available />));

    expect(text).toContain(CSV_INTRO);
    expect(CSV_INTRO).toContain("ocultos");
    expect(CSV_INTRO).toContain("inglés");
    expect(CSV_INTRO).toContain("tildes");
  });

  it("la descarga es un enlace al servidor: la pantalla no llama a la red ni arma el archivo", () => {
    vi.stubEnv("API_INTERNAL_URL", BASE_URL);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<AuditLogExport filters={EMPTY_AUDIT_FILTERS} available />);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sin servidor (demostración) los botones se ven desactivados y se explica por qué", () => {
    const html = render(<AuditLogExport filters={EMPTY_AUDIT_FILTERS} available={false} />);

    expect(downloadUrls(html)).toHaveLength(0);
    expect(html.match(/<button[^>]*\sdisabled=""/g)).toHaveLength(2);
    expect(visibleText(html)).toContain(CSV_DEMO_NOTICE);
  });
});
