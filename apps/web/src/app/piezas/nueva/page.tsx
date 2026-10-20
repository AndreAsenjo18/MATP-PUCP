"use client";

/**
 * Alta de pieza (change `ficha-pieza-crud`, tarea 4.2; RF-043). Usa el mismo formulario que el
 * editor (`PieceForm`, react-hook-form + zod, ADR-015) y `createPiece` de `lib/data/pieces.ts`.
 *
 * - Modo `live`: `POST /pieces` y, si sale bien, abre la ficha de la pieza creada.
 * - Modo `mock`: `createPiece` devuelve una pieza sintética que **no se conserva** (el store de
 *   la maqueta no tiene altas), por eso se confirma en la misma pantalla y no se abre la ficha.
 */
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PieceForm, type SaveOutcome } from "@/components/domain/PieceForm";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { RequireSession } from "@/components/layout/RequireSession";
import { useSession } from "@/lib/auth/session";
import { getApiMode } from "@/lib/data/mode";
import { createPiece } from "@/lib/data/pieces";
import { EMPTY_PIECE_FORM, toCreateInput, type PieceFormValues } from "@/lib/forms/piece-form";

function NewPieceContent() {
  const router = useRouter();
  const { hasPermission } = useSession();

  if (!hasPermission("pieces.create")) {
    return <PermissionNotice>Su rol no tiene permiso para registrar piezas (RF-039). Cambie de rol desde la cabecera para probarlo.</PermissionNotice>;
  }

  async function handleSave(values: PieceFormValues): Promise<SaveOutcome> {
    const result = await createPiece(toCreateInput(values));
    if (result.status !== "ok") return { status: "error", message: result.message };
    if (getApiMode() === "live") {
      router.push(`/piezas/${result.piece.id}`);
      return { status: "ok", message: "Pieza registrada." };
    }
    return { status: "ok", message: "Pieza registrada en modo demostración: no se conserva al recargar la página." };
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href="/busqueda" className="flex items-center gap-1 self-start text-sm text-gris-texto underline hover:text-terracota">
          <ArrowLeft size={16} aria-hidden="true" />
          Volver a la búsqueda
        </Link>
        <h1 className="text-2xl font-bold text-tinta">Registrar una pieza</h1>
        <p className="text-base text-gris-texto">
          Complete los datos que conozca. La denominación es obligatoria; el sistema revisa el resto mientras usted escribe.
        </p>
      </header>

      <PieceForm mode="create" initialValues={EMPTY_PIECE_FORM} onSave={handleSave} onCancel={() => router.push("/busqueda")} />
    </div>
  );
}

export default function NewPiecePage() {
  return (
    <RequireSession>
      <NewPieceContent />
    </RequireSession>
  );
}
