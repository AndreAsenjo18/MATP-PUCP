/**
 * Enlaces de fusión en la ficha de una pieza (change `deteccion-duplicados-y-cola-revision`, tarea
 * 4.2; design D4, pasos 5 y 6; spec calidad-datos, «Consulta de la pieza absorbida»):
 *
 * - `MergedIntoNotice`: la pieza fue fusionada en otra; muestra la fecha, el motivo y el enlace a la
 *   pieza conservada (`merged_into`).
 * - `MergedFromNotice`: piezas fusionadas en esta (`merged_from`); sus movimientos, datos de origen y
 *   evaluaciones de conservación siguen en ellas y se consultan desde aquí.
 *
 * Son presentacionales: reciben la ficha que leyó la pantalla.
 */
import { ArrowRight, GitMerge } from "lucide-react";
import Link from "next/link";

import { buttonClassName } from "@/components/ui/Button";
import type { ApiSchemas } from "@/lib/api/client";
import { mergeReasonText } from "@/lib/data/merge-plan";

import { formatDate } from "./DuplicateReview";

type PieceDetail = ApiSchemas["PieceDetail"];
type MergedInto = ApiSchemas["MergedInto"];
type MergedFrom = ApiSchemas["MergedFrom"];

export function MergedIntoNotice({ mergedInto }: { mergedInto: MergedInto }) {
  const reason = mergeReasonText(mergedInto.reason);
  return (
    <section role="status" aria-labelledby="piece-merged-title" className="flex flex-col gap-2 rounded-lg border border-borde bg-crema p-4 text-base text-tinta">
      <h2 id="piece-merged-title" className="flex items-center gap-2 font-semibold">
        <GitMerge size={18} aria-hidden="true" />
        Pieza fusionada
      </h2>
      <p>
        Esta pieza fue fusionada en otra el {formatDate(mergedInto.merged_at)}. No se borró: quedó dada de baja y conserva sus movimientos, datos de
        origen y evaluaciones de conservación (RN-005).
      </p>
      {reason && <p className="text-gris-texto">Motivo: {reason}</p>}
      <Link href={`/piezas/${mergedInto.piece_id}`} className={buttonClassName({ variant: "outline", className: "self-start" })}>
        Ir a la pieza conservada
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </section>
  );
}

export function MergedFromNotice({ mergedFrom }: { mergedFrom: readonly MergedFrom[] }) {
  if (mergedFrom.length === 0) return null;
  return (
    <section aria-labelledby="piece-merged-from-title" className="flex flex-col gap-2 rounded-md bg-crema-light p-3 text-base text-tinta">
      <h2 id="piece-merged-from-title" className="flex items-center gap-2 text-base font-semibold">
        <GitMerge size={18} aria-hidden="true" />
        {mergedFrom.length === 1 ? "Pieza fusionada en esta" : `Piezas fusionadas en esta (${mergedFrom.length})`}
      </h2>
      <ul className="flex flex-col gap-1">
        {mergedFrom.map((item) => {
          const reason = mergeReasonText(item.reason);
          return (
            <li key={item.piece_id}>
              <Link href={`/piezas/${item.piece_id}`} className="font-medium text-terracota underline">
                {item.denomination}
              </Link>{" "}
              <span className="text-sm text-gris-texto">
                · fusionada el {formatDate(item.merged_at)}
                {reason && ` · Motivo: ${reason}`}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-gris-texto">Sus movimientos, datos de origen y evaluaciones de conservación siguen en cada una: ábrala para consultarlos.</p>
    </section>
  );
}

/** Los dos avisos de fusión de una ficha; no muestra nada si la pieza no participó en una fusión. */
export function MergeLinks({ piece }: { piece: Pick<PieceDetail, "merged_into" | "merged_from"> }) {
  return (
    <>
      {piece.merged_into && <MergedIntoNotice mergedInto={piece.merged_into} />}
      <MergedFromNotice mergedFrom={piece.merged_from ?? []} />
    </>
  );
}
