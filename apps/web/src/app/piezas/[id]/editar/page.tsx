"use client";

/**
 * Pantalla 5 — Editor de pieza con validación en tiempo real (RF-043). El código I no aparece
 * como editable (RN-002): su corrección vive en la pestaña Identificadores de la ficha, con
 * procedimiento auditado y solo para el rol Administrador.
 */
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { use, useMemo, useState } from "react";

import { PermissionNotice } from "@/components/AppShell";
import { RequireSession } from "@/components/RequireSession";
import { useSession } from "@/lib/auth/session";
import { useMockStore } from "@/lib/data/mock-store";

interface FormState {
  title: string;
  description: string;
  provenance: string;
  dimensionsText: string;
  notes: string;
}

interface FieldErrors {
  title?: string;
  description?: string;
}

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.title.trim()) {
    errors.title = "La denominación es obligatoria.";
  } else if (form.title.trim().length < 3) {
    errors.title = "La denominación debe tener al menos 3 caracteres.";
  }
  if (form.description.length > 600) {
    errors.description = "La descripción no puede superar los 600 caracteres.";
  }
  return errors;
}

function EditorContent({ pieceId }: { pieceId: string }) {
  const router = useRouter();
  const { hasPermission, currentUser, currentRole } = useSession();
  const store = useMockStore();
  const piece = store.pieces[pieceId];
  if (!piece) notFound();

  const [form, setForm] = useState<FormState>({
    title: piece.title,
    description: piece.description ?? "",
    provenance: piece.provenance ?? "",
    dimensionsText: piece.dimensions_text ?? "",
    notes: piece.notes ?? "",
  });
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [saved, setSaved] = useState(false);
  const errors = useMemo(() => validate(form), [form]);
  const isValid = Object.keys(errors).length === 0;

  if (!hasPermission("pieces.update")) {
    return <PermissionNotice>Su rol no tiene permiso para editar piezas (RF-039). Cambie de rol desde la cabecera para probarlo.</PermissionNotice>;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href={`/piezas/${pieceId}`} className="text-sm text-stone-600 underline">
          ← Volver a la ficha
        </Link>
        <h1 className="text-2xl font-bold text-stone-900">Editar: {piece.title}</h1>
        <p className="text-base text-stone-700">
          El código I no se edita aquí (RN-002): use la pestaña Identificadores de la ficha si necesita una
          corrección auditada.
        </p>
      </header>

      <form
        className="flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setTouched({ title: true, description: true, provenance: true, dimensionsText: true, notes: true });
          if (!isValid) return;
          store.updatePiece(
            pieceId,
            { title: form.title.trim(), description: form.description || null, provenance: form.provenance || null, dimensions_text: form.dimensionsText || null, notes: form.notes || null },
            currentUser?.full_name ?? currentRole?.name ?? "Persona sintética",
            currentUser?.id ?? "",
          );
          setSaved(true);
        }}
      >
        <TextField
          id="title"
          label="Denominación"
          value={form.title}
          onChange={(value) => setForm((f) => ({ ...f, title: value }))}
          onBlur={() => setTouched((t) => ({ ...t, title: true }))}
          error={touched.title ? errors.title : undefined}
          required
        />
        <TextAreaField
          id="description"
          label="Descripción"
          value={form.description}
          onChange={(value) => setForm((f) => ({ ...f, description: value }))}
          onBlur={() => setTouched((t) => ({ ...t, description: true }))}
          error={touched.description ? errors.description : undefined}
          hint={`${form.description.length}/600 caracteres`}
        />
        <TextField id="provenance" label="Procedencia" value={form.provenance} onChange={(value) => setForm((f) => ({ ...f, provenance: value }))} />
        <TextField id="dimensions" label="Medidas (texto original)" value={form.dimensionsText} onChange={(value) => setForm((f) => ({ ...f, dimensionsText: value }))} />
        <TextAreaField id="notes" label="Observaciones" value={form.notes} onChange={(value) => setForm((f) => ({ ...f, notes: value }))} />

        <div className="flex flex-wrap items-center gap-3 border-t border-stone-100 pt-4">
          <button type="submit" disabled={!isValid} className="rounded-md bg-stone-900 px-4 py-2 text-base font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50">
            Guardar cambios
          </button>
          <button type="button" onClick={() => router.push(`/piezas/${pieceId}`)} className="rounded-md border border-stone-300 px-4 py-2 text-base text-stone-900 hover:bg-stone-100">
            Cancelar
          </button>
          {saved && <span className="text-base text-emerald-800">Cambios guardados en esta sesión de demostración.</span>}
        </div>
      </form>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-base font-medium text-stone-900">
        {label} {required && <span className="text-red-700">*</span>}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-invalid={Boolean(error)}
        className={`rounded-md border p-2.5 text-base text-stone-900 ${error ? "border-red-500" : "border-stone-300"}`}
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-base font-medium text-stone-900">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        rows={3}
        aria-invalid={Boolean(error)}
        className={`rounded-md border p-2.5 text-base text-stone-900 ${error ? "border-red-500" : "border-stone-300"}`}
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : hint && <p className="text-sm text-stone-600">{hint}</p>}
    </div>
  );
}

export default function EditorPage({ params }: PageProps<"/piezas/[id]/editar">) {
  const { id } = use(params);
  return (
    <RequireSession>
      <EditorContent pieceId={id} />
    </RequireSession>
  );
}
