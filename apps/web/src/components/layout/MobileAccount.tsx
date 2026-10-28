/**
 * Cuenta de la persona al final del panel del menú móvil: nombre, rol y cierre de sesión. En
 * pantallas angostas el encabezado no lleva este botón (`rediseno-ux-deposito`).
 */
import { LogOut } from "lucide-react";

export interface MobileAccountProps {
  name?: string;
  role?: string;
  /** «Cerrar sesión» o, en demostración, «Cambiar de rol». */
  logoutLabel: string;
  onLogout: () => void;
}

export function MobileAccount({ name, role, logoutLabel, onLogout }: MobileAccountProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-white/15 p-4">
      <p className="min-w-0 truncate text-sm text-crema/80">
        {name} · <span className="font-medium text-crema">{role}</span>
      </p>
      <button
        type="button"
        onClick={onLogout}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-crema/60 px-4 py-2 text-base font-medium text-crema hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crema"
      >
        <LogOut size={18} aria-hidden="true" />
        {logoutLabel}
      </button>
    </div>
  );
}
