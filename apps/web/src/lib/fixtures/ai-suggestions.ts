/**
 * Sugerencias del proveedor de IA simulado (services/ai, `AI_PROVIDER=mock`), siempre con estado
 * pendiente hasta que una persona aprueba, edita o rechaza (RN-009). Ninguna se aplica sola.
 */
import type { ApiSchemas } from "@/lib/api/client";

import { ids } from "./ids";

type AiSuggestionOut = ApiSchemas["AiSuggestionOut"];

export const AI_SUGGESTIONS: AiSuggestionOut[] = [
  {
    id: ids.aiSuggestion(1),
    function_code: "RIA_01",
    piece_id: ids.piece(14),
    import_batch_id: ids.importBatch(1),
    provider: "mock",
    model: "matp-mock-extract-v1",
    status: "PENDING",
    input_data: {
      texto_origen:
        "Cántaro de cerámica con decoración geométrica, hallado en Puno, buen estado, sin restauraciones visibles.",
    },
    output_data: {
      category: "CERAMICA",
      conservation_status: "BUENO",
      provenance: "Puno",
      confidence: 0.82,
    },
    approved_data: null,
    rejection_reason: null,
    requested_by_id: ids.user(3),
    reviewed_by_id: null,
    reviewed_at: null,
    created_at: "2026-09-10T09:05:00Z",
  },
  {
    id: ids.aiSuggestion(2),
    function_code: "RIA_03",
    piece_id: ids.piece(9),
    import_batch_id: null,
    provider: "mock",
    model: "matp-mock-terms-v1",
    status: "PENDING",
    input_data: { titulo: "Charango", descripcion: "Charango de caja completa, tapa de madera." },
    output_data: { suggested_terms: ["INSTRUMENTO_MUSICAL"], vocabulary_code: "CATEGORY", confidence: 0.91 },
    approved_data: null,
    rejection_reason: null,
    requested_by_id: ids.user(4),
    reviewed_by_id: null,
    reviewed_at: null,
    created_at: "2026-09-12T15:00:00Z",
  },
  {
    id: ids.aiSuggestion(3),
    function_code: "RIA_04",
    piece_id: ids.piece(7),
    import_batch_id: null,
    provider: "mock",
    model: "matp-mock-describe-v1",
    status: "APPROVED",
    input_data: { metadatos: { categoria: "MATE_BURILADO", provenance: "Junín" } },
    output_data: { description: "Conjunto de mates burilados con escenas costumbristas de Junín." },
    approved_data: { description: "Conjunto de dos mates burilados con escenas de cosecha y fiesta patronal." },
    rejection_reason: null,
    requested_by_id: ids.user(2),
    reviewed_by_id: ids.user(2),
    reviewed_at: "2026-03-21T09:00:00Z",
    created_at: "2026-03-20T09:00:00Z",
  },
  {
    id: ids.aiSuggestion(4),
    function_code: "RIA_01",
    piece_id: ids.piece(4),
    import_batch_id: ids.importBatch(1),
    provider: "mock",
    model: "matp-mock-extract-v1",
    status: "REJECTED",
    input_data: { texto_origen: "Cajón San Marcos, S/N, madera, sin más datos." },
    output_data: { category: "RETABLO", confidence: 0.44 },
    approved_data: null,
    rejection_reason: "Confianza demasiado baja (0.44): se prefiere completar el dato manualmente.",
    requested_by_id: ids.user(3),
    reviewed_by_id: ids.user(2),
    reviewed_at: "2026-09-11T09:00:00Z",
    created_at: "2026-09-10T09:10:00Z",
  },
];
