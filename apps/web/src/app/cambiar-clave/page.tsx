"use client";

/**
 * Cambio de contraseña (ADR-009). Es obligatorio tras recibir una contraseña temporal: mientras
 * esté vigente, la API solo deja usar `me`, `logout` y esta operación. Solo existe en modo `live`.
 */
import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { changePassword } from "@/lib/auth/api";
import { useSession } from "@/lib/auth/session";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { session, login } = useSession();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!session?.live) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-4 py-10">
        <p className="text-base text-tinta">Inicie sesión para cambiar su contraseña.</p>
        <Button onClick={() => router.push("/")}>Ir al inicio de sesión</Button>
      </main>
    );
  }
  const live = session.live;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-8 px-4 py-10">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-bold text-tinta">Cambiar contraseña</h1>
        {live.mustChangePassword && (
          <p className="text-base text-gris-texto">
            Su contraseña es temporal: defina una nueva para continuar.
          </p>
        )}
      </header>
      <Card as="section" aria-label="Cambio de contraseña" className="p-6">
        <form
          className="flex flex-col gap-5"
          onSubmit={async (event) => {
            event.preventDefault();
            if (next !== confirm) {
              setError("La confirmación no coincide con la contraseña nueva.");
              return;
            }
            setBusy(true);
            setError(null);
            const result = await changePassword(current, next);
            setBusy(false);
            if (result.status !== "ok") {
              setError(result.message);
              return;
            }
            login(session.userId, session.roleCode, { ...live, mustChangePassword: false });
            router.push("/inicio");
          }}
        >
          <Input
            id="current"
            label="Contraseña actual"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
          <Input
            id="new"
            label="Contraseña nueva"
            type="password"
            autoComplete="new-password"
            hint="Al menos 12 caracteres y que no sea una contraseña común. Una frase larga funciona bien."
            required
            value={next}
            onChange={(event) => setNext(event.target.value)}
          />
          <Input
            id="confirm"
            label="Repita la contraseña nueva"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            error={error ?? undefined}
          />
          <Button type="submit" icon={KeyRound} disabled={busy}>
            {busy ? "Guardando…" : "Cambiar contraseña"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
