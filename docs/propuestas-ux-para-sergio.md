# Propuestas de experiencia y textos para Sergio

Salen de la remodelación visual (change `remodelacion-visual`). La remodelación es solo de diseño: **las propuestas no están aplicadas**, salvo las que se marcan como «Aplicado, para avisar», que André decidió aplicar. Cada una indica la pantalla, qué se ve hoy, la propuesta y el motivo, para que Sergio decida.

## Pedidos del cliente

### C1. Reportes: filtrar por todos los datos de la ficha y exportar a Excel solo lo filtrado

- **Pedido del cliente** (lo transmitió André el 2026-11-13):
  1. Poder filtrar los reportes por todos los datos que se anotan al registrar una pieza.
  2. Que el Excel traiga solo las piezas filtradas.
- **No implementado:** son filtros y comportamiento nuevos, fuera de la remodelación visual.

**Cómo funciona hoy la exportación.** Con datos reales, el Excel de cada reporte se pide con los mismos parámetros que la vista en pantalla: trae las mismas piezas filtradas, con todas las columnas, la fecha, el usuario y los filtros en la cabecera. Lo mismo ocurre con la descarga de «Información incompleta» (Excel o CSV), que respeta las alertas y la colección elegidas. En modo demostración no se genera ningún archivo. La API ya aplica los filtros de búsqueda a los cuatro reportes que listan piezas.

**Qué filtros ofrece hoy cada reporte en pantalla:**

| Reporte | Filtros en pantalla |
|---|---|
| Inventario general | Incluir comodatos |
| Por colección | Colección (obligatoria); incluir comodatos |
| Por ubicación | Ubicación (obligatoria); no verificadas en los últimos N días |
| Piezas agrupadas por… | Agrupar por; incluir comodatos; y el panel completo de filtros de Buscar (abajo) |
| Información incompleta | Alertas (sin código I, sin foto, sin ubicación, campos obligatorios incompletos, campos recomendados incompletos, código no normalizable); colección, con o sin subcolecciones |

El panel completo de filtros de Buscar tiene: código o texto, denominación, categoría, material, «descripción contiene», colección (con subcolecciones), estado de conservación, ubicación, régimen de tenencia, código I (con o sin), época desde y hasta (año), autor, procedencia y completitud de la ficha. Solo aparece en «Piezas agrupadas por…».

**Datos que se anotan al registrar una pieza y si hoy se puede filtrar por ellos:**

| Dato del formulario | ¿Hay filtro? |
|---|---|
| Denominación | Sí |
| Código I | Sí: por su valor («código o texto») y por tenerlo o no |
| Régimen de tenencia | Sí |
| Colección | Sí |
| Categoría | Sí |
| Tipo de bien | **No** |
| Disponibilidad | **No** |
| Comodante | **No** (además es un dato restringido por rol) |
| Convenio de comodato | **No** (también restringido) |
| Propietario legal | **No** |
| Descripción | Sí («descripción contiene») |
| Autor | Sí |
| Procedencia | Sí |
| Época (texto original) | **En parte:** por rango de años; las épocas escritas solo como texto no se pueden comparar y se avisan aparte |
| Forma de adquisición | **No** |
| Fecha de ingreso | **No** (haría falta un rango de fechas) |
| Registrado por | **No** |
| Ubicación inicial | **En parte:** se filtra por la ubicación actual, no por la inicial |
| Medidas (texto original) | **No** |
| Materiales | Sí (un material a la vez) |
| Estado de conservación | Sí |
| Observaciones | **No** |

Faltan 10 datos (tipo de bien, disponibilidad, comodante, convenio de comodato, propietario legal, forma de adquisición, fecha de ingreso, registrado por, medidas y observaciones), y 2 se cubren solo en parte (época y ubicación inicial).

**Propuesta:**

1. Mostrar el panel completo de filtros en los cuatro reportes que listan piezas, no solo en «Piezas agrupadas por…»; la API ya los acepta.
2. Agregar los filtros que faltan, empezando por los de listas cerradas (tipo de bien, disponibilidad, forma de adquisición), el rango de fecha de ingreso y «registrado por».
3. Decir junto a «Exportar a Excel» que el archivo trae solo las piezas filtradas, por ejemplo: «El Excel trae las mismas piezas que ve en pantalla, con todas las columnas».

## Aplicado, para avisar

Cambios de texto o de contenido que André decidió aplicar el 2026-11-13 como consecuencia directa de la remodelación. Se anotan para que Sergio los conozca y pueda revisarlos.

### A1. «Cambie de rol desde la cabecera» pasa a «desde el menú»

- **Pantallas:** el aviso de permisos por defecto (`components/layout/PermissionNotice.tsx`) y los avisos de Administración, Cargar datos (dos), Cargar fotos, Registrar pieza, Editar pieza, Reportes y Sugerencias: nueve textos. También la ayuda del acceso: «Puede cambiar de rol en cualquier momento desde el menú».
- **Antes:** el botón «Cambiar de rol» estaba en la franja superior.
- **Ahora:** la franja superior ya no existe y el botón está al pie del menú, así que los textos dicen «desde el menú».
- **Motivo:** el texto mandaba a la persona a buscar algo que ya no existe.

### A2. El rol no se repite al pie del menú si el nombre ya lo dice

- **Pantalla:** el pie del menú, en todas las pantallas.
- **Antes:** nombre y rol, siempre en dos líneas («Administrador MATP (sintético)» y debajo «Administrador»).
- **Ahora:** el rol va debajo del nombre solo si el nombre no lo contiene. Con «Gabriela Curadora (sintética)» se sigue viendo «Gestor de colecciones (Curadora)».
- **Motivo:** el pie tiene que caber siempre a la vista en ventanas bajas; repetir el rol ocupaba una línea sin dar información nueva.

### A3. El Inicio de la maqueta B

- **Pantalla:** Inicio.
- **Antes:** seis tarjetas, con «Buscar una pieza» como una de las dos grandes, y la línea «Sesión de demostración como…» bajo el título.
- **Ahora:** «Buscar una pieza» es un buscador dentro de la cabecera, con el texto de ejemplo nuevo «Código o nombre, por ejemplo I-0236» y el botón «Buscar». La línea de demostración ya no está: la insignia vive solo en el menú. Los demás textos son los de siempre.
- **Motivo:** el Inicio es una de las excepciones decididas de la remodelación, y la maqueta B lo dibuja así.

## Para resolver antes de archivar

### R1. El change `inicio-guia-de-tareas` y la remodelación dicen cosas distintas

- **Escenario «Escritorio»** de su requisito de navegación: pide «un encabezado con su nombre, su rol y el cambio de rol». La remodelación quitó esa franja y puso la cuenta al pie del menú. André decidió no tocarlo todavía.
- **Requisito del Inicio:** pide «tarjetas grandes» para las seis tareas, entre ellas «Buscar una pieza» con su enlace. En la maqueta B buscar es un formulario en la cabecera.
- **Propuesta:** antes de archivar cualquiera de los dos changes, reescribir esos dos puntos de `inicio-guia-de-tareas` como en la remodelación.

### A4. Etiquetas de tipo en «¿Qué desea importar?»

- **Pantalla:** Importación, la elección del origen.
- **Ahora:** cada tarjeta lleva una etiqueta corta, tomada de la maqueta B: «Para piezas nuevas» (Solo Excel), «Para fotos» (Solo imágenes) y «Paso a paso» (Excel e imágenes).
- **Motivo:** André las pidió expresamente para el grupo de Importación.

### A5. Página no encontrada (404) en español

- **Pantalla:** cualquier dirección que no existe.
- **Antes:** la página por defecto de Next.js, en inglés («404 · This page could not be found.»).
- **Ahora:** la banda terracota con «No encontramos esta página», la ayuda «La dirección no existe o cambió. Vuelva al inicio para seguir desde allí.» y el botón «Ir al inicio».
- **Motivo:** André pidió dar a la 404 el mismo lenguaje visual; no había textos en español que conservar.

## Urgentes: textos que la remodelación deja desactualizados

### 2. Manual de usuario con los nombres antiguos del menú

- **Dónde:** `docs/manual-usuario/` (README, administración, auditoría, calidad de datos, catálogo, depósito, IA, importación y reportes).
- **Hoy:** nombra «Búsqueda», «Importación», «Duplicados» y «Sugerencias IA».
- **Después:** el menú dice «Buscar», «Cargar datos» y «Revisar pendientes», que junta duplicados y sugerencias.
- **Propuesta:** actualizar los nombres y las capturas del manual cuando entre la remodelación.

### 3. Dos nombres para Administración

- **Pantallas:** el Inicio y el menú.
- **Hoy:** la tarjeta del Inicio dice «Configuración» y el menú dice «Administración»; llevan al mismo lugar.
- **Ya resuelto:** el change `inicio-guia-de-tareas` se alineó el 2026-11-13 con los nombres del menú que decidió André («Buscar» y «Administración»). Su tarjeta del Inicio sigue diciendo «Configuración».
- **Propuesta:** un solo nombre en la tarjeta del Inicio y en el menú.

### 3b. Enlace para saltar al contenido

- **Pantallas:** todas las que tienen menú.
- **Hoy:** con el teclado hay que pasar por las seis entradas del menú y la cuenta antes de llegar al contenido.
- **Propuesta:** un enlace «Saltar al contenido» que solo aparece al usar el teclado, como primer elemento de la página.
- **Motivo:** lo pide la auditoría de web-design-guidelines. Es texto nuevo de pantalla, así que no lo añadí.

## Términos internos o siglas en pantalla

### 4. «Fuera del MVP»

- **Pantalla:** Revisar pendientes › Sugerencias de IA (etiqueta en cada sugerencia).
- **Motivo:** «MVP» es una sigla interna. Hoy la exige el spec `ia-asistiva`, así que cambiarla pide modificar ese requisito.
- **Propuesta:** algo como «Función en prueba».

### 5. «Fase 1» en el acceso y en Estado

- **Pantallas:** acceso («Uso interno · Fase 1» y «Desactivado en fase 1» junto a algunos roles) y Estado de los servicios («Uso interno · Fase 1»). En Administración, «Desactivado en fase 1» junto a algunos roles.
- **Motivo:** «fase 1» es un término del proyecto, no del museo.
- **Propuesta:** «Uso interno del museo» y «No disponible por ahora».

### 5b. «NEXT_PUBLIC_API_MODE=live» en la vista de impresión

- **Pantalla:** Reportes › Vista imprimible, en modo demostración.
- **Hoy:** «El asistente conectado a la API solo funciona con NEXT_PUBLIC_API_MODE=live.»
- **Propuesta:** «La vista para imprimir solo está disponible con los datos reales del museo.»
- **Motivo:** muestra el nombre de una variable de configuración y la palabra «API».

### 5c. «Disponible con la API (modo live)» en Administración

- **Pantalla:** Administración (Catálogo y otras secciones), en modo demostración.
- **Hoy:** «Disponible con la API (modo live).»
- **Propuesta:** «Esta sección se usa con los datos reales del museo; en la demostración no está disponible.»
- **Motivo:** «API» y «modo live» son términos internos.

## Coherencia de textos

### 6. «Volver a la búsqueda» y «Volver a búsqueda»

- **Pantallas:** Registrar pieza dice «Volver a la búsqueda»; la ficha dice «Volver a búsqueda».
- **Propuesta:** un solo texto en las dos.

## Comportamiento

### 7. En demostración, Buscar no recoge lo que se escribió en el Inicio

- **Pantallas:** Inicio y Buscar, solo en modo demostración.
- **Hoy:** el buscador del Inicio lleva a `/busqueda?q=…`. Con datos reales, Buscar aplica ese texto. En demostración, Buscar abre con el campo vacío, porque esa versión de la pantalla no lee la dirección.
- **Propuesta:** que la versión de demostración también lea `q` de la dirección, como ya hace con «Solo piezas incompletas». Es un cambio de lógica, así que no lo apliqué.
- **Motivo:** en una demostración parece que el buscador del Inicio no hace nada.

### 9. El botón «Buscar» de Buscar no hace nada nuevo

- **Pantalla:** Buscar.
- **Hoy:** la maqueta B pone un botón oscuro «Buscar» dentro del campo. Está, pero los resultados ya cambian mientras se escribe, así que pulsarlo no hace nada más.
- **Propuesta:** que al pulsarlo lleve el foco a «N resultados», para que quien usa el teclado o un lector de pantalla llegue a la lista, o quitar el botón en esta pantalla.
- **Motivo:** un botón que no responde confunde.

### 11. Imagen principal junto a los datos de la ficha

- **Pantalla:** ficha de la pieza, pestaña «Datos generales».
- **Hoy:** las fotos están en su propia pestaña, «Fotografías».
- **Propuesta:** mostrar la foto principal al lado de los datos, para reconocer la pieza sin cambiar de pestaña.
- **Motivo:** se pidió anotarla y no implementarla; cambia qué se muestra en la pestaña.

### 12. Textos y pestañas de la maqueta B en la ficha

- **Pantalla:** ficha de la pieza.
- **En la maqueta:** «Volver a los resultados» (hoy «Volver a búsqueda»), el código solo («I-0236», hoy «Código I: I-0236») y tres pestañas: «Datos», «Fotografías» e «Historial» (hoy seis). El estado de conservación aparece como insignia de color.
- **Propuesta:** decidir si se simplifican las pestañas y los textos. Seis pestañas es más de lo que la maqueta propone; agrupar Identificadores, Ubicación, Conservación y Origen en «Historial» o en «Datos» acortaría la fila.

### 10. Textos de la maqueta B en Buscar

- **Pantalla:** Buscar.
- **Hoy:** «Búsqueda», «14 resultados» y el buscador con la etiqueta «Código o texto».
- **En la maqueta:** «Buscar piezas» con la ayuda «Encuentre una pieza por su código, su nombre o su categoría.», «14 piezas encontradas» y «Toque una pieza para abrir su ficha».
- **Propuesta:** decidir si se adoptan; coinciden con el nombre del menú («Buscar») y son más claros que «resultados».

### 14. Pantalla de error

- **Pantallas:** todas, cuando algo falla al mostrar una pantalla.
- **Hoy:** no hay una pantalla de error propia: se ve la de Next.js.
- **Propuesta:** una pantalla con la banda terracota, un mensaje claro («Algo salió mal al mostrar esta pantalla»), «Intentar de nuevo» e «Ir al inicio».
- **Motivo:** capturar el error y ofrecer reintentar es un comportamiento nuevo, así que no se hizo dentro de la remodelación visual.

### 8. Textos de ejemplo cortados a 320 px

- **Pantallas:** el buscador del Inicio («Código o nombre, por ejemplo I-0236») y el de Buscar («p. ej. I-0236, mmz 15, cerámica huánuco»).
- **Hoy:** a 320 px de ancho, o con zoom al 300 %, el campo no tiene sitio para el ejemplo completo y se ve cortado.
- **Propuesta:** un ejemplo más corto en el campo («Código o nombre») y el ejemplo completo en la línea de ayuda, que sí puede ocupar dos líneas.
