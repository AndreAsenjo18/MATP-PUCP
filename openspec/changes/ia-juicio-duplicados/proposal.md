## Why

Aun con la comparación campo por campo de `revisar-duplicados-comparacion`, la cola se revisa par por
par: con 102 pares (o miles tras cargar las sábanas del museo) es mucho trabajo manual. El equipo pidió
el 2026-11-15 que Gemini haga el primer juicio y que la persona apruebe por grupo, revisando a mano
solo los dudosos. RIA-02 («Detección de duplicados e inconsistencias por similitud») ya está en el
catálogo; este change lo realiza. Maqueta aprobada: `duplicados con Gemini` (GIF del 2026-11-15).

## What Changes

- Operación nueva del proveedor de IA, `judge_duplicates`: recibe pares (los mismos campos de catálogo
  que la comparación de la cola, sin datos personales) y devuelve por par un veredicto (`same`,
  `distinct`, `unsure`), una confianza y un motivo en una frase en español. `MockProvider` determinista
  por reglas simples.
- Reglas antes que IA: pares con códigos I vigentes distintos (`inventory_code_conflict`) se marcan
  «distintos» por regla, sin llamar a Gemini.
- Trabajo en segundo plano (patrón de `run_full_scan`) que juzga los pares pendientes por lotes, con
  avance consultable; los veredictos se guardan como sugerencias de IA **sin aplicar** (RN-009).
- En la pestaña «Posibles duplicados»: una tarjeta «Deje que Gemini los ordene» con «Analizar con
  Gemini», el avance en vivo y tres grupos — «Gemini cree que son la misma pieza», «Gemini cree que son
  distintas» (incluye los resueltos por regla) y «Gemini no está seguro».
- Aprobación por grupo, siempre explícita y auditada («sugerido por IA, aprobado por …»):
  - «distintas»: lista con motivo y confianza de cada par, casillas para sacar pares, «Aprobar N como
    distintas»;
  - «misma pieza»: antes de habilitar «Aprobar N como la misma pieza», la persona confirma una muestra
    al azar (5 pares); un par mal juzgado se saca del grupo;
  - «no está seguro»: revisión uno por uno con la comparación de `revisar-duplicados-comparacion`.
- Con `AI_PROVIDER=mock` o sin proveedor, la cola funciona como hoy (revisión par por par).

## Impact

- Capacidades: `ia-asistiva` (requirement nuevo que realiza RIA-02) y `calidad-datos` (aprobación en
  bloque de pares). Depende de `revisar-duplicados-comparacion` (comparación y decisión de filas).
- API: endpoints nuevos para lanzar el juicio, consultar su avance, listar los grupos y aprobar un
  grupo (con exclusiones). Migración para guardar los veredictos (tabla de solo inserción o columnas
  en `duplicate_candidate`, a decidir en el diseño), con su disparador si es de solo inserción
  (RN-005, `test_cross_cutting_rules.py`).
- Costo y límites: Gemini por lotes de pares por pedido; respetar los límites del plan.
- Datos personales: solo campos de catálogo; nunca comodante, registrador, observaciones ni el registro
  de origen (RNF-014, Ley 29733).
