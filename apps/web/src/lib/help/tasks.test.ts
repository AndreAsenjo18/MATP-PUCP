import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ROLES } from "@/lib/fixtures";

import { TASKS, pendingLabel, statusParts, visibleTasks } from "./tasks";

// Spec plataforma — Inicio como guía de tareas. Datos sintéticos (RNF-014).

function idsFor(roleCode: string): string[] {
  const role = ROLES.find((item) => item.code === roleCode);
  if (!role) throw new Error(`Rol ${roleCode} no encontrado en los datos sintéticos`);
  return visibleTasks((permission) => role.permissions.includes(permission)).map((task) => task.id);
}

describe("tabla de tareas", () => {
  it("cada destino es una pantalla que existe", () => {
    for (const task of TASKS) {
      expect(existsSync(join(process.cwd(), "src/app", task.href, "page.tsx")), `${task.id}: ${task.href}`).toBe(true);
    }
  });

  it("cada permiso es uno que algún rol conoce", () => {
    const known = new Set(ROLES.flatMap((role) => role.permissions));
    for (const permission of TASKS.flatMap((task) => task.permissions)) {
      expect(known.has(permission), permission).toBe(true);
    }
  });

  it("cada tarea tiene un verbo y una sola línea de explicación, sin identificadores de requisitos", () => {
    for (const task of TASKS) {
      expect(task.verb.length).toBeGreaterThan(0);
      expect(task.description).not.toContain("\n");
      expect(`${task.verb} ${task.description}`).not.toMatch(/\b(RF|RN|RNF|RIA)-\d+/);
    }
    expect(new Set(TASKS.map((task) => task.id)).size).toBe(TASKS.length);
  });
});

describe("tareas visibles por rol", () => {
  it("el Administrador ve las seis", () => {
    expect(idsFor("ADMIN")).toEqual(["search", "register", "load", "review", "report", "settings"]);
  });

  it("el Personal de depósito no ve cargar ni configuración", () => {
    const ids = idsFor("STORAGE_STAFF");
    expect(ids).toContain("search");
    expect(ids).not.toContain("load");
    expect(ids).not.toContain("settings");
  });

  it("«Revisar pendientes» no aparece para un rol sin ninguno de sus tres permisos", () => {
    const ids = visibleTasks((permission) => permission === "pieces.read" || permission === "pieces.create").map((task) => task.id);
    expect(ids).toEqual(["search", "register"]);
  });

  it("el Catalogador puede registrar y cargar, pero no configurar", () => {
    const ids = idsFor("CATALOGUER");
    expect(ids).toContain("register");
    expect(ids).toContain("load");
    expect(ids).not.toContain("settings");
  });

  it("sin permisos solo queda buscar", () => {
    expect(visibleTasks(() => false).map((task) => task.id)).toEqual(["search"]);
  });

  it("«Revisar pendientes» aparece con cualquiera de sus tres permisos", () => {
    for (const permission of ["duplicates.resolve", "ai.review", "reports.view"]) {
      expect(visibleTasks((candidate) => candidate === permission).map((task) => task.id)).toContain("review");
    }
  });
});

describe("línea de estado y número de pendientes", () => {
  it("usa una sola medida, cuántas faltan", () => {
    const text = statusParts({ total: 318, withoutInventoryCode: 117, withoutPhoto: 138 }).map((part) => part.text).join(" · ");
    expect(text).toBe("318 piezas · 117 sin código I · 138 sin foto");
    expect(text).not.toContain("%");
  });

  it("dice «pieza» en singular", () => {
    expect(statusParts({ total: 1, withoutInventoryCode: 0, withoutPhoto: 0 })[0].text).toBe("1 pieza");
  });

  it("muestra el número solo cuando hay algo por revisar", () => {
    expect(pendingLabel(90)).toBe("90 por revisar");
    expect(pendingLabel(0)).toBeNull();
    expect(pendingLabel(null)).toBeNull();
  });
});
