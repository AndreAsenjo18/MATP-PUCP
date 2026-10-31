## Why

La importación tiene que cargar el histórico real del museo, y hasta ahora se probó con archivos sintéticos y plantillas ilustrativas ([SUPUESTO A1] en `app/seed/import_templates.py`). Se revisaron los 61 Excel entregados por el museo (fuera del repositorio, porque tienen datos personales de propietarios), solo en su estructura y con conteos, pasándolos por la ingesta y el normalizador actuales. La ingesta los lee todos sin errores, pero el resultado no sirve tal cual:

**Dos familias de formato, con 10 variantes de encabezados:**

| Familia | Archivos | Columnas | Particularidades |
|---|---|---|---|
| **BD estandarizada 2025** | 16 (inventario general con 4 hojas, listado RNBM y una por colección) | 44 (variantes de 46, 27 y 28) | Encabezado en la fila 1. Medidas en 5 columnas (Alto, Ancho, Espesor, Diámetro, Peso). Columnas de datos personales del propietario. Hojas «Errores identificados» y «Errores pendientes». Una colección con la columna del código de colección mal rotulada |
| **Ficha de catalogación (formato RN)** | 45 (fichas AJB de 100 en 100) + 1 (colección FJT) | 54 (variante de 40) | Encabezado en la fila 2, bajo una fila de grupos. Procedencia en 3 columnas y dimensiones en 4. En 12 archivos las columnas de grupo quedan sin nombre («Columna J»). Filas de encabezado repetidas dentro de los datos |

**Códigos que hoy no se normalizan** (conteos sobre los archivos reales):

| Columna | Sin normalizar | Formas encontradas |
|---|---|---|
| N° Inscripción Registro Nacional | 1 584 de 5 058 | **1 306 RN de 5 dígitos**, 276 «No presenta» |
| Código de la colección | 875 de 4 585 | 329 `ELA 123 CEL` (sigla + número + sufijo), 380 números sin sigla, 73 `AMM-OT-R-1234` |
| N° Inventario MATP (I) | 268 de 5 833 | 195 `AMM-IN-V-1234` (no es un código I), 48 «No presenta», notas de texto en la celda |
| Código INC (fichas) | 612 de 4 367 (sin contar decimales) | 195 `#RN 1234567890` (10 dígitos), 195 `D-1`, 195 `VI-1.2`, 21 encabezados repetidos |

Además, el mapeo actual no permite llevar **varias columnas a un mismo campo** (`duplicate_target`), no tiene destino para la **fecha de ingreso** y no reconoce «No presenta» ni «Sin código» como marcas de vacío. En un día de importación real, todo eso se traduciría en miles de errores en la previsualización.

## What Changes

- **Plantillas reales en lugar de las ilustrativas**: «BD estandarizada 2025» y «Ficha de catalogación RN», con el destino de cada una de sus columnas, y **reconocimiento de variantes** por alias de encabezado. Un archivo con 46, 27 o 40 columnas de la misma familia se reconoce y se mapea solo, y lo que no encaja queda como columna sin mapear (se conserva en los datos de origen, RF-008).
- **Encabezados de dos filas**: una columna de grupo sin nombre propio toma el nombre del grupo de la fila superior («Procedencia (2)»), en vez de «Columna J».
- **Filas que repiten el encabezado** dentro de los datos se omiten y se cuentan en la bitácora.
- **Varias columnas → un campo**: procedencia 1–3 se unen con «, », dimensiones 1–4 con «; », y Alto/Ancho/Espesor/Diámetro/Peso forman las medidas estructuradas y su texto.
- **Destinos nuevos**: fecha de ingreso y forma de adquisición (término), con la forma de adquisición que deduce el régimen (coordinado con `ajustes-lectura-importacion`).
- **Datos personales del propietario** (nombre, dirección, domicilio): se conservan solo en los datos de origen marcados como sensibles, visibles con el permiso `sensitive.donor_data`; nunca en campos de la ficha (RNF-014, RF-041).
- **Códigos reales**:
  - «No presenta» y «Sin código» como marcas de vacío por defecto;
  - código de colección con sufijo (`ELA 123 CEL`) [SUPUESTO FR1];
  - siglas compuestas con guiones (`AMM-IN-V-1234`), detectadas como código de colección aunque estén en la columna del código I [SUPUESTO FR2];
  - número sin sigla en la columna del código de colección, completado con la sigla de la colección de la fila [SUPUESTO FR3];
  - texto que no es un código (notas) va a observaciones, no se descarta.
- **Hojas de errores** de la consultoría («Errores identificados», «Errores pendientes»): se importan como observaciones de calidad de las piezas ya cargadas, no como piezas (L8).
- **Guía de carga del histórico** en el manual: qué archivo cargar primero y por qué. Primero los archivos por colección, que son los más completos; después el inventario general, cuyas filas salen como actualizaciones o posibles duplicados.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `importacion-datos`: se añaden requirements de plantillas reales con variantes, encabezados de dos filas y repetidos, varias columnas en un campo, datos personales del propietario, hojas de errores como observaciones y destinos de fecha de ingreso y forma de adquisición.
- `identificacion-piezas`: se añaden requirements de formas reales de código (sufijo, sigla compuesta, número con la colección de la fila, marcas «No presenta» y «Sin código», texto que no es código).

## Impact

- **IDs cubiertos**: RF-021, RF-022, RF-023, RF-008, RF-006, RF-041, RNF-014, RN-003, RN-005, RN-010.
- **Responsable**: Sergio (Importación). Coordina con `ajustes-lectura-importacion` (André): el RN de 5 dígitos (1 306 casos) y el régimen deducido de la forma de adquisición son requisito para cargar estos archivos. **Propuesta: que ese change pase a Sergio**, porque toca los mismos módulos.
- **Depende de**: `plantillas-mapeo-y-normalizacion` e `importacion-pipeline-reconciliacion` (archivados), `ajustes-lectura-importacion` (RN de 5 dígitos, forma de adquisición).
- **Afecta**: `apps/api/app/modules/imports/` (`ingest.py`, `mapping.py`, `transforms.py`, `templates.py`), `apps/api/app/modules/identification/normalization.py`, `apps/api/app/seed/import_templates.py` (plantillas reales), migración de datos para las marcas de vacío, asistente de importación en `apps/web` (columnas combinadas en el paso de mapeo), `docs/manual-usuario/`, `docs/preguntas-contraparte.md`.
- **Contrato**: el formato de mapeo admite varias fuentes por columna (`sources`) y los destinos `entry_date` y `acquisition_method`; se registran como ampliaciones en `docs/api/mapeo-endpoints-v1.md`.
- **Pruebas**: con un fixture **sintético** que reproduce las dos familias y sus variantes (encabezados reales, valores inventados). Además, un script local (`scripts/check_real_excels.py`, fuera de CI) que pasa los archivos reales por la ingesta y el mapeo, y reporta solo conteos.
- **Fuera de este change**:
  - normalizar los vocabularios sucios (930 materiales y 135 tipos de bien distintos): siguen la correspondencia con vocabularios existente y, más adelante, `ia-sugerencia-terminos`;
  - Word y Access;
  - interpretar los códigos `D-1` y `VI-1.2` de las fichas, ni los RN de 10 dígitos con `#RN`, hasta que el museo los explique (FR4, FR5): se conservan como «otro código».
