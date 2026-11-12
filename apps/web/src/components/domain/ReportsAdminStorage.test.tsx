import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SessionProvider } from "@/lib/auth/session";
import { render, visibleText } from "@/test/render";

import { ADMIN_SECTIONS, initialSection, sectionFromSlug, visibleSections } from "./AdminShell";
import { StorageEstimateCard } from "./StorageEstimateCard";

// Change reportes-vista-simplificada, sección 4 (Req: Pantalla de Reportes solo con reportes). HTML
// estático (ADR-012). Las páginas necesitan sesión, así que lo que montan se comprueba en su código.

const allowing = (...permissions: string[]) => (permission: string) => permissions.includes(permission);
const source = (relative: string) => readFileSync(path.resolve(__dirname, "..", "..", relative), "utf-8");

describe("«Almacenamiento de fotos» en Administración › Control (tarea 4.1)", () => {
  it("es una sección de Control, después de la exportación completa", () => {
    const control = ADMIN_SECTIONS.filter((section) => section.area === "control").map((section) => section.slug);
    expect(control).toEqual(["papelera", "auditoria", "exportacion", "almacenamiento"]);
    expect(sectionFromSlug("almacenamiento")?.label).toBe("Almacenamiento de fotos");
  });

  it("solo la ve quien administra (users.manage) y se abre con ?pestana=almacenamiento", () => {
    const admin = visibleSections(allowing("users.manage", "exports.full", "trash.read", "audit.read"));
    expect(initialSection("almacenamiento", admin)?.slug).toBe("almacenamiento");
    const curator = visibleSections(allowing("reports.view", "exports.run", "trash.read"));
    expect(curator.map((section) => section.slug)).not.toContain("almacenamiento");
    expect(initialSection("almacenamiento", curator)?.slug).not.toBe("almacenamiento");
  });

  it("Administración monta la estimación tal cual en esa sección", () => {
    const page = source("app/administracion/page.tsx");
    expect(page).toMatch(/case "almacenamiento":\s*return <StorageEstimateCard devUser=\{currentUser\?\.email\} \/>;/);
  });

  it("la tarjeta ya no muestra el identificador del requisito", () => {
    const text = visibleText(
      render(
        <SessionProvider>
          <StorageEstimateCard />
        </SessionProvider>,
      ),
    );
    expect(text).toContain("Volumen fotográfico");
    expect(text).not.toMatch(/RNF-\d/);
  });
});

describe("Reportes solo con reportes (tareas 4.1 y 4.2)", () => {
  const page = source("app/reportes/page.tsx");

  it("Reportes ya no monta la estimación del volumen", () => {
    expect(page).not.toContain("StorageEstimateCard");
  });

  it("Reportes ya no monta la exportación completa, ni la real ni la de demostración", () => {
    expect(page).not.toContain("FullExportPanel");
    expect(page).not.toContain("Exportación completa de la base");
    expect(page).not.toContain("exports.full");
  });

  it("la exportación completa sigue en Administración › Control", () => {
    expect(sectionFromSlug("exportacion")?.area).toBe("control");
    expect(source("app/administracion/page.tsx")).toContain("<FullExportPanel />");
  });
});
