/**
 * Cuenta de la persona al pie del menú, en todos los anchos (change `remodelacion-visual`, «Cuenta
 * de la persona al pie del menú»): la insignia «Modo demostración» una sola vez y solo en
 * demostración, el nombre, el rol y el cierre de sesión. En el riel contraído quedan los iconos, con
 * su nombre como ayuda y para el lector de pantalla.
 */
import { FlaskConical, LogOut } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

const DEMO_LABEL = "Modo demostración (datos sintéticos)";

export interface MenuAccountProps {
  name?: string;
  role?: string;
  /** «Cerrar sesión» o, en demostración, «Cambiar de rol». */
  logoutLabel: string;
  onLogout: () => void;
  demo?: boolean;
  collapsed?: boolean;
}

const LOGOUT_STYLES =
  "flex items-center justify-center gap-2 rounded-full border border-crema/60 text-base font-semibold text-crema hover:bg-white/10 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-crema";

export function MenuAccount({ name, role, logoutLabel, onLogout, demo = false, collapsed = false }: MenuAccountProps) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 px-2">
        {demo && (
          <span title={DEMO_LABEL} className="inline-flex size-11 items-center justify-center rounded-full bg-ambar-bg text-ambar-texto">
            <FlaskConical size={20} aria-hidden="true" />
            <span className="sr-only">{DEMO_LABEL}</span>
          </span>
        )}
        <button type="button" onClick={onLogout} aria-label={logoutLabel} title={logoutLabel} className={cn(LOGOUT_STYLES, "size-12")}>
          <LogOut size={20} aria-hidden="true" />
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 px-3">
      {demo && (
        <Badge intent="warning" className="self-start">
          {DEMO_LABEL}
        </Badge>
      )}
      <p className="min-w-0 px-1 text-base break-words text-crema">
        <span className="block font-semibold">{name}</span>
        <span className="block text-crema/80">{role}</span>
      </p>
      <button type="button" onClick={onLogout} className={cn(LOGOUT_STYLES, "min-h-12 w-full px-4 py-2")}>
        <LogOut size={20} aria-hidden="true" className="shrink-0" />
        {logoutLabel}
      </button>
    </div>
  );
}
