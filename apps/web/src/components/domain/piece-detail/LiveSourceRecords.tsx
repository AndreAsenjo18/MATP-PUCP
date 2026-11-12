"use client";

import { useEffect, useState } from "react";

import { Card } from "@/components/ui/Card";
import { apiErrorMessage, createApiClient, type ApiSchemas } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { apiBaseUrl } from "@/lib/data/mode";

import { SourceSection } from "./SourceSection";

type SourceRecord = ApiSchemas["SourceRecordOut"];
type LoadState =
  | { status: "loading" }
  | { status: "ok"; records: SourceRecord[] }
  | { status: "error"; message: string };

/** Lectura de datos de origen existente en la API: nunca recurre a fixtures en modo live. */
export function LiveSourceRecords({ pieceId }: { pieceId: string }) {
  const { currentUser } = useSession();
  const [loaded, setLoaded] = useState<{ key: string; value: LoadState } | null>(null);
  const key = `${pieceId}|${currentUser?.email ?? ""}`;

  useEffect(() => {
    let active = true;
    const client = createApiClient({ baseUrl: apiBaseUrl(), devUser: currentUser?.email });
    client.GET("/api/v1/pieces/{piece_id}/source-records", { params: { path: { piece_id: pieceId } } })
      .then(({ data, error }) => {
        if (!active) return;
        if (error !== undefined || data === undefined) {
          setLoaded({ key, value: { status: "error", message: apiErrorMessage(error) } });
        } else {
          setLoaded({ key, value: { status: "ok", records: data } });
        }
      })
      .catch(() => {
        if (active) setLoaded({ key, value: { status: "error", message: "No se pudieron consultar los datos de origen. Intente nuevamente." } });
      });
    return () => { active = false; };
  }, [pieceId, currentUser?.email, key]);

  const state = loaded?.key === key ? loaded.value : { status: "loading" } as const;
  if (state.status === "loading") return <p role="status" className="text-base text-gris-texto">Cargando los datos de origen…</p>;
  if (state.status === "error") return <Card role="alert" className="text-base text-ambar-texto">{state.message}</Card>;
  return <SourceSection records={state.records} />;
}
