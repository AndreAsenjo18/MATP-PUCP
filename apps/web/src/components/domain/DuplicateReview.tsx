"use client";

/**
 * Piezas de la cola de duplicados (change `deteccion-duplicados-y-cola-revision`, tarea 4.1; spec
 * calidad-datos, RF-030, RNF-010):
 *
 * - `DuplicateFilters`: estado, colección, puntaje mínimo y origen.
 * - `DuplicateCandidateCard`: similitud en cifra grande (`SimilarityMeter`), señales como etiquetas
 *   y comparación de las dos fichas con el campo al centro (A | campo | B); cada fila es igual,
 *   distinta o en conflicto, con color, palabra e icono (el color nunca es el único portador).
 * - `QueuePager`: «Anterior / Siguiente» que la pantalla monta encima y debajo de la lista.
 * - `DistinctDialog` y `PostponeDialog`: resolución como distinto (motivo obligatorio) o pospuesto
 *   hasta una fecha de como máximo 180 días (design D5).
 * - `ScanPanel`: detección completa bajo demanda y su avance (design D3).
 *
 * Son presentacionales: reciben datos y acciones (`Promise<DialogOutcome>`) y no llaman a la API.
 * «Fusionar» abre el asistente de la tarea 4.2 (`MergeWizard`); queda deshabilitado, con el motivo
 * a la vista, si el par está bloqueado (regímenes o códigos I distintos) o si es una fila de
 * importación, que se decide en su lote.
 */
import { ArrowRight, CalendarClock, Equal, EqualNot, GitMerge, ScanSearch, Split, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { ApiSchemas } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { IMPORT_ROW_MERGE_MESSAGE, mergeBlock } from "@/lib/data/merge-plan";
import {
  postponeBounds,
  postponedUntilFromDate,
  postponementError,
  type DuplicateCandidate,
  type DuplicateOrigin,
  type DuplicateStatus,
  type QualityJob,
} from "@/lib/data/duplicates";

import type { DialogOutcome } from "./PieceActionDialogs";
import { duplicateStatus, qualityJobStatus } from "./status-intents";
import { StatusBadge, TenureBadge } from "./StatusBadges";

type PieceDetail = ApiSchemas["PieceDetail"];
type DuplicateSignal = DuplicateCandidate["matched_fields"][number];
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

/** Texto de cada señal del motor por reglas (design D1); lo desconocido es «Otro dato». */
export function signalLabel(signal: DuplicateSignal, names: IdentifierTypeNames = {}): string {
  const type = identifierType(signal.field);
  switch (signal.signal) {
    case "identifier":
      return type ? `Coincide: ${identifierTypeName(type, names)}` : "Coincide un código";
    case "inventory_code_conflict":
      return "Códigos I vigentes distintos";
    case "denomination":
      return "Denominación parecida";
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
    if (signal.signal === "inventory_code_conflict") {
      marks.set("code_i", "conflict");
      continue;
    }
    if (signal.similarity <= 0) continue;
    if (signal.signal === "identifier" || identifierType(signal.field)) mark(identifierType(signal.field) === "I" ? "code_i" : "identifiers");
    else if (signal.signal === "denomination") mark("denomination");
    else if (signal.signal === "collection") mark("collection");
    else if (signal.signal === "epoch") mark("period");
    else if (signal.signal === "dimensions") mark("dimensions");
    else if (signal.signal === "author_provenance") {
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
  { value: "", label: "Cualquiera" },
  { value: "0.6", label: "60 % o más" },
  { value: "0.7", label: "70 % o más" },
  { value: "0.8", label: "80 % o más" },
  { value: "0.9", label: "90 % o más" },
];

/**
 * Legibilidad de los filtros de esta vista (change `revisar-pendientes-unificado`, tarea 3.5): el
 * átomo `Field` de components/ui pone etiqueta y ayuda a 14 px y el control a unos 42 px; aquí se
 * suben a 16 px y 44 px sin tocar el átomo, que es de la Base (C28).
 */
const FILTER_FIELD = "[&_label]:text-base [&_p]:text-base";
const FILTER_CONTROL = "min-h-11";

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
    <form role="search" aria-label="Filtros de la cola" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => event.preventDefault()}>
      <Select fieldClassName={FILTER_FIELD} className={FILTER_CONTROL} label="Estado" value={value.status} onChange={(event) => onChange({ ...value, status: event.target.value as DuplicateFilterValue["status"] })}>
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select
        fieldClassName={FILTER_FIELD}
        className={FILTER_CONTROL}
        label="Colección"
        hint="Incluye sus subcolecciones."
        value={value.collectionId}
        onChange={(event) => onChange({ ...value, collectionId: event.target.value })}
      >
        <option value="">Todas</option>
        {collections.map((collection) => (
          <option key={collection.id} value={collection.id}>
            {collection.parent_id ? `— ${collection.name}` : collection.name}
          </option>
        ))}
      </Select>
      <Select fieldClassName={FILTER_FIELD} className={FILTER_CONTROL} label="Similitud mínima" value={value.minScore} onChange={(event) => onChange({ ...value, minScore: event.target.value })}>
        {SCORE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select fieldClassName={FILTER_FIELD} className={FILTER_CONTROL} label="Origen" value={value.origin} onChange={(event) => onChange({ ...value, origin: event.target.value as DuplicateFilterValue["origin"] })}>
        <option value="">Catálogo e importación</option>
        <option value="CATALOG">Dos piezas del catálogo</option>
        <option value="IMPORT">Fila de importación</option>
      </Select>
    </form>
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

const ROW_STATES: Record<Exclude<RowState, "empty">, { label: string; icon: LucideIcon; row: string; tag: string }> = {
  same: { label: "igual", icon: Equal, row: "", tag: "text-verde-exito" },
  different: { label: "distinto", icon: EqualNot, row: "bg-ambar-bg", tag: "text-ambar-texto" },
  conflict: { label: "conflicto", icon: TriangleAlert, row: "bg-carmin-bg", tag: "text-carmin-texto" },
};

/** Una pieza sin ficha (aún cargando o sin acceso) se indica en su columna. */
type PieceSlot = PieceDetail | null | undefined;

function pieceHeader(title: string, piece: PieceSlot, piecesLoading: boolean): ReactNode {
  if (piece) {
    return (
      <Link href={`/piezas/${piece.id}`} className="inline-flex min-h-11 items-center font-semibold text-terracota underline">
        {title}: {piece.denomination}
      </Link>
    );
  }
  return (
    <span className="font-semibold text-tinta">
      {title}: {piecesLoading ? "cargando ficha…" : "ficha no disponible"}
    </span>
  );
}

function ColumnHeader({ title, piece, piecesLoading }: { title: string; piece: PieceSlot; piecesLoading: boolean }) {
  return (
    <div role="columnheader" className="min-w-0 text-center text-lg break-words">
      {pieceHeader(title, piece, piecesLoading)}
    </div>
  );
}

const GRID = "grid grid-cols-2 gap-x-3 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)]";

export function ComparisonTable({ pieceA, pieceB, signals, piecesLoading }: { pieceA: PieceSlot; pieceB: PieceSlot; signals: readonly DuplicateSignal[]; piecesLoading: boolean }) {
  const marks = markedRows(signals);
  const names = useIdentifierTypeNames();
  return (
    <div role="table" aria-label="Comparación de las dos piezas, campo por campo" className="mx-auto flex w-full max-w-4xl flex-col text-base text-tinta">
      <div role="row" className={cn(GRID, "items-end border-b border-borde px-2 pb-2")}>
        <div className="order-1 sm:order-1">
          <ColumnHeader title="Pieza A" piece={pieceA} piecesLoading={piecesLoading} />
        </div>
        <div role="columnheader" className="order-2 hidden text-center text-base font-medium text-gris-texto sm:order-2 sm:block">
          Campo
        </div>
        <div className="order-3">
          <ColumnHeader title="Pieza B" piece={pieceB} piecesLoading={piecesLoading} />
        </div>
      </div>
      {COMPARISON_ROWS.map((row) => {
        const state = comparisonRowState(pieceA ? row.text(pieceA, names) : "", pieceB ? row.text(pieceB, names) : "", marks.get(row.key));
        const info = state === "empty" ? null : ROW_STATES[state];
        const Icon = info?.icon;
        return (
          <div
            key={row.key}
            role="row"
            data-mark={state === "same" ? "match" : state === "empty" ? undefined : state}
            className={cn(GRID, "items-center gap-y-0.5 border-b border-borde px-2 py-1.5 last:border-b-0", info?.row)}
          >
            <div role="rowheader" className="order-1 col-span-2 flex items-center justify-center gap-2 text-center text-base font-medium text-gris-texto sm:order-2 sm:col-span-1 sm:flex-col sm:gap-0.5">
              {row.label}
              {info && Icon && (
                <span className={cn("inline-flex items-center gap-1 font-semibold", info.tag)}>
                  <Icon size={16} aria-hidden="true" />
                  {info.label}
                </span>
              )}
            </div>
            <div role="cell" className="order-2 min-w-0 text-center break-words sm:order-1">
              {pieceA ? row.value(pieceA, names) : "—"}
            </div>
            <div role="cell" className="order-3 min-w-0 text-center break-words">
              {pieceB ? row.value(pieceB, names) : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Etiquetas cortas con las señales del motor: «Denominación parecida 100 %». */
export function SignalChips({ signals }: { signals: readonly DuplicateSignal[] }) {
  const names = useIdentifierTypeNames();
  if (signals.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Por qué se propone">
      {signals.map((signal, index) => (
        <li key={`${signal.field}-${index}`} className="rounded-full bg-crema px-3 py-1 text-base text-tinta">
          {signalLabel(signal, names)} <span className="font-semibold">{scorePercent(signal.similarity)}</span>
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

/**
 * Las etiquetas (`Badge` de components/ui, 14 px) de la tarjeta suben a 16 px solo en esta vista
 * (change `revisar-pendientes-unificado`, tarea 3.5), sin tocar el átomo, que es de la Base (C28).
 */
const CARD_BADGES = "[&_span.rounded-full]:text-base";

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
}

export function DuplicateCandidateCard({ candidate, pieceA, pieceB, piecesLoading, canResolve, onMerge, onDistinct, onPostpone }: DuplicateCandidateCardProps) {
  const isImportRow = candidate.piece_b_id === null;
  const mergeNote = isImportRow ? IMPORT_ROW_MERGE_MESSAGE : mergeUnavailableReason(candidate, pieceA, pieceB, piecesLoading);
  return (
    <Card as="article" className={cn("flex flex-col gap-4", CARD_BADGES)} aria-label={`Par con similitud ${scorePercent(candidate.score)}`}>
      <div className="flex flex-wrap items-center gap-4">
        <SimilarityMeter score={candidate.score} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={duplicateStatus(candidate.status)} />
            {isImportRow && <Badge intent="info">Fila de importación</Badge>}
            {mergeBlock(candidate, pieceA, pieceB)?.code === "merge_blocked_inventory_code" && <Badge intent="danger">Códigos I distintos: no se puede fusionar</Badge>}
          </div>
          <SignalChips signals={candidate.matched_fields} />
        </div>
      </div>
      {candidate.status === "POSTPONED" && candidate.postponed_until && (
        <p className="text-base text-gris-texto">Pospuesto hasta el {formatDate(candidate.postponed_until)}; después vuelve a pendiente.</p>
      )}
      {candidate.resolution_note && <p className="text-base text-gris-texto">Motivo registrado: {candidate.resolution_note}</p>}

      {isImportRow ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 rounded-md border border-borde p-3 text-base text-tinta">
            {pieceHeader("Pieza del catálogo", pieceA, piecesLoading)}
            {pieceA && <p className="text-base text-gris-texto">{pieceA.collection?.name ?? "Sin colección"} · Código I {pieceA.code_i ?? "sin asignar"}</p>}
          </div>
          <div className="rounded-md border border-dashed border-borde p-3 text-base text-tinta">
            <p className="font-medium">Fila de importación</p>
            <p className="text-base text-gris-texto">Aún no está en el catálogo: se decide en su lote.</p>
            <Link href="/importacion" className="inline-flex min-h-11 items-center gap-1 text-base text-terracota underline">
              Ver en Importación
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : (
        <ComparisonTable pieceA={pieceA} pieceB={pieceB} signals={candidate.matched_fields} piecesLoading={piecesLoading} />
      )}

      <SignalList signals={candidate.matched_fields} />

      {canResolve && canBeResolved(candidate) && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-3">
            {!isImportRow && (
              <Button
                variant="primary"
                icon={GitMerge}
                disabled={mergeNote !== null}
                aria-describedby={mergeNote ? `merge-note-${candidate.id}` : undefined}
                onClick={onMerge}
              >
                Fusionar
              </Button>
            )}
            <Button variant="outline" icon={Split} onClick={onDistinct}>
              Marcar como distinto
            </Button>
            <Button variant="secondary" icon={CalendarClock} onClick={onPostpone}>
              Posponer
            </Button>
          </div>
          {mergeNote && (
            <p id={`merge-note-${candidate.id}`} className="text-base text-gris-texto">
              {mergeNote}
            </p>
          )}
        </div>
      )}
    </Card>
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
      <article aria-label={`Par: ${words.toLowerCase()}`} className={cn("rounded-lg border bg-white", open ? "border-terracota" : "border-borde")}>
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
            <RowPiece piece={pieceA} piecesLoading={piecesLoading} />
            {isImportRow ? (
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-lg font-semibold text-tinta">Fila de importación</p>
                <p className="text-base text-gris-texto">Aún no está en el catálogo.</p>
              </div>
            ) : (
              <RowPiece piece={pieceB} piecesLoading={piecesLoading} />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1 lg:w-60">
            <p className="text-base font-semibold text-tinta">{words}</p>
            {reason && <p className="text-base text-gris-texto">{signalLabel(reason, names)}</p>}
            {candidate.status !== "PENDING" && <p className="text-base text-tinta">Estado: {duplicateStatus(candidate.status).label}</p>}
          </div>
          <Button
            variant={open ? "secondary" : "outline"}
            aria-expanded={open}
            aria-controls={detailId}
            data-review-toggle=""
            onClick={onToggle}
            className="w-full lg:w-auto"
          >
            {open ? "Cerrar" : "Revisar"}
          </Button>
        </div>
        {open && (
          <div id={detailId} className="border-t border-borde p-4">
            {children}
          </div>
        )}
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
  const running = job?.status === "RUNNING";
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-tinta">Buscar en todo el catálogo</h2>
          <p className="text-base text-gris-texto">Corre sola al crear o editar piezas. Lance una completa tras cambios masivos.</p>
        </div>
        {canScan && (
          <Button variant="outline" icon={ScanSearch} disabled={starting || running} onClick={onStart}>
            {running ? "Detección en curso…" : "Buscar duplicados"}
          </Button>
        )}
      </div>
      {job && (
        <p role="status" className="flex flex-wrap items-center gap-2 text-base text-tinta">
          <StatusBadge status={qualityJobStatus(job.status)} />
          {jobProgressText(job)}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-carmin-bg p-3 text-base text-carmin-texto">
          {error}
        </p>
      )}
    </Card>
  );
}
