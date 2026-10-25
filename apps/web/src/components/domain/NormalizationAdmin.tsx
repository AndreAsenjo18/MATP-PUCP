"use client";

/**
 * Pestaña «Normalización» de Administración, modo `live` (change `plantillas-mapeo-y-normalizacion`,
 * tarea 4.2; spec identificacion-piezas: RN-010, RF-023, RF-004; design D5). Exige
 * `vocabularies.manage` [SUPUESTO T8].
 *
 * - `MarkersEditor`: marcadores de ausencia vigentes, con etiqueta «Valores del código» o
 *   «Personalizado»; se añaden y quitan en un borrador que se guarda o descarta entero.
 * - `SeparatorsEditor`: separadores de códigos concatenados y marcadores que no se separan.
 * - `AliasesEditor`: siglas históricas (alias → colección), alta y eliminación con motivo.
 * - `NormalizationImpactNotice`: el 409 `normalization_change_requires_preview`: cuántos
 *   identificadores cambiarían, algunos ejemplos y que no se guardó nada [SUPUESTO T10].
 * - `NormalizationLive`: lee los valores y hace las llamadas.
 *
 * Las reglas (comparar marcadores como el servidor, rechazar el espacio como separador, leer el
 * 409) están en `lib/data/normalization-admin.ts` (ADR-012).
 */
import { Plus, Save, Trash2, TriangleAlert, Undo2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { ConfirmButton } from "@/components/domain/ConfirmButton";
import { ErrorNotice } from "@/components/domain/ImportWizard";
import { StatusBadge } from "@/components/domain/StatusBadges";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSession } from "@/lib/auth/session";
import {
  SPECIAL_SEPARATORS,
  addMarker,
  addSeparator,
  aliasFieldError,
  createAlias,
  deleteAlias,
  fetchAliases,
  fetchCollections,
  fetchSetting,
  hasChanges,
  impactFrom,
  impactReasonLabel,
  markerError,
  markersValue,
  removeItem,
  saveSetting,
  separatorError,
  separatorLabel,
  separatorsValue,
  type AcronymAlias,
  type CollectionOption,
  type ConcatenationSeparators,
  type NormalizationImpact,
} from "@/lib/data/normalization-admin";

function markerLabel(marker: string): string {
  return marker === "" ? "(celda vacía)" : marker;
}

function codeValue(value: string | null): string {
  return value ?? "(sin código)";
}

export function NormalizationImpactNotice({ impact, onDiscard }: { impact: NormalizationImpact; onDiscard?: () => void }) {
  return (
    <section role="alert" className="flex flex-col gap-3 rounded-md border border-ambar-texto/40 bg-ambar-bg p-3 text-ambar-texto">
      <p className="flex items-center gap-2 font-semibold">
        <TriangleAlert size={18} aria-hidden="true" />
        No se guardó nada.
      </p>
      <p className="text-sm">
        Este cambio alteraría {impact.affected} {impact.affected === 1 ? "identificador ya registrado" : "identificadores ya registrados"}. Para
        aplicarlo hace falta revisar la vista previa del impacto y confirmar el recálculo, que todavía no está disponible
        (colecciones-y-vocabularios-admin).
      </p>
      {impact.examples.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-tinta">
            <thead className="text-gris-texto">
              <tr>
                <th className="py-1 pr-3 font-medium">Tipo</th>
                <th className="py-1 pr-3 font-medium">Texto original</th>
                <th className="py-1 pr-3 font-medium">Hoy</th>
                <th className="py-1 pr-3 font-medium">Quedaría</th>
                <th className="py-1 font-medium">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {impact.examples.map((example, index) => (
                <tr key={`${example.originalValue}-${index}`} className="border-t border-borde">
                  <td className="py-1 pr-3">{example.typeCode}</td>
                  <td className="py-1 pr-3 font-mono">{example.originalValue}</td>
                  <td className="py-1 pr-3 font-mono">{codeValue(example.normalizedValue)}</td>
                  <td className="py-1 pr-3 font-mono">{codeValue(example.proposedValue)}</td>
                  <td className="py-1">{impactReasonLabel(example.reason)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {impact.remaining > 0 && <p className="text-sm">… y {impact.remaining} más.</p>}
      {onDiscard && (
        <Button variant="secondary" icon={Undo2} className="self-start" onClick={onDiscard}>
          Descartar el cambio
        </Button>
      )}
    </section>
  );
}

function Chips({ items, label, name, disabled, onRemove }: { items: string[]; label: (item: string) => string; name: string; disabled: boolean; onRemove: (item: string) => void }) {
  if (items.length === 0) return <p className="text-sm text-gris-texto">Ninguno.</p>;
  return (
    <ul className="flex flex-wrap gap-2" aria-label={name}>
      {items.map((item) => (
        <li key={item} className="flex items-center gap-1 rounded-md bg-crema-light py-1 pr-1 pl-3 text-base text-tinta">
          <span className="font-mono">{label(item)}</span>
          <Button variant="secondary" icon={X} aria-label={`Quitar «${label(item)}»`} disabled={disabled} onClick={() => onRemove(item)} />
        </li>
      ))}
    </ul>
  );
}

function SaveBar({ dirty, busy, onSave, onDiscard }: { dirty: boolean; busy: boolean; onSave: () => void; onDiscard: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button icon={Save} disabled={!dirty || busy} onClick={onSave}>
        {busy ? "Guardando…" : "Guardar cambios"}
      </Button>
      <Button variant="secondary" icon={Undo2} disabled={!dirty || busy} onClick={onDiscard}>
        Descartar
      </Button>
      {dirty && <span className="text-sm text-gris-texto">Hay cambios sin guardar.</span>}
    </div>
  );
}

function DefaultBadge({ isDefault }: { isDefault: boolean }) {
  return <StatusBadge status={isDefault ? { label: "Valores del código", intent: "default" } : { label: "Personalizado", intent: "info" }} />;
}

export function MarkersEditor({
  saved,
  draft,
  isDefault,
  busy,
  error,
  impact,
  onChange,
  onSave,
  onDiscard,
}: {
  saved: string[];
  draft: string[];
  isDefault: boolean;
  busy: boolean;
  error: string | null;
  impact: NormalizationImpact | null;
  onChange: (draft: string[]) => void;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const [marker, setMarker] = useState("");
  const addError = marker ? markerError(draft, marker) : null;
  return (
    <section aria-label="Marcadores de ausencia" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-tinta">Marcadores de ausencia</h3>
        <DefaultBadge isDefault={isDefault} />
      </div>
      <p className="text-sm text-gris-texto">
        Textos que significan «sin código»: un código I con uno de estos valores se registra como pieza sin código I (RF-004). Se comparan sin
        espacios ni diferencias de mayúsculas.
      </p>
      <Chips items={draft} label={markerLabel} name="Marcadores de ausencia" disabled={busy} onRemove={(item) => onChange(removeItem(draft, item))} />
      <div className="flex flex-wrap items-end gap-2">
        <Input label="Nuevo marcador" value={marker} error={addError ?? undefined} onChange={(event) => setMarker(event.target.value)} fieldClassName="min-w-56" />
        <Button
          variant="outline"
          icon={Plus}
          disabled={busy || markerError(draft, marker) !== null}
          onClick={() => {
            onChange(addMarker(draft, marker));
            setMarker("");
          }}
        >
          Añadir
        </Button>
      </div>
      <SaveBar dirty={hasChanges(saved, draft)} busy={busy} onSave={onSave} onDiscard={onDiscard} />
      <ErrorNotice message={error} />
      {impact && <NormalizationImpactNotice impact={impact} onDiscard={onDiscard} />}
    </section>
  );
}

export function SeparatorsEditor({
  saved,
  draft,
  isDefault,
  busy,
  error,
  impact,
  onChange,
  onSave,
  onDiscard,
}: {
  saved: ConcatenationSeparators;
  draft: ConcatenationSeparators;
  isDefault: boolean;
  busy: boolean;
  error: string | null;
  impact: NormalizationImpact | null;
  onChange: (draft: ConcatenationSeparators) => void;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const [separator, setSeparator] = useState("");
  const [special, setSpecial] = useState("");
  const [unsplit, setUnsplit] = useState("");
  const typed = separator || special;
  const addError = typed ? separatorError(draft.separators, typed) : null;
  const unsplitList = draft.unsplit_markers ?? [];
  const unsplitError = unsplit ? markerError(unsplitList, unsplit) : null;
  const dirty = hasChanges(saved.separators, draft.separators) || hasChanges(saved.unsplit_markers ?? [], unsplitList);
  return (
    <section aria-label="Separadores de códigos" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-tinta">Separadores de códigos</h3>
        <DefaultBadge isDefault={isDefault} />
      </div>
      <p className="text-sm text-gris-texto">Caracteres que separan varios códigos escritos en una misma celda (I-0236 / M.M.Z. 015).</p>
      <Chips
        items={draft.separators}
        label={separatorLabel}
        name="Separadores"
        disabled={busy}
        onRemove={(item) => onChange({ ...draft, separators: removeItem(draft.separators, item) })}
      />
      <div className="flex flex-wrap items-end gap-2">
        <Input
          label="Nuevo separador"
          value={separator}
          maxLength={1}
          disabled={special !== ""}
          error={separator ? (addError ?? undefined) : undefined}
          onChange={(event) => setSeparator(event.target.value)}
          fieldClassName="w-40"
        />
        <Select label="O un carácter especial" value={special} disabled={separator !== ""} onChange={(event) => setSpecial(event.target.value)}>
          <option value="">Ninguno</option>
          {SPECIAL_SEPARATORS.map((item) => (
            <option key={item} value={item}>
              {separatorLabel(item)}
            </option>
          ))}
        </Select>
        <Button
          variant="outline"
          icon={Plus}
          disabled={busy || !typed || addError !== null}
          onClick={() => {
            onChange({ ...draft, separators: addSeparator(draft.separators, typed) });
            setSeparator("");
            setSpecial("");
          }}
        >
          Añadir
        </Button>
      </div>
      {special && addError && <p className="text-sm text-carmin-texto">{addError}</p>}
      <h4 className="text-sm font-semibold text-tinta">Marcadores que no se separan</h4>
      <p className="text-sm text-gris-texto">Se mantienen enteros aunque lleven un separador (S/N, S/C).</p>
      <Chips
        items={unsplitList}
        label={(item) => item}
        name="Marcadores que no se separan"
        disabled={busy}
        onRemove={(item) => onChange({ ...draft, unsplit_markers: removeItem(unsplitList, item) })}
      />
      <div className="flex flex-wrap items-end gap-2">
        <Input label="Nuevo marcador que no se separa" value={unsplit} error={unsplitError ?? undefined} onChange={(event) => setUnsplit(event.target.value)} fieldClassName="min-w-56" />
        <Button
          variant="outline"
          icon={Plus}
          disabled={busy || markerError(unsplitList, unsplit) !== null}
          onClick={() => {
            onChange({ ...draft, unsplit_markers: addMarker(unsplitList, unsplit) });
            setUnsplit("");
          }}
        >
          Añadir
        </Button>
      </div>
      <SaveBar dirty={dirty} busy={busy} onSave={onSave} onDiscard={onDiscard} />
      <ErrorNotice message={error} />
      {impact && <NormalizationImpactNotice impact={impact} onDiscard={onDiscard} />}
    </section>
  );
}

export function AliasesEditor({
  aliases,
  collections,
  busy,
  fieldError,
  error,
  impact,
  onCreate,
  onDelete,
  onDismissImpact,
}: {
  aliases: AcronymAlias[];
  collections: CollectionOption[];
  busy: boolean;
  fieldError: string | null;
  error: string | null;
  impact: NormalizationImpact | null;
  onCreate: (alias: string, collectionId: string) => void;
  onDelete: (aliasId: string, reason: string) => void;
  onDismissImpact: () => void;
}) {
  const [alias, setAlias] = useState("");
  const [collectionId, setCollectionId] = useState("");
  return (
    <section aria-label="Siglas históricas" className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-tinta">Siglas históricas de colección</h3>
      <p className="text-sm text-gris-texto">
        Otra sigla con la que se escribió una colección. La búsqueda, la ficha y la importación la reconocen como la sigla actual.
      </p>
      {aliases.length === 0 ? (
        <p className="text-sm text-gris-texto">No hay siglas históricas registradas.</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Siglas históricas registradas">
          {aliases.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-borde p-2">
              <span className="text-base text-tinta">
                <strong className="font-mono">{item.alias_normalized}</strong>
                {item.alias !== item.alias_normalized && <span className="text-gris-texto"> ({item.alias})</span>} → {item.collection_name}
                {item.collection_acronym && <span className="text-gris-texto"> ({item.collection_acronym})</span>}
              </span>
              <ConfirmButton
                label="Eliminar"
                variant="danger"
                icon={Trash2}
                disabled={busy}
                confirmTitle={`Eliminar la sigla histórica «${item.alias_normalized}»`}
                confirmDescription="Deja de reconocerse como sigla de la colección. Queda en la auditoría con el motivo (RN-005)."
                requireReason
                reasonLabel="Motivo de la eliminación"
                onConfirm={(reason) => onDelete(item.id, reason)}
              />
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <Input label="Sigla histórica" value={alias} error={fieldError ?? undefined} onChange={(event) => setAlias(event.target.value)} fieldClassName="w-48" />
        <Select label="Colección" value={collectionId} onChange={(event) => setCollectionId(event.target.value)} fieldClassName="min-w-56">
          <option value="">Elija la colección…</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
              {collection.acronym ? ` (${collection.acronym})` : ""}
            </option>
          ))}
        </Select>
        <Button icon={Plus} disabled={busy || !alias.trim() || !collectionId} onClick={() => onCreate(alias, collectionId)}>
          Registrar sigla
        </Button>
      </div>
      <ErrorNotice message={error} />
      {impact && <NormalizationImpactNotice impact={impact} onDiscard={onDismissImpact} />}
    </section>
  );
}

interface Section<T> {
  saved: T;
  draft: T;
  isDefault: boolean;
  error: string | null;
  impact: NormalizationImpact | null;
}

export function NormalizationLive() {
  const { currentUser } = useSession();
  const devUser = currentUser?.email;
  const [markers, setMarkers] = useState<Section<string[]> | null>(null);
  const [separators, setSeparators] = useState<Section<ConcatenationSeparators> | null>(null);
  const [aliases, setAliases] = useState<AcronymAlias[]>([]);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [aliasState, setAliasState] = useState<{ fieldError: string | null; error: string | null; impact: NormalizationImpact | null }>({
    fieldError: null,
    error: null,
    impact: null,
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"markers" | "separators" | "aliases" | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([fetchSetting("absence_markers", devUser), fetchSetting("concatenation_separators", devUser), fetchAliases(devUser), fetchCollections(devUser)]).then(
      ([markerResult, separatorResult, aliasResult, collectionResult]) => {
        if (!active) return;
        let failure: string | null = null;
        for (const result of [markerResult, separatorResult, aliasResult, collectionResult]) {
          if (result.status !== "ok") {
            failure = result.message;
            break;
          }
        }
        setLoadError(failure);
        if (markerResult.status === "ok") {
          const value = markersValue(markerResult.value.value);
          setMarkers({ saved: value, draft: value, isDefault: markerResult.value.is_default, error: null, impact: null });
        }
        if (separatorResult.status === "ok") {
          const value = separatorsValue(separatorResult.value.value);
          setSeparators({ saved: value, draft: value, isDefault: separatorResult.value.is_default, error: null, impact: null });
        }
        if (aliasResult.status === "ok") setAliases(aliasResult.value);
        if (collectionResult.status === "ok") setCollections(collectionResult.value);
      },
    );
    return () => {
      active = false;
    };
  }, [devUser, reload]);

  async function saveMarkers() {
    if (!markers) return;
    setBusy("markers");
    const result = await saveSetting("absence_markers", markers.draft, devUser);
    setBusy(null);
    if (result.status !== "ok") return setMarkers({ ...markers, error: impactFrom(result) ? null : result.message, impact: impactFrom(result) });
    setMessage("Marcadores de ausencia guardados: se aplican en adelante al ingreso manual, la importación y la búsqueda.");
    setReload((n) => n + 1);
  }

  async function saveSeparators() {
    if (!separators) return;
    setBusy("separators");
    const result = await saveSetting("concatenation_separators", separators.draft, devUser);
    setBusy(null);
    if (result.status !== "ok") return setSeparators({ ...separators, error: impactFrom(result) ? null : result.message, impact: impactFrom(result) });
    setMessage("Separadores guardados: se aplican en adelante a las celdas con varios códigos.");
    setReload((n) => n + 1);
  }

  async function handleCreateAlias(alias: string, collectionId: string) {
    setBusy("aliases");
    const result = await createAlias(alias, collectionId, devUser);
    setBusy(null);
    if (result.status !== "ok") {
      const impact = impactFrom(result);
      const fieldError = aliasFieldError(result);
      return setAliasState({ fieldError, error: impact || fieldError ? null : result.message, impact });
    }
    setAliasState({ fieldError: null, error: null, impact: null });
    setMessage(`Sigla histórica «${result.value.alias_normalized}» registrada para ${result.value.collection_name}.`);
    setReload((n) => n + 1);
  }

  async function handleDeleteAlias(aliasId: string, reason: string) {
    setBusy("aliases");
    const result = await deleteAlias(aliasId, reason, devUser);
    setBusy(null);
    if (result.status !== "ok") {
      const impact = impactFrom(result);
      return setAliasState({ fieldError: null, error: impact ? null : result.message, impact });
    }
    setAliasState({ fieldError: null, error: null, impact: null });
    setMessage("Sigla histórica eliminada.");
    setReload((n) => n + 1);
  }

  return (
    <Card as="section" aria-label="Normalización" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-tinta">Normalización de códigos</h2>
        <p className="text-sm text-gris-texto">Parámetros que usan el ingreso manual, la importación y la búsqueda (RN-010, RF-023). Cada cambio queda en la auditoría.</p>
      </div>
      <ErrorNotice message={loadError} />
      {message && <p className="rounded-md bg-verde-bg px-3 py-2 text-base text-verde-exito">{message}</p>}
      {markers && (
        <MarkersEditor
          {...markers}
          busy={busy === "markers"}
          onChange={(draft) => setMarkers({ ...markers, draft, error: null, impact: null })}
          onSave={saveMarkers}
          onDiscard={() => setMarkers({ ...markers, draft: markers.saved, error: null, impact: null })}
        />
      )}
      {separators && (
        <SeparatorsEditor
          {...separators}
          busy={busy === "separators"}
          onChange={(draft) => setSeparators({ ...separators, draft, error: null, impact: null })}
          onSave={saveSeparators}
          onDiscard={() => setSeparators({ ...separators, draft: separators.saved, error: null, impact: null })}
        />
      )}
      <AliasesEditor
        aliases={aliases}
        collections={collections}
        busy={busy === "aliases"}
        {...aliasState}
        onCreate={handleCreateAlias}
        onDelete={handleDeleteAlias}
        onDismissImpact={() => setAliasState({ fieldError: null, error: null, impact: null })}
      />
    </Card>
  );
}
