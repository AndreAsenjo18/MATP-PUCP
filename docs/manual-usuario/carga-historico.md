# Cargar el histórico del museo

> Sección escrita por el change `formatos-reales-importacion`. Cómo se usa el asistente paso a paso:
> [Importación de sábanas Excel y CSV](importacion.md).

Esta guía explica cómo cargar los Excel históricos del museo, de la consultoría 2024/25 y las fichas de catalogación:
qué cargar primero, qué hace cada plantilla y qué revisar antes de aprobar.

## Antes de empezar

1. **Cree las colecciones** en **Administración › Colecciones**, con su nombre y su sigla (por ejemplo «Arturo Jiménez
   Borja», sigla `AJB`). Los archivos traen el nombre de la colección; el sistema la reconoce por la sigla o por el
   nombre, sin distinguir tildes ni la palabra «Colección». Si la colección no existe, la fila sale con «colección
   desconocida» y los números de colección sin sigla no se pueden completar.
2. Agregue en **Administración › Lectura de códigos** las siglas históricas de cada colección, si las hay.
3. Revise en **Administración › Lectura de códigos** las correspondencias **Forma de adquisición → régimen**: «Cesión
   de uso» y «Custodia» son comodato; «Donación» y «Compra» son propiedad.

## Orden de carga

1. **Primero los archivos por colección** (BD estandarizada de cada colección y las fichas de catalogación): son los más
   completos.
2. **Después el inventario general.** Sus filas que ya se cargaron por colección aparecen como **actualizaciones** o
   **posibles duplicados**: revise el diff y decida qué valor queda [SUPUESTO FR6: manda el archivo de la colección].
3. **No cargue** las hojas «Errores identificados» y «Errores pendientes» como piezas: son observaciones de la
   consultoría. Se cargarán como observaciones de calidad cuando esté disponible esa opción.

Un lote admite hasta 20 000 filas; el inventario general (≈ 4 400 filas) entra en un solo lote.

## Qué hace cada plantilla

El asistente reconoce solo el formato por los títulos de las columnas, aunque el archivo tenga columnas de más, de menos
o con otro nombre equivalente. Las columnas que la plantilla no conoce se guardan en los **datos de origen** de la pieza.

### BD estandarizada 2025 (44 columnas; variantes de 46, 27 y 28)

- **Códigos**: «N° Inventario MATP (I)», «Código de la colección» (también cuando viene rotulada «N° Inventario MATP (I)
  (2)»), «N° Inscripción Registro Nacional», código de propietario, código PUCP y otros códigos.
- **Ficha**: denominación, autor, procedencia, época, descripción, observaciones, registrador, colección y **fecha de
  ingreso**.
- **Medidas**: Alto, Ancho, Espesor, Diámetro y Peso forman las medidas de la pieza («Alto 23 cm; Ancho 15,5 cm; Peso
  120 g»).
- **Forma de adquisición**: se compara con la lista y, si la fila no trae régimen, lo deduce.
- **Datos del propietario** (nombre, dirección, inmueble): solo en los datos de origen, como **dato restringido**.

### Ficha de catalogación RN (54 columnas; variante de 40)

- El encabezado está en la fila 2. Las columnas de **Procedencia** (3) y **Dimensiones** (4) se reconocen aunque las
  celdas del grupo no estén combinadas, y la fila de subtítulos de debajo no se carga como pieza.
- **Código INC** y **otros códigos**; una celda con `3311/3312` se separa en dos códigos.
- La procedencia de tres columnas se une con comas («Ayacucho, Huamanga, Quinua»); las dimensiones, con «; ».
- **Propietario y domicilios**: datos restringidos; en una pieza en comodato, el propietario pasa a ser el comodante.

## Cómo se leen los códigos

| En el archivo | Queda como | Nota |
|---|---|---|
| `No presenta`, `No registra`, `Sin código` | Sin código | No es un error |
| RN de 4, 5 o 6 dígitos | Código RN | |
| `ela 012 cel` | `ELA 12 CEL` | El sufijo forma parte del código [SUPUESTO FR1] |
| `AMM-IN-V-0195` (aunque esté en la columna del código I) | Código de colección `AMM-IN-V 195` | La fila no recibe código I [SUPUESTO FR2] |
| `45` en «Código de la colección», fila de la colección MMZ | `MMZ 45` | Aviso «se tomó MMZ de la colección de la fila»: revíselo [SUPUESTO FR3] |
| `45` sin colección en la fila | No normalizable | Aviso «número sin sigla ni colección» |
| `número de inventario mal asignado, revisar` | Observación de la pieza | Se agrega a Observaciones con «[Importación]» |
| `D-1`, `VI-1.2`, `#RN 0000097322` | No normalizable | Pendiente de explicación del museo (FR4, FR5) |

## Qué revisar antes de aprobar

- **Avisos amarillos** de cada fila: sigla tomada de la colección, régimen que contradice la forma de adquisición,
  medidas que no son números («Alto no es un número»), fecha de ingreso solo con año o ilegible.
- **Posibles duplicados y conflictos**: sobre todo al cargar el inventario general después de los archivos por colección.
- **Filas omitidas**: el asistente indica cuántas filas no se cargaron porque repetían el encabezado; la bitácora del
  lote dice cuáles.

## Datos personales del propietario

Los nombres, direcciones y domicilios del propietario o del inmueble **no** pasan a la ficha. Se guardan en los datos de
origen y solo los ven quienes tienen el permiso **Ver datos de donantes y comodantes**; los demás ven
«(dato restringido)». Las exportaciones nunca incluyen los datos de origen.

## Verificación técnica con los archivos reales

El equipo comprueba la lectura de los archivos reales, que están fuera del repositorio (ADR-019), con:

```
cd apps/api
.venv/Scripts/python ../../scripts/check_real_excels.py <carpeta con los Excel> [--examples]
```

Muestra, por hoja, la plantilla reconocida y cuántos códigos se normalizan; con `--examples`, hasta cinco códigos no
normalizables por columna, nunca otros datos. Resultado al 2026-10-31: 58 archivos, ≈ 29 900 filas, 1,6 % de códigos no
normalizables (antes del change: 3,7 %), incluidos los pendientes FR4 y FR5.
