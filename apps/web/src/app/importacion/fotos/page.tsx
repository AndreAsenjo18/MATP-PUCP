"use client";

/**
 * Importar fotografías al catálogo (change `importacion-fotos-a-catalogo`, tarea 7.2; RF-046):
 * el archivo fotográfico de piezas ya registradas, sin Excel, en un asistente de tres pasos.
 */
import { Suspense } from "react";
import { PhotoCatalogWizard } from "@/components/domain/PhotoCatalogWizard";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { RequireSession } from "@/components/layout/RequireSession";
import { useSession } from "@/lib/auth/session";

function Content() {
  const { hasPermission } = useSession();
  if (!hasPermission("imports.prepare")) {
    return <PermissionNotice>Su rol no tiene permiso para preparar cargas masivas. Cambie de rol desde la cabecera para probarlo.</PermissionNotice>;
  }
  return <PhotoCatalogWizard />;
}

export default function ImportarFotosPage() {
  return (
    <RequireSession>
      <Suspense fallback={null}>
        <Content />
      </Suspense>
    </RequireSession>
  );
}
