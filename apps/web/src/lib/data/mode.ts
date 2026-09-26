/**
 * Modo de datos de la maqueta (spec plataforma: "Prototipo navegable en modo simulado").
 *
 * `mock` (por defecto): todas las pantallas leen `lib/fixtures` sin red. `live`: las pantallas
 * que ya están implementadas en el contrato (`contratos-api-borrador`) usan el cliente tipado
 * real; el resto informa con claridad que la función no está disponible en este entorno.
 */
export type ApiMode = "mock" | "live";

export function getApiMode(): ApiMode {
  const raw = process.env.NEXT_PUBLIC_API_MODE;
  return raw === "live" ? "live" : "mock";
}

/**
 * URL base de la API para las pantallas (change despliegue-vm-y-respaldos, design D9).
 *
 * - **Navegador**: `NEXT_PUBLIC_API_URL` vacío o ausente ⇒ `""` (mismo origen): las rutas
 *   `/api/v1/...` se resuelven contra el propio dominio y el reenvío lo hace Next en local
 *   (`rewrites` en `next.config.ts`) o Caddy en staging/producción. Una sola imagen sirve
 *   así para todos los entornos y las cookies de sesión (ADR-009) cumplen mismo origen.
 *   Solo se define una URL absoluta para apuntar a una API en otro dominio (contingencia
 *   free tier, ADR-009 punto 8).
 * - **Servidor (SSR o route handlers)**: `API_INTERNAL_URL`, porque ahí no existe un origen
 *   relativo.
 */
export function apiBaseUrl(): string {
  if (typeof window === "undefined") {
    return process.env.API_INTERNAL_URL ?? "http://localhost:8000";
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "";
}
