## Why

En la reunión del 2026-10-31 el MATP confirmó que **«Cesión de uso» y «Custodia» son comodato** (pregunta L5). Hoy la importación solo reconoce la palabra «comodato» como régimen (`TENURE_ALIASES`, fijo en `apps/api/app/modules/imports/mapping.py`). Además, si la columna «Forma de adquisición» de las sábanas se usa para deducir el régimen, «Donación» y «Compra» se rechazan como «no es un régimen de tenencia», y las piezas de cesión de uso o custodia entrarían como propias, pudiendo recibir código I (contra RN-003).

Por otro lado, en las bases estandarizadas del museo hay números de RN de **5 dígitos**, y la regla actual solo acepta 4 y 6: esos códigos quedan «no normalizables» y no sirven para emparejar ni detectar duplicados. La pregunta A4 no se alcanzó a hacer, pero la evidencia está en los archivos; se corrige ahora y se confirma en la reunión del 2026-11-06.

## What Changes

- **Correspondencias entre forma de adquisición y régimen**, administrables (RN-010): `Comodato`, `Cesión de uso` y `Custodia` → Comodato; `Donación`, `Compra`, `Legado` y `Transferencia interna` → Propiedad [SUPUESTO]; `Préstamo temporal` → Préstamo temporal. Se editan desde Administración › Lectura de códigos, igual que los marcadores de ausencia.
- Una columna mapeada a «Forma de adquisición» llena el término de la ficha **y** deduce el régimen si la fila no trae otro régimen explícito.
- «Cesión de uso» y «Custodia» se agregan a la lista «Formas de adquisición» del seed.
- La regla INC/RN acepta **5 dígitos** y registra el formato `INC_5_DIGITOS`, sin rellenar con ceros [SUPUESTO A4].

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `importacion-datos`: se añade el requirement de régimen deducido de la forma de adquisición con correspondencias administrables.
- `identificacion-piezas`: se añade el requirement del formato RN de 5 dígitos.

## Impact

- **IDs cubiertos**: RF-005, RF-023, RF-021, RN-003, RN-008, RN-010.
- **Célula dueña**: Importación (responsable: André). Respuesta L5 y pregunta A4 de `docs/preguntas-contraparte.md`.
- **Depende de**: `plantillas-mapeo-y-normalizacion` y `colecciones-y-vocabularios-admin` (archivados; `normalization_setting` y pantalla «Lectura de códigos»).
- **Afecta**: `apps/api/app/modules/imports/mapping.py`, `apps/api/app/modules/identification/normalization.py` y `models.py`, migración de datos que siembra `tenure_aliases` en `normalization_setting`, `apps/api/app/seed/reference.py`, pantalla «Lectura de códigos» en `apps/web`, manual de usuario.
- **Contrato**: sin operaciones nuevas; el enumerado `TenureRegime` no cambia.
- **Fuera de este change**: un régimen de tenencia nuevo (no hace falta: son comodato); datos adicionales del acuerdo de comodato (respuesta B2: van en la descripción); cambiar el formato del código I (A2 sigue abierta); volver a normalizar identificadores ya registrados (se hace con la vista previa y confirmación existentes de «Tipos de código»).
