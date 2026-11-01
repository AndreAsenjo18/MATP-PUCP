"use client";

/**
 * Administración de colecciones, listas de valores y tipos de código en modo `live` (change
 * `colecciones-y-vocabularios-admin`, tareas 5.1 y 5.2; RN-010, RF-010, RF-011, RF-023; rediseño en
 * `rediseno-ux-administracion`). Cada sección lleva sus filtros y su botón «Nuevo …» en una barra
 * sobre el listado, y el alta es un diálogo.
 *
 * - Colecciones: listado filtrable (búsqueda, estado y tipo) con las subcolecciones distinguidas.
 * - Listas de valores (los vocabularios): las opciones que se eligen al llenar una ficha; sus
 *   términos son etiquetas que se activan o desactivan (nunca se borran).
 * - Tipos de código (los tipos de identificador): candado en los tipos del sistema, alta, cambio de
 *   etiqueta y cambio de regla en dos pasos: vista previa del impacto en lenguaje claro y
 *   confirmación ligada a ella (`confirm_token`); con colisiones no se puede confirmar.
 */
import { Check, EyeOff, Eye, Lock, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminToolbar, FormDialog, Notice, SectionHeader } from "@/components/domain/AdminShell";
import { ConfirmButton } from "@/components/domain/ConfirmButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import {
  NORMALIZATION_RULES,
  NO_COLLECTION_FILTERS,
  codeError,
  createCollection,
  createIdentifierType,
  createTerm,
  createVocabulary,
  fetchCollectionList,
  fetchIdentifierTypes,
  fetchTerms,
  fetchVocabularies,
  filterCollections,
  lockedRules,
  previewRuleChange,
  previewSentence,
  setTermActive,
  suggestCode,
  updateIdentifierType,
  type CollectionFilters,
  type CollectionItem,
  type IdentifierType,
  type NormalizationPreview,
  type NormalizationRule,
  type TenureLabel,
  type VocabularySummary,
  type VocabularyTerm,
} from "@/lib/data/admin";

function ruleLabel(rule: NormalizationRule): string {
  return NORMALIZATION_RULES.find((item) => item.value === rule)?.label ?? rule;
}

// ---------------------------------------------------------------------------------------------
// Piezas presentacionales (se prueban con `render`)
// ---------------------------------------------------------------------------------------------

/** Aviso de que el término se desactiva sin tocar las fichas que ya lo usan. */
export const TERM_DEACTIVATED_NOTE = "deja de ofrecerse, pero las fichas que lo usan lo conservan";

/**
 * Términos como etiquetas: verde con icono las que se ofrecen en las fichas, gris y tachada las
 * desactivadas. Pulsar una etiqueta la activa o la desactiva; no hay un botón por término.
 */
export function TermList({ terms, busy, onToggle }: { terms: VocabularyTerm[]; busy: boolean; onToggle: (term: VocabularyTerm) => void }) {
  if (terms.length === 0) return <p className="text-sm text-gris-texto">Esta lista todavía no tiene términos. Agregue el primero desde la barra de arriba.</p>;
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-2" aria-label="Términos de la lista">
        {terms.map((term) => (
          <li key={term.id}>
            <button
              type="button"
              aria-pressed={term.is_active}
              disabled={busy}
              title={`${term.code} · ${term.is_active ? "Pulse para desactivar" : "Pulse para activar"}`}
              onClick={() => onToggle(term)}
              className={cn(
                "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota disabled:opacity-50",
                term.is_active ? "bg-verde-bg text-verde-exito hover:brightness-95" : "bg-borde text-gris-texto line-through hover:brightness-95",
              )}
            >
              {term.is_active ? <Check size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
              {term.label}
              <span className="sr-only">{term.is_active ? "(activo)" : "(desactivado)"}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gris-texto">Verde: se ofrece en las fichas. Gris tachado: desactivado. Pulse una etiqueta para cambiarla.</p>
    </div>
  );
}

export function IdentifierTypesTable({
  types,
  selected,
  onSelect,
}: {
  types: IdentifierType[];
  selected: string | null;
  onSelect: (code: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-gris-texto">
          <tr>
            <th className="py-1.5 pr-3 font-medium">Código</th>
            <th className="py-1.5 pr-3 font-medium">Etiqueta</th>
            <th className="py-1.5 pr-3 font-medium">Cómo se escribe</th>
            <th className="py-1.5 pr-3 font-medium">Reglas fijas</th>
            <th className="py-1.5 font-medium">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody className="text-tinta">
          {types.map((type) => {
            const locked = lockedRules(type);
            return (
              <tr key={type.code} className={cn("border-t border-borde", selected === type.code && "bg-crema-light")}>
                <td className="py-1.5 pr-3 font-mono font-medium">
                  <span className="inline-flex items-center gap-1">
                    {type.is_system && <Lock size={14} aria-label="Tipo del sistema" className="text-terracota" />}
                    {type.code}
                  </span>
                </td>
                <td className="py-1.5 pr-3">{type.label}</td>
                <td className="py-1.5 pr-3 text-gris-texto">{ruleLabel(type.normalization_rule)}</td>
                <td className="py-1.5 pr-3 text-xs text-gris-texto">
                  {type.is_system ? <Badge intent="info" className="px-2 py-0 text-xs">Del sistema</Badge> : <Badge className="px-2 py-0 text-xs">Configurable</Badge>}
                  {type.is_system && locked.length > 0 && <span className="mt-0.5 block">{locked.join(", ")}.</span>}
                </td>
                <td className="py-1.5">
                  <Button variant="outline" size="sm" icon={Pencil} title="Editar" aria-label={`Editar ${type.code}`} onClick={() => onSelect(type.code)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Impacto de un cambio de regla y su confirmación (tarea 5.2; RNF-010). */
export function RulePreviewPanel({
  type,
  preview,
  busy,
  onConfirm,
  onCancel,
}: {
  type: Pick<IdentifierType, "label" | "locks_on_assignment">;
  preview: NormalizationPreview;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div role="region" aria-label="Impacto del cambio de regla" className="flex flex-col gap-3 rounded-md border border-borde p-3">
      <h3 className="text-base font-semibold text-tinta">
        Cambiar «{type.label}» de {ruleLabel(preview.current_rule)} a {ruleLabel(preview.proposed_rule)}
      </h3>
      <p className="text-sm text-tinta">{previewSentence(preview)}</p>
      {preview.changed_examples.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gris-texto">
              <tr>
                <th className="py-1 pr-3 font-medium">Valor original</th>
                <th className="py-1 pr-3 font-medium">Normalizado hoy</th>
                <th className="py-1 font-medium">Quedará como</th>
              </tr>
            </thead>
            <tbody className="text-tinta">
              {preview.changed_examples.map((item) => (
                <tr key={item.identifier_id} className="border-t border-borde">
                  <td className="py-1 pr-3">{item.original_value}</td>
                  <td className="py-1 pr-3">{item.normalized_value ?? "—"}</td>
                  <td className="py-1">{item.proposed_value ?? "No se reconoce"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {preview.collisions.length > 0 && (
        <div role="alert" className="rounded-md bg-carmin-bg p-3 text-sm text-carmin-texto">
          <p className="font-medium">No se puede confirmar: estos códigos quedarían repetidos en piezas distintas.</p>
          <ul className="list-disc pl-5">
            {preview.collisions.map((collision) => (
              <li key={collision.normalized_value}>
                {collision.normalized_value}: {collision.piece_ids.length} piezas
              </li>
            ))}
          </ul>
          <p>Corrija primero esos códigos desde la ficha de cada pieza.</p>
        </div>
      )}
      {preview.notes.map((note) => (
        <p key={note} className="rounded-md bg-ambar-bg p-2 text-sm text-ambar-texto">
          {note}
        </p>
      ))}
      <div className="flex flex-wrap gap-2">
        {preview.can_confirm && (
          <ConfirmButton
            label="Confirmar el cambio de regla"
            variant="primary"
            size="sm"
            disabled={busy}
            confirmTitle="Confirmar el cambio de regla"
            confirmDescription={`${previewSentence(preview)} El recálculo queda en la auditoría y se puede revertir.`}
            onConfirm={onConfirm}
          />
        )}
        <Button variant="secondary" size="sm" disabled={busy} onClick={onCancel}>
          {preview.can_confirm ? "Cancelar" : "Cerrar"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Colecciones
// ---------------------------------------------------------------------------------------------

const TENURES: TenureLabel[] = ["Propiedad", "Comodato", "Préstamo Temporal"];

/** Listado compacto: las subcolecciones llevan su etiqueta y el nombre de la colección padre. */
export function CollectionsTable({ items, all, onClearFilters }: { items: CollectionItem[]; all: CollectionItem[]; onClearFilters?: () => void }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-3 py-3 text-sm text-gris-texto">
        <p>No hay colecciones con estos filtros.</p>
        {onClearFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Limpiar filtros
          </Button>
        )}
      </div>
    );
  }
  const names = new Map(all.map((item) => [item.id, item.name]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-gris-texto">
          <tr>
            <th className="py-1.5 pr-3 font-medium">Colección</th>
            <th className="py-1.5 pr-3 font-medium">Sigla</th>
            <th className="py-1.5 pr-3 text-right font-medium">Piezas</th>
            <th className="py-1.5 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody className="text-tinta">
          {items.map((collection) => (
            <tr key={collection.id} className="border-t border-borde">
              <td className="py-1.5 pr-3">
                <span className={cn("flex flex-wrap items-center gap-2", collection.parent_id && "pl-4")}>
                  {collection.name}
                  {collection.parent_id && (
                    <Badge className="px-2 py-0 text-xs" title="Subcolección">
                      Subcolección de {names.get(collection.parent_id) ?? "otra colección"}
                    </Badge>
                  )}
                </span>
              </td>
              <td className="py-1.5 pr-3 font-mono text-xs text-gris-texto">{collection.acronym ?? "—"}</td>
              <td className="py-1.5 pr-3 text-right">{collection.piece_count}</td>
              <td className="py-1.5">
                {collection.is_active ? <Badge intent="success" className="px-2 py-0 text-xs">Activa</Badge> : <Badge className="px-2 py-0 text-xs">Inactiva</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CollectionsLive() {
  const { currentUser, hasPermission } = useSession();
  const devUser = currentUser?.email;
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [filters, setFilters] = useState<CollectionFilters>(NO_COLLECTION_FILTERS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", acronym: "", tenure: "Propiedad" as TenureLabel, parentId: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const canManage = hasPermission("collections.manage");

  const reload = useCallback(async () => {
    const result = await fetchCollectionList(devUser);
    if (result.status === "ok") setCollections(result.value);
    else setError(result.message);
  }, [devUser]);

  useEffect(() => {
    let active = true;
    fetchCollectionList(devUser).then((result) => {
      if (!active) return;
      if (result.status === "ok") setCollections(result.value);
      else setError(result.message);
    });
    return () => {
      active = false;
    };
  }, [devUser]);

  const shown = useMemo(() => filterCollections(collections, filters), [collections, filters]);

  async function handleCreate(): Promise<boolean> {
    if (!form.name.trim()) {
      setDialogError("Escriba el nombre de la colección.");
      return false;
    }
    const result = await createCollection({ ...form }, devUser);
    if (result.status !== "ok") {
      setDialogError(result.message);
      return false;
    }
    setDialogError(null);
    setError(null);
    setMessage(`Colección «${result.value.name}» creada.`);
    setForm({ name: "", acronym: "", tenure: "Propiedad", parentId: "" });
    await reload();
    return true;
  }

  return (
    <Card as="section" aria-label="Colecciones" className="flex flex-col gap-4">
      <SectionHeader title="Colecciones" description="Las colecciones del museo y sus subcolecciones. La sigla identifica a las piezas de cada una." />
      <AdminToolbar
        label="Filtros de colecciones"
        action={
          canManage && (
            <Button size="sm" icon={Plus} onClick={() => setDialogOpen(true)}>
              Nueva colección
            </Button>
          )
        }
      >
        <Input label="Buscar" value={filters.query} placeholder="Nombre o sigla" onChange={(event) => setFilters((c) => ({ ...c, query: event.target.value }))} fieldClassName="w-56" />
        <Select label="Estado" value={filters.status} onChange={(event) => setFilters((c) => ({ ...c, status: event.target.value as CollectionFilters["status"] }))} fieldClassName="w-36">
          <option value="">Todas</option>
          <option value="active">Activas</option>
          <option value="inactive">Inactivas</option>
        </Select>
        <Select label="Tipo" value={filters.kind} onChange={(event) => setFilters((c) => ({ ...c, kind: event.target.value as CollectionFilters["kind"] }))} fieldClassName="w-44">
          <option value="">Todas</option>
          <option value="main">Principales</option>
          <option value="sub">Subcolecciones</option>
        </Select>
      </AdminToolbar>
      <p className="text-xs text-gris-texto">
        {shown.length === collections.length ? `${collections.length} colecciones` : `${shown.length} de ${collections.length} colecciones`}
      </p>
      <Notice message={message} error={error} />
      <CollectionsTable items={shown} all={collections} onClearFilters={() => setFilters(NO_COLLECTION_FILTERS)} />
      <FormDialog
        open={dialogOpen}
        title="Nueva colección"
        description="Principal o subcolección de otra."
        submitLabel="Crear colección"
        error={dialogError}
        onClose={() => {
          setDialogOpen(false);
          setDialogError(null);
        }}
        onSubmit={handleCreate}
      >
        <Input label="Nombre" value={form.name} onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))} />
        <Input label="Sigla" value={form.acronym} placeholder="p. ej. M.M.Z." onChange={(event) => setForm((c) => ({ ...c, acronym: event.target.value }))} />
        <Select label="Régimen por defecto" value={form.tenure} onChange={(event) => setForm((c) => ({ ...c, tenure: event.target.value as TenureLabel }))}>
          {TENURES.map((tenure) => (
            <option key={tenure} value={tenure}>
              {tenure}
            </option>
          ))}
        </Select>
        <Select label="Colección padre" value={form.parentId} onChange={(event) => setForm((c) => ({ ...c, parentId: event.target.value }))}>
          <option value="">Ninguna (colección principal)</option>
          {collections
            .filter((collection) => collection.is_active)
            .map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
        </Select>
      </FormDialog>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
// Listas de valores (vocabularios)
// ---------------------------------------------------------------------------------------------

export function VocabulariesLive() {
  const { currentUser } = useSession();
  const devUser = currentUser?.email;
  const [vocabularies, setVocabularies] = useState<VocabularySummary[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [terms, setTerms] = useState<VocabularyTerm[]>([]);
  const [termLabel, setTermLabel] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [newVocabulary, setNewVocabulary] = useState({ name: "", code: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadVocabularies = useCallback(async () => {
    const result = await fetchVocabularies(devUser);
    if (result.status !== "ok") return setError(result.message);
    setVocabularies(result.value);
    setSelected((current) => current || result.value[0]?.code || "");
  }, [devUser]);

  useEffect(() => {
    let active = true;
    fetchVocabularies(devUser).then((result) => {
      if (!active) return;
      if (result.status !== "ok") return setError(result.message);
      setVocabularies(result.value);
      setSelected((current) => current || result.value[0]?.code || "");
    });
    return () => {
      active = false;
    };
  }, [devUser]);

  const loadTerms = useCallback(
    async (code: string) => {
      const result = await fetchTerms(code, devUser);
      if (result.status === "ok") setTerms(result.value);
      else setError(result.message);
    },
    [devUser],
  );

  useEffect(() => {
    let active = true;
    if (!selected) return;
    fetchTerms(selected, devUser).then((result) => {
      if (!active) return;
      if (result.status === "ok") setTerms(result.value);
      else setError(result.message);
    });
    return () => {
      active = false;
    };
  }, [selected, devUser]);

  function done(text: string) {
    setError(null);
    setMessage(text);
  }

  async function handleToggle(term: VocabularyTerm) {
    setBusy(true);
    const result = await setTermActive(selected, term.id, !term.is_active, devUser);
    setBusy(false);
    if (result.status !== "ok") return setError(result.message);
    done(`Término «${term.label}» ${term.is_active ? `desactivado: ${TERM_DEACTIVATED_NOTE}` : "activado"}.`);
    await loadTerms(selected);
  }

  async function handleAddTerm() {
    const code = suggestCode(termLabel);
    if (!termLabel.trim() || codeError(code)) return setError("Escriba la etiqueta del término.");
    setBusy(true);
    const result = await createTerm(selected, code, termLabel, devUser);
    setBusy(false);
    if (result.status !== "ok") return setError(result.message);
    setTermLabel("");
    done(`Término «${result.value.label}» agregado con el código ${result.value.code}.`);
    await Promise.all([loadTerms(selected), loadVocabularies()]);
  }

  async function handleCreateVocabulary(): Promise<boolean> {
    const code = newVocabulary.code || suggestCode(newVocabulary.name);
    const invalid = codeError(code, { min: 2 });
    if (!newVocabulary.name.trim()) {
      setDialogError("Escriba el nombre de la lista.");
      return false;
    }
    if (invalid) {
      setDialogError(invalid);
      return false;
    }
    const result = await createVocabulary(code, newVocabulary.name, devUser);
    if (result.status !== "ok") {
      setDialogError(result.message);
      return false;
    }
    setDialogError(null);
    setNewVocabulary({ name: "", code: "" });
    done(`Lista «${result.value.name}» creada con el código ${result.value.code}.`);
    await loadVocabularies();
    setSelected(result.value.code);
    return true;
  }

  return (
    <Card as="section" aria-label="Listas de valores" className="flex flex-col gap-4">
      <SectionHeader
        title="Listas de valores"
        description="Las opciones que se eligen al llenar una ficha, como materiales, técnicas o estados de conservación. Desactivar un término lo quita de las opciones; las fichas que ya lo usan lo conservan."
      />
      <AdminToolbar
        label="Lista y términos"
        action={
          <Button size="sm" variant="outline" icon={Plus} onClick={() => setDialogOpen(true)}>
            Nueva lista
          </Button>
        }
      >
        <Select label="Lista" value={selected} onChange={(event) => setSelected(event.target.value)} fieldClassName="w-64">
          {vocabularies.map((vocabulary) => (
            <option key={vocabulary.code} value={vocabulary.code}>
              {vocabulary.name} · {vocabulary.term_count}
            </option>
          ))}
        </Select>
        <Input label="Nuevo término" value={termLabel} onChange={(event) => setTermLabel(event.target.value)} placeholder="p. ej. Arte plumario" fieldClassName="w-56" />
        <Button size="sm" icon={Plus} disabled={busy || !selected || !termLabel.trim()} onClick={handleAddTerm}>
          Agregar
        </Button>
      </AdminToolbar>
      {termLabel.trim() && <p className="text-xs text-gris-texto">Código estable: {suggestCode(termLabel) || "—"}</p>}
      <Notice message={message} error={error} />
      <TermList terms={terms} busy={busy} onToggle={handleToggle} />
      <FormDialog
        open={dialogOpen}
        title="Nueva lista de valores"
        description="Una lista nueva puede usarse luego en las fichas y en los formatos de archivo."
        submitLabel="Crear lista"
        error={dialogError}
        onClose={() => {
          setDialogOpen(false);
          setDialogError(null);
        }}
        onSubmit={handleCreateVocabulary}
      >
        <Input label="Nombre" value={newVocabulary.name} onChange={(event) => setNewVocabulary((c) => ({ ...c, name: event.target.value }))} placeholder="p. ej. Técnicas decorativas" />
        <Input
          label="Código estable"
          value={newVocabulary.code || suggestCode(newVocabulary.name)}
          onChange={(event) => setNewVocabulary((c) => ({ ...c, code: event.target.value.toUpperCase() }))}
          hint="No cambia después: es la referencia del sistema, no un código del museo."
        />
      </FormDialog>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
// Tipos de código (tipos de identificador)
// ---------------------------------------------------------------------------------------------

export function IdentifierTypesLive() {
  const { currentUser } = useSession();
  const devUser = currentUser?.email;
  const [types, setTypes] = useState<IdentifierType[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [rule, setRule] = useState<NormalizationRule>("GENERIC");
  const [preview, setPreview] = useState<NormalizationPreview | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [newType, setNewType] = useState({ label: "", code: "", rule: "GENERIC" as NormalizationRule });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const result = await fetchIdentifierTypes(devUser);
    if (result.status === "ok") setTypes(result.value);
    else setError(result.message);
  }, [devUser]);

  useEffect(() => {
    let active = true;
    fetchIdentifierTypes(devUser).then((result) => {
      if (!active) return;
      if (result.status === "ok") setTypes(result.value);
      else setError(result.message);
    });
    return () => {
      active = false;
    };
  }, [devUser]);

  const editing = types.find((type) => type.code === selected) ?? null;

  function select(code: string) {
    const type = types.find((item) => item.code === code);
    setSelected(code);
    setLabel(type?.label ?? "");
    setRule(type?.normalization_rule ?? "GENERIC");
    setPreview(null);
    setMessage(null);
    setError(null);
  }

  async function finish(text: string) {
    setError(null);
    setMessage(text);
    setPreview(null);
    await reload();
  }

  async function handleSaveLabel() {
    if (!editing || !label.trim()) return;
    setBusy(true);
    const result = await updateIdentifierType(editing.code, { label }, devUser);
    setBusy(false);
    if (result.status !== "ok") return setError(result.message);
    await finish(`Etiqueta de ${editing.code} guardada.`);
  }

  async function handlePreview() {
    if (!editing) return;
    setBusy(true);
    const result = await previewRuleChange(editing.code, rule, devUser);
    setBusy(false);
    if (result.status !== "ok") return setError(result.message);
    setError(null);
    setPreview(result.value);
  }

  async function handleConfirm() {
    if (!editing || !preview) return;
    setBusy(true);
    const result = await updateIdentifierType(editing.code, { rule: preview.proposed_rule, confirmToken: preview.confirm_token }, devUser);
    setBusy(false);
    if (result.status !== "ok") {
      setPreview(null);
      return setError(result.message);
    }
    await finish(`Regla de ${editing.code} cambiada; ${preview.changed_count} identificadores recalculados.`);
  }

  async function handleCreate(): Promise<boolean> {
    const code = newType.code || suggestCode(newType.label);
    const invalid = codeError(code, { max: 40 });
    if (!newType.label.trim()) {
      setDialogError("Escriba la etiqueta del tipo.");
      return false;
    }
    if (invalid) {
      setDialogError(invalid);
      return false;
    }
    const result = await createIdentifierType({ code, label: newType.label, rule: newType.rule }, devUser);
    if (result.status !== "ok") {
      setDialogError(result.message);
      return false;
    }
    setDialogError(null);
    setNewType({ label: "", code: "", rule: "GENERIC" });
    await finish(`Tipo «${result.value.label}» creado: ya se puede usar en las fichas y en los formatos de archivo.`);
    return true;
  }

  return (
    <Card as="section" aria-label="Tipos de código" className="flex flex-col gap-4">
      <SectionHeader
        title="Tipos de código"
        description="Las clases de código que puede tener una pieza (I, colección, INC/RN…) y cómo se escribe cada una de forma uniforme."
      />
      <AdminToolbar
        label="Tipos de código"
        action={
          <Button size="sm" icon={Plus} onClick={() => setDialogOpen(true)}>
            Nuevo tipo
          </Button>
        }
      />
      <Notice message={message} error={error} />
      <IdentifierTypesTable types={types} selected={selected} onSelect={select} />
      {editing && (
        <section aria-label={`Editar ${editing.code}`} className="flex flex-col gap-3 rounded-md border border-borde p-3">
          <h3 className="flex items-center gap-2 text-base font-semibold text-tinta">
            {editing.is_system && <Lock size={16} aria-hidden="true" className="text-terracota" />}
            Editar {editing.code}
          </h3>
          {editing.is_system && (
            <p className="text-sm text-gris-texto">
              Es un tipo del sistema: {lockedRules(editing).join(", ") || "sus reglas no cambian"}. Solo se pueden cambiar su etiqueta, descripción y orden.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <Input label="Etiqueta" value={label} onChange={(event) => setLabel(event.target.value)} fieldClassName="w-64" />
            <Button size="sm" disabled={busy || label.trim() === editing.label} onClick={handleSaveLabel}>
              Guardar etiqueta
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-2 border-t border-borde pt-3">
            <Select label="Cómo se escribe" value={rule} onChange={(event) => setRule(event.target.value as NormalizationRule)} fieldClassName="w-72">
              {NORMALIZATION_RULES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
            <Button variant="outline" size="sm" icon={Eye} disabled={busy || rule === editing.normalization_rule} onClick={handlePreview}>
              Ver el impacto
            </Button>
          </div>
          {preview && <RulePreviewPanel type={editing} preview={preview} busy={busy} onConfirm={handleConfirm} onCancel={() => setPreview(null)} />}
        </section>
      )}
      <FormDialog
        open={dialogOpen}
        title="Nuevo tipo de código"
        description="Podrá usarse en las fichas y en los formatos de archivo."
        submitLabel="Crear tipo"
        error={dialogError}
        onClose={() => {
          setDialogOpen(false);
          setDialogError(null);
        }}
        onSubmit={handleCreate}
      >
        <Input label="Etiqueta" value={newType.label} onChange={(event) => setNewType((c) => ({ ...c, label: event.target.value }))} placeholder="p. ej. Código del propietario anterior" />
        <Input label="Código estable" value={newType.code || suggestCode(newType.label)} onChange={(event) => setNewType((c) => ({ ...c, code: event.target.value.toUpperCase() }))} />
        <Select label="Cómo se escribe" value={newType.rule} onChange={(event) => setNewType((c) => ({ ...c, rule: event.target.value as NormalizationRule }))}>
          {NORMALIZATION_RULES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
      </FormDialog>
    </Card>
  );
}
