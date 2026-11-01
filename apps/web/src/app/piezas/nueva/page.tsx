"use client";

/**
 * Alta de pieza (change `ficha-pieza-crud`, tarea 4.2; RF-043). Usa el mismo formulario que el
 * editor (`PieceForm`, react-hook-form + zod, ADR-015) y `createPiece` de `lib/data/pieces.ts`.
 *
 * - Modo `live`: `POST /pieces` y, si sale bien, abre la ficha de la pieza creada.
 * - Modo `mock`: `createPiece` devuelve una pieza sintética que **no se conserva** (el store de
 *   la maqueta no tiene altas), por eso se confirma en la misma pantalla y no se abre la ficha.
 *
 * «Guardar y registrar otra» (`crud-manual-completo` D4) se queda aquí: guarda y vuelve a montar el
 * formulario con los datos repetibles, sin pasarlos por la URL. «Registrar a partir de esta pieza»
 * llega desde la ficha con sus datos descriptivos, esperando en `pendingPieceCopy`. En ambos casos
 * lo copiado se comprueba antes de mostrar el formulario (`prepareCopy`).
 */
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PieceForm, type SaveIntent, type SaveOutcome } from "@/components/domain/PieceForm";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { RequireSession } from "@/components/layout/RequireSession";
import { useSession } from "@/lib/auth/session";
import { getApiMode } from "@/lib/data/mode";
import { createPiece } from "@/lib/data/pieces";
import { clearPieceCopy, pendingPieceCopy, prepareCopy, repeatableCopy, type PreparedCopy } from "@/lib/forms/piece-copy";
import { EMPTY_PIECE_FORM, toCreateInput, type PieceFormValues } from "@/lib/forms/piece-form";

function NewPieceContent() {
  const router = useRouter();
  const { hasPermission } = useSession();
  // Cada alta seguida es un formulario nuevo: `formKey` lo vuelve a montar.
  const [formKey, setFormKey] = useState(0);
  const [pending] = useState(() => pendingPieceCopy());
  const [prepared, setPrepared] = useState<PreparedCopy | null>(null);
  const [lastSaved, setLastSaved] = useState<{ name: string; href: string | null } | null>(null);

  useEffect(() => {
    // Ya en el estado de esta pantalla: volver a entrar más tarde abre un alta vacía.
    clearPieceCopy();
    if (!pending) return;
    let active = true;
    void prepareCopy(pending).then((result) => {
      if (active) setPrepared(result);
    });
    return () => {
      active = false;
    };
  }, [pending]);

  useEffect(() => {
    if (formKey > 0) document.getElementById("denomination")?.focus();
  }, [formKey]);

  if (!hasPermission("pieces.create")) {
    return <PermissionNotice>Su rol no tiene permiso para registrar piezas (RF-039). Cambie de rol desde la cabecera para probarlo.</PermissionNotice>;
  }

  async function handleRegisterAnother(saved: PieceFormValues) {
    setPrepared(await prepareCopy(repeatableCopy(saved)));
    setFormKey((current) => current + 1);
  }

  async function handleSave(values: PieceFormValues, intent: SaveIntent): Promise<SaveOutcome> {
    const result = await createPiece(toCreateInput(values));
    if (result.status !== "ok") return { status: "error", message: result.message };
    if (intent === "another") {
      setLastSaved({ name: values.denomination.trim(), href: getApiMode() === "live" ? `/piezas/${result.piece.id}` : null });
      return { status: "ok", message: "Pieza registrada." };
    }
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

      {lastSaved && (
        <p role="status" className="rounded-md bg-verde-bg px-3 py-2 text-base text-verde-exito">
          Pieza «{lastSaved.name}» registrada.
          {lastSaved.href ? (
            <>
              {" "}
              <Link href={lastSaved.href} className="underline">
                Ver su ficha
              </Link>
            </>
          ) : (
            " En modo demostración no se conserva al recargar la página."
          )}
        </p>
      )}

      {pending && !prepared ? (
        <p role="status" className="text-base text-gris-texto">
          Comprobando los datos copiados…
        </p>
      ) : (
        <PieceForm
          key={formKey}
          mode="create"
          initialValues={prepared?.copy.values ?? EMPTY_PIECE_FORM}
          copy={prepared?.copy}
          initialCatalogs={prepared?.catalogs}
          onSave={handleSave}
          onRegisterAnother={handleRegisterAnother}
          onCancel={() => router.push("/busqueda")}
        />
      )}
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
