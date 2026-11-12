import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SessionProvider } from "@/lib/auth/session";
import { incompleteStateFromSearch, paramsFromSearch, reportKeyFromSearch, reportsHref, type ReportParams } from "@/lib/data/reports";
import { EMPTY_FILTERS } from "@/lib/data/search";
import { render, visibleText } from "@/test/render";

import { IncompleteReportPanel } from "./IncompleteReportPanel";
import { ReportsLive } from "./ReportsLive";

// Change reportes-vista-simplificada, prueba humana 7.2 (Req: Reporte y filtros conservados en la
// dirección). HTML estático (ADR-012); datos sintéticos.

const search = (href: string) => new URL(`http://x${href}`).searchParams;

describe("tipo de reporte en la dirección", () => {
  it("lee el tipo; uno desconocido o ausente abre el inventario general", () => {
    expect(reportKeyFromSearch(search("/reportes?reporte=by-attribute"))).toBe("by-attribute");
    expect(reportKeyFromSearch(search("/reportes?reporte=incomplete"))).toBe("incomplete");
    expect(reportKeyFromSearch(search("/reportes?reporte=valorizacion"))).toBe("inventory");
    expect(reportKeyFromSearch(search("/reportes"))).toBe("inventory");
  });

  it("al cambiar de tipo, la dirección lleva solo el tipo nuevo (empieza sin filtros)", () => {
    expect(reportsHref("by-collection")).toBe("/reportes?reporte=by-collection");
  });
});

describe("parámetros y filtros en la dirección (escenario «Recargar con filtros»)", () => {
  const params: ReportParams = {
    includeLoansForUse: false,
    groupBy: "provenance",
    filters: { ...EMPTY_FILTERS, collectionId: "col-ra", author: "Huamán" },
  };

  it("se escriben con los mismos nombres que la API y vuelven iguales al recargar", () => {
    const href = reportsHref("by-attribute", params);
    const url = search(href);
    expect(url.get("reporte")).toBe("by-attribute");
    expect(url.get("group_by")).toBe("provenance");
    expect(url.get("include_loans_for_use")).toBe("false");
    const back = paramsFromSearch(url);
    expect(back.groupBy).toBe("provenance");
    expect(back.includeLoansForUse).toBe(false);
    expect(back.filters?.collectionId).toBe("col-ra");
    expect(back.filters?.author).toBe("Huamán");
  });

  it("los filtros de incompletas también, con varias alertas", () => {
    const href = reportsHref("incomplete", undefined, { alerts: ["MISSING_PHOTO", "MISSING_LOCATION"], collectionId: "col-ra", includeSubcollections: false });
    expect(href).toBe("/reportes?reporte=incomplete&alert=MISSING_PHOTO&alert=MISSING_LOCATION&collection_id=col-ra&include_subcollections=false");
    expect(incompleteStateFromSearch(search(href))).toEqual({ alerts: ["MISSING_PHOTO", "MISSING_LOCATION"], collectionId: "col-ra", includeSubcollections: false });
    expect(incompleteStateFromSearch(search("/reportes?reporte=incomplete"))).toEqual({ alerts: [], collectionId: "", includeSubcollections: true });
  });

  it("los parámetros de un tipo no se cuelan en otro", () => {
    expect(reportsHref("incomplete", params)).toBe("/reportes?reporte=incomplete");
    expect(reportsHref("inventory", undefined, { alerts: ["MISSING_PHOTO"], collectionId: "", includeSubcollections: true })).toBe("/reportes?reporte=inventory");
  });
});

describe("las pantallas arrancan con lo que trae la dirección", () => {
  it("el reporte agrupado arranca con su atributo y sus filtros («Filtros (1 activo)»)", () => {
    const html = render(
      <SessionProvider>
        <ReportsLive type="by-attribute" initialParams={{ includeLoansForUse: true, groupBy: "provenance", filters: { ...EMPTY_FILTERS, collectionId: "col-ra" } }} />
      </SessionProvider>,
    );
    expect(html).toMatch(/<option value="provenance" selected="">/);
    expect(visibleText(html)).toContain("Filtros (1 activo)");
  });

  it("sin dirección, el reporte arranca sin filtros", () => {
    const html = render(
      <SessionProvider>
        <ReportsLive type="by-attribute" />
      </SessionProvider>,
    );
    expect(visibleText(html)).not.toContain("activo");
  });

  it("incompletas arranca con sus alertas marcadas e ignora alertas que no existen", () => {
    const html = render(
      <SessionProvider>
        <IncompleteReportPanel canDownload={false} initialState={{ alerts: ["MISSING_PHOTO", "INVENTADA"], collectionId: "", includeSubcollections: true }} />
      </SessionProvider>,
    );
    const checked = [...html.matchAll(/<label[^>]*><input type="checkbox"[^>]*checked=""[^>]*\/>([^<]+)/g)].map((m) => m[1].trim());
    expect(checked).toEqual(["Sin foto"]);
  });

  it("la página lee la dirección dentro de Suspense (si no, `next build` falla)", () => {
    const page = readFileSync(path.resolve(__dirname, "..", "..", "app/reportes/page.tsx"), "utf-8");
    expect(page).toContain("useSearchParams()");
    expect(page).toMatch(/<Suspense fallback=\{null\}>\s*<ReportesContent \/>\s*<\/Suspense>/);
    expect(page).toContain("router.replace(href, { scroll: false })");
  });
});
