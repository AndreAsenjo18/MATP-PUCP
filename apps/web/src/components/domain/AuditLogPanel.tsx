"use client";

/**
 * Consulta global de auditoría de Administración (tarea 5.2 de
 * `auditoria-y-soft-delete-transversal`; requirement «Consulta agrupada y exportable de la
 * auditoría», RF-040, RF-041): conjuntos de cambios de todo el sistema con filtros, detalle campo a
 * campo y exportación a CSV.
 *
 * Une los filtros (`AuditLogFilterBar`), la lista (`AuditLogChangeSetList`), la descarga
 * (`AuditLogExport`) y la capa de datos `lib/data/audit-query`. Modos (igual que el resto de la
 * maqueta, `lib/data/mode.ts`): en `live` consulta la API; en `mock` la pantalla le pasa las filas de
 * la sesión de demostración en `demoEntries` y aquí no se hace ninguna llamada de red.
 *
 * Los permisos los decide la pantalla (`audit.read`); el servidor vuelve a comprobarlos (403) y
 * enmascara los valores sensibles que el rol no puede ver.
 */
import { TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  AUDIT_DETAIL_PAGE_SIZE,
  AUDIT_PAGE_SIZE,
  csvDownloadAvailable,
  EMPTY_AUDIT_FILTERS,
  fetchAuditChangeSets,
  fetchAuditEntries,
  hasActiveAuditFilters,
  type AuditChangeSetsResult,
  type AuditQueryFilters,
} from "@/lib/data/audit-query";
import type { AuditChangeSetSummary, AuditEntryView } from "@/lib/data/audit";
import { mergePeople, type Person } from "@/lib/data/trash";

import { AuditLogExport } from "./AuditLogExport";
import { AuditLogEntryList, AuditLogChangeSetList } from "./AuditLogChangeSetList";
import { AuditLogFilterBar } from "./AuditLogFilterBar";
import { AuditLogPager, pageCount } from "./AuditLogPager";

export const AUDIT_INTRO =
  "Cada tarjeta es una operación completa (una edición, una carga de Excel, una reversión), no un campo suelto. Filtre por tipo de registro, origen, acción, fechas o persona y abra una tarjeta para ver qué campos cambiaron.";

type Loaded = { key: string; result: AuditChangeSetsResult };

/** Detalle campo a campo del conjunto abierto. */
interface DetailState {
  changeSetId: string;
  entries: AuditEntryView[];
  total: number;
  page: number;
  loading: boolean;
  error: string | null;
}

export interface AuditLogPanelProps {
  /**
   * Filas de auditoría ya conocidas (modo demostración): si se pasan, el panel no consulta la red
   * y agrupa estas filas. En modo `live` se omite.
   */
  demoEntries?: readonly AuditEntryView[];
}

export function AuditLogPanel({ demoEntries }: AuditLogPanelProps) {
  const [filters, setFilters] = useState<AuditQueryFilters>(EMPTY_AUDIT_FILTERS);
  const [page, setPage] = useState(1);
  const [reloads, setReloads] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [knownPeople, setKnownPeople] = useState<Person[]>([]);
  const [detail, setDetail] = useState<DetailState | null>(null);

  const requestKey = `${JSON.stringify(filters)}|${page}|${reloads}`;
  const demoPeople = useMemo(
    () => mergePeople([], (demoEntries ?? []).map((entry) => ({ id: entry.user_id, name: entry.actor_label }))),
    [demoEntries],
  );
  const people = useMemo(() => mergePeople(demoPeople, knownPeople), [demoPeople, knownPeople]);

  useEffect(() => {
    let active = true;
    void fetchAuditChangeSets({ filters, page, pageSize: AUDIT_PAGE_SIZE, demoEntries }).then((result) => {
      if (!active) return;
      setLoaded({ key: requestKey, result });
      if (result.status === "ok") {
        setKnownPeople((known) => mergePeople(known, result.changeSets.map((summary) => ({ id: summary.user_id, name: summary.actor_label }))));
      }
    });
    return () => {
      active = false;
    };
  }, [filters, page, reloads, requestKey, demoEntries]);

  const current = loaded?.key === requestKey ? loaded.result : null;

  function applyFilters(next: AuditQueryFilters) {
    setDetail(null);
    setPage(1);
    setFilters(next);
  }

  async function loadDetail(changeSetId: string, detailPage: number, previous: AuditEntryView[]) {
    setDetail({ changeSetId, entries: previous, total: previous.length, page: detailPage, loading: true, error: null });
    const result = await fetchAuditEntries({
      filters: { ...EMPTY_AUDIT_FILTERS, changeSetId },
      page: detailPage,
      pageSize: AUDIT_DETAIL_PAGE_SIZE,
      demoEntries,
    });
    setDetail((state) => {
      if (!state || state.changeSetId !== changeSetId) return state;
      if (result.status !== "ok") return { ...state, loading: false, error: result.message };
      return { ...state, entries: [...previous, ...result.entries], total: result.total, loading: false, error: null };
    });
  }

  function toggleDetail(summary: AuditChangeSetSummary) {
    if (detail?.changeSetId === summary.change_set_id) {
      setDetail(null);
      return;
    }
    void loadDetail(summary.change_set_id, 1, []);
  }

  return (
    <section aria-label="Consulta de auditoría" className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-tinta">Consulta de auditoría</h2>
        <p className="text-base text-gris-texto">{AUDIT_INTRO}</p>
      </header>

      <AuditLogFilterBar key={JSON.stringify(filters)} filters={filters} people={people} onApply={applyFilters} />

      <AuditLogExport filters={filters} available={csvDownloadAvailable() && demoEntries === undefined} />

      {current === null && (
        <p role="status" className="text-base text-gris-texto">
          Cargando la auditoría…
        </p>
      )}

      {current?.status === "forbidden" && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-ambar-alerta bg-ambar-bg p-4 text-base text-ambar-texto">
          <TriangleAlert size={20} aria-hidden="true" className="mt-0.5 shrink-0" />
          {current.message}
        </p>
      )}

      {current?.status === "unavailable" && (
        <Card role="alert" className="flex flex-col gap-2 text-base text-carmin-texto">
          <p>{current.message}</p>
          <Button variant="secondary" className="self-start" onClick={() => setReloads((count) => count + 1)}>
            Reintentar
          </Button>
        </Card>
      )}

      {current?.status === "ok" && (
        <>
          <p aria-live="polite" className="text-sm text-gris-texto">
            {current.total === 1 ? "1 conjunto de cambios" : `${current.total} conjuntos de cambios`}
          </p>
          <AuditLogChangeSetList
            changeSets={current.changeSets}
            hasFilters={hasActiveAuditFilters(filters)}
            openChangeSetId={detail?.changeSetId ?? null}
            onToggleDetail={toggleDetail}
            onOpenChangeSet={(changeSetId) => applyFilters({ ...EMPTY_AUDIT_FILTERS, changeSetId })}
            detail={
              detail && (
                <AuditLogEntryList
                  entries={detail.entries}
                  total={detail.total}
                  loading={detail.loading}
                  error={detail.error}
                  onLoadMore={() => void loadDetail(detail.changeSetId, detail.page + 1, detail.entries)}
                />
              )
            }
          />
          <AuditLogPager
            page={page}
            pageSize={AUDIT_PAGE_SIZE}
            total={current.total}
            noun="conjuntos de cambios"
            onPageChange={(next) => {
              setDetail(null);
              setPage(Math.min(Math.max(1, next), pageCount(current.total, AUDIT_PAGE_SIZE)));
            }}
          />
        </>
      )}
    </section>
  );
}
