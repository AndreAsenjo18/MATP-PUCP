"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/domain/StatusBadges";
import { suggestionStatus } from "@/components/domain/status-intents";
import { Card } from "@/components/ui/Card";
import { useMockStore } from "@/lib/data/mock-store";

export function SuggestionsSection({ suggestions }: { suggestions: ReturnType<typeof useMockStore>["aiSuggestions"] }) {
  if (suggestions.length === 0) {
    return <Card className="border-dashed text-center text-base text-gris-texto">Sin sugerencias de IA para esta pieza.</Card>;
  }
  return (
    <div className="flex flex-col gap-3">
      {suggestions.map((s) => (
        <Card key={s.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-tinta">
              {s.function_code} · proveedor {s.provider}
            </span>
            <StatusBadge status={suggestionStatus(s.status)} />
          </div>
          {s.status === "PENDING" && (
            <Link href={`/ia/sugerencias?resaltar=${s.id}`} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-terracota underline">
              Revisar en la cola de sugerencias de IA
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </Card>
      ))}
    </div>
  );
}
