/**
 * Bandeja «Revisar pendientes» (change `revisar-pendientes-unificado`; spec calidad-datos,
 * «Bandeja única de pendientes con pestañas»; RF-030, RF-035, RF-039).
 *
 * Reglas puras de las pestañas (qué ve cada rol y cuál se abre primero, design D2) y los
 * contadores (design D3), que salen solo del `total` de `GET /quality/incomplete`, pidiendo una
 * sola fila. La pestaña de sugerencias de IA se retiró en `retirar-pestana-sugerencias-ia`, y la de
 * posibles duplicados en `codigo-unico-y-ajustes-pantallas`: dos piezas ya no pueden compartir un
 * código, así que no hay duplicados que revisar.
 * Sin endpoint nuevo: un total que no se puede obtener queda como `null` y la pestaña se muestra
 * sin número.
 */

import { pendingImportBatchesTotal } from "./imports";
import { fetchIncompleteReport } from "./quality";

/** Se retiraron «Sugerencias de IA» y «Posibles duplicados»: queda «Piezas incompletas». Se
 * agrega «Importaciones pendientes» (change `digitalizacion-libro-registros`): sin esta pestaña,
 * un lote que el catalogador dejó listo (p. ej. desde una foto del libro de registros) no tenía
 * dónde aparecerle a quien lo aprueba, salvo que alguien le pasara la dirección a mano. */
export type PendingTabKey = "incomplete" | "imports";

export interface PendingTab {
  key: PendingTabKey;
  href: string;
  label: string;
  /** Permiso que hace visible la pestaña. */
  permission: string;
}

/** Las pestañas de la bandeja. */
export const PENDING_TABS: readonly PendingTab[] = [
  { key: "incomplete", href: "/pendientes/incompletas", label: "Piezas incompletas", permission: "reports.view" },
  { key: "imports", href: "/pendientes/importaciones", label: "Importaciones pendientes", permission: "imports.approve" },
];

export const PENDING_BASE_PATH = "/pendientes";

/** Pendientes por pestaña; `null` cuando el total no se pudo obtener (o no se pidió). */
export type PendingCounts = Record<PendingTabKey, number | null>;

export const UNKNOWN_COUNTS: PendingCounts = { incomplete: null, imports: null };

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
}

/** Piezas a las que les faltan datos: el número de la bandeja y de la tarjeta de Inicio. */
export async function incompleteTotal(devUser?: string): Promise<number | null> {
  const result = await fetchIncompleteReport({ page: 1, pageSize: 1 }, devUser);
  return result.status === "ok" && typeof result.page.total === "number" ? result.page.total : null;
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
  const { devUser } = options;
  const loaders: Record<PendingTabKey, () => Promise<number | null>> = {
    incomplete: () => incompleteTotal(devUser),
    imports: () => pendingImportBatchesTotal(devUser),
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
  // La pestaña de posibles duplicados se retiró (codigo-unico-y-ajustes-pantallas).
  "/duplicados": "/pendientes",
  "/pendientes/duplicados": "/pendientes",
  // La pestaña de sugerencias de IA se retiró: sus direcciones llevan a la bandeja.
  "/ia/sugerencias": "/pendientes",
  "/pendientes/sugerencias": "/pendientes",
} as const;

/**
 * Adónde lleva una dirección antigua: su pestaña, con **todos** los parámetros tal cual (filtros,
 * `resaltar` y los que se añadan después). Mismo patrón que `depositoRedirectTarget`.
 */
export function legacyPendingTarget(target: string, params: { toString(): string }): string {
  const query = params.toString();
  return query ? `${target}?${query}` : target;
}
