"use client";

/**
 * La pestaña «Posibles duplicados» se retiró (change `codigo-unico-y-ajustes-pantallas`): dos piezas
 * ya no pueden compartir un código, así que no hay pares que revisar. Un enlace guardado a esta
 * dirección lleva a la bandeja.
 */
import { redirect } from "next/navigation";

import { LEGACY_PENDING_ROUTES } from "@/lib/data/pending";

export default function PendientesDuplicadosPage(): null {
  redirect(LEGACY_PENDING_ROUTES["/pendientes/duplicados"]);
}
