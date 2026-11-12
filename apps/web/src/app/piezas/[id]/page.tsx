"use client";

import { use } from "react";

import { PieceDetailContent } from "@/components/domain/piece-detail/PieceDetailContent";
import { RequireSession } from "@/components/layout/RequireSession";

/** Ruta de ficha. El contenido y las secciones viven en componentes para facilitar el trabajo paralelo de P1, P3 y P4. */
export default function FichaPage({ params }: PageProps<"/piezas/[id]">) {
  const { id } = use(params);
  return (
    <RequireSession>
      <PieceDetailContent pieceId={id} />
    </RequireSession>
  );
}
