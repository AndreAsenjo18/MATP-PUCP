# Lote de demostración de la importación

Datos **sintéticos** (Ley 29733, RNF-014): ninguna pieza, código ni foto viene del museo. Se regenera con
`cd apps/api && .venv/Scripts/python -m app.seed --fixtures ../../data/fixtures` (en Linux/macOS `.venv/bin/python`).

- `lote_demo_sabana.xlsx`: hoja `LOTE` con 30 filas que reproducen el «caos de codificación».
- `fotos/`: 80 imágenes para soltar como carpeta en el paso «Fotografías» del asistente.

Funciona sobre un ambiente con el seed sintético (`npm run seed`): las filas 19 y 20 actualizan dos
piezas de ese seed.

## Mapeo

| Columna del Excel | Campo |
|---|---|
| DENOMINACIÓN | Denominación |
| CÓDIGOS | Identificadores, con «Separar varios códigos de la celda» |
| COLECCIÓN | Colección (sigla) |
| RÉGIMEN | Régimen de tenencia |
| PROCEDENCIA | Procedencia |
| ÉPOCA | Época (texto original) |
| MATERIAL, MEDIDAS, OBS. CONSULTORÍA | Sin mapear: se conservan como datos de origen (RF-008) |
| FOTO | Archivo de la foto (cuando el asistente ofrezca esa columna) |

## Qué debería pasar con las filas

Los números son las filas de Excel (la 1 es la cabecera).

| Resultado esperado | Filas | Por qué |
|---|---|---|
| **Nueva** | 21 filas | Códigos que no existen en el catálogo |
| **Actualización** con diff | 19 y 20 | `M.M.Z. 001` y `RA 2` son piezas del seed; cambia la procedencia |
| **Posible duplicado** | 5 filas (2, 7, 14, 16 y 23) | Denominación muy parecida a una pieza existente; la fila 16 repite el «Toro de Pucará» de la fila 2 |
| **Conflicto** | 17 y 18 | Las dos traen el mismo código I (`I-9116`) |
| **Error** | 15 | Comodato con código I (RN-003) |

Además, los códigos están escritos a propósito de muchas formas: `I 9102`, `I.9103`, `R.A. 502`,
`M B B 502`, `mbb-503`, `INC 4521` (4 dígitos), `RN 009121` (6 dígitos), `S/N` y `s/c` (sin código),
`???` (ilegible) y celdas con varios códigos separados por `/`, `;` o `|`.

## Qué debería pasar con las fotos

| Cómo se reconoce | Cantidad | Ejemplos |
|---|---|---|
| **Por el nombre del archivo** (se ignoran ` (2)`, `_2`, `-a`, `_frontal` y `copia`) | 32 | `I-9101 (2).jpg`, `R.A. 502 copia.jpg`, `i-9128.jpg` |
| **Por la carpeta** (gana la carpeta más cercana) | 32 | `MBB 502/IMG_0001.jpg`, `Depósito 2/MMZ 504/IMG_0002.jpg` |
| **Ambigua**: el código está en dos filas | 3 | `I-9116.jpg` (filas 17 y 18) |
| **Sin código**: van a la bandeja para asignar a mano | 11 | `sin_codigo/DSC_0912.jpg`, `WhatsApp Image ….jpeg`, `escaneo.png` |
| **Repetida**: mismos bytes que otra foto | 2 | `I-9101 copia (2).jpg` = `I-9101.jpg` |

La fila 14 (`AJB 501`) es un comodato: sus fotos deben heredar la restricción «No publicar». La
fila 15 también es de la colección en comodato, pero tiene error y no se aplica.

> El emparejamiento y la aplicación de las fotos dependen de las tareas 3 a 6 de
> `importacion-masiva-fotografias`. Sin ellas, la sábana se importa igual y las fotos se pueden subir
> a cada ficha desde su galería.
