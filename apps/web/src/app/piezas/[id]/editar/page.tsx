"use client";

/**
 * Pantalla 5 — Editor de pieza con validación en tiempo real (RF-043). El código I no aparece
 * como editable (RN-002): su corrección vive en la pestaña Identificadores de la ficha, con
 * procedimiento auditado y solo para el rol Administrador.
 *
 * Funciona en los dos modos (`NEXT_PUBLIC_API_MODE`): `mock` lee y actualiza el store de la
 * sesión de demostración; `live` carga la ficha con `fetchPieceDetail` y guarda con `updatePiece`
 * (`PUT /pieces/{id}`). El formulario es `PieceForm` (react-hook-form + zod, ADR-015).
 */
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import { PieceForm, outcomeFromUpdate, type SaveOutcome } from "@/components/domain/PieceForm";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { RequireSession } from "@/components/layout/RequireSession";
import type { ApiSchemas } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { useMockStore } from "@/lib/data/mock-store";
import { maskPieceForRole } from "@/lib/data/masking";
import { getApiMode } from "@/lib/data/mode";
import { fetchPieceDetail, updatePiece, type PieceUpdateInput } from "@/lib/data/pieces";
import { toFormValues, toUpdateInput, type PieceFormValues } from "@/lib/forms/piece-form";

type PieceDetail = ApiSchemas["PieceDetail"];

interface EditorViewProps {
  piece: PieceDetail;
  /** Solo en modo mock: refleja el cambio en el store de la sesión de demostración. */
  afterSave?: (updated: PieceDetail, input: PieceUpdateInput) => void;
}

function EditorView({ piece, afterSave }: EditorViewProps) {
  const router = useRouter();
  const { hasPermission } = useSession();

  if (!hasPermission("pieces.update")) {
    return <PermissionNotice>Su rol no tiene permiso para editar piezas (RF-039). Cambie de rol desde la cabecera para probarlo.</PermissionNotice>;
  }

  async function handleSave(values: PieceFormValues): Promise<SaveOutcome> {
    const input = toUpdateInput(values, piece.period, piece.masked_fields ?? []);
    const result = await updatePiece(piece.id, input);
    const outcome = outcomeFromUpdate(
      result,
      getApiMode() === "live" ? "Cambios guardados." : "Cambios guardados en esta sesión de demostración.",
    );
    if (result.status === "ok") afterSave?.(result.piece, input);
    return outcome;
  }

  /** Versión actual de la ficha en el servidor: solo se pide tras un 409, para «Ver cambios del otro usuario». */
  async function loadCurrentValues(): Promise<PieceFormValues | null> {
    const current = await fetchPieceDetail(piece.id);
    return current.status === "ok" ? toFormValues(current.piece) : null;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href={`/piezas/${piece.id}`} className="flex items-center gap-1 self-start text-sm text-gris-texto underline hover:text-terracota">
          <ArrowLeft size={16} aria-hidden="true" />
          Volver a la ficha
        </Link>
        <h1 className="text-2xl font-bold text-tinta">Editar: {piece.denomination}</h1>
        <p className="text-base text-gris-texto">
          El código I no se edita aquí (RN-002): use la pestaña Identificadores de la ficha si necesita una
          corrección auditada.
        </p>
      </header>

      <PieceForm
        key={piece.id}
        mode="edit"
        pieceId={piece.id}
        initialValues={toFormValues(piece)}
        draftBase={piece.updated_at}
        onSave={handleSave}
        loadCurrentValues={loadCurrentValues}
        legalOwner={piece.legal_owner}
        maskedFields={piece.masked_fields ?? []}
        onCancel={() => router.push(`/piezas/${piece.id}`)}
      />
    </div>
  );
}

function MockEditorLoader({ pieceId }: { pieceId: string }) {
  const store = useMockStore();
  const { currentUser, currentRole, hasPermission } = useSession();
  const stored = store.pieces[pieceId];
  if (!stored) notFound();
  // Igual que la API real: el rol sin permiso sobre datos de comodato no recibe comodante ni convenio (RF-041).
  const piece = maskPieceForRole(stored, hasPermission);

  return (
    <EditorView
      piece={piece}
      afterSave={(updated) =>
        store.updatePiece(
          pieceId,
          {
            denomination: updated.denomination,
            collection: updated.collection,
            category: updated.category,
            object_type: updated.object_type,
            availability: updated.availability,
            acquisition_method: updated.acquisition_method,
            entry_date: updated.entry_date,
            // Con el dato restringido, `updated` conserva el valor original: no se pierde.
            lender_name: updated.lender_name,
            loan_agreement_ref: updated.loan_agreement_ref,
            description: updated.description,
            author: updated.author,
            provenance: updated.provenance,
            period: updated.period,
            dimensions_text: updated.dimensions_text,
            materials: updated.materials,
            conservation_status: updated.conservation_status,
            notes: updated.notes,
          },
          currentUser?.full_name ?? currentRole?.name ?? "Persona sintética",
          currentUser?.id ?? "",
        )
      }
    />
  );
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; piece: PieceDetail }
  | { status: "not_found" }
  | { status: "unavailable"; message: string };

function LiveEditorLoader({ pieceId }: { pieceId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    fetchPieceDetail(pieceId)
      .then((result) => {
        if (!active) return;
        if (result.status === "ok") setState({ status: "ready", piece: result.piece });
        else if (result.status === "not_found") setState({ status: "not_found" });
        else setState({ status: "unavailable", message: result.message });
      })
      .catch(() => {
        if (active) setState({ status: "unavailable", message: "No se pudo conectar con el servidor. Intente nuevamente." });
      });
    return () => {
      active = false;
    };
  }, [pieceId]);

  if (state.status === "not_found") notFound();
  if (state.status === "loading") return <p role="status" className="text-base text-gris-texto">Cargando la ficha…</p>;
  if (state.status === "unavailable") return <PermissionNotice>{state.message}</PermissionNotice>;
  return <EditorView piece={state.piece} />;
}

function EditorContent({ pieceId }: { pieceId: string }) {
  return getApiMode() === "live" ? <LiveEditorLoader pieceId={pieceId} /> : <MockEditorLoader pieceId={pieceId} />;
}

export default function EditorPage({ params }: PageProps<"/piezas/[id]/editar">) {
  const { id } = use(params);
  return (
    <RequireSession>
      <EditorContent pieceId={id} />
    </RequireSession>
  );
}
