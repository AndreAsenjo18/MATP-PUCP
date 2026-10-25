# Búsqueda avanzada y exportación

Esta sección explica cómo buscar piezas en el catálogo del museo, filtrar los resultados, exportar listas a Excel y consultar el historial de descargas.

---

## 1. Búsqueda por código y por texto libre

La barra de búsqueda principal permite buscar tanto por códigos de inventario o históricos como por términos descriptivos (título, autor, procedencia o época).

### Búsqueda tolerante a tildes y mayúsculas
El sistema utiliza coincidencia fonética y trigramas sin tildes:
- Buscar `ceramica` encontrará piezas catalogadas como `Cerámica`, `CERÁMICA` o `ceramica`.
- Buscar `tumi` encontrará `Tumi ceremonial`, `Tumi de oro`, etc.
- Palabras en autor o procedencia (por ejemplo `Cusco` o `Nazca`) también se detectan automáticamente.

### Búsqueda por código de pieza
Al ingresar un código, el sistema normaliza automáticamente el formato:
- `I-00100`, `i 100` o `I-100` se reconocen como el mismo código de inventario normalizado `I-000100`.
- **Prioridad de relevancia**:
  1. Coincidencia exacta con un código de inventario **vigente** (relevancia máxima).
  2. Coincidencia con un código **histórico** o anterior (por ejemplo códigos de colecciones previas o fichas antiguas).
  3. Coincidencias por texto libre en denominación, procedencia o autor.

Cada pieza en los resultados incluye una etiqueta explicativa (`match_reason`), por ejemplo: *"Código vigente: I-000100"*, *"Código histórico: COL-LMA-0012"*, o *"Texto: coincidencia en denominación"*.

---

## 2. Filtros combinados

En el panel lateral izquierdo puede combinar varios criterios. La pantalla muestra solo las piezas que cumplen **todos** a la vez:
- **Colección**: incluye las piezas de sus subcolecciones.
- **Categoría**, **Material** y **Estado de conservación**: términos de los vocabularios del museo.
- **Ubicación**: incluye todo lo que contiene ese lugar (por ejemplo, un depósito con sus muebles, niveles y contenedores).
- **Régimen de tenencia**: *Propiedad*, *Comodato* o *Préstamo Temporal*.
- **Código I**: solo piezas con código I o solo piezas sin él.
- **Época desde / hasta (año)**: rango de años. Si una pieza tiene la época escrita solo como texto (por ejemplo, «colonial tardío»), no se puede comparar con el rango. La pantalla le avisa cuántas piezas quedaron fuera por eso.
- **Completitud de la ficha**: solo piezas incompletas (con alguna alerta) o solo piezas completas.

No hace falta escribir nada en el buscador: con solo elegir filtros, la pantalla lista las piezas en orden alfabético.

### Filtros activos
Cada filtro elegido aparece como una etiqueta (*chip*) sobre los resultados. Haga clic en una etiqueta para quitar ese filtro sin reiniciar la búsqueda.

### Qué coincidió y foto de la pieza
Cuando escribe un texto o un código, cada resultado indica qué coincidió: por ejemplo, *«Coincide por código de colección «M.M.Z. 15»»* o *«Coincide en denominación y procedencia»*. Si la pieza tiene fotografías, la tarjeta muestra una miniatura de la foto principal.

---

## 3. Sugerencias cuando no hay resultados

Si combina varios filtros y ninguna pieza los cumple todos:
1. La pantalla le indica que no se encontraron piezas con estos filtros.
2. Le sugiere acciones concretas: quitar uno de los filtros, revisar cómo escribió el código (sin puntos, guiones ni ceros a la izquierda) o buscar por un código anterior de la pieza.
3. Las sugerencias de quitar un filtro son enlaces: haga clic y el filtro se quita de inmediato.

---

## 4. Exportar resultados

Debajo de los resultados está el panel **Exportar resultados** (requiere permiso de exportación):
1. Marque las **columnas** que quiere en el archivo. Las columnas con datos restringidos (comodante, convenio de préstamo) solo aparecen si su rol puede verlas.
2. Elija el **formato**: Excel (`.xlsx`) o CSV.
3. Presione **Exportar**. El archivo tiene exactamente las mismas piezas que la búsqueda, con los mismos filtros.
4. Si la búsqueda tiene **hasta 5 000 piezas**, el archivo se descarga en el momento. Si tiene **más**, se prepara en segundo plano y aparece en **Mis exportaciones** cuando está listo. Puede seguir trabajando mientras tanto.

### Estructura del archivo Excel generado
- **Hoja `Resultados`**: las columnas que eligió, en el orden del panel.
- **Hoja `Filtros`**: la fecha y hora de generación, el usuario, los filtros aplicados y las columnas omitidas por confidencialidad (por ejemplo, comodantes o valorización).

Cada exportación queda registrada en la auditoría (quién, cuándo, con qué filtros y si incluyó datos restringidos).

---

## 5. Mis exportaciones

El panel **Mis exportaciones**, debajo del panel de exportación, lista sus archivos recientes:
- El estado de cada uno: *En cola*, *Preparándose*, *Lista*, *Falló* o *Caducada*. Mientras haya alguna en preparación, el estado se actualiza solo; también puede presionar **Actualizar**.
- Cuando está lista, aparece el botón **Descargar**.
- **Caducidad**: los archivos se conservan **72 horas**. Después, la exportación figura como *Caducada* y debe generarla de nuevo. El registro de la exportación se conserva.
