import { describe, expect, it } from "vitest";

import { ADMIN_ERROR_MESSAGES, type CollectionItem, type IdentifierType, type NormalizationPreview, type VocabularyTerm } from "@/lib/data/admin";
import type { MappingTemplate } from "@/lib/data/import-templates";
import type { LocationNode } from "@/lib/data/locations";
import type { PackageView, RoleOut, UserOut } from "@/lib/data/users-admin";
import { render, visibleText } from "@/test/render";

import { ADMIN_SECTIONS, AdminNav, AdminToolbar, FormDialog, SectionHeader, visibleSections } from "./AdminShell";
import { LocationTreeView } from "./LocationsAdmin";
import { Fold, MarkersEditor, SeparatorsEditor } from "./NormalizationAdmin";
import { TemplateAdminList } from "./MappingTemplatesAdmin";
import { CollectionsTable, IdentifierTypesTable, RulePreviewPanel, TermList } from "./VocabulariesAdmin";
import { PermissionPackageCard, PermissionSaveBar, RoleButtons, UsersTable } from "./UsersAdmin";

// Spec plataforma — Administración: ningún texto que lee la persona cita requisitos (RF-, RN-, RNF-, RIA-).
// Datos sintéticos (RNF-014). Se buscan los identificadores reales (RN-001..010, RF-001..044…): un código de
// pieza como «RN-004521» no es un requisito.

const REQUIREMENT = /\b(RF-0\d{2}|RNF-0\d{2}|RN-0\d{2}|RIA-0\d)\b/;
const noop = () => {};

const ROLES = [{ code: "ADMIN", name: "Administrador", description: null, is_enabled: true, permissions: ["pieces.read"] }] as unknown as RoleOut[];
const USER = { id: "u1", email: "ana@matp.local", full_name: "Ana García", roles: ["ADMIN"], is_active: true, must_change_password: true } as unknown as UserOut;
const PACKAGE = { id: "fichas", label: "Fichas", permissions: [{ code: "pieces.read", description: "Consultar fichas de piezas" }] } as unknown as PackageView;
const COLLECTION = { id: "c1", name: "Cerámica de Puno", acronym: "M.M.Z.", parent_id: null, is_active: true, piece_count: 3 } as unknown as CollectionItem;
const TYPE = {
  code: "I",
  label: "Código de inventario general (I)",
  description: null,
  normalization_rule: "INVENTORY",
  is_unique_when_current: true,
  locks_on_assignment: true,
  owned_pieces_only: true,
  allowed_for_temporary_loan: false,
  sort_order: 1,
  is_active: true,
  is_system: true,
} as IdentifierType;
const TERM = { id: "t1", vocabulary_code: "MATERIAL", parent_id: null, code: "MADERA", name: "Madera", label: "Madera", description: null, sort_order: 0, is_active: true, external_uri: null } as VocabularyTerm;
const TEMPLATE = {
  id: "tpl-1",
  name: "Libro de inventario general v1",
  source_name: "Libro de inventario (sintético)",
  header_signature: "a".repeat(64),
  columns: [{ source_column: "Nº INVENTARIO", target_field: "identifier", identifier_type_code: null, split_compound: true, transforms: ["trim"], value_map: null }],
  defaults: {},
  description: "[SUPUESTO] Columnas ilustrativas.",
  created_at: "2026-10-22T10:00:00Z",
} as MappingTemplate;
const NODE = { id: "s1", name: "Sede central", level_type: "Sede", children: [{ id: "c1", name: "Caja 3", level_type: "Contenedor", children: [] }] } as unknown as LocationNode;
const PREVIEW = {
  type_code: "PUCP",
  current_rule: "GENERIC",
  proposed_rule: "INVENTORY",
  total_identifiers: 3,
  changed_count: 2,
  unparseable_count: 0,
  collisions: [{ normalized_value: "I-21", piece_ids: ["p-1", "p-2"] }],
  changed_examples: [],
  unparseable_examples: [],
  can_confirm: false,
  confirm_token: "t",
  notes: [],
} as NormalizationPreview;

describe("lenguaje llano en Administración", () => {
  const all = visibleSections(() => true);
  const texts: Record<string, string> = {
    navegación: visibleText(render(<AdminNav sections={all} current="usuarios" onSelect={noop} />)),
    encabezado: visibleText(render(<SectionHeader title="Listas de valores" description="Las opciones que se eligen al llenar una ficha." />)),
    barra: visibleText(render(<AdminToolbar label="Filtros" action={<button type="button">Nuevo</button>} />)),
    diálogo: visibleText(render(<FormDialog open={false} title="Nuevo usuario" submitLabel="Crear usuario" onClose={noop} onSubmit={async () => true}>{null}</FormDialog>)),
    usuarios: visibleText(render(<UsersTable users={[USER]} roles={ROLES} onToggleActive={noop} onResetPassword={noop} />)),
    permisos: visibleText(render(<RoleButtons roles={ROLES} value="ADMIN" onChange={noop} />)) + visibleText(render(<PermissionPackageCard pkg={PACKAGE} working={[]} onTogglePermission={noop} onTogglePackage={noop} />)),
    guardar: visibleText(render(<PermissionSaveBar diff={{ added: ["imports.prepare"], removed: [] }} reason="" onReason={noop} onSave={noop} />)),
    colecciones: visibleText(render(<CollectionsTable items={[COLLECTION]} all={[COLLECTION]} />)),
    listas: visibleText(render(<TermList terms={[TERM]} busy={false} onToggle={noop} />)),
    tipos: visibleText(render(<IdentifierTypesTable types={[TYPE]} selected={null} onSelect={noop} />)),
    impacto: visibleText(render(<RulePreviewPanel type={TYPE} preview={PREVIEW} busy={false} onConfirm={noop} onCancel={noop} />)),
    ubicaciones: visibleText(render(<LocationTreeView nodes={[NODE]} onDeactivate={noop} />)),
    formatos: visibleText(render(<TemplateAdminList templates={[TEMPLATE]} canEdit canDelete busyId={null} errors={{}} onRename={noop} onDelete={noop} />)),
    lectura:
      visibleText(render(<Fold title="Textos que significan «sin código»" count={3} open={false}>{null}</Fold>)) +
      visibleText(render(<MarkersEditor saved={["S/N"]} draft={["S/N"]} isDefault busy={false} error={null} impact={null} onChange={noop} onSave={noop} onDiscard={noop} />)) +
      visibleText(render(<SeparatorsEditor saved={{ separators: ["/"], unsplit_markers: [] }} draft={{ separators: ["/"], unsplit_markers: [] }} isDefault busy={false} error={null} impact={null} onChange={noop} onSave={noop} onDiscard={noop} />)),
  };

  for (const [name, text] of Object.entries(texts)) {
    it(`«${name}» no cita requisitos`, () => {
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toMatch(REQUIREMENT);
    });
  }

  it("los mensajes de error de Administración tampoco", () => {
    for (const message of Object.values(ADMIN_ERROR_MESSAGES)) expect(message).not.toMatch(REQUIREMENT);
  });

  it("las secciones usan los nombres nuevos y no los técnicos", () => {
    const labels = ADMIN_SECTIONS.map((section) => section.label);
    expect(labels).toEqual(expect.arrayContaining(["Listas de valores", "Tipos de código", "Formatos de archivo", "Lectura de códigos"]));
    expect(labels.join(" ")).not.toMatch(/vocabulario|plantilla|normalizaci/i);
  });
});
