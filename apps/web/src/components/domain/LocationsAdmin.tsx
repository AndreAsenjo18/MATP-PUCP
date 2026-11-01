"use client";

/**
 * Sección «Ubicaciones» de Administración en modo `live` (RF-016; rediseño en
 * `rediseno-ux-administracion`). Arriba, la búsqueda por nombre y el filtro por nivel con el botón
 * «Nueva ubicación», que abre un diálogo; debajo, el árbol sede → depósito → mueble → nivel →
 * contenedor con cada nivel en una etiqueta de color y texto. Al filtrar se conservan los
 * ascendientes de cada resultado (`filterLocationTree`).
 */
import { CircleOff, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminToolbar, FormDialog, Notice, SectionHeader } from "@/components/domain/AdminShell";
import { Badge, type BadgeIntent } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSession } from "@/lib/auth/session";
import {
  LOCATION_ERROR_MESSAGES,
  createLocation,
  fetchLocationsTree,
  filterLocationTree,
  updateLocation,
  type LocationFailure,
  type LocationFilters,
  type LocationLevelLabel,
  type LocationNode,
} from "@/lib/data/locations";

export const LOCATION_LEVELS: LocationLevelLabel[] = ["Sede", "Depósito", "Mueble", "Nivel", "Contenedor"];

const LEVEL_INTENT: Record<string, BadgeIntent> = {
  Sede: "info",
  Depósito: "success",
  Mueble: "warning",
  Nivel: "default",
  Contenedor: "info",
};

export function flattenLocationTree(nodes: LocationNode[], prefix: string[] = []): { id: string; label: string }[] {
  return nodes.flatMap((node) => {
    const path = [...prefix, node.name];
    return [{ id: node.id, label: path.join(" › ") }, ...flattenLocationTree(node.children ?? [], path)];
  });
}

function describeLocationFailure(failure: LocationFailure): string {
  if (failure.status === "unavailable") return failure.message;
  return LOCATION_ERROR_MESSAGES[failure.code] ?? failure.message;
}

/** Árbol compacto: el nivel de cada ubicación va en una etiqueta de color con su nombre. */
export function LocationTreeView({
  nodes,
  depth = 0,
  onDeactivate,
}: {
  nodes: LocationNode[];
  depth?: number;
  onDeactivate?: (node: LocationNode) => void;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {nodes.map((node) => (
        <li key={node.id}>
          <p className="flex flex-wrap items-center gap-2 py-0.5 text-sm text-tinta" style={{ paddingLeft: `${depth * 20}px` }}>
            <Badge intent={LEVEL_INTENT[node.level_type] ?? "default"} className="px-2 py-0 text-xs">
              {node.level_type}
            </Badge>
            {node.name}
            {node.level_type === "Contenedor" && onDeactivate && (
              <Button
                variant="outline"
                size="sm"
                icon={CircleOff}
                title="Desactivar"
                aria-label={`Desactivar ${node.name}`}
                className="ml-1"
                onClick={() => onDeactivate(node)}
              />
            )}
          </p>
          {node.children && node.children.length > 0 && <LocationTreeView nodes={node.children} depth={depth + 1} onDeactivate={onDeactivate} />}
        </li>
      ))}
    </ul>
  );
}

export function LocationsLive() {
  const { currentUser } = useSession();
  const devUser = currentUser?.email;
  const [tree, setTree] = useState<LocationNode[]>([]);
  const [filters, setFilters] = useState<LocationFilters>({ query: "", level: "" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ level: "Depósito" as LocationLevelLabel, code: "", name: "", parentId: "" });

  const reload = useCallback(async () => {
    const result = await fetchLocationsTree(devUser);
    if (result.status === "ok") setTree(result.value);
  }, [devUser]);

  useEffect(() => {
    let active = true;
    fetchLocationsTree(devUser).then((result) => {
      if (active && result.status === "ok") setTree(result.value);
    });
    return () => {
      active = false;
    };
  }, [devUser]);

  const shown = useMemo(() => filterLocationTree(tree, filters), [tree, filters]);
  const flat = useMemo(() => flattenLocationTree(tree), [tree]);

  async function handleDeactivate(node: LocationNode) {
    setError(null);
    setMessage(null);
    const result = await updateLocation(node.id, { is_active: false }, devUser);
    if (result.status === "ok") {
      setMessage(`Ubicación «${node.name}» desactivada.`);
      await reload();
    } else {
      setError(describeLocationFailure(result));
    }
  }

  async function handleCreate(): Promise<boolean> {
    if (!form.code.trim() || !form.name.trim()) {
      setDialogError("Escriba el código y el nombre de la ubicación.");
      return false;
    }
    const result = await createLocation({ level: form.level, code: form.code.trim(), name: form.name.trim(), parent_id: form.parentId || null }, devUser);
    if (result.status !== "ok") {
      setDialogError(describeLocationFailure(result));
      return false;
    }
    setDialogError(null);
    setError(null);
    setMessage(`Ubicación «${result.value.name}» creada.`);
    setForm((current) => ({ ...current, code: "", name: "" }));
    await reload();
    return true;
  }

  return (
    <Card as="section" aria-label="Ubicaciones" className="flex flex-col gap-4">
      <SectionHeader title="Ubicaciones" description="Dónde se guardan las piezas: sede, depósito, mueble, nivel y contenedor." />
      <AdminToolbar
        label="Filtros de ubicaciones"
        action={
          <Button size="sm" icon={Plus} onClick={() => setDialogOpen(true)}>
            Nueva ubicación
          </Button>
        }
      >
        <Input label="Buscar" value={filters.query} placeholder="Nombre" onChange={(event) => setFilters((c) => ({ ...c, query: event.target.value }))} fieldClassName="w-56" />
        <Select label="Nivel" value={filters.level} onChange={(event) => setFilters((c) => ({ ...c, level: event.target.value as LocationFilters["level"] }))} fieldClassName="w-44">
          <option value="">Todos</option>
          {LOCATION_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </Select>
      </AdminToolbar>
      <Notice message={message} error={error} />
      {tree.length === 0 ? (
        <p className="text-sm text-gris-texto">Sin ubicaciones registradas todavía. Cree la primera con «Nueva ubicación».</p>
      ) : shown.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-gris-texto">
          <p>No hay ubicaciones con estos filtros.</p>
          <Button variant="outline" size="sm" onClick={() => setFilters({ query: "", level: "" })}>
            Limpiar filtros
          </Button>
        </div>
      ) : (
        <LocationTreeView nodes={shown} onDeactivate={handleDeactivate} />
      )}
      <FormDialog
        open={dialogOpen}
        title="Nueva ubicación"
        description="Elija su nivel y, salvo las sedes, el lugar donde está."
        submitLabel="Crear ubicación"
        error={dialogError}
        onClose={() => {
          setDialogOpen(false);
          setDialogError(null);
        }}
        onSubmit={handleCreate}
      >
        <Select label="Nivel" value={form.level} onChange={(event) => setForm((c) => ({ ...c, level: event.target.value as LocationLevelLabel }))}>
          {LOCATION_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </Select>
        <Select label="Ubicación padre" value={form.parentId} onChange={(event) => setForm((c) => ({ ...c, parentId: event.target.value }))}>
          <option value="">Sin padre (solo para Sede)</option>
          {flat.map((location) => (
            <option key={location.id} value={location.id}>
              {location.label}
            </option>
          ))}
        </Select>
        <Input label="Código" value={form.code} onChange={(event) => setForm((c) => ({ ...c, code: event.target.value }))} placeholder="p. ej. DEP2-RB" />
        <Input label="Nombre" value={form.name} onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))} placeholder="p. ej. Rack B" />
      </FormDialog>
    </Card>
  );
}
