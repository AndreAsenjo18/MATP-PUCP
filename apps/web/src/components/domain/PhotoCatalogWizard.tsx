"use client";

/**
 * Asistente «Importar fotografías al catálogo» (change `importacion-fotos-a-catalogo`, tareas 7.2
 * a 7.4; spec importacion-datos, «Lote de solo fotografías para piezas existentes»; diseño D10).
 *
 * Tres pasos, separados de «Importar Excel» para no mezclar los flujos:
 * 1. **Subir carpeta**: se nombra el lote y se suelta la carpeta descargada de Drive; la subida,
 *    las huellas y la reanudación son las de `ImportPhotosPanel`.
 * 2. **Cómo se leen los nombres** (`PhotoReadingStep`).
 * 3. **Revisar y aprobar** (`PhotoReviewStep`).
 *
 * El lote queda en la dirección (`?lote=`), así que recargar la página o volver más tarde retoma
 * el mismo lote.
 */
import { ArrowLeft, ArrowRight, Check, FolderPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ImportPhotosPanel } from "@/components/domain/ImportPhotosPanel";
import { PhotoReadingStep } from "@/components/domain/PhotoReadingStep";
import { PhotoReviewStep } from "@/components/domain/PhotoReviewStep";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/auth/session";
import { batchStateText, fetchImportBatch, type ImportBatch } from "@/lib/data/imports";
import { createPhotoBatch } from "@/lib/data/photoBatches";

export const PHOTO_WIZARD_STEPS = ["Subir carpeta", "Cómo se leen los nombres", "Revisar y aprobar"] as const;

export const UPLOAD_HELP =
  "Descargue la carpeta de Drive, descomprímala y arrástrela aquí con sus subcarpetas. Las fotos se emparejan con las piezas ya registradas por los códigos de sus nombres; nada llega a una ficha hasta aprobar el lote. Si se corta la conexión, vuelva a soltar la misma carpeta y solo se sube lo que falta.";

export interface PhotoUploadStartProps {
  name: string;
  busy: boolean;
  error: string | null;
  onName?: (value: string) => void;
  onCreate?: () => void;
}

/** Paso 1 antes de crear el lote: el nombre con que se reconocerá en la lista y la bitácora. */
export function PhotoUploadStart({ name, busy, error, onName, onCreate }: PhotoUploadStartProps) {
  return (
    <Card as="section" aria-label="Nuevo lote de fotografías" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-tinta">Nuevo lote de fotografías</h2>
      <p className="text-base text-gris-texto">{UPLOAD_HELP}</p>
      <label className="flex flex-col gap-1 text-base text-tinta">
        <span className="font-medium">Nombre del lote</span>
        <input
          value={name}
          onChange={(event) => onName?.(event.target.value)}
          placeholder="Archivo fotográfico — colección ABC"
          maxLength={300}
          className="min-h-11 rounded-md border border-borde px-3"
        />
      </label>
      {error && (
        <p role="alert" className="rounded-md bg-carmin-bg p-3 text-base text-carmin-texto">
          {error}
        </p>
      )}
      <Button icon={FolderPlus} className="self-start" disabled={busy || name.trim() === ""} onClick={onCreate}>
        Crear el lote y subir la carpeta
      </Button>
    </Card>
  );
}

export function PhotoCatalogWizard() {
  const { currentUser, hasPermission } = useSession();
  const devUser = currentUser?.email;
  const params = useSearchParams();
  const router = useRouter();
  const batchId = params.get("lote");
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!batchId) return;
    const result = await fetchImportBatch(batchId, devUser);
    if (result.status === "ok") setBatch(result.value);
  }, [batchId, devUser]);

  useEffect(() => {
    // Carga el lote de la dirección; la función actualiza el estado cuando responde la API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-tinta">Importar fotografías al catálogo</h1>
        <p className="text-base text-gris-texto">
          Archivo fotográfico de piezas ya registradas, sin Excel.{batch && ` Lote: ${batch.file_name} · ${batchStateText(batch)}.`}
        </p>
      </header>

      <ol className="flex flex-wrap gap-2" aria-label="Pasos de la importación de fotografías">
        {PHOTO_WIZARD_STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              aria-current={index === step ? "step" : undefined}
              disabled={!batchId && index > 0}
              onClick={() => setStep(index)}
              className={cn(
                "flex min-h-11 items-center gap-1 rounded-full px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota disabled:opacity-50",
                index === step ? "bg-terracota text-white" : index < step ? "bg-verde-bg text-verde-exito" : "bg-crema text-tinta hover:bg-borde",
              )}
            >
              {index < step && <Check size={16} aria-hidden="true" />}
              {index + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 &&
        (!batchId ? (
          <PhotoUploadStart
            name={name}
            busy={busy}
            error={error}
            onName={setName}
            onCreate={async () => {
              setBusy(true);
              setError(null);
              const result = await createPhotoBatch(name, devUser);
              setBusy(false);
              if (result.status !== "ok") return setError(result.message);
              setBatch(result.value);
              router.replace(`/importacion/fotos?lote=${result.value.id}`);
            }}
          />
        ) : (
          batch && <ImportPhotosPanel batch={batch} devUser={devUser} intro={UPLOAD_HELP} onUploaded={() => void refresh()} />
        ))}
      {step === 1 && batchId && <PhotoReadingStep batchId={batchId} devUser={devUser} onChanged={() => void refresh()} />}
      {step === 2 && batchId && <PhotoReviewStep batchId={batchId} devUser={devUser} canApprove={hasPermission("imports.approve")} />}

      <div className="flex justify-between gap-3 border-t border-borde pt-4">
        <Button variant="secondary" icon={ArrowLeft} disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>
          Atrás
        </Button>
        <Button disabled={!batchId || step === PHOTO_WIZARD_STEPS.length - 1} onClick={() => setStep((current) => Math.min(PHOTO_WIZARD_STEPS.length - 1, current + 1))}>
          Siguiente
          <ArrowRight size={18} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
