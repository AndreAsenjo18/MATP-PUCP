import { describe, expect, it } from "vitest";

import type { RestoreBlocker, TrashEntry } from "@/lib/data/trash";
import { ids } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import { blockedHeadline, blockerSentence, restoreDescription, TrashRestorePanel, type TrashRestoreState } from "./TrashRestorePanel";

const MEDIA = ids.media(901);
const PIECE = ids.piece(901);
const disabledButton = /<button[^>]*\sdisabled=""/;

function entry(partial: Partial<TrashEntry> = {}): TrashEntry {
  return {
    entity_type: "media_asset",
    entity_id: MEDIA,
    entity_label: "retablo_duplicado_frontal.jpg",
    type_label: "Fotografía o documento",
    deleted_at: "2026-10-12T11:05:00Z",
    deleted_by_id: ids.user(2),
    deleted_by_name: "Gabriela Curadora (sintética)",
    deletion_reason: "Foto de una ficha duplicada",
    ...partial,
  };
}

function blocker(partial: Partial<RestoreBlocker> = {}): RestoreBlocker {
  return {
    entityType: "piece",
    entityId: PIECE,
    label: "Retablo de cajón (sintético)",
    message: "No se puede restaurar: la pieza «Retablo de cajón (sintético)» (Pieza) también está eliminada. Restáurela primero.",
    ...partial,
  };
}

function panel(state: TrashRestoreState, props: { busy?: boolean; error?: string | null; entry?: TrashEntry } = {}) {
  return render(
    <TrashRestorePanel
      entry={props.entry ?? entry()}
      state={state}
      busy={props.busy}
      error={props.error}
      onConfirm={() => {}}
      onCancel={() => {}}
      onGoTo={() => {}}
      onRefresh={() => {}}
    />,
  );
}

describe("frases de la restauración", () => {
  it("explica qué hará la restauración y que queda en la auditoría", () => {
    const sentence = restoreDescription(entry());

    expect(sentence).toContain("«retablo_duplicado_frontal.jpg»");
    expect(sentence).toContain("fotografía o documento");
    expect(sentence).toContain("auditoría");
  });

  it("dice qué hay que restaurar primero", () => {
    expect(blockedHeadline(entry())).toBe("Todavía no se puede restaurar «retablo_duplicado_frontal.jpg».");
    expect(blockerSentence(entry(), blocker())).toBe("Primero restaure: Pieza «Retablo de cajón (sintético)».");
  });

  it("una pieza activa con el mismo código I se explica distinto: hay que revisar su ficha", () => {
    const sentence = blockerSentence(entry({ entity_type: "piece" }), blocker({ entityId: ids.piece(2), label: "Charango" }));

    expect(sentence).toContain("sigue activa");
    expect(sentence).toContain("código I");
  });
});

describe("TrashRestorePanel", () => {
  it("al confirmar pide un motivo opcional y ofrece restaurar o cancelar", () => {
    const html = panel({ status: "confirm" });
    const text = visibleText(html);

    expect(text).toContain("Restaurar «retablo_duplicado_frontal.jpg»");
    expect(text).toContain("Motivo de la restauración (opcional)");
    expect(html).not.toMatch(/<textarea[^>]*\srequired=""/);
    expect(text).toContain("Cancelar");
    expect(html).not.toMatch(disabledButton);
  });

  it("mientras restaura bloquea el formulario y lo avisa", () => {
    const html = panel({ status: "confirm" }, { busy: true });

    expect(visibleText(html)).toContain("Restaurando…");
    expect(html).toMatch(disabledButton);
  });

  it("un error de permisos o de conexión queda visible dentro del panel", () => {
    const html = panel({ status: "confirm" }, { error: "Solo un Administrador puede restaurar registros eliminados." });

    expect(html).toContain('role="alert"');
    expect(visibleText(html)).toContain("Solo un Administrador puede restaurar registros eliminados.");
  });

  it("con una dependencia eliminada dice qué restaurar primero y ofrece ir a ese elemento", () => {
    const html = panel({ status: "blocked", message: blocker().message, blockers: [blocker()] });
    const text = visibleText(html);

    expect(text).toContain("Todavía no se puede restaurar «retablo_duplicado_frontal.jpg».");
    expect(text).toContain("Primero restaure: Pieza «Retablo de cajón (sintético)».");
    expect(text).toContain(blocker().message);
    expect(text).toContain("Ir a «Retablo de cajón (sintético)»");
    expect(html).toContain('aria-label="Qué hay que restaurar primero"');
    // Ya no se ofrece restaurar: primero hay que resolver la dependencia.
    expect(text).not.toContain("Motivo de la restauración");
  });

  it("lista todas las dependencias, cada una con su acción", () => {
    const html = panel({
      status: "blocked",
      message: "x",
      blockers: [blocker(), blocker({ entityType: "collection", entityId: ids.collection(901), label: "Colección de prueba (ficticia)" })],
    });

    expect(html.match(/Ir a «/g)).toHaveLength(2);
    expect(visibleText(html)).toContain("Primero restaure: Colección «Colección de prueba (ficticia)».");
  });

  it("si lo que bloquea es una pieza activa, ofrece abrir su ficha y no ir a la papelera", () => {
    const html = panel(
      {
        status: "blocked",
        message: "x",
        blockers: [blocker({ entityId: ids.piece(2), label: "Charango", message: "El código I ya está vigente en la pieza activa «Charango»." })],
      },
      { entry: entry({ entity_type: "piece", entity_label: "Charango duplicado" }) },
    );

    expect(html).toContain(`href="/piezas/${ids.piece(2)}"`);
    expect(visibleText(html)).toContain("Abrir la ficha de «Charango»");
    expect(visibleText(html)).not.toContain("Ir a «Charango»");
  });

  it("sin lista de dependencias muestra el mensaje general del servidor", () => {
    const text = visibleText(panel({ status: "blocked", message: "Hay un registro relacionado que sigue eliminado.", blockers: [] }));

    expect(text).toContain("Hay un registro relacionado que sigue eliminado.");
  });

  it("un registro que ya cambió ofrece actualizar la lista", () => {
    const html = panel({ status: "stale", message: "Este registro ya no está en la papelera." });
    const text = visibleText(html);

    expect(html).toContain('role="alert"');
    expect(text).toContain("Este registro ya no está en la papelera.");
    expect(text).toContain("Actualizar la lista");
  });
});
