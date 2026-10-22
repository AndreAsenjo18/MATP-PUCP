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

En el panel lateral izquierdo puede refinar la búsqueda combinando múltiples criterios:
- **Colección**: Seleccione una colección principal o subcolección (incluye automáticamente piezas de subcolecciones dependientes).
- **Categoría y Estado**: Filtre por términos controlados del vocabulario (ej. *Textil*, *Metalurgia*, *Bueno*, *Regular*).
- **Régimen de tenencia**: *Propiedad*, *Comodato* o *Préstamo Temporal*.
- **Época o Periodo**: Rango de años cronológicos calculados o texto original.

### Filtros activos
Cada filtro seleccionado aparece como una etiqueta interactiva (*chip*) en la parte superior. Puede hacer clic en la **X** de cualquier chip para quitar ese filtro individual sin reiniciar toda la búsqueda.

---

## 3. Sugerencias cuando no hay resultados

Si combina varios filtros muy específicos y ninguna pieza coincide exactamente:
1. El sistema le informará que no se encontraron piezas con todos los filtros simultáneos.
2. Propondrá automáticamente **búsquedas relajadas**, indicándole cuántas piezas encontraría si retira uno de los filtros (por ejemplo: *"Si retira el filtro 'Estado: Regular', se encontrarán 14 piezas"*).
3. Puede hacer clic en la sugerencia para aplicar ese ajuste de inmediato.

---

## 4. Exportar resultados a Excel

Cualquier búsqueda o listado de catálogo puede exportarse para trabajo de inventario, investigación o auditoría:
1. Presione el botón **Exportar a Excel** en la esquina superior derecha de la tabla.
2. Si la consulta tiene **hasta 5 000 piezas**, el archivo `.xlsx` se descarga de forma inmediata en su navegador.
3. Si la consulta tiene **más de 5 000 piezas**, el sistema genera un **trabajo en segundo plano** para no congelar su pantalla. El sistema le avisará que la exportación ha iniciado y podrá continuar trabajando.

### Estructura del archivo Excel generado
- **Hoja `Resultados`**: Contiene la lista tabular con los mismos datos visibles en pantalla (código, denominación, colección, categoría, estado, ubicación, etc.).
- **Hoja `Filtros`**: Registro de auditoría con la fecha y hora de generación, el usuario responsable, los filtros aplicados y las columnas omitidas por política de confidencialidad (ej. comodantes o tasación).

---

## 5. Mis exportaciones

En el menú superior, acceda a **Mis exportaciones** para revisar sus archivos generados:
- Muestra el estado del trabajo: *Pendiente*, *En proceso*, *Listo* o *Fallido*.
- Al finalizar, aparece el botón **Descargar archivo**.
- **Caducidad**: Por seguridad y para optimizar el almacenamiento del servidor, los enlaces de descarga son válidos durante **24 horas**. Pasado ese tiempo, la exportación caduca y deberá solicitar una nueva si la requiere.
