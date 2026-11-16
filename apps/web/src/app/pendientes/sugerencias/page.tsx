"use client";

/**
 * La pestaña «Sugerencias de IA» se retiró (change `retirar-pestana-sugerencias-ia`): solo mostraba
 * ejemplos «Fuera del MVP» y las sugerencias de la carga masiva se aprueban en su lote. Un enlace
 * guardado a esta dirección lleva a la bandeja.
 */
import { redirect } from "next/navigation";

import { LEGACY_PENDING_ROUTES } from "@/lib/data/pending";

export default function PendientesSugerenciasPage(): null {
  redirect(LEGACY_PENDING_ROUTES["/pendientes/sugerencias"]);
}
