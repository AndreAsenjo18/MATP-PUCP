import { describe, expect, it } from "vitest";

import { SessionProvider } from "@/lib/auth/session";
import { PENDING_TABS, UNKNOWN_COUNTS, pendingTabs, type PendingCounts } from "@/lib/data/pending";
import { render, visibleText } from "@/test/render";

import { DuplicateQueue } from "./DuplicateQueue";
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

// Change revisar-pendientes-unificado, tareas 2.3 a 2.5. HTML estático (ADR-012); datos sintéticos.
const REQUIREMENT = /\b(RF-0\d{2}|RNF-0\d{2}|RN-0\d{2}|RIA-0\d)\b|\[SUPUESTO\]/;
const COUNTS: PendingCounts = { duplicates: 9, suggestions: 2, incomplete: 117 };

/** Etiquetas `<a>` del HTML, en orden. */
function links(html: string): string[] {
  return html.match(/<a\b[^>]*>/g) ?? [];
}

describe("pestañas de la bandeja (Req: Bandeja única de pendientes con pestañas)", () => {
  it("son enlaces a su dirección, en el orden fijo, con su número", () => {
    const html = render(<PendingTabsNav tabs={PENDING_TABS} counts={COUNTS} activeKey="duplicates" />);
    expect(html).toMatch(/^<nav aria-label="Pendientes"/);
    expect(links(html).map((a) => a.match(/href="([^"]+)"/)?.[1])).toEqual([
      "/pendientes/duplicados",
      "/pendientes/sugerencias",
      "/pendientes/incompletas",
    ]);
    expect(visibleText(html)).toBe("Posibles duplicados (9) Sugerencias de IA (2) Piezas incompletas (117)");
  });

  it("solo la activa lleva aria-current y una marca que no depende solo del color", () => {
    const html = render(<PendingTabsNav tabs={PENDING_TABS} counts={COUNTS} activeKey="suggestions" />);
    const anchors = links(html);
    expect(anchors.filter((a) => a.includes('aria-current="page"'))).toHaveLength(1);
    expect(anchors[1]).toContain('aria-current="page"');
    expect(anchors[1]).toMatch(/font-semibold/);
    expect(anchors[0]).not.toMatch(/font-semibold/);
  });

  it("sin total conocido, la pestaña va sin número y sin mensaje de error", () => {
    const html = render(<PendingTabsNav tabs={PENDING_TABS} counts={{ ...COUNTS, suggestions: null }} />);
    expect(visibleText(html)).toBe("Posibles duplicados (9) Sugerencias de IA Piezas incompletas (117)");
    expect(visibleText(html)).not.toMatch(/error|no se pudo/i);
  });

  it("muestra solo las pestañas que recibe (las del rol)", () => {
    const tabs = pendingTabs((code) => code === "reports.view");
    expect(visibleText(render(<PendingTabsNav tabs={tabs} counts={UNKNOWN_COUNTS} />))).toBe("Piezas incompletas");
    expect(render(<PendingTabsNav tabs={[]} counts={UNKNOWN_COUNTS} />)).toBe("");
  });
});

describe("legibilidad de las pestañas (Req: Legibilidad de la bandeja de pendientes)", () => {
  it("16 px, 44 px de alto, foco visible; las pestañas pasan de línea en lugar de desbordar", () => {
    const html = render(<PendingTabsNav tabs={PENDING_TABS} counts={COUNTS} activeKey="duplicates" />);
    for (const anchor of links(html)) {
      expect(anchor).toMatch(/\bmin-h-11\b/);
      expect(anchor).toMatch(/\btext-base\b/);
      expect(anchor).toMatch(/focus-visible:outline-2/);
    }
    expect(html).toMatch(/<ul class="[^"]*flex-wrap/);
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

  it("rol sin ninguno de los permisos: aviso, ninguna pestaña y nada del contenido", () => {
    const html = render(
      <PendingInboxFrame tabs={[]} counts={UNKNOWN_COUNTS}>
        <p>contenido</p>
      </PendingInboxFrame>,
    );
    expect(visibleText(html)).toContain(NO_PENDING_TABS_NOTICE);
    expect(html).not.toContain('aria-label="Pendientes"');
    expect(visibleText(html)).not.toContain("contenido");
  });

  it("pestaña sin permiso abierta por su dirección: aviso y, arriba, las pestañas que sí puede abrir", () => {
    const tabs = pendingTabs((code) => code === "reports.view");
    const html = render(
      <PendingInboxFrame tabs={tabs} counts={UNKNOWN_COUNTS} activeKey="duplicates">
        <PendingTabBody tabKey="duplicates" allowed={false}>
          <p>cola de duplicados</p>
        </PendingTabBody>
      </PendingInboxFrame>,
    );
    expect(visibleText(html)).toContain(TAB_PERMISSION_NOTICES.duplicates);
    expect(visibleText(html)).toContain("Piezas incompletas");
    expect(visibleText(html)).not.toContain("cola de duplicados");
    expect(html).not.toContain('aria-current="page"');
  });
});

describe("contenido de cada pestaña", () => {
  it("con permiso muestra el contenido; sin él, el aviso de su pestaña", () => {
    for (const key of ["duplicates", "suggestions", "incomplete"] as const) {
      expect(visibleText(render(<PendingTabBody tabKey={key} allowed>contenido</PendingTabBody>))).toBe("contenido");
      expect(visibleText(render(<PendingTabBody tabKey={key} allowed={false}>contenido</PendingTabBody>))).toBe(TAB_PERMISSION_NOTICES[key]);
    }
  });

  it("mientras se eligen la pestaña, un aviso de carga accesible", () => {
    const html = render(<PendingLoading />);
    expect(html).toContain('role="status"');
    expect(visibleText(html)).toBe(PENDING_LOADING_TEXT);
  });

  it("la cola de duplicados dentro de la bandeja no repite el título; fuera de ella, sí", () => {
    const embedded = render(
      <SessionProvider>
        <DuplicateQueue embedded />
      </SessionProvider>,
    );
    expect(embedded).not.toContain("<h1");
    expect(visibleText(embedded)).toContain("Compare cada par y decida.");
    const standalone = render(
      <SessionProvider>
        <DuplicateQueue />
      </SessionProvider>,
    );
    expect(standalone.match(/<h1\b[^>]*>([^<]+)</)?.[1]).toBe("Cola de posibles duplicados");
  });
});

describe("textos de la bandeja sin identificadores internos", () => {
  it("título, ayuda, avisos, carga y enlace provisional", () => {
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
