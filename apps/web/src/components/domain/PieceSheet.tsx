/**
 * Secciones de la ficha de pieza (docs/system-design.md §4; `FichaPieza` en el documento del
 * equipo): encabezado con badges, datos generales, identificadores con candado del código I
 * (RN-002), fotografías y ubicación actual. Son presentacionales: las acciones (editar, corregir,
 * retirar, mover) las inyecta la pantalla, que es la que conoce la sesión y el store.
 */
import { ArrowLeft, ImageOff, Lock, MapPin, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { ApiSchemas } from "@/lib/api/client";

import { identifierCurrencyStatus } from "./status-intents";
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
  return (
    <header className="flex flex-col gap-2">
      <Link href={backHref} className="flex items-center gap-1 self-start text-sm text-gris-texto underline hover:text-terracota">
        <ArrowLeft size={16} aria-hidden="true" />
        {backLabel}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-tinta">{piece.title}</h1>
        {actions}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <TenureBadge regime={piece.tenure_regime} />
        {piece.inventory_code && <LockBadge label={`Código I: ${piece.inventory_code}`} />}
        {alerts
          .filter((alert) => alert.applies)
          .map((alert) => (
            <AlertBadge key={alert.type} alert={alert} />
          ))}
      </div>
      {notices}
    </header>
  );
}

export function PieceField({ label, value, wide = false }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-sm font-medium text-gris-texto">{label}</dt>
      <dd className="text-base text-tinta">{value}</dd>
    </div>
  );
}

const RESTRICTED = "Restringido para su rol (RF-041)";

export function PieceGeneralData({ piece }: { piece: PieceDetail }) {
  return (
    <Card as="section" aria-label="Datos generales">
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        <PieceField label="Colección" value={piece.collection?.name ?? "Sin colección (pieza suelta)"} />
        <PieceField label="Categoría" value={piece.category?.label ?? "Sin registrar"} />
        <PieceField label="Tipo de bien" value={piece.object_type?.label ?? "Sin registrar"} />
        <PieceField label="Materiales" value={piece.materials.length ? piece.materials.map((m) => m.label).join(", ") : "Sin registrar"} />
        <PieceField label="Estado de conservación" value={piece.conservation_status?.label ?? "Sin registrar"} />
        <PieceField label="Forma de adquisición" value={piece.acquisition_method?.label ?? "Sin registrar"} />
        <PieceField label="Disponibilidad" value={piece.availability?.label ?? "Sin registrar"} />
        <PieceField label="Procedencia" value={piece.provenance ?? "Sin registrar"} />
        <PieceField label="Época (texto original)" value={piece.period.text ?? "Sin registrar"} />
        <PieceField label="Medidas" value={piece.dimensions_text ?? "Sin registrar"} />
        <PieceField label="Fecha de ingreso" value={piece.entry_date ?? "Sin registrar"} />
        <PieceField label="Registrado por" value={piece.recorded_by ?? "Sin registrar"} />
        <PieceField label="Propietario legal" value={piece.legal_owner ?? "PUCP"} />
        {piece.tenure_regime === "LOAN_FOR_USE" && (
          <>
            <PieceField label="Comodante" value={piece.lender_name ?? RESTRICTED} />
            <PieceField label="Convenio de comodato" value={piece.loan_agreement_ref ?? RESTRICTED} />
          </>
        )}
        <PieceField label="Descripción" value={piece.description ?? "Sin descripción"} wide />
        {piece.notes && <PieceField label="Observaciones" value={piece.notes} wide />}
      </dl>
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
                    {identifier.identifier_type_code}
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
      {piece.inventory_code && (
        <p className="flex items-start gap-2 rounded-md bg-crema-light p-3 text-sm text-gris-texto">
          <Lock size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          El código I está bloqueado una vez asignado (RN-002). Solo un Administrador puede corregirlo mediante un procedimiento
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
        {!location.is_exact && <span className="ml-2 text-sm text-gris-texto">(ubicación exacta restringida para su rol, RF-041)</span>}
      </p>
    </Card>
  );
}
