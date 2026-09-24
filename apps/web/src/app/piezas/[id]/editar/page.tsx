"use client";

/**
 * Pantalla 5 — Editor de pieza con validación en tiempo real (RF-043). El código I no aparece
 * como editable (RN-002): su corrección vive en la pestaña Identificadores de la ficha, con
 * procedimiento auditado y solo para el rol Administrador.
 */
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { use, useMemo, useState } from "react";

import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { RequireSession } from "@/components/layout/RequireSession";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
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
        <Link href={`/piezas/${pieceId}`} className="flex items-center gap-1 self-start text-sm text-gris-texto underline hover:text-terracota">
          <ArrowLeft size={16} aria-hidden="true" />
          Volver a la ficha
        </Link>
        <h1 className="text-2xl font-bold text-tinta">Editar: {piece.title}</h1>
        <p className="text-base text-gris-texto">
          El código I no se edita aquí (RN-002): use la pestaña Identificadores de la ficha si necesita una
          corrección auditada.
        </p>
      </header>

      <Card as="section" aria-label="Formulario de edición">
        <form
          className="flex flex-col gap-4"
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
          <Input
            id="title"
            label={
              <>
                Denominación <span className="text-carmin-texto">*</span>
              </>
            }
            value={form.title}
            onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
            onBlur={() => setTouched((t) => ({ ...t, title: true }))}
            error={touched.title ? errors.title : undefined}
            required
            className="p-2.5"
          />
          <Textarea
            id="description"
            label="Descripción"
            value={form.description}
            onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
            onBlur={() => setTouched((t) => ({ ...t, description: true }))}
            error={touched.description ? errors.description : undefined}
            hint={touched.description && errors.description ? undefined : `${form.description.length}/600 caracteres`}
            rows={3}
            className="p-2.5"
          />
          <Input id="provenance" label="Procedencia" value={form.provenance} onChange={(event) => setForm((f) => ({ ...f, provenance: event.target.value }))} className="p-2.5" />
          <Input
            id="dimensions"
            label="Medidas (texto original)"
            value={form.dimensionsText}
            onChange={(event) => setForm((f) => ({ ...f, dimensionsText: event.target.value }))}
            className="p-2.5"
          />
          <Textarea id="notes" label="Observaciones" value={form.notes} onChange={(event) => setForm((f) => ({ ...f, notes: event.target.value }))} rows={3} className="p-2.5" />

          <div className="flex flex-wrap items-center gap-3 border-t border-borde pt-4">
            <Button type="submit" icon={Save} disabled={!isValid}>
              Guardar cambios
            </Button>
            <Button variant="secondary" onClick={() => router.push(`/piezas/${pieceId}`)}>
              Cancelar
            </Button>
            {saved && (
              <span role="status" className="text-base font-medium text-verde-exito">
                Cambios guardados en esta sesión de demostración.
              </span>
            )}
          </div>
        </form>
      </Card>
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
