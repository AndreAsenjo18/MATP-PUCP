# Archivo fotográfico sintético

Este fixture es completamente ficticio. No contiene nombres, códigos ni fotografías reales del museo.

## Qué incluye

- `fotos/`: árbol sintético con carpetas por coleccionista, subcarpetas por rango, carpetas anidadas y `ALTAS/`.
- `catalogo_sucio.xlsx`: catálogo sintético con códigos escritos de varias maneras.
- `correspondencias.csv`: correspondencias explícitas para nombres que no llevan un código completo.
- `resultado_esperado.csv`: oráculo simple de foto → forma F1–F6 → código esperado.
- `generar_fixture.py`: copia del script generador para reproducir el conjunto.

## Formas cubiertas

- F1: `SIGLA 001 - PUCP #### (n).JPG`
- F2: `SIGLA 1 - INC ####.jpg`
- F3: `I-#### XX-###(n).jpg`
- F4: número solo dentro de una carpeta de colección, por ejemplo `1.JPG`
- F5: `###-####.jpg` y variantes como `###-#### x.jpg`
- F6: nombre de cámara en baja resolución y copia de mayor resolución en `ALTAS/`

## Estructuras sintéticas incluidas

- carpeta de colección por nombre de coleccionista;
- carpeta en mayúsculas con tilde;
- subcarpeta de rango (`VCL 001-050`, `FOTOS 121-140`);
- estructura anidada `ARCHIVO SECUNDARIO/FDX/`;
- carpeta `ALTAS/` y una subcarpeta adicional;
- un caso trampa sin asociación esperada.

Todos los valores se eligieron para ser distintos de los ejemplos reales observados.


## Ajuste de coherencia con el ambiente
Las carpetas de colección del fixture fueron renombradas para usar siglas válidas del ambiente: MMZ, AJB, LRM, MBB y RAB. Las fotos y CSV fueron actualizados para conservar las correspondencias.
