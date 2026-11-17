## Context

`carga-masiva-con-ia` (D2) pide a la IA un destino para las columnas que quedan sin mapear al abrir
el editor y lo aplica sin avisar. El editor (`ImportMappingEditor`) es «columna → campo» con un
`Select` por columna. El lote no expone filas antes de validar (`/diffs` exige un lote validado).

## Decisions

### D1. Vista por dato del catálogo, no por columna
Una fila por dato principal del catálogo (código I, código de colección, colección, denominación,
descripción, materiales, procedencia, época, medidas, estado de conservación, autor, régimen,
observaciones) más cualquier otro destino ya asignado. Cada fila muestra la columna de origen y los
valores de las primeras 3 filas del archivo, sin transformar (las transformaciones de una plantilla
siguen aplicándose al validar).

### D2. Origen de cada asignación
«Formato» si coincide con la plantilla de partida, «Gemini» si la aplicó la sugerencia de la IA,
«Usted» si la persona la eligió o confirmó en esta vista. Una asignación de la IA con confianza menor
que 0,8 [SUPUESTO] se marca en ámbar con el motivo; confirmarla o cambiarla la pasa a «Usted».
Sobre lo que puso la heurística por el nombre, la IA solo confirma el mismo destino (pasa a mostrar
su confianza) o precisa un código genérico («Códigos» → «Código I»). Nunca reemplaza otro destino
ya puesto, ni lo que viene de una plantilla o eligió la persona (como en `carga-masiva-con-ia`, D2).

### D3. Corregir eligiendo columna
El menú de cada dato lista las columnas del archivo con sus valores de ejemplo, con buscador, y «No
usar ninguna columna». Elegir una columna para un dato de valor único (denominación, procedencia…) le
quita ese destino a la columna que lo tenía; los códigos admiten varias columnas.

### D4. Muestra de filas en el lote
`ImportBatchOut.sample_rows`: las 3 primeras filas tal como se leyeron (sin las claves internas
`__…`). Las ve quien prepara el lote, que ya ve el archivo completo. La web las envía también a la
sugerencia de la IA, que quita las columnas sensibles antes de llamar al proveedor (RNF-014).

### D5. Motivo de la duda
`reason` opcional por columna, una frase de hasta 200 caracteres, solo cuando hay campo propuesto. El
mock lo da cuando el parecido del encabezado está entre el umbral y 0,8; el proveedor LLM lo pide en
el prompt.

## Risks / Trade-offs

- Mostrar valores sin transformar puede diferir de lo que quedará (p. ej. códigos compuestos que se
  separan): la validación sigue siendo la fuente de verdad y la revisión de filas lo muestra.
- El umbral de 0,8 es un supuesto: se ajusta con los archivos reales.
