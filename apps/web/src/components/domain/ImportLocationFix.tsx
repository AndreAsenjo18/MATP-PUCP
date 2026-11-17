"use client";

/**
 * «Ubicaciones que no existen» en la revisión de un lote (change `importacion-aplicar-vocabularios`,
 * D4; RF-012, RF-025, RN-010).
 *
 * Cada ubicación escrita en el archivo que no coincide con ninguna del museo («Deposito N° 1»), con
 * cuántas filas la usan. Se elige una ubicación existente o se crea una ahí mismo: una sede nueva y,
 * dentro, su depósito, mueble, nivel o contenedor, uno por vez (lo creado queda elegido para seguir
 * creando dentro). «Usar esta ubicación y validar de nuevo» guarda la correspondencia en el mapeo
 * del lote y vuelve a validarlo: todas las filas que escriben ese texto quedan con esa ubicación.
 */
import { MapPin, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { locationTrail, proposedPlaceCode, type LocationLevelLabel, type LocationNode } from "@/lib/data/locations";

export interface UnresolvedLocation {
  text: string;
  rows: number;
}

export interface PlaceChoice {
  id: string;
  label: string;
  level: string;
  /** Tipos que admite dentro (para crear un lugar en él). */
  childTypes: string[];
}

const SITE = "Sede";

/** Todos los lugares del árbol con su ruta, para elegir uno o crear dentro de él. */
export function placeChoices(nodes: readonly LocationNode[], prefix: readonly string[] = []): PlaceChoice[] {
  return nodes.flatMap((node) => {
    const path = [...prefix, node.name];
    return [{ id: node.id, label: path.join(" › "), level: node.level_type, childTypes: node.allowed_child_types ?? [] }, ...placeChoices(node.children ?? [], path)];
  });
}

/** Una pieza no queda en una sede: hay que elegir al menos un espacio dentro de ella. */
export function canHoldPieces(choice: Pick<PlaceChoice, "level"> | undefined): boolean {
  return Boolean(choice) && choice?.level !== SITE;
}

export function UnresolvedLocationsPanel({
  items,
  tree,
  busy,
  decidedNotice,
  onAssign,
  onCreate,
}: {
  items: readonly UnresolvedLocation[];
  tree: readonly LocationNode[] | null;
  busy: boolean;
  /** Qué se pierde al validar de nuevo (decisiones ya tomadas). */
  decidedNotice?: string | null;
  onAssign: (text: string, locationId: string) => void;
  /** Crea un lugar; devuelve su id, o null si no se pudo. */
  onCreate: (input: { parentId: string | null; level: LocationLevelLabel; name: string; code: string }) => Promise<string | null>;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="ubicaciones-sin-coincidencia" className="flex flex-col gap-3 rounded-2xl border border-ambar-alerta bg-ambar-bg/40 p-4">
      <h2 id="ubicaciones-sin-coincidencia" className="flex items-center gap-2 text-lg font-semibold text-tinta">
        <MapPin size={20} aria-hidden="true" className="text-ambar-texto" />
        Ubicaciones del archivo que no existen en el museo
      </h2>
      <p className="text-base text-gris-texto">Elija a qué ubicación corresponde cada una, o créela aquí. Las piezas se registran en esa ubicación al aprobar.</p>
      {decidedNotice && <p className="text-sm font-medium text-ambar-texto">{decidedNotice}</p>}
      {items.map((item) => (
        <UnresolvedLocationRow key={item.text} item={item} tree={tree} busy={busy} onAssign={onAssign} onCreate={onCreate} />
      ))}
    </section>
  );
}

function UnresolvedLocationRow({
  item,
  tree,
  busy,
  onAssign,
  onCreate,
}: {
  item: UnresolvedLocation;
  tree: readonly LocationNode[] | null;
  busy: boolean;
  onAssign: (text: string, locationId: string) => void;
  onCreate: (input: { parentId: string | null; level: LocationLevelLabel; name: string; code: string }) => Promise<string | null>;
}) {
  const choices = placeChoices(tree ?? []);
  const [chosen, setChosen] = useState("");
  const [creating, setCreating] = useState(false);
  const selected = choices.find((choice) => choice.id === chosen);
  return (
    <article aria-label={`Ubicación «${item.text}»`} className="flex flex-col gap-3 rounded-xl border border-borde bg-white p-3">
      <p className="text-base text-tinta">
        <b>«{item.text}»</b> · {item.rows === 1 ? "1 fila" : `${item.rows.toLocaleString("es-PE")} filas`}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Select label="Corresponde a" controlSize="md" fieldClassName="min-w-72 flex-1" value={chosen} disabled={busy || tree === null} onChange={(event) => setChosen(event.target.value)}>
          <option value="">{tree === null ? "Cargando ubicaciones…" : "Elija una ubicación"}</option>
          {choices.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.label}
            </option>
          ))}
        </Select>
        <Button variant="secondary" icon={Plus} disabled={busy} aria-expanded={creating} onClick={() => setCreating((open) => !open)}>
          Crear una ubicación
        </Button>
      </div>
      {selected && !canHoldPieces(selected) && <p className="text-sm text-ambar-texto">Una sede no guarda piezas: elija o cree un espacio dentro de ella.</p>}
      {creating && (
        <NewPlaceForm
          suggestedName={item.text}
          choices={choices}
          tree={tree ?? []}
          parentId={chosen}
          busy={busy}
          onCreate={async (input) => {
            const id = await onCreate(input);
            if (id) setChosen(id);
            return id;
          }}
        />
      )}
      <Button className="self-start" variant="create" icon={MapPin} disabled={busy || !canHoldPieces(selected)} onClick={() => selected && onAssign(item.text, selected.id)}>
        {busy ? "Validando…" : "Usar esta ubicación y validar de nuevo"}
      </Button>
    </article>
  );
}

/** Crear un lugar: una sede nueva o un lugar dentro del elegido, del tipo que ese lugar admite. */
export function NewPlaceForm({
  suggestedName,
  choices,
  tree,
  parentId,
  busy,
  onCreate,
}: {
  suggestedName: string;
  choices: readonly PlaceChoice[];
  tree: readonly LocationNode[];
  /** Lugar elegido arriba: se propone crear dentro de él. */
  parentId: string;
  busy: boolean;
  onCreate: (input: { parentId: string | null; level: LocationLevelLabel; name: string; code: string }) => Promise<string | null>;
}) {
  const [parent, setParent] = useState(parentId);
  const parentChoice = choices.find((choice) => choice.id === parent);
  const types = parentChoice ? parentChoice.childTypes : [SITE];
  const [level, setLevel] = useState(types[0] ?? "");
  const [name, setName] = useState(suggestedName);
  const effectiveLevel = types.includes(level) ? level : (types[0] ?? "");
  const trail = parent ? (locationTrail(tree as LocationNode[], parent) ?? []) : [];
  const code = proposedPlaceCode(trail, name) || proposedPlaceCode([], name);
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-crema-light p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Select label="Dentro de" controlSize="md" value={parent} disabled={busy} onChange={(event) => setParent(event.target.value)}>
          <option value="">Ninguna: una sede nueva</option>
          {choices
            .filter((choice) => choice.childTypes.length > 0)
            .map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label}
              </option>
            ))}
        </Select>
        <Select label="Tipo" controlSize="md" value={effectiveLevel} disabled={busy || types.length <= 1} onChange={(event) => setLevel(event.target.value)}>
          {types.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
        <Input label="Nombre" controlSize="md" value={name} disabled={busy} onChange={(event) => setName(event.target.value)} />
      </div>
      <p className="text-sm text-gris-texto">
        Código: <span className="font-mono">{code || "—"}</span>. Después de crearla queda elegida: puede crear otra dentro (por ejemplo, un mueble en el depósito).
      </p>
      <Button
        className="self-start"
        variant="outline"
        icon={Plus}
        disabled={busy || !name.trim() || !effectiveLevel || !code}
        onClick={async () => {
          const id = await onCreate({ parentId: parent || null, level: effectiveLevel as LocationLevelLabel, name: name.trim(), code });
          if (id) {
            setParent(id);
            setName("");
          }
        }}
      >
        Crear {effectiveLevel ? effectiveLevel.toLowerCase() : "ubicación"}
      </Button>
    </div>
  );
}
