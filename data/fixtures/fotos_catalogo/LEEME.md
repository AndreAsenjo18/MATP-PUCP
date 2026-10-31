# Archivo fotográfico de demostración

Datos **sintéticos** (Ley 29733, RNF-014): ninguna pieza, código ni foto viene del museo. Reproduce la estructura del
Drive del MATP con nombres inventados. Se regenera con
`cd apps/api && .venv/Scripts/python -m app.seed --fixtures ../../data/fixtures` (en Linux/macOS `.venv/bin/python`).

- `fotos/`: 13 imágenes en carpetas, para soltar en **Importación › Importar fotografías al catálogo**.
- `correspondencias.csv`: lista `archivo,codigo` para el botón **Subir lista de correspondencias**.

Funciona sobre un ambiente con el seed sintético (`npm run seed`): las fotos apuntan a las piezas `MMZ 1…6`,
`MBB 2` y `LRM 1…2` de ese seed. Lo verifica `apps/api/tests/api/test_import_photo_catalog_e2e_api.py`.

## Recorrido

1. **Subir carpeta**: cree el lote («Archivo fotográfico de demostración») y suelte la carpeta `fotos/`.
2. **Cómo se leen los nombres**:
   - `Fotos MMZ`, `Fotos MBB` y `Fotos Coleccion LRM` se leen solas, con la colección propuesta por la sigla.
   - `FOTOS 001-100` aparece como «sugerencia pendiente»: pulse **Usar la plantilla {n}-{*}**, elija la colección
     MMZ y guarde.
   - Suba `correspondencias.csv`: asigna la foto de `ALTAS/` y avisa que una línea no tiene foto.
3. **Revisar y aprobar**: quedan dos fotos sin pieza (`IMG_0001.jpg` y `CARPETA 1/DSC_0001.jpg`) para asignarlas a mano,
   y `82LF4169.jpg` descartada como versión de menor resolución de `ALTAS/82LF4169 copy.jpg`.

## Qué debería pasar con cada foto

| Foto | Forma | Resultado esperado |
|---|---|---|
| `Fotos MMZ/MMZ 001 - PUCP 9101 (1).JPG`, `(2)` | F1: sigla + correlativo y código PUCP | MMZ 1, fotos 1 y 2 (el PUCP no existe en el seed: basta el código de colección) |
| `Fotos MMZ/MMZ 2 - INC 0000.jpg` | F2 | MMZ 2 |
| `Fotos MMZ/I-0000 MMZ-3(1).jpg` | F3 | MMZ 3 |
| `Fotos MBB/MBB 001 - 100/MBB 2 - PUCP 9202.jpg` | Carpeta de rango con sigla | MBB 2; el nombre de la carpeta nunca se lee como «MBB 1» |
| `Fotos MBB/MBB 001 - 100/IMG_0001.jpg` | Nombre de cámara | Sin asignar |
| `Fotos Coleccion LRM/1.JPG`, `2.JPG` | F4: número solo | LRM 1 y LRM 2 por la colección de la carpeta |
| `FOTOS 001-100/004-3269.jpg`, `005-3270 x.jpg` | F5: correlativo + contador | Nombre de cámara hasta aplicar la plantilla `{n}-{*}` con MMZ; luego MMZ 4 y MMZ 5 |
| `82LF4169.jpg` (160 × 120) | F6, baja resolución | Descartada: versión de menor resolución de la de `ALTAS/` |
| `ALTAS/82LF4169 copy.jpg` (960 × 720) | F6, alta resolución | MMZ 6 por la lista de correspondencias |
| `CARPETA 1/DSC_0001.jpg` | Carpeta genérica | Sin asignar |
