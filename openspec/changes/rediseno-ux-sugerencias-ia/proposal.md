## Why

La pantalla «Revisión de sugerencias de IA» no explica para qué sirve. Abre con «Proveedor simulado y determinista (`AI_PROVIDER=mock`)» y una referencia a una regla interna, y las tarjetas mezclan identificadores de requisitos («RIA-01»), JSON en bruto y el nombre técnico del proveedor. Quien entra no sabe qué hace la IA, qué se le pide a la persona ni qué pasa al aprobar.

Además, la IA **no está en el alcance del MVP** (`docs/plan-sprints.md`: «Fuera del MVP»; `docs/plan-mvp-dos-desarrolladores.md`). La pantalla trabaja con ejemplos sintéticos del almacén local, incluso cuando la aplicación está conectada a la API, y nada de lo que se ve o se aprueba llega al catálogo. Sin una indicación visible, quien prueba la plataforma toma lo que falta (conexión con un proveedor real, sugerencias sobre sus piezas) por un fallo, y lo reporta como tal.

Es el quinto rediseño de UX por vista (después de Importación, Duplicados, Administración y Depósito), con los mismos criterios: copia corta, sin identificadores de requisitos y responsive.

## What Changes

- **Propósito en dos frases.** Bajo el título, un texto corto dice qué es: la IA lee un texto libre de una ficha (por ejemplo una descripción pegada) y propone los campos; la persona revisa, corrige y aprueba, y sin su aprobación nada se guarda.
- **Aviso de alcance.** Una franja visible con la etiqueta «Fuera del MVP» aclara que la pantalla muestra ejemplos de demostración con datos sintéticos, que aún no usa un proveedor de IA real y que lo que se apruebe aquí no cambia el catálogo. Lo que falta por construir no es un fallo.
- **Ejemplos rotulados.** Las tarjetas se agrupan bajo «Ejemplos pendientes de revisión» y «Ejemplos ya revisados», no como trabajo real.
- **Lenguaje llano.** Los nombres de las cinco funciones pierden el identificador («Extraer datos de un texto», «Detectar posibles duplicados», «Sugerir términos», «Redactar una descripción», «Responder consultas»); desaparecen «`AI_PROVIDER=mock`» y las referencias a reglas internas; las tarjetas dicen «Texto de la ficha» y «Propuesta de la IA».
- **Propuesta legible.** La propuesta se muestra como lista de campos con su valor y la confianza como porcentaje; el JSON queda solo para quien quiera corregir, en un bloque plegado «Corregir antes de aprobar».
- **Manual.** Una página breve en `docs/manual-usuario/` explica la pantalla y su estado fuera del MVP.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

Deltas solo `ADDED` con nombres únicos (ADR-010).

- `ia-asistiva`: propósito de la pantalla de revisión explicado en corto, aviso de que está fuera del MVP con ejemplos de demostración, y propuesta legible sin identificadores técnicos.

## Impact

- **Frontend** (`apps/web`): `app/ia/sugerencias/page.tsx`, nuevo `components/domain/AiSuggestionParts.tsx` (+ prueba) con las funciones puras de presentación; `components/layout/navigation.ts` sin cambios.
- **Backend / API / modelo**: sin cambios. La IA sigue desacoplada con `AI_PROVIDER=mock` por defecto; el proveedor y la regla de aprobación humana no se tocan.
- **Docs**: `docs/manual-usuario/ia.md` (y su estado en `README.md`).
- **Dependencias nuevas**: ninguna.
- **Cubre**: RIA-01..RIA-05 (presentación), RNF-010. Regla que sigue respetando sin mostrarla en pantalla: RN-009 (ninguna salida de IA se guarda sin aprobación humana).
- **Célula dueña**: IA. **Depende de**: `ia-extraccion-texto-libre` y `ia-sugerencia-terminos` (backend fuera del MVP; no se conecta aquí).
- **Fuera del change**: conectar la pantalla a la API de IA, el proveedor real, la pestaña «Sugerencias IA» de la ficha y el aviso de pendientes del Inicio (se revisan con sus vistas), y el nombre del menú.
