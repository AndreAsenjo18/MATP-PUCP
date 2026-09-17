import { connection } from "next/server";

import { fetchHealth, type ServiceHealth, type ServiceState } from "@/lib/health";

const STATE_STYLES: Record<ServiceState, { text: string; className: string }> = {
  ok: { text: "Operativo", className: "bg-emerald-100 text-emerald-900" },
  degraded: { text: "Con problemas", className: "bg-amber-100 text-amber-900" },
  unreachable: { text: "Sin conexión", className: "bg-red-100 text-red-900" },
};

function ServiceCard({ health }: { health: ServiceHealth }) {
  const style = STATE_STYLES[health.state];
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-lg font-semibold text-stone-900">{health.label}</p>
        <p className="text-base text-stone-700">{health.detail}</p>
      </div>
      <span className={`self-start rounded-full px-3 py-1 text-sm font-medium ${style.className}`}>
        {style.text}
      </span>
    </li>
  );
}

export default async function Home() {
  await connection(); // always render at request time: health must be live
  const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";
  const aiUrl = process.env.AI_INTERNAL_URL ?? "http://localhost:8100";
  const services = await Promise.all([fetchHealth("api", apiUrl), fetchHealth("ai", aiUrl)]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-wide text-stone-600">
          Uso interno · Fase 1
        </p>
        <h1 className="text-3xl font-bold text-stone-900">
          Gestión de Colecciones del MATP
        </h1>
        <p className="text-base text-stone-700">
          Museo de Artes y Tradiciones Populares &quot;Luis Repetto Málaga&quot; — entorno de desarrollo.
        </p>
      </header>
      <section aria-labelledby="estado-servicios" className="flex flex-col gap-3">
        <h2 id="estado-servicios" className="text-xl font-semibold text-stone-900">
          Estado de los servicios
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
