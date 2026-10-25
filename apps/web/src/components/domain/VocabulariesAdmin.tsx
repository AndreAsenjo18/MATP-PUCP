"use client";

/**
 * Administración de colecciones, vocabularios y tipos de identificador en modo `live` (change
 * `colecciones-y-vocabularios-admin`, tareas 5.1 y 5.2; RN-010, RF-010, RF-011, RF-023).
 *
 * - Colecciones: listado con piezas y alta con sigla (la API normaliza y rechaza siglas repetidas).
 * - Vocabularios: alta con código estable, términos con alta y activar/desactivar (nunca borrar).
 * - Tipos de identificador: candado y explicación en los tipos del sistema (I, COLECCION), alta,
 *   cambio de etiqueta y cambio de regla en dos pasos: vista previa del impacto en lenguaje claro y
 *   confirmación ligada a ella (`confirm_token`); con colisiones no se puede confirmar (RN-002).
 */
import { Eye, Lock, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ConfirmButton } from "@/components/domain/ConfirmButton";
import { StatusBadge } from "@/components/domain/StatusBadges";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import {
  NORMALIZATION_RULES,
  codeError,
  createCollection,
  createIdentifierType,
  createTerm,
  createVocabulary,
  fetchCollectionList,
  fetchIdentifierTypes,
  fetchTerms,
  fetchVocabularies,
  lockedRules,
  previewRuleChange,
  previewSentence,
  setTermActive,
  suggestCode,
  updateIdentifierType,
  type CollectionItem,
  type IdentifierType,
  type NormalizationPreview,
  type NormalizationRule,
  type TenureLabel,
  type VocabularySummary,
  type VocabularyTerm,
} from "@/lib/data/admin";

function Notice({ message, error }: { message: string | null; error: string | null }) {
  return (
    <>
      {message && <p className="rounded-md bg-verde-bg px-3 py-2 text-base text-verde-exito">{message}</p>}
      {error && (
        <p role="alert" className="rounded-md bg-carmin-bg px-3 py-2 text-base text-carmin-texto">
          {error}
        </p>
      )}
    </>
  );
}

function ruleLabel(rule: NormalizationRule): string {
  return NORMALIZATION_RULES.find((item) => item.value === rule)?.label ?? rule;
}

// ---------------------------------------------------------------------------------------------
// Piezas presentacionales (se prueban con `render`)
// ---------------------------------------------------------------------------------------------

export function TermList({ terms, busy, onToggle }: { terms: VocabularyTerm[]; busy: boolean; onToggle: (term: VocabularyTerm) => void }) {
  if (terms.length === 0) return <p className="text-base text-gris-texto">El vocabulario todavía no tiene términos.</p>;
  return (
    <ul className="flex flex-col gap-1">
      {terms.map((term) => (
        <li key={term.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-borde pt-1 first:border-t-0 first:pt-0">
          <span className={cn("text-base", term.is_active ? "text-tinta" : "text-gris-texto line-through")}>
            {term.label} <span className="text-sm text-gris-texto">({term.code})</span>
          </span>
          <span className="flex items-center gap-2">
            {!term.is_active && <StatusBadge status={{ label: "Desactivado", intent: "default" }} />}
            <Button variant="outline" disabled={busy} onClick={() => onToggle(term)}>
              {term.is_active ? "Desactivar" : "Activar"}
            </Button>
          </span>
        </li>
      ))}
    </ul>
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
      <table className="w-full text-left text-base">
        <thead className="text-sm text-gris-texto">
          <tr>
            <th className="py-1 pr-4 font-medium">Código</th>
            <th className="py-1 pr-4 font-medium">Etiqueta</th>
            <th className="py-1 pr-4 font-medium">Regla de normalización</th>
            <th className="py-1 pr-4 font-medium">Reglas fijas</th>
            <th className="py-1 font-medium">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody className="text-tinta">
          {types.map((type) => {
            const locked = lockedRules(type);
            return (
              <tr key={type.code} className={cn("border-t border-borde", selected === type.code && "bg-crema-light")}>
                <td className="py-1 pr-4 font-medium">
                  <span className="inline-flex items-center gap-1">
                    {type.is_system && <Lock size={16} aria-label="Tipo del sistema" className="text-terracota" />}
                    {type.code}
                  </span>
                </td>
                <td className="py-1 pr-4">{type.label}</td>
                <td className="py-1 pr-4 text-gris-texto">{ruleLabel(type.normalization_rule)}</td>
                <td className="py-1 pr-4 text-sm text-gris-texto">
                  {type.is_system ? `Tipo del sistema: ${locked.join(", ") || "sus reglas no cambian"}.` : "Configurable"}
                </td>
                <td className="py-1">
                  <Button variant="outline" onClick={() => onSelect(type.code)}>
                    Editar
                  </Button>
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
      <p className="text-base text-tinta">{previewSentence(preview)}</p>
      {preview.changed_examples.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-gris-texto">
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
        <div role="alert" className="rounded-md bg-carmin-bg p-3 text-base text-carmin-texto">
          <p className="font-medium">No se puede confirmar: estos códigos quedarían repetidos en piezas distintas (RN-002).</p>
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
            disabled={busy}
            confirmTitle="Confirmar el cambio de regla"
            confirmDescription={`${previewSentence(preview)} El recálculo queda en la auditoría y se puede revertir.`}
            onConfirm={onConfirm}
          />
        )}
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
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

export function CollectionsLive() {
  const { currentUser, hasPermission } = useSession();
  const devUser = currentUser?.email;
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [form, setForm] = useState({ name: "", acronym: "", tenure: "Propiedad" as TenureLabel, parentId: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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

  async function handleCreate() {
    if (!form.name.trim()) return setError("Escriba el nombre de la colección.");
    setBusy(true);
    const result = await createCollection({ ...form }, devUser);
    setBusy(false);
    if (result.status !== "ok") {
      setMessage(null);
      return setError(result.message);
    }
    setError(null);
    setMessage(`Colección «${result.value.name}» creada.`);
    setForm({ name: "", acronym: "", tenure: "Propiedad", parentId: "" });
    await reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-x-auto">
        <table className="w-full text-left text-base">
          <thead className="text-sm text-gris-texto">
            <tr>
              <th className="py-1 pr-4 font-medium">Colección</th>
              <th className="py-1 pr-4 font-medium">Sigla</th>
              <th className="py-1 pr-4 font-medium">Piezas</th>
              <th className="py-1 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="text-tinta">
            {collections.map((collection) => (
              <tr key={collection.id} className="border-t border-borde">
                <td className="py-1 pr-4">{collection.name}</td>
                <td className="py-1 pr-4 text-gris-texto">{collection.acronym ?? "—"}</td>
                <td className="py-1 pr-4">{collection.piece_count}</td>
                <td className="py-1">
                  <StatusBadge status={collection.is_active ? { label: "Activa", intent: "success" } : { label: "Inactiva", intent: "default" }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {canManage && (
        <Card as="section" aria-label="Crear colección" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-tinta">Crear colección o subcolección</h2>
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
          <Button icon={Plus} className="self-start" disabled={busy} onClick={handleCreate}>
            Crear colección
          </Button>
        </Card>
      )}
      <Notice message={message} error={error} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Vocabularios
// ---------------------------------------------------------------------------------------------

export function VocabulariesLive() {
  const { currentUser } = useSession();
  const devUser = currentUser?.email;
  const [vocabularies, setVocabularies] = useState<VocabularySummary[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [terms, setTerms] = useState<VocabularyTerm[]>([]);
  const [termLabel, setTermLabel] = useState("");
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

  const loadTerms = useCallback(async (code: string) => {
    const result = await fetchTerms(code, devUser);
    if (result.status === "ok") setTerms(result.value);
    else setError(result.message);
  }, [devUser]);

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
    done(`Término «${term.label}» ${term.is_active ? "desactivado: deja de ofrecerse, pero las fichas que lo usan lo conservan" : "activado"}.`);
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

  async function handleCreateVocabulary() {
    const code = newVocabulary.code || suggestCode(newVocabulary.name);
    const invalid = codeError(code, { min: 2 });
    if (!newVocabulary.name.trim()) return setError("Escriba el nombre del vocabulario.");
    if (invalid) return setError(invalid);
    setBusy(true);
    const result = await createVocabulary(code, newVocabulary.name, devUser);
    setBusy(false);
    if (result.status !== "ok") return setError(result.message);
    setNewVocabulary({ name: "", code: "" });
    done(`Vocabulario «${result.value.name}» creado con el código ${result.value.code}.`);
    await loadVocabularies();
    setSelected(result.value.code);
  }

  const current = vocabularies.find((vocabulary) => vocabulary.code === selected);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <ul className="flex flex-col gap-1" aria-label="Vocabularios">
          {vocabularies.map((vocabulary) => (
            <li key={vocabulary.code}>
              <button
                type="button"
                aria-pressed={selected === vocabulary.code}
                onClick={() => setSelected(vocabulary.code)}
                className={cn(
                  "min-h-11 w-full rounded-md px-3 py-2 text-left text-base focus-visible:outline-2 focus-visible:outline-terracota",
                  selected === vocabulary.code ? "bg-terracota text-white" : "text-tinta hover:bg-crema",
                )}
              >
                {vocabulary.name} ({vocabulary.term_count})
              </button>
            </li>
          ))}
        </ul>
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-tinta">{current?.name ?? "Vocabulario"}</h2>
          <TermList terms={terms} busy={busy} onToggle={handleToggle} />
          <div className="flex flex-wrap items-end gap-2 border-t border-borde pt-3">
            <Input label="Nuevo término" value={termLabel} onChange={(event) => setTermLabel(event.target.value)} placeholder="p. ej. Arte plumario" />
            <Button icon={Plus} disabled={busy || !selected} onClick={handleAddTerm}>
              Agregar término
            </Button>
          </div>
          {termLabel.trim() && <p className="text-sm text-gris-texto">Código estable: {suggestCode(termLabel) || "—"}</p>}
        </Card>
      </div>
      <Card as="section" aria-label="Crear vocabulario" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-tinta">Crear vocabulario</h2>
        <Input label="Nombre" value={newVocabulary.name} onChange={(event) => setNewVocabulary((c) => ({ ...c, name: event.target.value }))} placeholder="p. ej. Técnicas decorativas" />
        <Input
          label="Código estable"
          value={newVocabulary.code || suggestCode(newVocabulary.name)}
          onChange={(event) => setNewVocabulary((c) => ({ ...c, code: event.target.value.toUpperCase() }))}
          hint="No cambia después: es la referencia del sistema, no un código del museo."
        />
        <Button icon={Plus} className="self-start" disabled={busy} onClick={handleCreateVocabulary}>
          Crear vocabulario
        </Button>
      </Card>
      <Notice message={message} error={error} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Tipos de identificador
// ---------------------------------------------------------------------------------------------

export function IdentifierTypesLive() {
  const { currentUser } = useSession();
  const devUser = currentUser?.email;
  const [types, setTypes] = useState<IdentifierType[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [rule, setRule] = useState<NormalizationRule>("GENERIC");
  const [preview, setPreview] = useState<NormalizationPreview | null>(null);
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

  async function handleCreate() {
    const code = newType.code || suggestCode(newType.label);
    const invalid = codeError(code, { max: 40 });
    if (!newType.label.trim()) return setError("Escriba la etiqueta del tipo.");
    if (invalid) return setError(invalid);
    setBusy(true);
    const result = await createIdentifierType({ code, label: newType.label, rule: newType.rule }, devUser);
    setBusy(false);
    if (result.status !== "ok") return setError(result.message);
    setNewType({ label: "", code: "", rule: "GENERIC" });
    await finish(`Tipo «${result.value.label}» creado: ya se puede usar en las fichas y en las plantillas de mapeo.`);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <IdentifierTypesTable types={types} selected={selected} onSelect={select} />
      </Card>
      {editing && (
        <Card as="section" aria-label={`Editar ${editing.code}`} className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-tinta">
            {editing.is_system && <Lock size={18} aria-hidden="true" className="text-terracota" />}
            Editar {editing.code}
          </h2>
          {editing.is_system && (
            <p className="text-base text-gris-texto">
              Es un tipo del sistema: {lockedRules(editing).join(", ") || "sus reglas no cambian"}. Solo se pueden cambiar su etiqueta, descripción y orden.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <Input label="Etiqueta" value={label} onChange={(event) => setLabel(event.target.value)} />
            <Button disabled={busy || label.trim() === editing.label} onClick={handleSaveLabel}>
              Guardar etiqueta
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-2 border-t border-borde pt-3">
            <Select label="Regla de normalización" value={rule} onChange={(event) => setRule(event.target.value as NormalizationRule)}>
              {NORMALIZATION_RULES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
            <Button variant="outline" icon={Eye} disabled={busy || rule === editing.normalization_rule} onClick={handlePreview}>
              Ver el impacto
            </Button>
          </div>
          {preview && <RulePreviewPanel type={editing} preview={preview} busy={busy} onConfirm={handleConfirm} onCancel={() => setPreview(null)} />}
        </Card>
      )}
      <Card as="section" aria-label="Crear tipo de identificador" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-tinta">Crear tipo de identificador</h2>
        <Input label="Etiqueta" value={newType.label} onChange={(event) => setNewType((c) => ({ ...c, label: event.target.value }))} placeholder="p. ej. Código del propietario anterior" />
        <Input
          label="Código estable"
          value={newType.code || suggestCode(newType.label)}
          onChange={(event) => setNewType((c) => ({ ...c, code: event.target.value.toUpperCase() }))}
        />
        <Select label="Regla de normalización" value={newType.rule} onChange={(event) => setNewType((c) => ({ ...c, rule: event.target.value as NormalizationRule }))}>
          {NORMALIZATION_RULES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
        <Button icon={Plus} className="self-start" disabled={busy} onClick={handleCreate}>
          Crear tipo
        </Button>
      </Card>
      <Notice message={message} error={error} />
    </div>
  );
}
