"use client";

/**
 * Agregar, editar o desactivar un lugar desde el árbol de la búsqueda (change `crud-manual-completo`,
 * tarea 3.1, design D3; RF-016, RN-005). Valen las mismas reglas y la misma auditoría que en
 * Administración › Ubicaciones, porque las aplica la API. El diálogo es `FormDialog`, y solo ofrece
 * los tipos que el lugar admite.
 */
import { useState } from "react";

import { FormDialog } from "@/components/domain/AdminShell";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  LOCATION_ERROR_MESSAGES,
  allowedTypesSentence,
  createLocation,
  locationTrail,
  proposedPlaceCode,
  updateLocation,
  type LocationFailure,
  type LocationLevelLabel,
  type LocationNode,
} from "@/lib/data/locations";

export type PlaceAction = { kind: "add" | "edit" | "deactivate"; node: LocationNode };

export interface NewPlaceForm {
  level: string;
  name: string;
  /** Vacío mientras la persona no lo cambie: vale el propuesto a partir de la ruta. */
  code: string;
}

export function newPlaceForm(parent: Pick<LocationNode, "allowed_child_types">): NewPlaceForm {
  return { level: parent.allowed_child_types?.[0] ?? "", name: "", code: "" };
}

function failureText(failure: LocationFailure): string {
  if (failure.status === "unavailable") return failure.message;
  return LOCATION_ERROR_MESSAGES[failure.code] ?? failure.message;
}

/** Campos del lugar nuevo: el tipo ya propuesto, entre los que admite el lugar; el código, a partir de la ruta. */
export function NewPlaceFields({
  parent,
  trail,
  form,
  errors = {},
  onChange,
}: {
  parent: LocationNode;
  trail: readonly Pick<LocationNode, "name">[];
  form: NewPlaceForm;
  errors?: { name?: string | null; code?: string | null };
  onChange: (form: NewPlaceForm) => void;
}) {
  const proposed = form.name.trim() ? proposedPlaceCode(trail, form.name) : "";
  return (
    <>
      <Select label="Tipo" value={form.level} hint={allowedTypesSentence(parent)} onChange={(event) => onChange({ ...form, level: event.target.value })}>
        {(parent.allowed_child_types ?? []).map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </Select>
      <Input label="Nombre" value={form.name} error={errors.name} placeholder="p. ej. Caja 14" onChange={(event) => onChange({ ...form, name: event.target.value })} />
      <Input
        label="Código"
        value={form.code || proposed}
        error={errors.code}
        hint="Se propone a partir de la ruta; cámbielo si el lugar ya tiene otro. No puede repetirse."
        onChange={(event) => onChange({ ...form, code: event.target.value })}
      />
    </>
  );
}

function AddPlaceDialog({ parent, nodes, devUser, onClose, onChanged }: { parent: LocationNode; nodes: readonly LocationNode[]; devUser?: string; onClose: () => void; onChanged: (text: string) => Promise<void> | void }) {
  const trail = locationTrail(nodes, parent.id) ?? [parent];
  const [form, setForm] = useState(() => newPlaceForm(parent));
  const [errors, setErrors] = useState<{ name?: string | null; code?: string | null }>({});
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <FormDialog
      open
      title={`Agregar lugar en «${parent.name}»`}
      description="Queda disponible como destino al mover piezas."
      submitLabel="Agregar lugar"
      error={failure}
      onClose={onClose}
      onSubmit={async () => {
        const name = form.name.trim();
        setFailure(null);
        setErrors(name ? {} : { name: "Escriba el nombre del lugar." });
        if (!name) return false;
        const code = form.code.trim() || proposedPlaceCode(trail, name);
        const result = await createLocation({ level: form.level as LocationLevelLabel, code, name, parent_id: parent.id }, devUser);
        if (result.status !== "ok") {
          if (result.status === "rejected" && result.code === "duplicate_location_code") setErrors({ code: failureText(result) });
          else setFailure(failureText(result));
          return false;
        }
        await onChanged(`Lugar «${result.value.name}» agregado en «${parent.name}».`);
        return true;
      }}
    >
      <NewPlaceFields parent={parent} trail={trail} form={form} errors={errors} onChange={setForm} />
    </FormDialog>
  );
}

function EditPlaceDialog({ node, devUser, onClose, onChanged }: { node: LocationNode; devUser?: string; onClose: () => void; onChanged: (text: string) => Promise<void> | void }) {
  const [name, setName] = useState(node.name);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <FormDialog
      open
      title={`Editar «${node.name}»`}
      description="El cambio queda en la auditoría. Las piezas que están aquí no se mueven."
      submitLabel="Guardar cambios"
      error={failure}
      onClose={onClose}
      onSubmit={async () => {
        const next = name.trim();
        setFailure(null);
        setError(next ? null : "Escriba el nombre del lugar.");
        if (!next) return false;
        const result = await updateLocation(node.id, { name: next }, devUser);
        if (result.status !== "ok") {
          setFailure(failureText(result));
          return false;
        }
        await onChanged(`Lugar «${node.name}» guardado como «${result.value.name}».`);
        return true;
      }}
    >
      <Input label="Nombre" value={name} error={error} onChange={(event) => setName(event.target.value)} />
    </FormDialog>
  );
}

function DeactivatePlaceDialog({ node, devUser, onClose, onChanged }: { node: LocationNode; devUser?: string; onClose: () => void; onChanged: (text: string, removedId: string) => Promise<void> | void }) {
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <FormDialog
      open
      title={`Desactivar «${node.name}»`}
      description="Deja de ofrecerse como destino. No se borra, y el historial de las piezas lo conserva."
      submitLabel="Desactivar"
      error={failure}
      onClose={onClose}
      onSubmit={async () => {
        setFailure(null);
        const result = await updateLocation(node.id, { is_active: false }, devUser);
        if (result.status !== "ok") {
          setFailure(failureText(result));
          return false;
        }
        await onChanged(`Lugar «${node.name}» desactivado.`, node.id);
        return true;
      }}
    >
      {null}
    </FormDialog>
  );
}

export function LocationPlaceDialogs({
  action,
  nodes,
  devUser,
  onClose,
  onChanged,
}: {
  action: PlaceAction | null;
  nodes: readonly LocationNode[];
  devUser?: string;
  onClose: () => void;
  /** Lo hecho, para avisar y recargar el árbol; `removedId` si el lugar dejó de estar. */
  onChanged: (text: string, removedId?: string) => Promise<void> | void;
}) {
  if (!action) return null;
  if (action.kind === "add") return <AddPlaceDialog key={action.node.id} parent={action.node} nodes={nodes} devUser={devUser} onClose={onClose} onChanged={onChanged} />;
  if (action.kind === "edit") return <EditPlaceDialog key={action.node.id} node={action.node} devUser={devUser} onClose={onClose} onChanged={onChanged} />;
  return <DeactivatePlaceDialog key={action.node.id} node={action.node} devUser={devUser} onClose={onClose} onChanged={onChanged} />;
}
