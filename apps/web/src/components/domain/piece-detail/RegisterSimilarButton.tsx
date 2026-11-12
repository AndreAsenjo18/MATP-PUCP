"use client";

import { CopyPlus } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import type { ApiSchemas } from "@/lib/api/client";
import { offerPieceCopy, similarPieceCopy } from "@/lib/forms/piece-copy";

type PieceDetail = ApiSchemas["PieceDetail"];

/** Abre el alta con los datos descriptivos de esta pieza; la copia no pasa por la URL (`crud-manual-completo` D4). */
export function RegisterSimilarButton({ piece }: { piece: PieceDetail }) {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      icon={CopyPlus}
      onClick={() => {
        offerPieceCopy(similarPieceCopy(piece));
        router.push("/piezas/nueva");
      }}
    >
      Registrar a partir de esta pieza
    </Button>
  );
}
