/**
 * Bandeja «Revisar pendientes» (change `revisar-pendientes-unificado`; spec calidad-datos,
 * «Bandeja única de pendientes con pestañas»; RF-030, RF-035, RF-039).
 *
 * Reglas puras de las pestañas (qué ve cada rol y cuál se abre primero, design D2) y los
 * contadores (design D3), que salen solo del `total` de las consultas que ya existen, pidiendo
 * una sola fila: `GET /quality/duplicates`, `GET /ai/suggestions` y `GET /quality/incomplete`.
 * Sin endpoint nuevo: un total que no se puede obtener queda como `null` y la pestaña se muestra
 * sin número. `lib/data/ai.ts` (de P4) no se toca: la consulta de sugerencias se hace aquí.
 */
import { createApiClient } from "@/lib/api/client";

import { fetchDuplicateQueue } from "./duplicates";
import { apiBaseUrl, getApiMode } from "./mode";
import { fetchIncompleteReport } from "./quality";

export type PendingTabKey = "duplicates" | "suggestions" | "incomplete";

export interface PendingTab {
  key: PendingTabKey;
  href: string;
  label: string;
  /** Permiso que hace visible la pestaña. */
  permission: string;
}

/** Orden fijo de las pestañas (spec: duplicados, sugerencias, incompletas). */
export const PENDING_TABS: readonly PendingTab[] = [
  { key: "duplicates", href: "/pendientes/duplicados", label: "Posibles duplicados", permission: "duplicates.resolve" },
  { key: "suggestions", href: "/pendientes/sugerencias", label: "Sugerencias de IA", permission: "ai.review" },
  { key: "incomplete", href: "/pendientes/incompletas", label: "Piezas incompletas", permission: "reports.view" },
];

export const PENDING_BASE_PATH = "/pendientes";

/** Pendientes por pestaña; `null` cuando el total no se pudo obtener (o no se pidió). */
export type PendingCounts = Record<PendingTabKey, number | null>;

export const UNKNOWN_COUNTS: PendingCounts = { duplicates: null, suggestions: null, incomplete: null };

/** Pestañas que el rol puede ver, en el orden fijo. */
export function pendingTabs(hasPermission: (permission: string) => boolean): PendingTab[] {
  return PENDING_TABS.filter((tab) => hasPermission(tab.permission));
}

/**
 * Pestaña que abre `/pendientes`: la primera visible con pendientes; si ninguna tiene (o no se
 * conocen sus totales), la primera visible; `null` si el rol no ve ninguna. Un total desconocido
 * no cuenta como «tiene pendientes».
 */
export function initialTab(visible: readonly PendingTab[], counts: PendingCounts): PendingTab | null {
  return visible.find((tab) => (counts[tab.key] ?? 0) > 0) ?? visible[0] ?? null;
}

/** Nombre de la pestaña con su número entre paréntesis, solo si se conoce. */
export function tabLabel(tab: Pick<PendingTab, "label">, count: number | null | undefined): string {
  return count == null ? tab.label : `${tab.label} (${count})`;
}

/** Pestaña de una dirección de la bandeja (también sus subrutas); `undefined` fuera de ellas. */
export function tabForPath(pathname: string | null | undefined): PendingTab | undefined {
  if (!pathname) return undefined;
  return PENDING_TABS.find((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`));
}

export interface PendingCountsOptions {
  devUser?: string;
  /**
   * En modo demostración las sugerencias viven en el almacén de React (`useMockStore`), que una
   * función de datos no puede leer: quien llama pasa cuántas hay pendientes.
   */
  mockPendingSuggestions?: number;
}

async function suggestionsTotal(devUser: string | undefined): Promise<number | null> {
  const { data, error } = (await createApiClient({ baseUrl: apiBaseUrl(), devUser }).GET("/api/v1/ai/suggestions", {
    params: { query: { status: "PENDING", page: 1, page_size: 1 } },
  })) as { data?: { total?: unknown }; error?: unknown };
  return !error && typeof data?.total === "number" ? data.total : null;
}

async function duplicatesTotal(devUser: string | undefined): Promise<number | null> {
  const result = await fetchDuplicateQueue({ status: "PENDING", page: 1, pageSize: 1 }, devUser);
  return result.status === "ok" ? result.page.total : null;
}

async function incompleteTotal(devUser: string | undefined): Promise<number | null> {
  const result = await fetchIncompleteReport({ page: 1, pageSize: 1 }, devUser);
  return result.status === "ok" ? result.page.total : null;
}

/** Un total que falla o lanza no rompe los demás. */
async function safely(load: () => Promise<number | null>): Promise<number | null> {
  try {
    return await load();
  } catch {
    return null;
  }
}

/**
 * Totales de las pestañas pedidas, en paralelo. Solo se consulta lo que el rol puede ver (así no
 * se provocan respuestas 403); lo demás queda `null`.
 */
export async function fetchPendingCounts(keys: readonly PendingTabKey[], options: PendingCountsOptions = {}): Promise<PendingCounts> {
  const { devUser, mockPendingSuggestions } = options;
  const mock = getApiMode() === "mock";
  const loaders: Record<PendingTabKey, () => Promise<number | null>> = {
    duplicates: () => duplicatesTotal(devUser),
    suggestions: mock ? async () => mockPendingSuggestions ?? null : () => suggestionsTotal(devUser),
    incomplete: () => incompleteTotal(devUser),
  };
  const wanted = PENDING_TABS.map((tab) => tab.key).filter((key) => keys.includes(key));
  const totals = await Promise.all(wanted.map((key) => safely(loaders[key])));
  const counts: PendingCounts = { ...UNKNOWN_COUNTS };
  wanted.forEach((key, index) => {
    counts[key] = totals[index] ?? null;
  });
  return counts;
}

/** Direcciones antiguas que ahora son pestañas de la bandeja (spec: «Redirección de las direcciones antiguas a la bandeja»). */
export const LEGACY_PENDING_ROUTES = {
  "/duplicados": "/pendientes/duplicados",
  "/ia/sugerencias": "/pendientes/sugerencias",
} as const;

/**
 * Adónde lleva una dirección antigua: su pestaña, con **todos** los parámetros tal cual (filtros,
 * `resaltar` y los que se añadan después). Mismo patrón que `depositoRedirectTarget`.
 */
export function legacyPendingTarget(target: string, params: { toString(): string }): string {
  const query = params.toString();
  return query ? `${target}?${query}` : target;
}
