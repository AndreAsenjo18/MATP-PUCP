## Context

`/importacion` es una sola página con dos modos (`app/importacion/page.tsx`): en modo `live` monta `LiveImportWizard`, y en modo `mock` un asistente de demostración propio. Encima de ambos hay una tarjeta suelta, `PhotoImportEntry`, con un enlace a `/importacion/fotos` (el asistente de solo fotografías, `PhotoCatalogWizard`).

Estado actual observado en el código:

- `LiveImportWizard` guarda el lote en la dirección (`?lote=<id>`): sube el archivo y hace `router.replace('/importacion?lote=…')`. Sin `lote`, muestra `UploadPanel` (`ImportUpload.tsx`): zona de subida, la lista «Antes de subir» (5 viñetas, constante `GUIDE`), `FormatPicker` («Formato del archivo» con «Detectar automáticamente» y una opción por plantilla guardada), «Más opciones» (régimen por defecto) y el botón.
- Con un lote mapeado, el asistente siempre muestra `ImportPhotosPanel` y `ImportPhotoTray` (fotos opcionales junto con el Excel).
- El asistente ya sabe qué hacer cuando la detección falla (`FormatProblemPanel`) y permite cambiar de formato desde la revisión (`FormatBar` → `changingFormat`), y ya tiene `TenureBanner` para las filas sin régimen. Es decir: lo que `FormatPicker` y «Más opciones» piden por adelantado ya se puede decidir después, con los datos a la vista.
- `Importar otro archivo` (al final del lote) hace `router.replace('/importacion')`.
- Los enlaces de Inicio y de Duplicados apuntan a `/importacion`.

Restricciones: solo frontend, sin cambios de API ni de contrato; el flujo de fotos y el de Excel conservan su comportamiento; todo texto sin identificadores de requisitos (spec «Lenguaje llano»).

## Goals / Non-Goals

**Goals:**
- Que la primera decisión de la persona sea qué quiere importar, con tres tarjetas y casi nada de texto.
- Que subir un Excel no pida decisiones técnicas por adelantado.
- Que los tres flujos queden accesibles con el mismo número de clics o menos que hoy.
- No romper enlaces ni lotes en curso.

**Non-Goals:**
- Cambiar cómo se leen los nombres de las fotos, cómo se aplican las plantillas o las reglas de clasificación.
- Importar Word o Access.
- Renombrar «formato» en los paneles que se conservan (pregunta Y1 sigue abierta).
- Tocar el modo `mock` más allá de mostrarle la elección.

## Decisions

### D1. La elección de origen vive en la misma ruta `/importacion`, con `origen` en la dirección

`/importacion` sin `lote` ni `origen` válido muestra las tres tarjetas. Las tarjetas son enlaces (no estado interno):

| Tarjeta | Destino |
|---|---|
| Solo Excel | `/importacion?origen=excel` |
| Solo imágenes | `/importacion/fotos` (existente) |
| Excel e imágenes | `/importacion?origen=excel-fotos` |

Con `lote` en la dirección se ignora la elección y se abre el asistente (así los enlaces guardados, los de Inicio y el retomar tras recargar siguen funcionando). `origen` ausente con `lote` = comportamiento actual.

*Alternativas*: una ruta nueva (`/importacion/excel`): obliga a mantener las dos rutas y a redirigir los enlaces con `lote`; descartada. Guardar la elección en estado o en `localStorage`: se pierde al compartir el enlace o recargar; descartada.

### D2. `origen` solo decide si se ve el paso de fotos; no cambia los datos del lote

`origen=excel` oculta `ImportPhotosPanel` e `ImportPhotoTray`. `origen=excel-fotos` los muestra como parte del recorrido, con una frase («Ahora las fotos: se emparejan con las filas del Excel»). Sin `origen`, como hoy (opcional). Ocultar el panel no borra nada: un lote con fotos ya subidas las conserva (spec, escenario «Lote con fotos ya subidas y origen cambiado a mano»).

Hay que **conservar `origen` en cada `router.replace`** del asistente: tras la subida (`?lote=…&origen=…`) y en «Importar otro archivo» (vuelve a `/importacion?origen=…`, no a la pantalla de elección, para no obligar a elegir otra vez).

*Alternativa*: guardar el origen en el lote (campo nuevo en la API): requiere cambio de contrato y migración, innecesario para decidir qué se muestra; descartada. Costo aceptado: editar la dirección a mano cambia lo que se ve.

### D3. `UploadPanel` queda mínimo y la detección siempre es automática

Se quitan de la primera pantalla `FormatPicker` y la lista `GUIDE` visible. La guía pasa a un `<details>` con un solo resumen, «¿Cómo preparo mi Excel?». `onUpload` deja de recibir `templateId` (siempre `null` = detección automática). Los componentes `FormatPicker`/`FormatOption` se **reutilizan** en `FormatProblemPanel` y en el cambio de formato desde la revisión si ya los usan; si solo los usaba `UploadPanel`, se eliminan.

*Alternativa*: dejar el selector plegado en «Más opciones». Sigue exigiendo que la persona entienda «formato» antes de empezar; los paneles posteriores ya cubren el caso con el archivo a la vista. Descartada.

### D4. El régimen por defecto se ofrece en la revisión

`UploadOptions.tenureDefault` deja de llenarse desde la primera pantalla (queda siempre `""`). La persona lo elige en `TenureBanner`, que ya lista las filas afectadas, advierte de las decisiones que se pierden al revalidar y se oculta cuando no hace falta (spec «Corrección del régimen de tenencia desde la previsualización», modificada).

Consecuencia que se acepta: un archivo sin columna de régimen se valida primero con el error en todas sus filas y luego se corrige con el aviso, en lugar de evitarlo antes de subir. Es la misma ruta que ya sigue cualquier archivo con filas sin régimen.

*Riesgo de contrato*: el API conserva el parámetro de régimen por defecto del lote; solo la interfaz deja de enviarlo al subir. No hay cambio de API.

### D5. Textos y nombres

- Pregunta: «¿Qué desea importar?». Tarjetas, una línea cada una:
  - **Solo Excel** — «Sábanas de piezas en Excel o CSV.»
  - **Solo imágenes** — «Fotos de piezas que ya están registradas. Una foto sin pieza no crea una pieza.»
  - **Excel e imágenes** — «Piezas en Excel y sus fotos. Las fotos se suben después del Excel.»
- Los textos son `[SUPUESTO]` hasta que el museo los vea; se registran en `docs/preguntas-contraparte.md`.
- El término «formato» se conserva donde sigue apareciendo (no reconocido, cambiar formato). Pregunta Y1 («¿formato» o «plantilla»?) sigue abierta.

### D6. Permisos y modo `mock`

La pantalla de elección exige `imports.prepare`, igual que los dos asistentes (reutiliza el aviso de `PermissionNotice`). En modo `mock` se muestra la misma elección; *Solo Excel* y *Excel e imágenes* abren el asistente de demostración sin diferencia entre ambos, que se documenta en el manual de demostración.

### D7. Estructura de código

Un componente nuevo `ImportOriginPicker` (tarjetas, sin lógica de datos) y una función pura `originFromParams(params)` que devuelve `"excel" | "excel-fotos" | null` y acepta solo esos dos valores. `page.tsx` decide entre el selector y el asistente con `lote`/`origen`. Funciones puras con pruebas directas, como en `navigation.ts`.

## Risks / Trade-offs

- **[Un clic más para quien siempre sube un Excel]** → La mayoría de las personas importa el histórico una vez; el clic extra se compensa con la pantalla de subida más corta. Si el museo prefiere entrar directo, `/importacion?origen=excel` se puede fijar como acceso del Inicio sin tocar el diseño.
- **[Enlaces y lotes en curso]** → `lote` tiene prioridad sobre la elección y `origen` ausente conserva el comportamiento anterior; prueba explícita de ambos casos.
- **[Retirar el selector de formato rompe un flujo conocido del equipo (p. ej. elegir «Lote de demostración v1» a mano)]** → La detección automática reconoce ese formato por sus cabeceras (documentado en `data/fixtures/lote_demo/LEEME.md`); si no reconoce el archivo, el panel de formato no reconocido ofrece la misma lista.
- **[Régimen por defecto: más filas con error en la primera validación]** → Se acepta (D4); el aviso de régimen ya existe y se prueba.
- **[Textos de las tarjetas sin validar con el museo]** → Marcados `[SUPUESTO]`; son la primera pregunta de la próxima entrevista sobre importación.
- **[Dos asistentes con distinta cantidad de pasos]** → El de Excel mantiene sus cuatro pasos y el de fotos sus tres; la elección de origen no es un paso más y no se cuenta en la barra.

## Migration Plan

Solo interfaz: se despliega con el frontend, sin migraciones ni cambios de API. Reversión: revertir el commit; los lotes creados con `origen` en la dirección siguen abriendo (el parámetro se ignora). Actualizar capturas y manual en el mismo PR.

## Open Questions

- ¿El museo prefiere entrar directo al asistente de Excel? (si sí, la elección puede aparecer solo la primera vez o desde un enlace «Otro tipo de importación»).
- Y1: ¿«formato» o «plantilla» (o «tipo de archivo»)? Afecta los paneles posteriores, no esta pantalla.
- ¿Debe *Excel e imágenes* pedir la carpeta de fotos antes de validar el Excel? Hoy las fotos se suben con el lote ya mapeado porque se emparejan con sus filas; se mantiene.
