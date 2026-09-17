/**
 * Catálogo sintético de piezas para la maqueta (14 piezas), reproduciendo a propósito el "caos
 * de codificación" descrito en CLAUDE.md: códigos sucios, piezas sin código I, comodato,
 * préstamo temporal, conjuntos, época en texto libre y un código ilegible. Mismos títulos,
 * siglas y problemas que `apps/api/app/seed/fixtures.py` y `synthetic.py`, para que la maqueta
 * y el seed real de la API cuenten la misma historia de demostración (RNF-014: solo sintético).
 */
import type { ApiSchemas } from "@/lib/api/client";

import { collectionRef } from "./collections";
import { ids } from "./ids";
import { LOCATION_IDS, locationPath } from "./locations";
import { placeholderPhotoDataUrl } from "./placeholder-image";
import { termRef } from "./reference-data";

type PieceDetail = ApiSchemas["PieceDetail"];
type IdentifierOut = ApiSchemas["IdentifierOut"];
type MediaAssetOut = ApiSchemas["MediaAssetOut"];
type MovementOut = ApiSchemas["MovementOut"];
type SourceRecordOut = ApiSchemas["SourceRecordOut"];
type PieceAlert = ApiSchemas["PieceAlert"];
type PieceLocation = ApiSchemas["PieceLocation"];

function emptyLocation(): PieceLocation {
  return { location_id: null, path: [], is_exact: true };
}

function locatedAt(locationId: string): PieceLocation {
  return { location_id: locationId, path: locationPath(locationId), is_exact: true };
}

function identifier(
  n: number,
  pieceId: string,
  typeCode: string,
  original: string,
  normalized: string | null,
  opts: Partial<IdentifierOut> = {},
): IdentifierOut {
  return {
    id: ids.identifier(n),
    piece_id: pieceId,
    identifier_type_code: typeCode,
    original_value: original,
    normalized_value: normalized,
    detected_format: opts.detected_format ?? null,
    normalization_status: normalized ? "NORMALIZED" : "UNPARSEABLE",
    is_current: opts.is_current ?? true,
    is_locked: opts.is_locked ?? typeCode === "I",
    source: opts.source ?? "Sábana consultoría 2024/25 (sintética)",
    notes: opts.notes ?? null,
    recorded_at: opts.recorded_at ?? "2026-01-15T09:00:00Z",
    replaced_by_id: opts.replaced_by_id ?? null,
  };
}

// --- 1. Toro de Pucará (MMZ) — pieza completa, sirve de referencia "sin alertas" ---
const P1_ID = ids.piece(1);
const P1: PieceDetail = {
  id: P1_ID,
  title: "Toro de Pucará",
  description: "Toro ritual de cerámica vidriada, decoración policroma.",
  collection: collectionRef("MMZ"),
  tenure_regime: "OWNED",
  category: termRef("CATEGORY", "CERAMICA"),
  object_type: termRef("OBJECT_TYPE", "BIEN_MUEBLE"),
  materials: [termRef("MATERIAL", "ARCILLA"), termRef("MATERIAL", "PIGMENTO")],
  conservation_status: termRef("CONSERVATION_STATUS", "BUENO"),
  acquisition_method: termRef("ACQUISITION_METHOD", "DONACION"),
  availability: termRef("AVAILABILITY", "EN_DEPOSITO"),
  author: null,
  provenance: "Puno",
  entry_date: "2019-06-10",
  period: { text: "s. XX", type: "CENTURY", year_from: 1901, year_to: 2000 },
  dimensions: [{ dimension: "alto", unit: "cm", value: 23 }, { dimension: "diámetro", unit: "cm", value: 15 }],
  dimensions_text: "alto 23 cm x diám. 15 cm",
  notes: "Ficha revisada en la consultoría 2024/25.",
  recorded_by: "Practicante Catalogador (sintético)",
  legal_owner: "PUCP",
  lender_name: null,
  loan_agreement_ref: null,
  temporary_inventory_number: null,
  parent_piece_id: null,
  inventory_code: "I-0236",
  identifiers: [
    identifier(101, P1_ID, "I", "I-0236 / M.M.Z. 015", "I-0236", { detected_format: "I-nnnn", notes: "Celda con dos códigos concatenados: se separó en dos identificadores (RF-023)." }),
    identifier(102, P1_ID, "COLLECTION", "M.M.Z. 015", "MMZ-015", { detected_format: "sigla con puntos", is_locked: false }),
  ],
  location: locatedAt(LOCATION_IDS.shelfA2),
  media_count: 1,
  masked_fields: [],
  created_at: "2026-01-15T09:00:00Z",
  updated_at: "2026-06-02T10:30:00Z",
};

// --- 2. Toro de Pucará (3 cuernos) — posible duplicado de la #1, código sucio en minúscula ---
const P2_ID = ids.piece(2);
const P2: PieceDetail = {
  ...P1,
  id: P2_ID,
  title: "Toro de Pucará (3 cuernos)",
  description: "Variante con tres cuernos; ingresado en una carga posterior. Posible duplicado del registro I-0236.",
  entry_date: "2020-03-02",
  notes: "Marcado por el detector de duplicados por similitud de título y colección (RF-030).",
  inventory_code: null,
  identifiers: [identifier(103, P2_ID, "COLLECTION", "mmz 15", "MMZ-015", { detected_format: "minúsculas sin separador", source: "Carga 2020 (sintética)" })],
  location: emptyLocation(),
  media_count: 1,
  created_at: "2020-03-02T09:00:00Z",
  updated_at: "2026-08-05T09:00:00Z",
};

// --- 3. Retablo ayacuchano (RA) — dos códigos en una celda ---
const P3_ID = ids.piece(3);
const P3: PieceDetail = {
  id: P3_ID,
  title: "Retablo ayacuchano",
  description: "Retablo de dos cuerpos con escena costumbrista.",
  collection: collectionRef("RA"),
  tenure_regime: "OWNED",
  category: termRef("CATEGORY", "RETABLO"),
  object_type: termRef("OBJECT_TYPE", "BIEN_MUEBLE"),
  materials: [termRef("MATERIAL", "MADERA"), termRef("MATERIAL", "PASTA_PAPA")],
  conservation_status: termRef("CONSERVATION_STATUS", "REGULAR"),
  acquisition_method: termRef("ACQUISITION_METHOD", "COMPRA"),
  availability: termRef("AVAILABILITY", "EN_SALA"),
  author: null,
  provenance: "Ayacucho",
  entry_date: "2018-11-20",
  period: { text: "ca. 1950", type: "APPROXIMATE", year_from: 1945, year_to: 1955 },
  dimensions: [{ dimension: "alto", unit: "cm", value: 40 }],
  dimensions_text: "alto 40 cm",
  notes: null,
  recorded_by: "Gestor de colecciones (sintético)",
  legal_owner: "PUCP",
  lender_name: null,
  loan_agreement_ref: null,
  temporary_inventory_number: null,
  parent_piece_id: null,
  inventory_code: "I-2362",
  identifiers: [
    identifier(104, P3_ID, "I", "I 2362 / RA 28", "I-2362", { detected_format: "I sin guion", notes: "Celda con dos códigos concatenados: se separó en dos identificadores (RF-023)." }),
    identifier(105, P3_ID, "COLLECTION", "RA 28", "RA-028", { is_locked: false }),
  ],
  location: locatedAt(LOCATION_IDS.room1),
  media_count: 1,
  masked_fields: [],
  created_at: "2018-11-20T09:00:00Z",
  updated_at: "2026-05-11T09:00:00Z",
};

// --- 4. Cajón San Marcos (RAB) — sin código I, sin foto, sin ubicación (3 alertas) ---
const P4_ID = ids.piece(4);
const P4: PieceDetail = {
  id: P4_ID,
  title: "Cajón San Marcos",
  description: "Cajón retablo con figuras de bulto para la festividad de San Marcos.",
  collection: collectionRef("RAB"),
  tenure_regime: "OWNED",
  category: termRef("CATEGORY", "RETABLO"),
  object_type: termRef("OBJECT_TYPE", "BIEN_MUEBLE"),
  materials: [termRef("MATERIAL", "MADERA")],
  conservation_status: null,
  acquisition_method: termRef("ACQUISITION_METHOD", "DESCONOCIDA"),
  availability: termRef("AVAILABILITY", "NO_LOCALIZADA"),
  author: null,
  provenance: "Ayacucho",
  entry_date: null,
  period: { text: "1960-1970", type: "RANGE", year_from: 1960, year_to: 1970 },
  dimensions: null,
  dimensions_text: null,
  notes: "Registrado como \"S/N\" en la sábana de la consultoría: sin código I (RF-004).",
  recorded_by: "Practicante Catalogador (sintético)",
  legal_owner: "PUCP",
  lender_name: null,
  loan_agreement_ref: null,
  temporary_inventory_number: "TMP-0007",
  parent_piece_id: null,
  inventory_code: null,
  identifiers: [identifier(106, P4_ID, "COLLECTION", "RAB", "RAB", { is_locked: false })],
  location: emptyLocation(),
  media_count: 0,
  masked_fields: [],
  created_at: "2026-02-01T09:00:00Z",
  updated_at: "2026-02-01T09:00:00Z",
};

// --- 5. Niño Manuelito (AJB, comodato) — nunca recibe código I (RN-003); fotos restringidas ---
const P5_ID = ids.piece(5);
const P5: PieceDetail = {
  id: P5_ID,
  title: "Niño Manuelito",
  description: "Imagen de bulto policromada, vestida con textiles bordados.",
  collection: collectionRef("AJB"),
  tenure_regime: "LOAN_FOR_USE",
  category: termRef("CATEGORY", "IMAGINERIA"),
  object_type: termRef("OBJECT_TYPE", "BIEN_MUEBLE"),
  materials: [termRef("MATERIAL", "MADERA"), termRef("MATERIAL", "PIGMENTO")],
  conservation_status: termRef("CONSERVATION_STATUS", "BUENO"),
  acquisition_method: termRef("ACQUISITION_METHOD", "COMODATO"),
  availability: termRef("AVAILABILITY", "EN_DEPOSITO"),
  author: null,
  provenance: "Cusco",
  entry_date: "2021-12-01",
  period: { text: "s. XIX", type: "CENTURY", year_from: 1801, year_to: 1900 },
  dimensions: [{ dimension: "alto", unit: "cm", value: 35 }],
  dimensions_text: "alto 35 cm",
  notes: null,
  recorded_by: "Gestor de colecciones (sintético)",
  legal_owner: "PUCP",
  lender_name: "Comodante sintético (sin datos personales reales)",
  loan_agreement_ref: "CONV-AJB-2021-014 (sintético)",
  temporary_inventory_number: null,
  parent_piece_id: null,
  inventory_code: null,
  identifiers: [identifier(107, P5_ID, "OWNER", "AJB 12", "AJB-012", { is_locked: false })],
  location: locatedAt(LOCATION_IDS.deposit2),
  media_count: 1,
  masked_fields: [],
  created_at: "2021-12-01T09:00:00Z",
  updated_at: "2026-04-18T09:00:00Z",
};

// --- 6. Virgen de la Puerta (AJB, comodato) — código I asignado por error y corregido (RN-003) ---
const P6_ID = ids.piece(6);
const P6: PieceDetail = {
  id: P6_ID,
  title: "Virgen de la Puerta",
  description: "Imagen de bulto en yeso policromado.",
  collection: collectionRef("AJB"),
  tenure_regime: "LOAN_FOR_USE",
  category: termRef("CATEGORY", "IMAGINERIA"),
  object_type: termRef("OBJECT_TYPE", "BIEN_MUEBLE"),
  materials: [termRef("MATERIAL", "YESO"), termRef("MATERIAL", "PIGMENTO")],
  conservation_status: termRef("CONSERVATION_STATUS", "REGULAR"),
  acquisition_method: termRef("ACQUISITION_METHOD", "COMODATO"),
  availability: termRef("AVAILABILITY", "EN_DEPOSITO"),
  author: null,
  provenance: "La Libertad",
  entry_date: "2021-12-01",
  period: { text: "fines del s. XIX", type: "APPROXIMATE", year_from: 1880, year_to: 1900 },
  dimensions: null,
  dimensions_text: null,
  notes: "La consultoría 2024/25 había registrado un código I por error: se corrigió como parte de este arranque (RN-003), ver pestaña Auditoría.",
  recorded_by: "Administrador MATP (sintético)",
  legal_owner: "PUCP",
  lender_name: "Comodante sintético (sin datos personales reales)",
  loan_agreement_ref: "CONV-AJB-2021-015 (sintético)",
  temporary_inventory_number: null,
  parent_piece_id: null,
  inventory_code: null,
  identifiers: [
    identifier(108, P6_ID, "I", "I-0999", "I-0999", { is_current: false, is_locked: true, notes: "Asignación errónea: una pieza en comodato nunca recibe código I (RN-003). Retirada mediante corrección auditada." }),
    identifier(109, P6_ID, "OWNER", "AJB 13", "AJB-013", { is_locked: false }),
  ],
  location: locatedAt(LOCATION_IDS.deposit2),
  media_count: 0,
  masked_fields: [],
  created_at: "2021-12-01T09:00:00Z",
  updated_at: "2026-07-01T09:00:00Z",
};

// --- 7/8. Conjunto de mates burilados (MBB) — pieza padre + componente ---
const P7_ID = ids.piece(7);
const P7: PieceDetail = {
  id: P7_ID,
  title: "Juego de mates burilados",
  description: "Conjunto de dos mates burilados con escenas de cosecha y fiesta patronal.",
  collection: collectionRef("MBB"),
  tenure_regime: "OWNED",
  category: termRef("CATEGORY", "MATE_BURILADO"),
  object_type: termRef("OBJECT_TYPE", "CONJUNTO"),
  materials: [termRef("MATERIAL", "CALABAZA")],
  conservation_status: termRef("CONSERVATION_STATUS", "BUENO"),
  acquisition_method: termRef("ACQUISITION_METHOD", "DONACION"),
  availability: termRef("AVAILABILITY", "EN_DEPOSITO"),
  author: null,
  provenance: "Junín",
  entry_date: "2017-05-09",
  period: { text: "3000 años", type: "RELATIVE_AGE", year_from: null, year_to: null },
  dimensions: null,
  dimensions_text: null,
  notes: "Época en texto libre no interpretable de forma estructurada (RF-007): \"3000 años\" tal como figura en la sábana.",
  recorded_by: "Practicante Catalogador (sintético)",
  legal_owner: "PUCP",
  lender_name: null,
  loan_agreement_ref: null,
  temporary_inventory_number: null,
  parent_piece_id: null,
  inventory_code: "I-0450",
  identifiers: [identifier(110, P7_ID, "I", "MBB 40", "I-0450", { detected_format: "sigla de colección usada como I", notes: "Normalizado a código I tras revisión manual." })],
  location: locatedAt(LOCATION_IDS.deposit1),
  media_count: 2,
  masked_fields: [],
  created_at: "2017-05-09T09:00:00Z",
  updated_at: "2026-03-20T09:00:00Z",
};
const P8_ID = ids.piece(8);
const P8: PieceDetail = {
  ...P7,
  id: P8_ID,
  title: "Mate burilado (componente 1)",
  description: "Componente individual del conjunto MBB 40 (escena de cosecha).",
  object_type: termRef("OBJECT_TYPE", "COMPONENTE"),
  dimensions: [{ dimension: "diámetro", unit: "cm", value: 12 }],
  dimensions_text: "diám. 12 cm",
  notes: null,
  parent_piece_id: P7_ID,
  inventory_code: null,
  identifiers: [identifier(111, P8_ID, "COLLECTION", "MBB 40.1", "MBB-040.1", { is_locked: false })],
  media_count: 0,
};

// --- 9. Charango (LRM) — código INC de 4 dígitos + RN de 6 dígitos, sin ubicación ---
const P9_ID = ids.piece(9);
const P9: PieceDetail = {
  id: P9_ID,
  title: "Charango",
  description: "Charango de caja completa, tapa de madera.",
  collection: collectionRef("LRM"),
  tenure_regime: "OWNED",
  category: termRef("CATEGORY", "INSTRUMENTO_MUSICAL"),
  object_type: termRef("OBJECT_TYPE", "BIEN_MUEBLE"),
  materials: [termRef("MATERIAL", "MADERA"), termRef("MATERIAL", "CUERO")],
  conservation_status: termRef("CONSERVATION_STATUS", "BUENO"),
  acquisition_method: termRef("ACQUISITION_METHOD", "DESCONOCIDA"),
  availability: termRef("AVAILABILITY", "EN_DEPOSITO"),
  author: null,
  provenance: "Apurímac",
  entry_date: null,
  period: { text: "desconocida", type: "UNKNOWN", year_from: null, year_to: null },
  dimensions: [{ dimension: "largo", unit: "cm", value: 60 }],
  dimensions_text: "largo 60 cm",
  notes: "El formato del código INC/RN cambió de 4 a 6 dígitos entre consultorías; se conservan ambos históricos (RN-005).",
  recorded_by: "Practicante Catalogador (sintético)",
  legal_owner: "PUCP",
  lender_name: null,
  loan_agreement_ref: null,
  temporary_inventory_number: null,
  parent_piece_id: null,
  inventory_code: null,
  identifiers: [
    identifier(112, P9_ID, "INC_RN", "INC 1234", "INC-1234", { detected_format: "INC 4 dígitos (histórico)", is_current: false, is_locked: false, notes: "Formato anterior a 2020; se conserva como histórico." }),
    identifier(113, P9_ID, "INC_RN", "RN 004521", "RN-004521", { detected_format: "RN 6 dígitos", is_locked: false }),
  ],
  location: emptyLocation(),
  media_count: 1,
  masked_fields: [],
  created_at: "2016-08-30T09:00:00Z",
  updated_at: "2026-01-05T09:00:00Z",
};

// --- 10. Máscara de chuncho — pieza suelta, sin colección ni ningún código (s/c) ---
const P10_ID = ids.piece(10);
const P10: PieceDetail = {
  id: P10_ID,
  title: "Máscara de chuncho",
  description: "Máscara de danza ritual, sin registro de colección de origen.",
  collection: null,
  tenure_regime: "OWNED",
  category: termRef("CATEGORY", "MASCARA"),
  object_type: null,
  materials: [termRef("MATERIAL", "YESO")],
  conservation_status: null,
  acquisition_method: null,
  availability: termRef("AVAILABILITY", "NO_LOCALIZADA"),
  author: null,
  provenance: null,
  entry_date: null,
  period: { text: null, type: null, year_from: null, year_to: null },
  dimensions: null,
  dimensions_text: null,
  notes: "Registrada como \"s/c\" (sin código) en la sábana: pieza suelta sin colección asignada.",
  recorded_by: "Practicante Catalogador (sintético)",
  legal_owner: "PUCP",
  lender_name: null,
  loan_agreement_ref: null,
  temporary_inventory_number: null,
  parent_piece_id: null,
  inventory_code: null,
  identifiers: [],
  location: emptyLocation(),
  media_count: 0,
  masked_fields: [],
  created_at: "2026-02-10T09:00:00Z",
  updated_at: "2026-02-10T09:00:00Z",
};

// --- 11. Tabla pintada de Sarhua (LRM) — código ilegible, no normalizable ---
const P11_ID = ids.piece(11);
const P11: PieceDetail = {
  id: P11_ID,
  title: "Tabla pintada de Sarhua",
  description: "Tabla pintada con escena costumbrista de Sarhua.",
  collection: collectionRef("LRM"),
  tenure_regime: "OWNED",
  category: termRef("CATEGORY", "PINTURA_POPULAR"),
  object_type: termRef("OBJECT_TYPE", "BIEN_MUEBLE"),
  materials: [termRef("MATERIAL", "MADERA"), termRef("MATERIAL", "PIGMENTO")],
  conservation_status: termRef("CONSERVATION_STATUS", "MALO"),
  acquisition_method: termRef("ACQUISITION_METHOD", "DESCONOCIDA"),
  availability: termRef("AVAILABILITY", "EN_RESTAURACION"),
  author: null,
  provenance: "Ayacucho",
  entry_date: null,
  period: { text: "década de 1940", type: "DECADE", year_from: 1940, year_to: 1949 },
  dimensions: null,
  dimensions_text: null,
  notes: "Código de origen ilegible (\"???\" en la sábana); requiere verificación física antes de asignar identificador.",
  recorded_by: "Especialista de Conservación (sintético)",
  legal_owner: "PUCP",
  lender_name: null,
  loan_agreement_ref: null,
  temporary_inventory_number: null,
  parent_piece_id: null,
  inventory_code: null,
  identifiers: [identifier(114, P11_ID, "OTHER", "???", null, { detected_format: null, notes: "No se pudo normalizar: código ilegible en la fuente (RF-023)." })],
  location: emptyLocation(),
  media_count: 0,
  masked_fields: [],
  created_at: "2026-02-10T09:00:00Z",
  updated_at: "2026-02-10T09:00:00Z",
};

// --- 12. Manta tejida (MBB) — pieza completa adicional ---
const P12_ID = ids.piece(12);
const P12: PieceDetail = {
  id: P12_ID,
  title: "Manta tejida",
  description: "Manta de lana con iconografía andina en telar de cuatro estacas.",
  collection: collectionRef("MBB"),
  tenure_regime: "OWNED",
  category: termRef("CATEGORY", "TEXTIL"),
  object_type: termRef("OBJECT_TYPE", "BIEN_MUEBLE"),
  materials: [termRef("MATERIAL", "LANA")],
  conservation_status: termRef("CONSERVATION_STATUS", "REGULAR"),
  acquisition_method: termRef("ACQUISITION_METHOD", "LEGADO"),
  availability: termRef("AVAILABILITY", "EN_DEPOSITO"),
  author: null,
  provenance: "Junín",
  entry_date: "2015-04-02",
  period: { text: "ca. 1930", type: "APPROXIMATE", year_from: 1925, year_to: 1935 },
  dimensions: [{ dimension: "largo", unit: "cm", value: 180 }, { dimension: "ancho", unit: "cm", value: 90 }],
  dimensions_text: "180 x 90 cm",
  notes: null,
  recorded_by: "Gestor de colecciones (sintético)",
  legal_owner: "PUCP",
  lender_name: null,
  loan_agreement_ref: null,
  temporary_inventory_number: null,
  parent_piece_id: null,
  inventory_code: "I-0512",
  identifiers: [identifier(115, P12_ID, "I", "I-0512", "I-0512")],
  location: locatedAt(LOCATION_IDS.shelfB3),
  media_count: 1,
  masked_fields: [],
  created_at: "2015-04-02T09:00:00Z",
  updated_at: "2026-02-14T09:00:00Z",
};

// --- 13. Quena (LRM) — préstamo temporal: no entra al inventario permanente (RN-004) ---
const P13_ID = ids.piece(13);
const P13: PieceDetail = {
  id: P13_ID,
  title: "Quena",
  description: "Quena de caña, recibida para la exposición temporal \"Sonidos del ande\".",
  collection: collectionRef("LRM"),
  tenure_regime: "TEMPORARY_LOAN",
  category: termRef("CATEGORY", "INSTRUMENTO_MUSICAL"),
  object_type: termRef("OBJECT_TYPE", "BIEN_MUEBLE"),
  materials: [termRef("MATERIAL", "MADERA")],
  conservation_status: termRef("CONSERVATION_STATUS", "BUENO"),
  acquisition_method: null,
  availability: termRef("AVAILABILITY", "EN_EXPOSICION_TEMPORAL"),
  author: null,
  provenance: "Cusco",
  entry_date: "2026-08-01",
  period: { text: "s. XX", type: "CENTURY", year_from: 1901, year_to: 2000 },
  dimensions: null,
  dimensions_text: null,
  notes: "Préstamo temporal: no recibe código ni entra al inventario permanente (RN-004).",
  recorded_by: "Gestor de colecciones (sintético)",
  legal_owner: "Prestador externo (sintético)",
  lender_name: "Prestador externo (sintético)",
  loan_agreement_ref: "PREST-2026-003 (sintético)",
  temporary_inventory_number: "TMP-0021",
  parent_piece_id: null,
  inventory_code: null,
  identifiers: [],
  location: locatedAt(LOCATION_IDS.room1),
  media_count: 0,
  masked_fields: [],
  created_at: "2026-08-01T09:00:00Z",
  updated_at: "2026-08-01T09:00:00Z",
};

// --- 14. Cántaro decorado (MMZ) — llegó por importación reciente, con sugerencia de IA pendiente ---
const P14_ID = ids.piece(14);
const P14: PieceDetail = {
  id: P14_ID,
  title: "Cántaro decorado",
  description: "Cántaro de cerámica con decoración geométrica.",
  collection: collectionRef("MMZ"),
  tenure_regime: "OWNED",
  category: termRef("CATEGORY", "CERAMICA"),
  object_type: termRef("OBJECT_TYPE", "BIEN_MUEBLE"),
  materials: [termRef("MATERIAL", "ARCILLA")],
  conservation_status: termRef("CONSERVATION_STATUS", "BUENO"),
  acquisition_method: termRef("ACQUISITION_METHOD", "DONACION"),
  availability: termRef("AVAILABILITY", "EN_DEPOSITO"),
  author: null,
  provenance: "Puno",
  entry_date: "2026-09-10",
  period: { text: "s. XX", type: "CENTURY", year_from: 1901, year_to: 2000 },
  dimensions: null,
  dimensions_text: null,
  notes: "Ingresó en el último lote de importación (ver pestaña Datos de origen y Sugerencias IA).",
  recorded_by: "Practicante Catalogador (sintético)",
  legal_owner: "PUCP",
  lender_name: null,
  loan_agreement_ref: null,
  temporary_inventory_number: null,
  parent_piece_id: null,
  inventory_code: "I-0781",
  identifiers: [identifier(116, P14_ID, "I", "I-0781", "I-0781")],
  location: locatedAt(LOCATION_IDS.shelfA1),
  media_count: 1,
  masked_fields: [],
  created_at: "2026-09-10T09:00:00Z",
  updated_at: "2026-09-10T09:00:00Z",
};

export const PIECES: PieceDetail[] = [P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14];

// --- Alertas de completitud por pieza (RF-019, calidad-datos) ---
const MISSING_FIELDS: Record<string, string[]> = {
  [P4_ID]: ["conservation_status", "acquisition_method"],
  [P9_ID]: ["acquisition_method"],
  [P10_ID]: ["collection", "conservation_status", "acquisition_method", "provenance"],
  [P11_ID]: ["acquisition_method"],
};

export function alertsForPiece(piece: PieceDetail): PieceAlert[] {
  const alerts: PieceAlert[] = [];
  const withoutCode = piece.tenure_regime === "OWNED" && !piece.inventory_code;
  alerts.push({
    type: "WITHOUT_INVENTORY_CODE",
    applies: withoutCode,
    message: withoutCode
      ? "Pieza propia sin código I asignado."
      : piece.tenure_regime === "LOAN_FOR_USE"
        ? "En comodato: nunca recibe código I (RN-003), no es una alerta."
        : piece.tenure_regime === "TEMPORARY_LOAN"
          ? "Préstamo temporal: no entra al inventario permanente (RN-004), no es una alerta."
          : "Tiene código I vigente.",
  });
  alerts.push({
    type: "WITHOUT_PHOTO",
    applies: piece.media_count === 0,
    message: piece.media_count === 0 ? "Sin fotografías registradas." : "Tiene al menos una fotografía.",
  });
  alerts.push({
    type: "WITHOUT_LOCATION",
    applies: piece.location.path.length === 0,
    message: piece.location.path.length === 0 ? "Sin ubicación registrada." : "Tiene ubicación registrada.",
  });
  const missing = MISSING_FIELDS[piece.id] ?? [];
  alerts.push({
    type: "MISSING_REQUIRED_FIELDS",
    applies: missing.length > 0,
    fields: missing,
    message: missing.length > 0 ? `Faltan campos: ${missing.join(", ")}.` : "Campos obligatorios completos.",
  });
  const unparseable = piece.identifiers.some((i) => i.normalization_status === "UNPARSEABLE");
  alerts.push({
    type: "UNPARSEABLE_CODE",
    applies: unparseable,
    message: unparseable ? "Al menos un código de origen no se pudo normalizar." : "Todos los códigos se normalizaron.",
  });
  return alerts;
}

// --- Fotografías (RF-013), 1-2 por pieza con foto ---
function photo(n: number, pieceId: string, title: string, viewCode: string, opts: Partial<MediaAssetOut> = {}): MediaAssetOut {
  const view = termRef("PHOTO_VIEW_TYPE", viewCode);
  return {
    id: ids.media(n),
    piece_id: pieceId,
    view_type: view,
    sort_order: opts.sort_order ?? 0,
    is_primary: opts.is_primary ?? true,
    original_filename: opts.original_filename ?? `${title.toLowerCase().replace(/\s+/g, "-")}-${viewCode.toLowerCase()}.jpg`,
    content_type: "image/jpeg",
    size_bytes: 182_340,
    width_px: 320,
    height_px: 240,
    content_sha256: "sha256-sintetico-" + n,
    download_url: placeholderPhotoDataUrl(title, view.label),
    usage_restriction: opts.usage_restriction ?? termRef("USAGE_RESTRICTION", "SIN_RESTRICCION"),
    restriction_note: opts.restriction_note ?? null,
    photographer: "Equipo MATP (sintético)",
    taken_on: opts.taken_on ?? "2026-01-15",
    created_at: opts.created_at ?? "2026-01-15T09:00:00Z",
  };
}

export const MEDIA_BY_PIECE: Record<string, MediaAssetOut[]> = {
  [P1_ID]: [photo(1, P1_ID, P1.title, "FRONTAL")],
  [P2_ID]: [photo(2, P2_ID, P2.title, "FRONTAL")],
  [P3_ID]: [photo(3, P3_ID, P3.title, "FRONTAL")],
  [P5_ID]: [photo(4, P5_ID, P5.title, "FRONTAL", { usage_restriction: termRef("USAGE_RESTRICTION", "NO_PUBLICAR"), restriction_note: "Comodato: no publicar sin autorización del comodante (RF-014)." })],
  [P7_ID]: [
    photo(5, P7_ID, P7.title, "FRONTAL", { sort_order: 0 }),
    photo(6, P7_ID, P7.title, "DETALLE", { sort_order: 1, is_primary: false }),
  ],
  [P9_ID]: [photo(7, P9_ID, P9.title, "PERFIL")],
  [P12_ID]: [photo(8, P12_ID, P12.title, "FRONTAL")],
  [P14_ID]: [photo(9, P14_ID, P14.title, "FRONTAL")],
};

// --- Movimientos e historial (RF-017) ---
export const MOVEMENTS_BY_PIECE: Record<string, MovementOut[]> = {
  [P1_ID]: [
    { id: ids.movement(1), piece_id: P1_ID, movement_type: "MOVE", from_location: null, to_location: locationPath(LOCATION_IDS.deposit1).at(-1) ?? null, occurred_at: "2019-06-10T09:00:00Z", performed_by_label: "Practicante Catalogador (sintético)", reason: "Ingreso inicial." },
    { id: ids.movement(2), piece_id: P1_ID, movement_type: "MOVE", from_location: locationPath(LOCATION_IDS.deposit1).at(-1) ?? null, to_location: locationPath(LOCATION_IDS.shelfA2).at(-1) ?? null, occurred_at: "2026-06-02T10:30:00Z", performed_by_label: "Auxiliar de Depósito (sintético)", reason: "Reordenamiento de depósito 1." },
    { id: ids.movement(3), piece_id: P1_ID, movement_type: "VERIFICATION", from_location: null, to_location: null, occurred_at: "2026-09-01T08:00:00Z", performed_by_label: "Auxiliar de Depósito (sintético)", reason: "Verificación física trimestral: conforme." },
  ],
  [P5_ID]: [
    { id: ids.movement(4), piece_id: P5_ID, movement_type: "MOVE", from_location: null, to_location: locationPath(LOCATION_IDS.deposit2).at(-1) ?? null, occurred_at: "2021-12-01T09:00:00Z", performed_by_label: "Gestor de colecciones (sintético)", reason: "Ingreso en comodato." },
  ],
  [P13_ID]: [
    { id: ids.movement(5), piece_id: P13_ID, movement_type: "MOVE", from_location: null, to_location: locationPath(LOCATION_IDS.room1).at(-1) ?? null, occurred_at: "2026-08-01T09:00:00Z", performed_by_label: "Gestor de colecciones (sintético)", reason: "Ingreso para exposición temporal." },
  ],
};

// --- Datos de origen preservados sin mapeo (RF-008) ---
function sourceRecord(n: number, pieceId: string, rowNumber: number, payload: Record<string, unknown>): SourceRecordOut {
  return {
    id: ids.sourceRecord(n),
    piece_id: pieceId,
    import_batch_id: null,
    source_name: "Sábana consultoría 2024/25 (sintética)",
    source_row_number: rowNumber,
    recorded_at: "2026-01-15T09:00:00Z",
    source_file_name: "sabana_sintetica_v1.xlsx",
    payload,
  };
}

export const SOURCE_RECORDS_BY_PIECE: Record<string, SourceRecordOut[]> = {
  [P1_ID]: [sourceRecord(1, P1_ID, 1, { "N°": 1, "OBS. CONSULTORÍA": "", "COLUMNA_SIN_MAPEAR": "Vitrina 3 (anotación a mano)" })],
  [P4_ID]: [sourceRecord(2, P4_ID, 4, { "N°": 4, "OBS. CONSULTORÍA": "Sin código I", "COLUMNA_SIN_MAPEAR": "" })],
  [P9_ID]: [sourceRecord(3, P9_ID, 9, { "N°": 9, "OBS. CONSULTORÍA": "INC 4 y 6 dígitos", "COLUMNA_SIN_MAPEAR": "" })],
};
