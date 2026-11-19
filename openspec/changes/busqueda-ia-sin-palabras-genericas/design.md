## Context

`/v1/interpret-search` devuelve los filtros reconocidos y `q`, lo que sobra. El modelo dejaba en `q` las
palabras de la frase que no son filtros, aunque no aporten nada que buscar.

## Decisions

### D1. Limpieza determinista después del proveedor
`clean_interpretation` se aplica en el endpoint, una vez para cualquier proveedor. Quita las palabras
genéricas en cualquier lugar, los valores ya usados como filtros y el relleno en los bordes. No usa el
modelo: cero tokens y el mismo resultado siempre. Solo recorta los bordes para no romper una frase real.

### D2. Una línea en el prompt
Se agrega una regla breve (≈25 tokens) para que el modelo tampoco las devuelva; la limpieza D1 cubre lo
que el modelo igual deje.

## Risks / Trade-offs

- Una búsqueda que de verdad quiera la palabra «obra» o «pieza» como texto ya no la busca: se considera
  genérica [SUPUESTO]. Se puede escribir en la búsqueda normal, sin IA.
