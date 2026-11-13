/**
 * Secciones de la ficha de pieza (docs/system-design.md §4; `FichaPieza` en el documento del
 * equipo): encabezado con badges, datos generales, identificadores con candado del código I
 * (RN-002), fotografías y ubicación actual. Son presentacionales: las acciones (editar, corregir,
 * retirar, mover) las inyecta la pantalla, que es la que conoce la sesión y el store.
 */
import { ImageOff, Lock, MapPin, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { ApiSchemas } from "@/lib/api/client";

import { identifierCurrencyStatus, identifierTypeLabel } from "./status-intents";
import { AlertBadge, LockBadge, StatusBadge, TenureBadge } from "./StatusBadges";

type PieceDetail = ApiSchemas["PieceDetail"];
type MediaAsset = ApiSchemas["MediaAssetOut"];

export function PieceSheetHeader({
  piece,
  alerts,
  actions,
  notices,
  backHref = "/busqueda",
  backLabel = "Volver a búsqueda",
}: {
  piece: PieceDetail;
  alerts: ApiSchemas["PieceAlert"][];
  actions?: ReactNode;
  notices?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  // Maqueta B: «Volver», el nombre y sus insignias van en la banda; las acciones, debajo, sobre el
  // fondo claro (sus colores, como el terracota de «Editar ficha», no se verían sobre la banda).
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        back={{ href: backHref, label: backLabel }}
        title={piece.denomination}
        meta={
          <>
            {piece.code_i && <LockBadge label={`Código I: ${piece.code_i}`} />}
            <TenureBadge regime={piece.tenure_regime} />
            {alerts
              .filter((alert) => alert.applies)
              .map((alert) => (
                <AlertBadge key={alert.type} alert={alert} />
              ))}
          </>
        }
      />
      {actions}
      {notices}
    </div>
  );
}

/**
 * Un dato de la ficha (maqueta B): la etiqueta tenue a 16 px y el valor más grande, a 20 px en
 * seminegrita. Los textos largos (`wide`) ocupan la fila entera, a 18 px y con más interlineado.
 */
export function PieceField({ label, value, wide = false }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-full" : undefined}>
      <dt className="text-base font-medium text-gris-texto">{label}</dt>
      <dd className={wide ? "mt-1 text-lg leading-relaxed font-medium text-tinta" : "mt-1 text-xl font-semibold break-words text-tinta"}>{value}</dd>
    </div>
  );
}

/** Un grupo de datos con su subtítulo; una línea fina lo separa del anterior. */
function PieceFieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-t border-borde pt-6 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-bold text-terracota">{title}</h2>
      <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
    </div>
  );
}

const RESTRICTED = "Restringido para su rol";

/**
 * Datos generales agrupados como el formulario de la pieza (Identificación, Descripción, Procedencia y
 * época, Medidas y materiales, Conservación y Observaciones), con los mismos campos de siempre.
 */
export function PieceGeneralData({ piece }: { piece: PieceDetail }) {
  return (
    <Card as="section" aria-label="Datos generales" className="flex flex-col gap-6 p-tarjeta">
      <PieceFieldGroup title="Identificación">
        <PieceField label="Colección" value={piece.collection?.name ?? "Sin colección (pieza suelta)"} />
        <PieceField label="Categoría" value={piece.category?.label ?? "Sin registrar"} />
        <PieceField label="Tipo de bien" value={piece.object_type?.label ?? "Sin registrar"} />
        <PieceField label="Disponibilidad" value={piece.availability?.label ?? "Sin registrar"} />
        <PieceField label="Propietario legal" value={piece.legal_owner ?? "PUCP"} />
        {piece.tenure_regime === "Comodato" && (
          <>
            <PieceField label="Comodante" value={piece.lender_name ?? RESTRICTED} />
            <PieceField label="Convenio de comodato" value={piece.loan_agreement_ref ?? RESTRICTED} />
          </>
        )}
      </PieceFieldGroup>
      <PieceFieldGroup title="Descripción">
        <PieceField label="Descripción" value={piece.description ?? "Sin descripción"} wide />
      </PieceFieldGroup>
      <PieceFieldGroup title="Procedencia y época">
        <PieceField label="Procedencia" value={piece.provenance ?? "Sin registrar"} />
        <PieceField label="Época (texto original)" value={piece.period.text ?? "Sin registrar"} />
        <PieceField label="Forma de adquisición" value={piece.acquisition_method?.label ?? "Sin registrar"} />
        <PieceField label="Fecha de ingreso" value={piece.entry_date ?? "Sin registrar"} />
        <PieceField label="Registrado por" value={piece.recorded_by ?? "Sin registrar"} />
      </PieceFieldGroup>
      <PieceFieldGroup title="Medidas y materiales">
        <PieceField label="Materiales" value={piece.materials.length ? piece.materials.map((m) => m.label).join(", ") : "Sin registrar"} />
        <PieceField label="Medidas" value={piece.dimensions_text ?? "Sin registrar"} />
        {piece.dimensions && piece.dimensions.length > 0 && (
          <PieceField label="Medidas detalladas" value={piece.dimensions.map((d) => `${d.dimension}: ${d.value} ${d.unit}`).join(", ")} />
        )}
      </PieceFieldGroup>
      <PieceFieldGroup title="Conservación">
        <PieceField label="Estado de conservación" value={piece.conservation_status?.label ?? "Sin registrar"} />
      </PieceFieldGroup>
      {piece.notes && (
        <PieceFieldGroup title="Observaciones">
          <PieceField label="Observaciones" value={piece.notes} wide />
        </PieceFieldGroup>
      )}
    </Card>
  );
}

export function PieceIdentifiersTable({ piece, children }: { piece: PieceDetail; children?: ReactNode }) {
  return (
    <Card as="section" aria-label="Identificadores" className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-base">
          <thead className="text-sm text-gris-texto">
            <tr>
              <th className="py-2 pr-4 font-medium">Tipo</th>
              <th className="py-2 pr-4 font-medium">Valor original</th>
              <th className="py-2 pr-4 font-medium">Normalizado</th>
              <th className="py-2 pr-4 font-medium">Vigente</th>
              <th className="py-2 pr-4 font-medium">Notas</th>
            </tr>
          </thead>
          <tbody>
            {piece.identifiers.map((identifier) => (
              <tr key={identifier.id} className="border-t border-borde align-top">
                <td className="py-2 pr-4 font-medium text-tinta">
                  <span className="inline-flex items-center gap-1">
                    {identifierTypeLabel(identifier.identifier_type_code)}
                    {identifier.is_locked && <Lock size={16} role="img" aria-label="Bloqueado" className="text-gris-texto" />}
                  </span>
                </td>
                <td className="py-2 pr-4 text-tinta">{identifier.original_value}</td>
                <td className="py-2 pr-4 text-tinta">
                  {identifier.normalized_value ?? <span className="font-medium text-carmin-texto">No normalizable</span>}
                </td>
                <td className="py-2 pr-4">
                  <StatusBadge status={identifierCurrencyStatus(identifier.is_current)} />
                </td>
                <td className="py-2 pr-4 text-sm text-gris-texto">{identifier.notes ?? "—"}</td>
              </tr>
            ))}
            {piece.identifiers.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-gris-texto">
                  Sin identificadores registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {piece.code_i && (
        <p className="flex items-start gap-2 rounded-md bg-crema-light p-3 text-sm text-gris-texto">
          <Lock size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          El código I está bloqueado una vez asignado. Solo un Administrador puede corregirlo mediante un procedimiento
          auditado.
        </p>
      )}
      {children}
    </Card>
  );
}

export function PieceMediaGallery({
  media,
  pieceTitle,
  renderActions,
}: {
  media: MediaAsset[];
  pieceTitle: string;
  renderActions?: (asset: MediaAsset) => ReactNode;
}) {
  if (media.length === 0) {
    return (
      <Card className="flex items-center justify-center gap-2 border-dashed text-base text-gris-texto">
        <ImageOff size={20} aria-hidden="true" />
        Sin fotografías registradas.
      </Card>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {media.map((asset) => (
        <figure key={asset.id} className="flex flex-col gap-2 overflow-hidden rounded-lg border border-borde bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- foto sintética en data: URI, sin optimización de imagen remota */}
          <img src={asset.download_url ?? undefined} alt={`${pieceTitle} — ${asset.view_type?.label ?? "vista"}`} className="aspect-[4/3] w-full object-cover" />
          <figcaption className="flex flex-col gap-1 p-3">
            <span className="text-sm font-medium text-tinta">{asset.view_type?.label ?? "Vista"}</span>
            {asset.usage_restriction && asset.usage_restriction.code !== "SIN_RESTRICCION" && (
              <Badge intent="warning" icon={TriangleAlert} className="self-start">
                {asset.usage_restriction.label}
                {asset.restriction_note ? `: ${asset.restriction_note}` : ""}
              </Badge>
            )}
            {renderActions?.(asset)}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function PieceCurrentLocation({ location }: { location: PieceDetail["location"] }) {
  return (
    <Card as="section" aria-label="Ubicación actual">
      <h3 className="flex items-center gap-2 text-base font-semibold text-tinta">
        <MapPin size={18} aria-hidden="true" className="text-terracota" />
        Ubicación actual
      </h3>
      <p className="mt-1 text-base text-tinta">
        {location.path.length > 0 ? location.path.map((l) => l.name).join(" / ") : "Sin ubicación registrada"}
        {!location.is_exact && <span className="ml-2 text-sm text-gris-texto">(ubicación exacta restringida para su rol)</span>}
      </p>
    </Card>
  );
}
