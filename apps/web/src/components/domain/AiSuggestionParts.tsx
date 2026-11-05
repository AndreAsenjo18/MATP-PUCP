/**
 * Presentación de las sugerencias de IA (change `rediseno-ux-sugerencias-ia`): textos de propósito
 * y de alcance, nombres llanos de las funciones y la propuesta como lista de campos. La IA está
 * fuera del MVP: la pantalla muestra ejemplos de demostración y lo dice.
 */
import { FlaskConical } from "lucide-react";

import { Badge } from "@/components/ui/Badge";

export const AI_TITLE = "Sugerencias de la IA";

export const AI_PURPOSE =
  "La IA lee el texto libre de una ficha y propone sus campos. Usted revisa, corrige y aprueba; sin su aprobación no se guarda nada.";

export const AI_SCOPE_LABEL = "Fuera del MVP";

export const AI_SCOPE_TEXT =
  "Estos son ejemplos de demostración con datos sintéticos: aún no hay un proveedor de IA conectado y lo que apruebe aquí no cambia el catálogo.";

const FUNCTION_LABELS: Record<string, string> = {
  RIA_01: "Extraer datos de un texto",
  RIA_02: "Detectar posibles duplicados",
  RIA_03: "Sugerir términos",
  RIA_04: "Redactar una descripción",
  RIA_05: "Responder consultas",
};

/** Nombre llano de la función de IA; un código desconocido se muestra tal cual. */
export function functionLabel(code: string): string {
  return FUNCTION_LABELS[code] ?? code;
}

const FIELD_LABELS: Record<string, string> = {
  texto_origen: "Texto",
  denomination: "Nombre",
  description: "Descripción",
  category: "Categoría",
  categoria: "Categoría",
  metadatos: "Datos de origen",
  conservation_status: "Estado de conservación",
  provenance: "Procedencia",
  suggested_terms: "Términos sugeridos",
  vocabulary_code: "Lista de valores",
  materials: "Materiales",
  technique: "Técnica",
  author: "Autor",
  period: "Periodo",
  object_type: "Tipo de objeto",
  collection: "Colección",
  tenure_regime: "Régimen",
};

/** Etiqueta legible de un campo; si no se conoce, conserva su nombre original. */
export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

/** Valor como texto: lista con comas, sí/no, objeto anidado como «clave: valor». */
export function describeValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (Array.isArray(value)) return value.length === 0 ? "—" : value.map(describeValue).join(", ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, inner]) => `${fieldLabel(key)}: ${describeValue(inner)}`)
      .join("; ");
  }
  return String(value);
}

export interface DataField {
  key: string;
  label: string;
  value: string;
}

export interface DataView {
  fields: DataField[];
  /** «82 % de confianza», si los datos traen una `confidence` entre 0 y 1. */
  confidence: string | null;
}

/** Campos legibles de los datos de entrada o de la propuesta, y la confianza aparte. */
export function dataView(data: unknown): DataView {
  const record = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  const confidence = record.confidence;
  const hasConfidence = typeof confidence === "number" && confidence >= 0 && confidence <= 1;
  const fields = Object.entries(record)
    .filter(([key]) => !(hasConfidence && key === "confidence"))
    .map(([key, value]) => ({ key, label: fieldLabel(key), value: describeValue(value) }));
  return { fields, confidence: hasConfidence ? `${Math.round(confidence * 100)} % de confianza` : null };
}

/** Franja de alcance: etiqueta con icono y texto, sin depender solo del color. */
export function ScopeNotice() {
  return (
    <div role="note" className="flex flex-col gap-2 rounded-lg border border-ambar-alerta/40 bg-ambar-bg px-4 py-3 text-ambar-texto sm:flex-row sm:items-start sm:gap-3">
      <Badge intent="warning" icon={FlaskConical} className="shrink-0 self-start whitespace-nowrap border border-ambar-alerta/50 bg-white/60">
        {AI_SCOPE_LABEL}
      </Badge>
      <p className="text-sm">{AI_SCOPE_TEXT}</p>
    </div>
  );
}

/** Lista de campos con etiqueta y valor; vacía muestra un guion. */
export function FieldList({ view }: { view: DataView }) {
  return (
    <div className="flex flex-col gap-2">
      <dl className="flex flex-col gap-1.5">
        {view.fields.map((field) => (
          <div key={field.key} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="shrink-0 text-sm font-medium text-gris-texto sm:w-40">{field.label}</dt>
            <dd className="min-w-0 break-words text-sm text-tinta">{field.value}</dd>
          </div>
        ))}
      </dl>
      {view.confidence && <p className="text-sm font-semibold text-tinta">{view.confidence}</p>}
    </div>
  );
}
