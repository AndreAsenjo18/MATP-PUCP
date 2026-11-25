import { describe, expect, it } from "vitest";

import { PENDING_TABS, UNKNOWN_COUNTS, pendingTabs, type PendingCounts } from "@/lib/data/pending";
import { render, visibleText } from "@/test/render";

import {
  NO_PENDING_TABS_NOTICE,
  PENDING_HINT,
  PENDING_LOADING_TEXT,
  PENDING_TITLE,
  PendingInboxFrame,
  PendingLoading,
  PendingTabBody,
  PendingTabsNav,
  TAB_PERMISSION_NOTICES,
} from "./PendingInbox";

// Change revisar-pendientes-unificado, tareas 2.3 a 2.5, y codigo-unico-y-ajustes-pantallas (se retira
// la pestaña de posibles duplicados). HTML estático (ADR-012); datos sintéticos.
const REQUIREMENT = /\b(RF-0\d{2}|RNF-0\d{2}|RN-0\d{2}|RIA-0\d)\b|\[SUPUESTO\]/;
const COUNTS: PendingCounts = { incomplete: 117, imports: null };
/** Una sola pestaña, para probar su forma en aislamiento (sin depender de cuántas haya en total). */
const ONE_TAB = [PENDING_TABS[0]];

/** Etiquetas `<a>` del HTML, en orden. */
function links(html: string): string[] {
  return html.match(/<a\b[^>]*>/g) ?? [];
}

describe("pestañas de la bandeja (Req: Bandeja única de pendientes con pestañas)", () => {
  it("solo «Piezas incompletas», como enlace a su dirección y con su número", () => {
    const html = render(<PendingTabsNav tabs={ONE_TAB} counts={COUNTS} activeKey="incomplete" />);
    expect(html).toMatch(/^<nav aria-label="Pendientes"/);
    expect(links(html).map((a) => a.match(/href="([^"]+)"/)?.[1])).toEqual(["/pendientes/incompletas"]);
    // Las pestañas de sugerencias de IA y de posibles duplicados se retiraron.
    expect(visibleText(html)).toBe("Piezas incompletas (117)");
    expect(visibleText(html)).not.toMatch(/duplicados/i);
  });

  it("con permiso de aprobar importaciones, también «Importaciones pendientes»", () => {
    const html = render(<PendingTabsNav tabs={PENDING_TABS} counts={{ incomplete: 117, imports: 3 }} activeKey="incomplete" />);
    const text = visibleText(html);
    expect(text).toContain("Piezas incompletas (117)");
    expect(text).toContain("Importaciones pendientes (3)");
  });

  it("la activa lleva aria-current y una marca que no depende solo del color", () => {
    const [anchor] = links(render(<PendingTabsNav tabs={PENDING_TABS} counts={COUNTS} activeKey="incomplete" />));
    expect(anchor).toContain('aria-current="page"');
    expect(anchor).toMatch(/font-semibold/);
  });

  it("sin total conocido, la pestaña va sin número y sin mensaje de error", () => {
    const html = render(<PendingTabsNav tabs={ONE_TAB} counts={UNKNOWN_COUNTS} />);
    expect(visibleText(html)).toBe("Piezas incompletas");
    expect(visibleText(html)).not.toMatch(/error|no se pudo/i);
  });

  it("sin pestañas del rol, nada", () => {
    expect(render(<PendingTabsNav tabs={[]} counts={UNKNOWN_COUNTS} />)).toBe("");
  });
});

describe("legibilidad de las pestañas (Req: Legibilidad de la bandeja de pendientes)", () => {
  it("16 px, 44 px de alto, foco visible; en pantallas estrechas se desplazan dentro de su cuadro", () => {
    const html = render(<PendingTabsNav tabs={PENDING_TABS} counts={COUNTS} activeKey="incomplete" />);
    for (const anchor of links(html)) {
      expect(anchor).toMatch(/\bmin-h-11\b/);
      expect(anchor).toMatch(/\btext-base\b/);
      expect(anchor).toMatch(/focus-visible:outline-3/);
    }
    expect(html).toMatch(/<ul class="[^"]*overflow-x-auto/);
  });
});

describe("marco de la bandeja", () => {
  it("título y una sola línea de ayuda; pestañas y contenido", () => {
    const html = render(
      <PendingInboxFrame tabs={PENDING_TABS} counts={COUNTS} activeKey="incomplete">
        <p>contenido</p>
      </PendingInboxFrame>,
    );
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(visibleText(html)).toContain(PENDING_TITLE);
    expect(visibleText(html)).toContain(PENDING_HINT);
    expect(html).toContain('aria-label="Pendientes"');
    expect(visibleText(html)).toContain("contenido");
  });

  it("rol sin el permiso: aviso, ninguna pestaña y nada del contenido", () => {
    const html = render(
      <PendingInboxFrame tabs={pendingTabs(() => false)} counts={UNKNOWN_COUNTS}>
        <p>contenido</p>
      </PendingInboxFrame>,
    );
    expect(visibleText(html)).toContain(NO_PENDING_TABS_NOTICE);
    expect(html).not.toContain('aria-label="Pendientes"');
    expect(visibleText(html)).not.toContain("contenido");
  });
});

describe("contenido de la pestaña", () => {
  it("con permiso muestra el contenido; sin él, su aviso", () => {
    expect(visibleText(render(<PendingTabBody tabKey="incomplete" allowed>contenido</PendingTabBody>))).toBe("contenido");
    expect(visibleText(render(<PendingTabBody tabKey="incomplete" allowed={false}>contenido</PendingTabBody>))).toBe(TAB_PERMISSION_NOTICES.incomplete);
  });

  it("mientras se elige la pestaña, un aviso de carga accesible", () => {
    const html = render(<PendingLoading />);
    expect(html).toContain('role="status"');
    expect(visibleText(html)).toBe(PENDING_LOADING_TEXT);
  });
});

describe("textos de la bandeja sin identificadores internos", () => {
  it("título, ayuda, avisos y carga", () => {
    const texts = [
      PENDING_TITLE,
      PENDING_HINT,
      NO_PENDING_TABS_NOTICE,
      PENDING_LOADING_TEXT,
      ...Object.values(TAB_PERMISSION_NOTICES),
      visibleText(render(<PendingTabsNav tabs={PENDING_TABS} counts={COUNTS} />)),
    ];
    for (const text of texts) expect(text).not.toMatch(REQUIREMENT);
  });
});
