## Why

En la búsqueda con IA, «piezas de madera procedentes de Ayacucho» aplicaba bien los filtros material
«Madera» y procedencia «Ayacucho», pero además dejaba «pieza» como texto libre: la búsqueda exigía esa
palabra en la ficha y casi no devolvía nada (2026-11-19).

## What Changes

- El texto que sobra (`q`) se limpia en el servicio de IA, igual para Gemini y para el proveedor mock, sin
  gastar tokens: se quitan las palabras genéricas para «pieza» («pieza», «objeto», «obra», «bien»…), los
  valores que ya se volvieron filtros si el modelo los repite, y los conectores y verbos de pedido al
  inicio y al final («muéstrame las… de»). Si no queda nada, no hay texto libre.
- Una regla corta en el prompt (una línea) para que el modelo no las ponga en `q`.
- El texto del medio se conserva: «toro de Pucará» sigue siendo una frase.

## Impact

- Capacidad `busqueda-reportes` (requirement nuevo).
- IA: `services/ai/matp_ai/search_text.py`, `main.py` (`/v1/interpret-search`), `providers/llm.py`.
- La API y la web no cambian.
