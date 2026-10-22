import { describe, expect, it } from "vitest";

import type { TrashEntry } from "@/lib/data/trash";
import { ids } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import {
  DEPENDENCY_FIRST_BADGE,
  deletedBySentence,
  NO_REASON_MESSAGE,
  TRASH_EMPTY_MESSAGE,
  TRASH_NO_MATCH_MESSAGE,
  trashAnchor,
  TrashEntryList,
} from "./TrashEntryList";

const TERM = ids.term(901);
const disabledButton = /<button[^>]*\sdisabled=""/;

function entry(partial: Partial<TrashEntry> = {}): TrashEntry {
  return {
    entity_type: "term",
    entity_id: TERM,
    entity_label: "Totora",
    type_label: "Término de vocabulario",
    deleted_at: "2026-10-14T16:20:00Z",
    deleted_by_id: ids.user(1),
    deleted_by_name: "Administrador MATP (sintético)",
    deletion_reason: "Duplicado del término Totora",
    ...partial,
  };
}

describe("deletedBySentence", () => {
  it("dice quién eliminó y cuándo", () => {
    const sentence = deletedBySentence(entry());

    expect(sentence).toContain("Eliminado el");
    expect(sentence).toContain("por Administrador MATP (sintético)");
  });

  it("sin nombre dice que fue una persona o el sistema, nunca inventa un nombre", () => {
    expect(deletedBySentence(entry({ deleted_by_name: null }))).toContain("una persona sin nombre registrado");
    expect(deletedBySentence(entry({ deleted_by_name: null, deleted_by_id: null }))).toContain("el sistema");
    expect(deletedBySentence(entry({ deleted_at: null }))).toBe("Eliminado por Administrador MATP (sintético)");
  });
});

describe("TrashEntryList", () => {
  it("muestra qué es cada registro, quién lo eliminó, cuándo y el motivo", () => {
    const html = render(<TrashEntryList entries={[entry()]} canRestore onRestore={() => {}} />);
    const text = visibleText(html);

    expect(html).toContain('aria-label="Registros eliminados"');
    expect(html).toContain(`id="${trashAnchor(TERM)}"`);
    expect(text).toContain("Totora");
    expect(text).toContain("Término de vocabulario");
    expect(text).toContain("Administrador MATP (sintético)");
    expect(text).toContain("Motivo: Duplicado del término Totora");
    expect(text).toContain("Restaurar");
    expect(html).toContain('aria-label="Restaurar término de vocabulario «Totora»"');
    expect(html).not.toMatch(disabledButton);
  });

  it("un registro sin motivo lo dice en lugar de dejar un hueco", () => {
    const text = visibleText(render(<TrashEntryList entries={[entry({ deletion_reason: "   " })]} canRestore onRestore={() => {}} />));

    expect(text).toContain(NO_REASON_MESSAGE);
  });

  it("sin permiso de restaurar el botón se ve desactivado y explica por qué", () => {
    const html = render(<TrashEntryList entries={[entry()]} canRestore={false} onRestore={() => {}} />);

    expect(html).toMatch(disabledButton);
    expect(html).toContain("Solo un Administrador puede restaurar registros eliminados.");
  });

  it("destaca la dependencia a la que se acaba de ir", () => {
    const html = render(<TrashEntryList entries={[entry()]} canRestore highlightId={TERM} onRestore={() => {}} />);

    expect(visibleText(html)).toContain(DEPENDENCY_FIRST_BADGE);
    expect(html).toContain("border-terracota");
  });

  it("el registro abierto cambia su botón por el panel de restauración", () => {
    const html = render(
      <TrashEntryList
        entries={[entry(), entry({ entity_id: ids.term(902), entity_label: "Rojo carmín" })]}
        canRestore
        openEntryId={TERM}
        restorePanel={<p>Panel de restauración</p>}
        onRestore={() => {}}
      />,
    );
    const text = visibleText(html);

    expect(text).toContain("Panel de restauración");
    // Solo queda el botón del otro registro.
    expect(html.match(/Restaurar término de vocabulario «/g)).toHaveLength(1);
    expect(html).toContain("Restaurar término de vocabulario «Rojo carmín»");
  });

  it("distingue la papelera vacía de unos filtros sin resultados", () => {
    expect(visibleText(render(<TrashEntryList entries={[]} canRestore onRestore={() => {}} />))).toBe(TRASH_EMPTY_MESSAGE);
    expect(visibleText(render(<TrashEntryList entries={[]} canRestore hasFilters onRestore={() => {}} />))).toBe(TRASH_NO_MATCH_MESSAGE);
  });
});
