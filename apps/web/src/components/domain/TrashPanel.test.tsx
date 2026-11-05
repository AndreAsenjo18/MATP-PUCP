import { afterEach, describe, expect, it, vi } from "vitest";

import type { TrashRestoreOutcome } from "@/lib/data/trash";
import { ids } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import { restoreOutcomeView, TRASH_INTRO, TRASH_VIEW_ONLY_NOTICE, TrashPanel } from "./TrashPanel";

const RESULT = {
  entity_type: "term",
  entity_id: ids.term(901),
  entity_label: "Totora",
  type_label: "Término de vocabulario",
  previous_deletion_reason: null,
  restored: true,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("restoreOutcomeView", () => {
  it("un éxito avisa qué se restauró y que quedó en la auditoría", () => {
    const view = restoreOutcomeView({ status: "ok", result: RESULT, simulated: false });

    expect(view.notice).toContain("Se restauró «Totora» (término de vocabulario)");
    expect(view.notice).toContain("auditoría");
    expect(view.notice).not.toContain("demostración");
    expect(view.panel).toBeUndefined();
    expect(view.error).toBeUndefined();
  });

  it("en la demostración aclara que no se modificó ningún dato real", () => {
    expect(restoreOutcomeView({ status: "ok", result: RESULT, simulated: true }).notice).toContain("Modo demostración: no se modificó ningún dato real.");
  });

  it("una dependencia eliminada pasa el panel a «bloqueado» con la lista de qué restaurar primero", () => {
    const blockers = [{ entityType: "piece", entityId: ids.piece(901), label: "Retablo", message: "Restáurela primero." }];

    expect(restoreOutcomeView({ status: "blocked", message: "Restáurela primero.", blockers })).toEqual({
      panel: { status: "blocked", message: "Restáurela primero.", blockers },
    });
  });

  it("un registro que ya cambió pasa el panel a «desactualizado»", () => {
    expect(restoreOutcomeView({ status: "not_deleted", message: "Ya no está en la papelera." })).toEqual({
      panel: { status: "stale", message: "Ya no está en la papelera." },
    });
    expect(restoreOutcomeView({ status: "not_found", message: "Ya no existe." }).panel).toEqual({ status: "stale", message: "Ya no existe." });
  });

  it("los permisos, el rechazo y los fallos de conexión se quedan como error del formulario", () => {
    const outcomes: TrashRestoreOutcome[] = [
      { status: "forbidden", message: "Solo un Administrador puede restaurar." },
      { status: "rejected", code: "unknown_entity_type", message: "Tipo no admitido." },
      { status: "unavailable", message: "No se pudo conectar con el servidor." },
    ];

    expect(outcomes.map((outcome) => restoreOutcomeView(outcome))).toEqual([
      { error: "Solo un Administrador puede restaurar." },
      { error: "Tipo no admitido." },
      { error: "No se pudo conectar con el servidor." },
    ]);
  });
});

describe("TrashPanel", () => {
  it("explica que nada se borra y muestra los filtros mientras carga, sin llamar a la red", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const html = render(<TrashPanel canRestore />);
    const text = visibleText(html);

    expect(text).toContain("Papelera");
    expect(text).toContain(TRASH_INTRO);
    expect(text).toContain("Tipo de registro");
    expect(text).toContain("Cargando la papelera…");
    expect(html).toContain('role="status"');
    expect(text).not.toContain(TRASH_VIEW_ONLY_NOTICE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("un rol que no es Administrador ve avisado desde el principio que no puede restaurar", () => {
    const text = visibleText(render(<TrashPanel canRestore={false} />));

    expect(text).toContain(TRASH_VIEW_ONLY_NOTICE);
  });

  it("en modo live también muestra el estado de carga antes de tener respuesta", () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");

    expect(visibleText(render(<TrashPanel canRestore />))).toContain("Cargando la papelera…");
  });
});
