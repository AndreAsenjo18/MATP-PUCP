"use client";

/**
 * Piezas de la cola de duplicados (change `deteccion-duplicados-y-cola-revision`, tarea 4.1; spec
 * calidad-datos, RF-030, RNF-010):
 *
 * - `DuplicateFilters`: píldoras de estado, colección, similitud y tipo de par (change
 *   `revisar-duplicados-comparacion`).
 * - `DuplicateCandidateCard`: la revisión de un par como una pregunta («¿Es la misma pieza?»), los
 *   motivos en palabras, la comparación campo por campo (pieza del catálogo o fila del Excel) con
 *   «Solo diferencias», y tres decisiones que dicen qué pasará. Cada fila es igual, distinta, en
 *   conflicto o «solo en» un lado, con color, palabra e icono (el color nunca es el único portador).
 * - `QueuePager`: «Anterior / Siguiente» que la pantalla monta encima y debajo de la lista.
 * - `DistinctDialog` y `PostponeDialog`: resolución como distinto (motivo obligatorio) o pospuesto
 *   hasta una fecha de como máximo 180 días (design D5).
 * - `ScanPanel`: detección completa bajo demanda, como un botón discreto junto al número de pares,
 *   con su avance en la misma línea (design D3; `revisar-duplicados-comparacion`).
 *
 * Son presentacionales: reciben datos y acciones (`Promise<DialogOutcome>`) y no llaman a la API.
 * «Es la misma pieza» abre el asistente de fusión de la tarea 4.2 (`MergeWizard`) en un par de dos
 * piezas; queda deshabilitado, con el motivo a la vista, si el par está bloqueado. En un par con fila
 * de Excel decide la fila en su lote (la actualiza o la vuelve pieza nueva).
 */
import { ArrowRight, CalendarClock, Check, ChevronLeft, ChevronRight, CircleAlert, Equal, EqualNot, ScanSearch, Split, TriangleAlert, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PillSelect } from "@/components/ui/PillSelect";
import { Textarea } from "@/components/ui/Textarea";
import type { ApiSchemas } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { mergeBlock } from "@/lib/data/merge-plan";
import {
  postponeBounds,
  postponedUntilFromDate,
  postponementError,
  type DuplicateCandidate,
  type DuplicateOrigin,
  type DuplicateStatus,
  type ImportRowChoice,
  type QualityJob,
} from "@/lib/data/duplicates";
import { importHref } from "@/lib/data/import-origin";

import type { DialogOutcome } from "./PieceActionDialogs";
import { duplicateStatus } from "./status-intents";
import { StatusBadge, TenureBadge } from "./StatusBadges";

type PieceDetail = ApiSchemas["PieceDetail"];
type DuplicateSignal = DuplicateCandidate["matched_fields"][number];
type ImportRowSummary = NonNullable<DuplicateCandidate["import_row"]>;
type CollectionOut = ApiSchemas["CollectionOut"];

// ---------------------------------------------------------------------------------------------
// Reglas puras (se prueban sin DOM)
// ---------------------------------------------------------------------------------------------

export const DISTINCT_REASON_REQUIRED = "Indique por qué son piezas distintas: queda registrado.";
export const MERGE_LOADING_NOTE = "Cargando las dos fichas para poder fusionar…";
export const MERGE_UNAVAILABLE_NOTE = "No se pudieron leer las dos fichas: recargue la cola para poder fusionar.";

/** Por qué «Fusionar» no está disponible para el par, o `null` si se puede abrir el asistente. */
export function mergeUnavailableReason(candidate: DuplicateCandidate, pieceA: PieceSlot, pieceB: PieceSlot, piecesLoading: boolean): string | null {
  const block = mergeBlock(candidate, pieceA, pieceB);
  if (block) return block.message;
  if (pieceA && pieceB) return null;
  return piecesLoading ? MERGE_LOADING_NOTE : MERGE_UNAVAILABLE_NOTE;
}

/** Estados en los que un par ya no admite resolución (design D4). */
const CLOSED: ReadonlySet<string> = new Set(["MERGED", "SUPERSEDED"]);

export function canBeResolved(candidate: Pick<DuplicateCandidate, "status">): boolean {
  return !CLOSED.has(candidate.status);
}

export function scorePercent(score: number): string {
  return `${Math.round(score * 100)} %`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-PE");
}

/** Tipo de identificador de una señal `identifier:<TIPO>`. */
function identifierType(field: string): string | null {
  return field.startsWith("identifier:") ? field.slice("identifier:".length) || null : null;
}

// ---------------------------------------------------------------------------------------------
// Nombres en español (change `revisar-pendientes-unificado`, tarea 3.2; design D5): ningún nombre
// interno de señal, campo o tipo de identificador llega a la pantalla.
// ---------------------------------------------------------------------------------------------

/**
 * Nombres de los tipos de identificador sembrados (`apps/api/app/seed/reference.py`: `I`,
 * `COLECCION`, `INC_RN`, `PUCP`, `PROPIETARIO`, `OTRO`) y de los datos de demostración (`COLLECTION`,
 * `OWNER`, `OTHER`). Los tipos son parametrizables (RN-010): los nombres que da la API
 * (`GET /identifier-types`) tienen prioridad y cubren los que cree el Administrador.
 */
export const SEEDED_IDENTIFIER_TYPE_NAMES: Readonly<Record<string, string>> = {
  I: "Código de inventario general (I)",
  COLECCION: "Código de colección",
  COLLECTION: "Código de colección",
  INC_RN: "Código INC / Registro Nacional",
  PUCP: "Código PUCP",
  PROPIETARIO: "Código del propietario o comodante",
  OWNER: "Código del propietario o comodante",
  OTRO: "Otro código histórico",
  OTHER: "Otro código histórico",
};

/** Tipo de identificador que ni la API ni la lista local conocen. */
export const UNKNOWN_IDENTIFIER_TYPE = "Otro código";
/** Señal o campo que la pantalla no conoce: nunca se muestra su nombre interno. */
export const UNKNOWN_SIGNAL = "Otro dato";

/** Código de tipo → nombre visible, tal como lo da la API. */
export type IdentifierTypeNames = Readonly<Record<string, string>>;

/** Nombre visible de un tipo de identificador: el de la API, el sembrado o «Otro código». */
export function identifierTypeName(code: string, names: IdentifierTypeNames = {}): string {
  return names[code] ?? SEEDED_IDENTIFIER_TYPE_NAMES[code] ?? UNKNOWN_IDENTIFIER_TYPE;
}

const IdentifierTypeNamesContext = createContext<IdentifierTypeNames>({});

/** La cola provee los nombres de la API una vez; tarjetas, señales y comparación los leen. */
export function IdentifierTypeNamesProvider({ names, children }: { names: IdentifierTypeNames; children: ReactNode }) {
  return <IdentifierTypeNamesContext.Provider value={names}>{children}</IdentifierTypeNamesContext.Provider>;
}

/** Nombres de los tipos que la cola leyó de la API; vacío fuera de ella (quedan los sembrados). */
export function useIdentifierTypeNames(): IdentifierTypeNames {
  return useContext(IdentifierTypeNamesContext);
}

/**
 * Tipo de una señal. Los pares que crea la importación guardan el tipo solo en `field`
 * («denomination», «collection») y sin `signal`: antes se mostraban como «Otro dato»
 * (change `revisar-duplicados-comparacion`).
 */
export function signalKind(signal: Pick<DuplicateSignal, "signal" | "field">): string {
  const kind = signal.signal || signal.field;
  return kind === "collection_id" ? "collection" : kind;
}

/** Texto de cada señal del motor por reglas (design D1); lo desconocido es «Otro dato». */
export function signalLabel(signal: DuplicateSignal, names: IdentifierTypeNames = {}): string {
  const type = identifierType(signal.field);
  switch (signalKind(signal)) {
    case "identifier":
      return type ? `Coincide: ${identifierTypeName(type, names)}` : "Coincide un código";
    case "inventory_code_conflict":
      return "Códigos I vigentes distintos";
    case "denomination":
      return signal.similarity >= 0.999 ? "Denominación igual" : "Denominación parecida";
    case "collection":
      return signal.similarity > 0 ? "Misma colección o subcolección" : "Colecciones distintas";
    case "author_provenance":
      return "Autor y procedencia";
    case "epoch":
      return signal.similarity > 0 ? "Épocas que se superponen" : "Épocas distintas";
    case "dimensions":
      return "Medidas compatibles";
    default:
      return type ? `Coincide: ${identifierTypeName(type, names)}` : UNKNOWN_SIGNAL;
  }
}

export interface SignalValueLine {
  label: string | null;
  a: string;
  b: string;
}

function show(value: unknown): string {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.length === 2 && value.every((v) => typeof v === "number") ? `${value[0]}–${value[1]}` : value.map(show).join(", ");
  return String(value);
}

const VALUE_LABELS: Record<string, string> = { author: "Autor", provenance: "Procedencia" };

/**
 * Valores comparados de una señal (A frente a B). La colección no se repite aquí porque la
 * comparación muestra sus nombres; las filas de importación antiguas pueden no traer valores.
 */
export function signalValueLines(signal: DuplicateSignal): SignalValueLine[] {
  const values = signal.values;
  if (signal.signal === "collection" || typeof values !== "object" || values === null || Array.isArray(values)) return [];
  const record = values as Record<string, unknown>;
  if ("a" in record || "b" in record) {
    const line = { label: null, a: show(record.a), b: show(record.b) };
    return typeof record.normalized === "string" ? [{ ...line, label: `Normalizado ${record.normalized}` }] : [line];
  }
  return Object.entries(record)
    .filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]) && entry[1].length === 2)
    .map(([key, pair]) => ({ label: VALUE_LABELS[key] ?? UNKNOWN_SIGNAL, a: show(pair[0]), b: show(pair[1]) }));
}

export type ComparisonRowKey = "denomination" | "collection" | "tenure" | "code_i" | "identifiers" | "author" | "provenance" | "period" | "dimensions";
export type RowMark = "match" | "conflict";

export interface ComparisonRow {
  key: ComparisonRowKey;
  label: string;
  value: (piece: PieceDetail, names?: IdentifierTypeNames) => ReactNode;
  /** El mismo valor como texto, para decidir si las dos piezas coinciden en este campo. */
  text: (piece: PieceDetail, names?: IdentifierTypeNames) => string;
}

function otherCodes(p: PieceDetail, names?: IdentifierTypeNames): string {
  const others = p.identifiers.filter((i) => i.identifier_type_code !== "I");
  return others.length
    ? others.map((i) => `${identifierTypeName(i.identifier_type_code, names)} ${i.original_value}${i.is_current ? "" : " (histórico)"}`).join(" · ")
    : "—";
}

export const COMPARISON_ROWS: ComparisonRow[] = [
  { key: "denomination", label: "Denominación", value: (p) => p.denomination, text: (p) => p.denomination },
  { key: "collection", label: "Colección", value: (p) => p.collection?.name ?? "Sin colección", text: (p) => p.collection?.name ?? "" },
  { key: "tenure", label: "Régimen", value: (p) => <TenureBadge regime={p.tenure_regime} />, text: (p) => p.tenure_regime },
  {
    key: "code_i",
    label: "Código I",
    value: (p) => <span className="font-mono font-bold text-terracota">{p.code_i ?? "Sin código I"}</span>,
    text: (p) => p.code_i ?? "",
  },
  { key: "identifiers", label: "Otros códigos", value: otherCodes, text: otherCodes },
  { key: "author", label: "Autor", value: (p) => p.author ?? "—", text: (p) => p.author ?? "" },
  { key: "provenance", label: "Procedencia", value: (p) => p.provenance ?? "—", text: (p) => p.provenance ?? "" },
  { key: "period", label: "Época", value: (p) => p.period?.text ?? "—", text: (p) => p.period?.text ?? "" },
  { key: "dimensions", label: "Medidas", value: (p) => p.dimensions_text ?? "—", text: (p) => p.dimensions_text ?? "" },
];

/** Estado de una fila de la comparación: `empty` = ninguna de las dos piezas tiene el dato. */
export type RowState = "same" | "different" | "conflict" | "empty";

function fold(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isBlank(value: string): boolean {
  const folded = fold(value);
  return folded === "" || folded === "sin registrar";
}

/**
 * Igual, distinta o en conflicto. Una señal de conflicto manda; valores iguales al plegar
 * mayúsculas, tildes y puntuación son iguales, y una señal de coincidencia también (códigos que se
 * escriben distinto pero normalizan igual).
 */
export function comparisonRowState(a: string, b: string, mark?: RowMark): RowState {
  if (mark === "conflict") return "conflict";
  if (isBlank(a) && isBlank(b)) return "empty";
  // Si solo un lado tiene el dato, nunca es «igual», aunque una señal diga que coinciden.
  if (isBlank(a) !== isBlank(b)) return "different";
  if (mark === "match" || fold(a) === fold(b)) return "same";
  return "different";
}

/** Filas de la comparación que motiva cada señal: coincidencia o conflicto (código I). */
export function markedRows(signals: readonly DuplicateSignal[]): Map<ComparisonRowKey, RowMark> {
  const marks = new Map<ComparisonRowKey, RowMark>();
  const mark = (key: ComparisonRowKey) => {
    if (marks.get(key) !== "conflict") marks.set(key, "match");
  };
  for (const signal of signals) {
    const kind = signalKind(signal);
    if (kind === "inventory_code_conflict") {
      marks.set("code_i", "conflict");
      continue;
    }
    if (signal.similarity <= 0) continue;
    if (kind === "identifier" || identifierType(signal.field)) mark(identifierType(signal.field) === "I" ? "code_i" : "identifiers");
    else if (kind === "denomination") mark("denomination");
    else if (kind === "collection") mark("collection");
    else if (kind === "epoch") mark("period");
    else if (kind === "dimensions") mark("dimensions");
    else if (kind === "author_provenance") {
      for (const name of signal.field.split("+")) if (name === "author" || name === "provenance") mark(name);
    }
  }
  return marks;
}

/** Avance de una detección que aún no contó las piezas del catálogo (`total_pieces` en 0). */
export const SCAN_STARTING_TEXT = "Iniciando…";

/** Texto del avance o resultado de una detección completa. */
export function jobProgressText(job: QualityJob): string {
  if (job.status === "RUNNING") {
    if (job.total_pieces === 0) return SCAN_STARTING_TEXT;
    return `Revisadas ${job.processed_pieces} de ${job.total_pieces} piezas · ${job.pairs_evaluated} pares evaluados.`;
  }
  if (job.status === "FAILED") return job.error_message || "La detección se interrumpió. Puede lanzarla de nuevo.";
  const seconds = job.duration_ms != null ? ` en ${(job.duration_ms / 1000).toLocaleString("es-PE", { maximumFractionDigits: 1 })} s` : "";
  return `Detección terminada${seconds}: ${job.pairs_evaluated} pares evaluados, ${job.candidates_created} pares nuevos y ${job.candidates_reopened} reabiertos.`;
}

// ---------------------------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------------------------

export interface DuplicateFilterValue {
  status: DuplicateStatus | "";
  collectionId: string;
  minScore: string;
  origin: DuplicateOrigin | "";
}

export const DEFAULT_FILTERS: DuplicateFilterValue = { status: "PENDING", collectionId: "", minScore: "", origin: "" };

const STATUS_OPTIONS: { value: DuplicateStatus | ""; label: string }[] = [
  { value: "PENDING", label: "Pendientes" },
  { value: "POSTPONED", label: "Pospuestos" },
  { value: "DISTINCT", label: "Distintos" },
  { value: "MERGED", label: "Fusionados" },
  { value: "SUPERSEDED", label: "Reemplazados" },
  { value: "", label: "Todos" },
];

const SCORE_OPTIONS = [
  { value: "0.6", label: "60 % o más" },
  { value: "0.7", label: "70 % o más" },
  { value: "0.8", label: "80 % o más" },
  { value: "0.9", label: "90 % o más" },
];

/** «Origen» decía poco: es el tipo de par (change `revisar-duplicados-comparacion`). */
export const PAIR_TYPE_OPTIONS: { value: DuplicateOrigin; label: string }[] = [
  { value: "CATALOG", label: "Dos piezas del catálogo" },
  { value: "IMPORT", label: "Pieza y fila de un Excel" },
];

/**
 * Filtros de la cola como píldoras, igual que en Búsqueda (change `revisar-duplicados-comparacion`):
 * «Estado» siempre tiene un valor (sin ✕); los demás muestran su valor y una ✕ al estar activos.
 */
export function DuplicateFilters({
  value,
  collections,
  onChange,
}: {
  value: DuplicateFilterValue;
  collections: readonly Pick<CollectionOut, "id" | "name" | "parent_id">[];
  onChange: (next: DuplicateFilterValue) => void;
}) {
  return (
    <ul role="search" aria-label="Filtros de la cola" className="flex flex-wrap items-center gap-2">
      <li className="flex">
        <PillSelect fija label="Estado" value={value.status} options={STATUS_OPTIONS} onChange={(status) => onChange({ ...value, status: (status ?? "") as DuplicateFilterValue["status"] })} />
      </li>
      <li className="flex">
        <PillSelect
          label="Colección"
          accessibleLabel="Colección (incluye sus subcolecciones)"
          allLabel="Todas las colecciones"
          value={value.collectionId || null}
          options={collections.map((collection) => ({ value: collection.id, label: collection.parent_id ? `— ${collection.name}` : collection.name }))}
          onChange={(collectionId) => onChange({ ...value, collectionId: collectionId ?? "" })}
        />
      </li>
      <li className="flex">
        <PillSelect label="Similitud" allLabel="Cualquier similitud" value={value.minScore || null} options={SCORE_OPTIONS} onChange={(minScore) => onChange({ ...value, minScore: minScore ?? "" })} />
      </li>
      <li className="flex">
        <PillSelect
          label="Tipo de par"
          allLabel="Todos los pares"
          value={value.origin || null}
          options={PAIR_TYPE_OPTIONS}
          onChange={(origin) => onChange({ ...value, origin: (origin ?? "") as DuplicateFilterValue["origin"] })}
        />
      </li>
    </ul>
  );
}

// ---------------------------------------------------------------------------------------------
// Similitud, tabla y tarjeta del par
// ---------------------------------------------------------------------------------------------

export type SimilarityLevel = "high" | "medium" | "low";

/** Alta desde 85 %, media desde 70 %, baja por debajo (el nivel se dice también con texto). */
export function similarityLevel(score: number): SimilarityLevel {
  return score >= 0.85 ? "high" : score >= 0.7 ? "medium" : "low";
}

const LEVELS: Record<SimilarityLevel, { label: string; ring: string }> = {
  high: { label: "alta", ring: "var(--color-terracota)" },
  medium: { label: "media", ring: "var(--color-ambar-alerta)" },
  low: { label: "baja", ring: "var(--color-gris-texto)" },
};

/** Anillo con el porcentaje en cifra grande; el nivel va también en palabras. */
export function SimilarityMeter({ score }: { score: number }) {
  const level = LEVELS[similarityLevel(score)];
  const percent = Math.max(0, Math.min(100, Math.round(score * 100)));
  return (
    <div
      className="flex size-32 shrink-0 items-center justify-center rounded-full p-1.5"
      style={{ background: `conic-gradient(${level.ring} ${percent}%, var(--color-borde) 0)` }}
    >
      <div className="flex size-full flex-col items-center justify-center rounded-full bg-white">
        <span className="font-heading text-3xl leading-none font-bold text-tinta">{percent} %</span>
        <span className="mt-1 text-base text-gris-texto">similitud {level.label}</span>
      </div>
    </div>
  );
}

/** Una pieza sin ficha (aún cargando o sin acceso) se indica en su columna. */
type PieceSlot = PieceDetail | null | undefined;

/** Un lado de la comparación: una pieza del catálogo o la fila del Excel de un par. */
export interface ComparisonSide {
  /** «Pieza del catálogo», «Fila del Excel», «Pieza A»… */
  title: string;
  /** Nombre corto para «Solo en …»: «el catálogo», «el Excel», «la pieza A». */
  short: string;
  /** Debajo del título: la pieza con enlace a su ficha, o la fila y su lote. */
  caption: ReactNode;
  /** Valor de cada fila de la comparación, o `null` si el lado aún no se puede leer. */
  values: Partial<Record<ComparisonRowKey, { node: ReactNode; text: string }>> | null;
}

/** El lado de una pieza del catálogo. */
export function pieceSide(title: string, short: string, piece: PieceSlot, piecesLoading: boolean, names?: IdentifierTypeNames): ComparisonSide {
  const caption = piece ? (
    <Link href={`/piezas/${piece.id}`} className="inline-flex min-h-11 items-center gap-1 font-semibold text-terracota underline">
      {piece.denomination}
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
  ) : (
    <span className="text-gris-texto">{piecesLoading ? "Cargando ficha…" : "Ficha no disponible"}</span>
  );
  return {
    title,
    short,
    caption,
    values: piece ? Object.fromEntries(COMPARISON_ROWS.map((row) => [row.key, { node: row.value(piece, names), text: row.text(piece, names) }])) : null,
  };
}

/** El lado de la fila del Excel de un par (solo sus campos de catálogo; nunca datos personales). */
export function importRowSide(row: ImportRowSummary | null | undefined, names?: IdentifierTypeNames): ComparisonSide {
  if (!row) {
    return { title: "Fila del Excel", short: "el Excel", caption: <span className="text-gris-texto">Sus datos no están disponibles: revísela en su lote.</span>, values: null };
  }
  const identifiers = row.identifiers ?? [];
  const codeI = identifiers.find((identifier) => identifier.type === "I");
  const others = identifiers.filter((identifier) => identifier.type !== "I");
  const otherText = others.length ? others.map((identifier) => `${identifierTypeName(identifier.type, names)} ${identifier.original_value}`).join(" · ") : "—";
  const text = (value: string | null | undefined) => ({ node: value ?? "—", text: value ?? "" });
  return {
    title: "Fila del Excel",
    short: "el Excel",
    caption: (
      <span className="text-base text-gris-texto">
        Fila {row.source_row_number} · Lote «{row.batch_name}»
      </span>
    ),
    values: {
      denomination: text(row.denomination),
      collection: { node: row.collection_name ?? "Sin colección", text: row.collection_name ?? "" },
      tenure: { node: row.tenure_regime ? <TenureBadge regime={row.tenure_regime} /> : "—", text: row.tenure_regime ?? "" },
      code_i: { node: <span className="font-mono font-bold text-terracota">{codeI?.original_value ?? "Sin código I"}</span>, text: codeI?.original_value ?? "" },
      identifiers: { node: otherText, text: otherText === "—" ? "" : otherText },
      author: text(row.author),
      provenance: text(row.provenance),
      period: text(row.period_text),
      dimensions: text(row.dimensions_text),
    },
  };
}

const ROW_STATES: Record<Exclude<RowState, "empty">, { label: string; icon: LucideIcon; row: string; tag: string }> = {
  same: { label: "Igual", icon: Equal, row: "", tag: "text-verde-exito" },
  different: { label: "Distinto", icon: EqualNot, row: "bg-ambar-bg/60", tag: "text-ambar-texto" },
  conflict: { label: "En conflicto", icon: TriangleAlert, row: "bg-carmin-bg", tag: "text-carmin-texto" },
};

/** Una fila es diferencia si no es igual ni está vacía en los dos lados. */
export function isDifference(state: RowState): boolean {
  return state === "different" || state === "conflict";
}

/**
 * Comparación campo por campo (change `revisar-duplicados-comparacion`): el campo, el valor de cada
 * lado y si son iguales, distintos, están en conflicto o solo uno lo tiene. Con `onlyDifferences`
 * solo quedan las filas que no son iguales.
 */
export function ComparisonTable({ sideA, sideB, signals, onlyDifferences = false }: { sideA: ComparisonSide; sideB: ComparisonSide; signals: readonly DuplicateSignal[]; onlyDifferences?: boolean }) {
  const marks = markedRows(signals);
  const rows = COMPARISON_ROWS.map((row) => {
    const a = sideA.values?.[row.key];
    const b = sideB.values?.[row.key];
    const state = comparisonRowState(a?.text ?? "", b?.text ?? "", marks.get(row.key));
    const onlyIn = state === "different" ? (isBlank(a?.text ?? "") ? sideB.short : isBlank(b?.text ?? "") ? sideA.short : null) : null;
    return { row, a, b, state, onlyIn };
  }).filter(({ state }) => !onlyDifferences || isDifference(state));
  return (
    <div role="table" aria-label="Comparación campo por campo" className="flex w-full flex-col text-base text-tinta">
      <div role="row" className="hidden grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_11rem] items-end gap-x-4 border-b border-borde px-4 pb-2 sm:grid">
        <span role="columnheader">
          <span className="sr-only">Campo</span>
        </span>
        <div role="columnheader" className="flex min-w-0 flex-col">
          <span className="text-lg font-extrabold">{sideA.title}</span>
          {sideA.caption}
        </div>
        <div role="columnheader" className="flex min-w-0 flex-col">
          <span className="text-lg font-extrabold">{sideB.title}</span>
          {sideB.caption}
        </div>
        <span role="columnheader">
          <span className="sr-only">Resultado</span>
        </span>
      </div>
      {rows.length === 0 && (
        <p role="row" className="px-4 py-3 text-gris-texto">
          <span role="cell">No hay diferencias entre las dos.</span>
        </p>
      )}
      {rows.map(({ row, a, b, state, onlyIn }) => {
        const info = state === "empty" ? null : ROW_STATES[state];
        const Icon = onlyIn ? CircleAlert : info?.icon;
        return (
          <div
            key={row.key}
            role="row"
            data-mark={state === "same" ? "match" : state === "empty" ? undefined : state}
            className={cn("grid grid-cols-2 items-center gap-x-4 gap-y-1 border-b border-borde px-4 py-2 last:border-b-0 sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_11rem]", info?.row)}
          >
            <div role="rowheader" className="col-span-2 font-semibold text-gris-texto sm:col-span-1">
              {row.label}
            </div>
            <div role="cell" className="min-w-0 break-words">
              <span className="sr-only">{sideA.title}: </span>
              {sideA.values ? (a?.node ?? "—") : "—"}
            </div>
            <div role="cell" className="min-w-0 break-words">
              <span className="sr-only">{sideB.title}: </span>
              {sideB.values ? (b?.node ?? "—") : "—"}
            </div>
            <div role="cell" className="col-span-2 sm:col-span-1">
              {info && Icon && (
                <span className={cn("inline-flex items-center gap-1.5 font-bold", onlyIn ? "text-gris-texto" : info.tag)}>
                  <Icon size={18} aria-hidden="true" className="shrink-0" />
                  {onlyIn ? `Solo en ${onlyIn}` : info.label}
                </span>
              )}
              {!info && <span className="text-gris-texto">Sin dato en ninguno</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Los motivos del par en palabras, sin porcentajes: «Denominación igual», «Misma colección…». */
export function SignalChips({ signals }: { signals: readonly DuplicateSignal[] }) {
  const names = useIdentifierTypeNames();
  const labels = [...new Set(signals.map((signal) => signalLabel(signal, names)))];
  if (labels.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Por qué se propone">
      {labels.map((label) => (
        <li key={label} className="rounded-full border border-borde bg-white px-3 py-1 text-base font-semibold text-tinta">
          {label}
        </li>
      ))}
    </ul>
  );
}

/** El detalle de cada señal con los valores comparados, plegado. */
export function SignalList({ signals }: { signals: readonly DuplicateSignal[] }) {
  const names = useIdentifierTypeNames();
  if (signals.length === 0) return null;
  return (
    <details className="text-base">
      <summary className="flex min-h-11 cursor-pointer items-center rounded-sm text-gris-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota">
        Ver por qué se propone
      </summary>
      <ul className="mt-2 flex flex-col gap-1.5">
        {signals.map((signal, index) => {
          const lines = signalValueLines(signal);
          return (
            <li key={`${signal.field}-${index}`} className="rounded-md border border-borde p-2 text-base text-tinta">
              <p className="font-medium">
                {signalLabel(signal, names)} · similitud {scorePercent(signal.similarity)}
                {signal.contribution != null && <span className="text-gris-texto"> · aporta {scorePercent(signal.contribution)}</span>}
              </p>
              {lines.map((line, lineIndex) => (
                <p key={lineIndex} className="text-gris-texto">
                  {line.label && <span>{line.label}: </span>}A «{line.a}» · B «{line.b}»
                </p>
              ))}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export interface DuplicateCandidateCardProps {
  candidate: DuplicateCandidate;
  pieceA: PieceSlot;
  pieceB: PieceSlot;
  piecesLoading: boolean;
  /** Permiso `duplicates.resolve`: sin él no se muestran las acciones. */
  canResolve: boolean;
  onMerge: () => void;
  onDistinct: () => void;
  onPostpone: () => void;
  /** Permiso `imports.prepare`: decidir desde aquí la fila del Excel de un par. */
  canDecideRow?: boolean;
  /** Decide la fila del Excel: corresponde a la pieza del par (`same`) o es nueva (`new`). */
  onRowDecision?: (choice: ImportRowChoice) => void;
  /** Mientras se guarda una decisión sobre la fila. */
  deciding?: boolean;
  /** Error al decidir la fila, junto a los botones. */
  decisionError?: string | null;
  /** «Par N de M» con anterior y siguiente; sin esto no se muestra. */
  position?: { index: number; total: number; onPrevious?: () => void; onNext?: () => void };
  onClose?: () => void;
  /** Para mover el foco al título al abrir el par siguiente. */
  headingRef?: React.Ref<HTMLHeadingElement>;
}

/** Una decisión grande con lo que pasará al elegirla. */
function DecisionButton({
  tone,
  title,
  detail,
  disabled,
  describedBy,
  onClick,
}: {
  tone: "same" | "distinct" | "later";
  title: string;
  detail?: string;
  disabled?: boolean;
  describedBy?: string;
  onClick: () => void;
}) {
  if (tone === "later") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="inline-flex min-h-11 items-center justify-center rounded-full px-4 text-base font-bold text-gris-texto hover:bg-crema-light hover:text-tinta focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota disabled:opacity-50"
      >
        {title}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-describedby={describedBy}
      className={cn(
        "flex min-h-11 flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota disabled:cursor-not-allowed disabled:opacity-50",
        tone === "same" ? "border-verde-exito bg-verde-exito text-white hover:brightness-95" : "border-borde bg-white text-tinta hover:border-gris-texto",
      )}
    >
      <span className="inline-flex items-center gap-2 text-lg font-extrabold">
        {tone === "same" && <Check size={20} aria-hidden="true" />}
        {title}
      </span>
      {detail && <span className={cn("text-base", tone === "same" ? "text-white" : "text-gris-texto")}>{detail}</span>}
    </button>
  );
}

/** Lo que ya decidió el lote sobre la fila, o por qué no se puede decidir desde aquí. */
function rowBlockNote(row: ImportRowSummary | null | undefined, canDecideRow: boolean): ReactNode {
  if (!row) return "No se pudieron leer los datos de la fila: decídala en su lote de importación.";
  if (row.resolution === "piece") return "Su lote ya decidió que la fila actualiza esta pieza.";
  if (row.resolution === "new") return "Su lote ya decidió que la fila entra como pieza nueva.";
  if (!row.editable) return "Su lote ya no admite cambios (se aprobó o se abandonó).";
  if (!canDecideRow) return "Decidir la fila le corresponde a quien prepara la carga.";
  return null;
}

export function DuplicateCandidateCard({
  candidate,
  pieceA,
  pieceB,
  piecesLoading,
  canResolve,
  onMerge,
  onDistinct,
  onPostpone,
  canDecideRow = false,
  onRowDecision,
  deciding = false,
  decisionError = null,
  position,
  onClose,
  headingRef,
}: DuplicateCandidateCardProps) {
  const names = useIdentifierTypeNames();
  const noteId = useId();
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const isImportRow = candidate.piece_b_id === null;
  const row = candidate.import_row;
  const sideA = pieceSide(isImportRow ? "Pieza del catálogo" : "Pieza A", isImportRow ? "el catálogo" : "la pieza A", pieceA, piecesLoading, names);
  const sideB = isImportRow ? importRowSide(row, names) : pieceSide("Pieza B", "la pieza B", pieceB, piecesLoading, names);
  const mergeNote = isImportRow ? null : mergeUnavailableReason(candidate, pieceA, pieceB, piecesLoading);
  const rowNote = isImportRow ? rowBlockNote(row, canDecideRow && Boolean(onRowDecision)) : null;
  const blockNote = isImportRow ? rowNote : mergeNote;
  const pieceName = pieceA?.denomination ?? "la pieza del catálogo";
  const words = SIMILARITY_WORDS[similarityLevel(candidate.score)];
  const blocked = mergeBlock(candidate, pieceA, pieceB)?.code === "merge_blocked_inventory_code";

  return (
    // Las etiquetas (`Badge`, 14 px) suben a 16 px solo aquí, sin tocar el átomo de la Base (C28).
    <section aria-label="Revisión del par" className="flex flex-col [&_span.rounded-full]:text-base">
      <div className="flex flex-wrap items-center gap-3 border-b border-borde px-4 py-3 sm:px-5">
        <h3 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold text-tinta focus-visible:outline-none">
          ¿Es la misma pieza?
        </h3>
        <span className="rounded-full bg-ambar-bg px-3 py-1 text-base font-bold text-ambar-texto">{words}</span>
        <span className="rounded-full bg-ciruela-bg px-3 py-1 text-base font-bold text-ciruela">{isImportRow ? "Pieza y fila de un Excel" : "Dos piezas del catálogo"}</span>
        {candidate.status !== "PENDING" && <StatusBadge status={duplicateStatus(candidate.status)} />}
        <span className="flex-1" />
        {position && (
          <nav aria-label="Pares de la cola" className="flex items-center gap-1.5 text-base font-semibold text-gris-texto">
            <Button variant="secondary" size="sm" aria-label="Par anterior" disabled={!position.onPrevious} onClick={position.onPrevious} className="size-11 p-0">
              <ChevronLeft size={18} aria-hidden="true" />
            </Button>
            <span>
              Par {position.index} de {position.total}
            </span>
            <Button variant="secondary" size="sm" aria-label="Par siguiente" disabled={!position.onNext} onClick={position.onNext} className="size-11 p-0">
              <ChevronRight size={18} aria-hidden="true" />
            </Button>
          </nav>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar la revisión"
            className="grid min-h-11 size-11 place-items-center rounded-full border border-borde hover:bg-crema-light focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota"
          >
            <X size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-borde bg-crema-light px-4 py-2.5 sm:px-5">
        <span className="text-base text-gris-texto">Se propone porque:</span>
        <SignalChips signals={candidate.matched_fields} />
        {blocked && <Badge intent="danger">Códigos I distintos: no se puede fusionar</Badge>}
        <span className="flex-1" />
        <button
          type="button"
          role="switch"
          aria-checked={onlyDifferences}
          onClick={() => setOnlyDifferences((value) => !value)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-base font-semibold text-tinta focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota"
        >
          <span aria-hidden="true" className={cn("relative h-6 w-10 rounded-full transition-colors", onlyDifferences ? "bg-terracota" : "bg-borde")}>
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-[left]", onlyDifferences ? "left-[1.125rem]" : "left-0.5")} />
          </span>
          Solo diferencias
        </button>
      </div>

      {(candidate.status === "POSTPONED" && candidate.postponed_until) || candidate.resolution_note ? (
        <div className="flex flex-col gap-1 px-4 pt-3 sm:px-5">
          {candidate.status === "POSTPONED" && candidate.postponed_until && (
            <p className="text-base text-gris-texto">Pospuesto hasta el {formatDate(candidate.postponed_until)}; después vuelve a pendiente.</p>
          )}
          {candidate.resolution_note && <p className="text-base text-gris-texto">Motivo registrado: {candidate.resolution_note}</p>}
        </div>
      ) : null}

      <div className="py-1">
        <ComparisonTable sideA={sideA} sideB={sideB} signals={candidate.matched_fields} onlyDifferences={onlyDifferences} />
      </div>

      {canResolve && canBeResolved(candidate) && (
        <div className="flex flex-col gap-2 border-t border-borde px-4 py-4 sm:px-5">
          <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr_auto] sm:items-stretch">
            {isImportRow ? (
              <>
                <DecisionButton
                  tone="same"
                  title="Es la misma pieza"
                  detail={`La fila actualizará «${pieceName}» al aprobar la carga, en vez de crear una pieza nueva.`}
                  disabled={rowNote !== null || deciding}
                  describedBy={rowNote ? noteId : undefined}
                  onClick={() => onRowDecision?.("same")}
                />
                {rowNote === null ? (
                  <DecisionButton tone="distinct" title="Son piezas distintas" detail="La fila entrará como pieza nueva al aprobar la carga." disabled={deciding} onClick={() => onRowDecision?.("new")} />
                ) : (
                  <DecisionButton tone="distinct" title="Son piezas distintas" detail="El par sale de la cola; queda registrado el motivo." onClick={onDistinct} />
                )}
              </>
            ) : (
              <>
                <DecisionButton
                  tone="same"
                  title="Es la misma pieza"
                  detail="Se fusionan en una sola ficha: elegirá qué datos conservar. No se borra nada."
                  disabled={mergeNote !== null}
                  describedBy={mergeNote ? noteId : undefined}
                  onClick={onMerge}
                />
                <DecisionButton tone="distinct" title="Son piezas distintas" detail="El par sale de la cola; queda registrado el motivo." onClick={onDistinct} />
              </>
            )}
            <DecisionButton tone="later" title="Decidir después" disabled={deciding} onClick={onPostpone} />
          </div>
          {blockNote && (
            <p id={noteId} className="text-base text-gris-texto">
              {blockNote}
              {isImportRow && row && (
                <>
                  {" "}
                  <Link href={importHref({ batchId: row.batch_id })} className="inline-flex min-h-11 items-center font-semibold text-terracota underline">
                    Abrir su lote
                  </Link>
                </>
              )}
            </p>
          )}
          {decisionError && (
            <p role="alert" className="rounded-md bg-carmin-bg p-3 text-base text-carmin-texto">
              {decisionError}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Fila compacta (change `revisar-pendientes-unificado`, tareas 3.3 y 3.4; design D4)
// ---------------------------------------------------------------------------------------------

/** Nivel de parecido en palabras, sin el círculo de porcentaje (que sigue en el detalle del par). */
export const SIMILARITY_WORDS: Record<SimilarityLevel, string> = {
  high: "Muy parecidas",
  medium: "Parecidas",
  low: "Poco parecidas",
};

/**
 * Motivo principal por el que se propone el par: un conflicto de códigos I manda (bloquea la
 * fusión); si no, la señal que más aporta al puntaje y, sin aportes, la de mayor similitud.
 */
export function mainSignal(signals: readonly DuplicateSignal[]): DuplicateSignal | null {
  if (signals.length === 0) return null;
  const conflict = signals.find((signal) => signal.signal === "inventory_code_conflict");
  if (conflict) return conflict;
  const byContribution = signals.filter((signal) => signal.contribution != null);
  const pool = byContribution.length > 0 ? byContribution : signals;
  const value = (signal: DuplicateSignal) => (byContribution.length > 0 ? (signal.contribution ?? 0) : signal.similarity);
  return pool.reduce((best, signal) => (value(signal) > value(best) ? signal : best));
}

function RowPiece({ piece, piecesLoading }: { piece: PieceSlot; piecesLoading: boolean }) {
  if (!piece) {
    return <p className="text-base font-semibold text-tinta">{piecesLoading ? "Cargando ficha…" : "ficha no disponible"}</p>;
  }
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <p className="text-lg font-semibold break-words text-tinta">{piece.denomination}</p>
      <p className="text-base break-words text-gris-texto">
        <span className="font-mono font-bold text-terracota">{piece.code_i ? `Código I ${piece.code_i}` : "Sin código I"}</span>
        {" · "}
        {piece.collection?.name ?? "Sin colección"}
      </p>
    </div>
  );
}

export interface DuplicateCandidateRowProps {
  candidate: DuplicateCandidate;
  pieceA: PieceSlot;
  pieceB: PieceSlot;
  piecesLoading: boolean;
  open: boolean;
  onToggle: () => void;
  /** El detalle del par (la tarjeta de comparación y sus acciones), solo cuando está abierto. */
  children?: ReactNode;
}

/**
 * Una fila por par: las dos piezas, el nivel de parecido en palabras, el motivo principal y
 * «Revisar», que despliega el detalle en el mismo lugar. En celular las dos piezas se apilan y el
 * botón ocupa todo el ancho.
 */
export function DuplicateCandidateRow({ candidate, pieceA, pieceB, piecesLoading, open, onToggle, children }: DuplicateCandidateRowProps) {
  const names = useIdentifierTypeNames();
  const detailId = `pair-detail-${candidate.id}`;
  const isImportRow = candidate.piece_b_id === null;
  const reason = mainSignal(candidate.matched_fields);
  const words = SIMILARITY_WORDS[similarityLevel(candidate.score)];
  return (
    <li>
      <article
        aria-label={`Par: ${words.toLowerCase()}`}
        className={cn("overflow-hidden rounded-tarjeta border bg-white shadow-sm", open ? "border-2 border-terracota shadow-md" : "border-borde")}
      >
        {/* Abierto, la revisión reemplaza al resumen: no se repiten las dos piezas (revisar-duplicados-comparacion). */}
        <div className={cn("flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center", open && "hidden")}>
          {/* Las dos piezas en paneles de color suave, separadas por «vs» (maqueta B). */}
          <div className="grid min-w-0 flex-1 items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-3">
            <div className="flex min-w-0 items-center rounded-md bg-ambar-bg p-3">
              <RowPiece piece={pieceA} piecesLoading={piecesLoading} />
            </div>
            <span aria-hidden="true" className="inline-flex size-10 items-center justify-center self-center justify-self-center rounded-full bg-crema text-base font-bold text-gris-texto">
              vs
            </span>
            <div className="flex min-w-0 items-center rounded-md bg-ciruela-bg p-3">
              {isImportRow ? (
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-lg font-semibold break-words text-tinta">{candidate.import_row?.denomination ?? "Fila de importación"}</p>
                  <p className="text-base text-gris-texto">
                    {candidate.import_row ? `Fila ${candidate.import_row.source_row_number} · Lote «${candidate.import_row.batch_name}»` : "Aún no está en el catálogo."}
                  </p>
                </div>
              ) : (
                <RowPiece piece={pieceB} piecesLoading={piecesLoading} />
              )}
            </div>
          </div>
          <div className="flex min-w-0 flex-col items-start gap-1.5 lg:w-56">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-base font-semibold",
                similarityLevel(candidate.score) === "low" ? "bg-borde text-gris-texto" : "bg-ambar-bg text-ambar-texto",
              )}
            >
              {words}
            </span>
            {reason && <p className="text-base text-gris-texto">{signalLabel(reason, names)}</p>}
            {candidate.status !== "PENDING" && <p className="text-base text-tinta">Estado: {duplicateStatus(candidate.status).label}</p>}
          </div>
          <Button
            variant={open ? "secondary" : "primary"}
            aria-expanded={open}
            aria-controls={detailId}
            data-review-toggle=""
            onClick={onToggle}
            className="w-full lg:w-auto"
          >
            {open ? "Cerrar" : "Revisar"}
          </Button>
        </div>
        {open && <div id={detailId}>{children}</div>}
      </article>
    </li>
  );
}

/** Controles de página; se montan encima y debajo de la lista y no se pintan con una sola página. */
export function QueuePager({ page, pageCount, label, onPage }: { page: number; pageCount: number; label: string; onPage: (page: number) => void }) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Anterior
      </Button>
      <span className="text-base text-gris-texto">
        Página {page} de {pageCount}
      </span>
      <Button variant="secondary" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
        Siguiente
      </Button>
    </nav>
  );
}

// ---------------------------------------------------------------------------------------------
// Diálogos de resolución
// ---------------------------------------------------------------------------------------------

const GENERIC_FAILURE = "No se pudo completar la acción. Intente nuevamente.";

/**
 * Etiqueta y ayuda de `Field` (components/ui, de la Base, 14 px) a 16 px en los diálogos de esta vista
 * (prueba humana de HU-04, change `revisar-pendientes-unificado`, 6.2).
 */
const DIALOG_ATOMS = "[&_label]:text-base [&_p]:text-base";

function ResolutionDialog({
  open,
  onClosed,
  title,
  description,
  submitLabel,
  submitIcon,
  busy,
  error,
  onSubmit,
  children,
}: {
  open: boolean;
  onClosed: () => void;
  title: string;
  description: ReactNode;
  submitLabel: string;
  submitIcon: typeof Split;
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClosed}
      className={cn("m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-borde bg-white p-0 text-tinta backdrop:bg-tinta/40", DIALOG_ATOMS)}
    >
      <form
        noValidate
        className="flex flex-col gap-4 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <h2 id={titleId} className="text-lg font-semibold text-tinta">
          {title}
        </h2>
        <div className="text-base text-gris-texto">{description}</div>
        {children}
        {busy && (
          <p role="status" className="text-base font-medium text-gris-texto">
            Procesando…
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-md bg-carmin-bg p-3 text-base text-carmin-texto">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" disabled={busy} onClick={() => dialogRef.current?.close()}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" icon={submitIcon} disabled={busy}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}

/** Estado de envío de un diálogo de resolución: bloquea reenvíos y guarda el mensaje de error. */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<DialogOutcome>, onOk: () => void) {
    if (busy) return;
    setBusy(true);
    setError(null);
    let outcome: DialogOutcome;
    try {
      outcome = await action();
    } catch {
      outcome = { ok: false, message: GENERIC_FAILURE };
    }
    setBusy(false);
    if (outcome.ok) onOk();
    else setError(outcome.message);
  }

  return {
    busy,
    error,
    run,
    reset() {
      setBusy(false);
      setError(null);
    },
  };
}

export function DistinctDialog({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (note: string) => Promise<DialogOutcome> }) {
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const submit = useSubmit();

  return (
    <ResolutionDialog
      open={open}
      onClosed={() => {
        setNote("");
        setNoteError(null);
        submit.reset();
        onClose();
      }}
      title="Marcar como piezas distintas"
      description="Son piezas distintas aunque se parezcan. El par no vuelve a la cola mientras no cambien sus datos."
      submitLabel="Marcar como distinto"
      submitIcon={Split}
      busy={submit.busy}
      error={submit.error}
      onSubmit={() => {
        if (!note.trim()) {
          setNoteError(DISTINCT_REASON_REQUIRED);
          return;
        }
        void submit.run(() => onSubmit(note.trim()), onClose);
      }}
    >
      <Textarea
        label="Motivo (obligatorio)"
        required
        rows={2}
        value={note}
        error={noteError ?? undefined}
        onChange={(event) => {
          setNote(event.target.value);
          setNoteError(null);
        }}
      />
    </ResolutionDialog>
  );
}

export function PostponeDialog({
  open,
  today,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** Fecha de referencia para los límites (se fija al abrir el diálogo). */
  today: Date;
  onClose: () => void;
  onSubmit: (postponedUntil: string, note: string) => Promise<DialogOutcome>;
}) {
  const bounds = postponeBounds(today);
  const [date, setDate] = useState(bounds.suggested);
  const [note, setNote] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);
  const submit = useSubmit();

  return (
    <ResolutionDialog
      open={open}
      onClosed={() => {
        setDate(postponeBounds(new Date()).suggested);
        setNote("");
        setDateError(null);
        submit.reset();
        onClose();
      }}
      title="Posponer la revisión"
      description="El par sale de los pendientes hasta esa fecha (máximo 180 días) y luego vuelve solo."
      submitLabel="Posponer"
      submitIcon={CalendarClock}
      busy={submit.busy}
      error={submit.error}
      onSubmit={() => {
        const until = postponedUntilFromDate(date);
        const problem = postponementError(until, new Date());
        if (problem || !until) {
          setDateError(problem?.message ?? "Elija una fecha válida.");
          return;
        }
        void submit.run(() => onSubmit(until, note.trim()), onClose);
      }}
    >
      <Input
        type="date"
        className="min-h-11"
        label="Posponer hasta"
        hint={`Entre el ${formatDate(postponedUntilFromDate(bounds.min))} y el ${formatDate(postponedUntilFromDate(bounds.max))}.`}
        required
        min={bounds.min}
        max={bounds.max}
        value={date}
        error={dateError ?? undefined}
        onChange={(event) => {
          setDate(event.target.value);
          setDateError(null);
        }}
      />
      <Textarea label="Motivo (opcional)" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
    </ResolutionDialog>
  );
}

// ---------------------------------------------------------------------------------------------
// Detección completa
// ---------------------------------------------------------------------------------------------

export const SCAN_HINT =
  "Compara todas las piezas entre sí. No suele hacer falta: el sistema ya busca duplicados solo cada vez que se crea o edita una pieza. Úselo después de una carga masiva.";

/** Avance de la detección en una línea: «Revisando el catálogo… 3 303 de 10 312 piezas». */
export function scanLineText(job: QualityJob): string {
  if (job.status === "RUNNING") {
    if (job.total_pieces === 0) return `Revisando el catálogo… ${SCAN_STARTING_TEXT}`;
    return `Revisando el catálogo… ${job.processed_pieces.toLocaleString("es-PE")} de ${job.total_pieces.toLocaleString("es-PE")} piezas`;
  }
  if (job.status === "FAILED") return job.error_message || "La revisión se interrumpió. Puede lanzarla de nuevo.";
  const fresh = job.candidates_created + job.candidates_reopened;
  return `Revisión completa: ${fresh === 0 ? "ningún par nuevo" : fresh === 1 ? "1 par nuevo" : `${fresh} pares nuevos`}`;
}

/**
 * Detección completa (design D3) como un botón discreto junto al número de pares (change
 * `revisar-duplicados-comparacion`): casi nunca hace falta, porque la detección corre sola al crear
 * o editar piezas. La explicación va en el título del botón y para lectores de pantalla; mientras
 * corre, el avance se ve en la misma línea con una barra pequeña.
 */
export function ScanPanel({
  job,
  error,
  starting,
  canScan,
  onStart,
}: {
  job: QualityJob | null;
  error: string | null;
  starting: boolean;
  canScan: boolean;
  onStart: () => void;
}) {
  const hintId = useId();
  const running = job?.status === "RUNNING";
  const percent = running && job.total_pieces > 0 ? Math.round((job.processed_pieces / job.total_pieces) * 100) : 0;
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
      {job && (
        <p role="status" className="flex flex-wrap items-center gap-2 text-base text-tinta">
          {running ? (
            <>
              <span>{scanLineText(job)}</span>
              <span aria-hidden="true" className="h-2 w-32 overflow-hidden rounded-full bg-anil-bg">
                <span className="block h-full rounded-full bg-anil" style={{ width: `${percent}%` }} />
              </span>
            </>
          ) : (
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold", job.status === "FAILED" ? "bg-carmin-bg text-carmin-texto" : "bg-verde-bg text-verde-exito")}>
              {job.status !== "FAILED" && <Check size={16} aria-hidden="true" />}
              {scanLineText(job)}
            </span>
          )}
        </p>
      )}
      {canScan && !running && (
        <>
          <button
            type="button"
            onClick={onStart}
            disabled={starting}
            title={SCAN_HINT}
            aria-describedby={hintId}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-transparent px-3 text-base font-bold text-gris-texto hover:border-borde hover:bg-white hover:text-tinta focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota disabled:opacity-60"
          >
            <ScanSearch size={18} aria-hidden="true" />
            {starting ? "Iniciando…" : "Revisar todo el catálogo"}
          </button>
          <span id={hintId} className="sr-only">
            {SCAN_HINT}
          </span>
        </>
      )}
      {error && (
        <p role="alert" className="w-full rounded-md bg-carmin-bg p-3 text-base text-carmin-texto">
          {error}
        </p>
      )}
    </div>
  );
}
