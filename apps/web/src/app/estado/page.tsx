import { connection } from "next/server";

import { Badge, type BadgeIntent } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { fetchHealth, type ServiceHealth, type ServiceState } from "@/lib/health";

const STATE_STYLES: Record<ServiceState, { text: string; intent: BadgeIntent }> = {
  ok: { text: "Operativo", intent: "success" },
  degraded: { text: "Con problemas", intent: "warning" },
  unreachable: { text: "Sin conexión", intent: "danger" },
};

function ServiceCard({ health }: { health: ServiceHealth }) {
  const style = STATE_STYLES[health.state];
  return (
    <Card as="li" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-lg font-semibold text-tinta">{health.label}</p>
        <p className="text-base text-gris-texto">{health.detail}</p>
      </div>
      <Badge intent={style.intent} className="self-start">
        {style.text}
      </Badge>
    </Card>
  );
}

/**
 * Estado técnico de los servicios (antes en "/"; movido aquí en `maqueta-ui-navegable` para que
 * "/" sea la pantalla de login de la maqueta). Sigue siendo útil para operación/soporte.
 */
export default async function EstadoPage() {
  await connection(); // always render at request time: health must be live
  const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";
  // La IA asistiva corre dentro de la API, bajo AI_MOUNT_PATH (ADR-008): misma URL base.
  const aiUrl = `${apiUrl.replace(/\/$/, "")}${process.env.AI_MOUNT_PATH ?? "/ai"}`;
  const services = await Promise.all([fetchHealth("api", apiUrl), fetchHealth("ai", aiUrl)]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-wide text-terracota">
          Uso interno · Fase 1
        </p>
        <h1 className="text-3xl font-bold text-tinta">Estado de los servicios</h1>
        <p className="text-base text-gris-texto">
          Museo de Artes y Tradiciones Populares &quot;Luis Repetto Málaga&quot; — entorno de desarrollo.
        </p>
      </header>
      <section aria-labelledby="estado-servicios" className="flex flex-col gap-3">
        <h2 id="estado-servicios" className="text-xl font-semibold text-tinta">
          Servicios backend (modo conectado)
        </h2>
        <ul className="flex flex-col gap-3">
          {services.map((health) => (
            <ServiceCard key={health.service} health={health} />
          ))}
        </ul>
      </section>
    </main>
  );
}
