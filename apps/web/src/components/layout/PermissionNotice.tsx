import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

/** Mensaje uniforme cuando el rol activo no tiene el permiso necesario para ver algo (RF-039). */
export function PermissionNotice({ children }: { children?: ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-2 rounded-lg border border-ambar-alerta bg-ambar-bg p-4 text-base text-ambar-texto">
      <TriangleAlert size={20} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div>
        {children ?? "Su rol actual no tiene permiso para ver esta sección. Cambie de rol desde la cabecera para probar otra vista."}
      </div>
    </div>
  );
}
