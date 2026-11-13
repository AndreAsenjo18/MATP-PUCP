/**
 * Página no encontrada (404) con el lenguaje visual de la dirección B: la banda terracota con la
 * trama, centrada, y un único camino de vuelta al inicio. Dentro de la estructura común: con sesión
 * lleva el menú; sin sesión, no (como la pantalla de acceso).
 */
import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { buttonClassName } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-10">
      <PageHeader title="No encontramos esta página" description="La dirección no existe o cambió. Vuelva al inicio para seguir desde allí." />
      <Link href="/inicio" className={buttonClassName({ className: "self-start" })}>
        Ir al inicio
      </Link>
    </div>
  );
}
