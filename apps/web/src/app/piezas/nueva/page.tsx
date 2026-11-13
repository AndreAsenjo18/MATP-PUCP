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
 *
 * Quien puede mover piezas elige también la ubicación inicial. Se registra después de guardar, como
 * el primer movimiento de la pieza: si ese paso falla, la pieza ya existe y el aviso lo dice.
 */
import {  } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { PieceForm, type SaveIntent, type SaveOutcome } from "@/components/domain/PieceForm";
import { Button } from "@/components/ui/Button";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { RequireSession } from "@/components/layout/RequireSession";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { describeLocationFailure, fetchDestinations, firstLocationBody, movePiece, type DestinationOption } from "@/lib/data/locations";
import { getApiMode } from "@/lib/data/mode";
import { createPiece } from "@/lib/data/pieces";
import { clearPieceCopy, pendingPieceCopy, prepareCopy, repeatableCopy, type PreparedCopy } from "@/lib/forms/piece-copy";
import { EMPTY_PIECE_FORM, toCreateInput, type PieceFormValues } from "@/lib/forms/piece-form";

function NewPieceContent() {
  const router = useRouter();
  const { currentUser, hasPermission } = useSession();
  const devUser = currentUser?.email;
  const canPlace = getApiMode() === "live" && hasPermission("movements.register");
  // Cada alta seguida es un formulario nuevo: `formKey` lo vuelve a montar.
  const [formKey, setFormKey] = useState(0);
  const [pending] = useState(() => pendingPieceCopy());
  const [prepared, setPrepared] = useState<PreparedCopy | null>(null);
  const [destinations, setDestinations] = useState<DestinationOption[] | null>(null);
  const [placesFailed, setPlacesFailed] = useState(false);
  const [lastSaved, setLastSaved] = useState<{ name: string; href: string | null; warning: string | null } | null>(null);
  // La pieza ya se registró sin su ubicación: otro «Registrar pieza» la duplicaría.
  const [formClosed, setFormClosed] = useState(false);

  useEffect(() => {
    // Ya en el estado de esta pantalla: volver a entrar más tarde abre un alta vacía.
    clearPieceCopy();
    let active = true;
    void (async () => {
      const places = canPlace ? await fetchDestinations(devUser) : null;
      const result = pending ? await prepareCopy(pending, places) : null;
      if (!active) return;
      setDestinations(places);
      setPlacesFailed(canPlace && places === null);
      if (result) setPrepared(result);
    })();
    return () => {
      active = false;
    };
  }, [pending, canPlace, devUser]);

  useEffect(() => {
    if (formKey > 0) document.getElementById("denomination")?.focus();
  }, [formKey]);

  if (!hasPermission("pieces.create")) {
    return <PermissionNotice>Su rol no tiene permiso para registrar piezas. Cambie de rol desde el menú para probarlo.</PermissionNotice>;
  }

  async function handleRegisterAnother(saved: PieceFormValues) {
    const places = canPlace ? await fetchDestinations(devUser) : null;
    setDestinations(places);
    setPlacesFailed(canPlace && places === null);
    setPrepared(await prepareCopy(repeatableCopy(saved), places));
    setFormKey((current) => current + 1);
  }

  async function handleSave(values: PieceFormValues, intent: SaveIntent): Promise<SaveOutcome> {
    const result = await createPiece(toCreateInput(values));
    if (result.status !== "ok") return { status: "error", message: result.message };
    const saved = { name: values.denomination.trim(), href: getApiMode() === "live" ? `/piezas/${result.piece.id}` : null };
    let warning: string | null = null;
    if (values.initial_location_id) {
      const moved = await movePiece(result.piece.id, firstLocationBody(values.initial_location_id), devUser);
      if (moved.status !== "ok") warning = `No se pudo registrar su ubicación inicial: ${describeLocationFailure(moved)} Regístrela desde la búsqueda.`;
    }
    if (intent === "another" || warning) {
      setLastSaved({ ...saved, warning });
      if (intent !== "another") setFormClosed(true);
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
      <PageHeader
        back={{ href: "/busqueda", label: "Volver a la búsqueda" }}
        title="Registrar una pieza"
        description="Complete los datos que conozca. La denominación es obligatoria; el sistema revisa el resto mientras usted escribe."
      />

      {lastSaved && (
        <p role="status" className={cn("rounded-md px-3 py-2 text-base", lastSaved.warning ? "bg-ambar-bg text-ambar-texto" : "bg-verde-bg text-verde-exito")}>
          Pieza «{lastSaved.name}» registrada.
          {lastSaved.warning && ` ${lastSaved.warning}`}
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

      {placesFailed && <p className="text-sm text-gris-texto">No se pudieron cargar los lugares: registre la ubicación después, desde la búsqueda.</p>}

      {formClosed ? (
        <div>
          <Button
            variant="outline"
            onClick={() => {
              setFormClosed(false);
              setLastSaved(null);
              setPrepared(null);
              setFormKey((current) => current + 1);
            }}
          >
            Registrar otra pieza
          </Button>
        </div>
      ) : pending && !prepared ? (
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
          destinations={destinations}
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
