/**
 * Aviso de pieza eliminada lógicamente (change `ficha-pieza-crud`, tarea 4.4; design D7, RN-005).
 *
 * Se muestra en la ficha justo después de eliminar la pieza, con la acción «Restaurar pieza» para quien
 * tiene el permiso `pieces.restore` (quien lo monta pasa `canRestore`). Es presentacional: el diálogo de
 * restauración (`PieceRestoreDialog`) y la llamada a la API los gestiona la pantalla.
 */
import { RotateCcw } from "lucide-react";
import Link from "next/link";

import { Button, buttonClassName } from "@/components/ui/Button";

export interface PieceDeletedNoticeProps {
  pieceName: string;
  /** La persona tiene el permiso de restaurar piezas. */
  canRestore: boolean;
  onRestore: () => void;
  backHref?: string;
}

export function PieceDeletedNotice({ pieceName, canRestore, onRestore, backHref = "/busqueda" }: PieceDeletedNoticeProps) {
  return (
    <section
      role="status"
      aria-labelledby="piece-deleted-title"
      className="flex flex-col gap-3 rounded-lg border border-borde bg-crema p-4 text-base text-tinta"
    >
      <h2 id="piece-deleted-title" className="font-semibold">
        Pieza eliminada
      </h2>
      <p>
        La pieza <strong>{pieceName}</strong> quedó marcada como eliminada. No se borró: conserva su historial y su código I (RN-005), pero ya no
        aparece en el catálogo ni en las búsquedas.
      </p>
      {!canRestore && (
        <p className="text-gris-texto">Su rol no puede restaurarla. Si fue un error, pida la restauración a una persona con permiso para restaurar piezas.</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {canRestore && (
          <Button variant="primary" icon={RotateCcw} onClick={onRestore}>
            Restaurar pieza
          </Button>
        )}
        <Link href={backHref} className={buttonClassName({ variant: "outline" })}>
          Volver a búsqueda
        </Link>
      </div>
    </section>
  );
}
