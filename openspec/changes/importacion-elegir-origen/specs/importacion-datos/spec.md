## ADDED Requirements

### Requirement: Elección del origen de la importación
La pantalla Importación MUST abrir con la pregunta «¿Qué desea importar?» y tres opciones en tarjetas: **Solo Excel**, **Solo imágenes** y **Excel e imágenes**, cada una con un título y una sola línea de explicación, sin otro texto ni controles. *Solo Excel* y *Excel e imágenes* SHALL abrir el asistente del Excel; *Solo imágenes* SHALL abrir el asistente de fotografías para piezas ya registradas. La tarjeta *Solo imágenes* MUST indicar que es para piezas **ya registradas**, y la tarjeta *Excel e imágenes* MUST indicar que las fotos se suben después del Excel. La elección SHALL conservarse en la dirección de la pantalla (`origen`) para que recargar la página o compartir el enlace mantenga el mismo flujo. Esta pantalla MUST NOT mostrarse cuando la dirección trae un lote en curso (`lote`), que se retoma donde quedó, y MUST exigir el mismo permiso de preparar importaciones que los asistentes que abre. Los textos MUST NOT contener identificadores de requisitos. (RF-021, RF-045, RF-046, RNF-001, RNF-010)

#### Scenario: Entrar a Importación sin lote
- **WHEN** una persona con permiso de preparar importaciones abre Importación sin ningún lote en la dirección
- **THEN** ve la pregunta «¿Qué desea importar?» y las tres tarjetas, y ningún formulario de subida

#### Scenario: Elegir solo Excel
- **WHEN** la persona elige «Solo Excel»
- **THEN** se abre el asistente del Excel con `origen=excel` en la dirección

#### Scenario: Elegir solo imágenes
- **WHEN** la persona elige «Solo imágenes»
- **THEN** se abre el asistente de fotografías para piezas existentes y la tarjeta ya advirtió que una foto sin pieza no crea una pieza

#### Scenario: Elegir Excel e imágenes
- **WHEN** la persona elige «Excel e imágenes»
- **THEN** se abre el asistente del Excel con `origen=excel-fotos` en la dirección

#### Scenario: Retomar un lote en curso
- **GIVEN** un lote en previsualización y su enlace `/importacion?lote=…`
- **WHEN** la persona abre el enlace
- **THEN** el asistente se abre en el estado del lote, sin pasar por las tres tarjetas

#### Scenario: Origen desconocido en la dirección
- **WHEN** la dirección trae `origen=otro` y ningún lote
- **THEN** se muestra la pantalla de elección, sin error

#### Scenario: Rol sin permiso de importar
- **WHEN** una persona sin permiso de preparar importaciones abre Importación
- **THEN** ve el aviso de que su rol no puede preparar cargas masivas y ninguna de las tres tarjetas

### Requirement: Paso de fotografías según el origen elegido
El asistente del Excel MUST mostrar el paso de fotografías del lote según el origen elegido: con `origen=excel-fotos` SHALL presentarlo como parte del recorrido, a continuación de la validación y con la indicación de que las fotos se emparejan con las filas del Excel; con `origen=excel` MUST NOT mostrarlo ni la bandeja de fotos. Un lote sin `origen` en la dirección (enlaces anteriores a este cambio) SHALL comportarse como hasta ahora, con la subida de fotos disponible y opcional. Cambiar de origen en un lote ya creado MUST NOT descartar las fotos que ya tiene. (RF-045, RF-021, RNF-010)

#### Scenario: Excel e imágenes
- **GIVEN** un lote validado con `origen=excel-fotos`
- **WHEN** la persona llega a la revisión
- **THEN** el asistente muestra la zona para arrastrar la carpeta de fotos y explica que se emparejan con las filas

#### Scenario: Solo Excel
- **GIVEN** un lote validado con `origen=excel`
- **WHEN** la persona llega a la revisión
- **THEN** no se muestra la zona de subida de fotos ni la bandeja de fotos por revisar

#### Scenario: Enlace anterior sin origen
- **WHEN** la persona abre `/importacion?lote=…` sin `origen`
- **THEN** el asistente muestra la subida de fotos opcional igual que antes de este cambio

#### Scenario: Lote con fotos ya subidas y origen cambiado a mano
- **GIVEN** un lote con 40 fotos registradas
- **WHEN** la dirección se edita para dejar `origen=excel`
- **THEN** las 40 fotos siguen en el lote y no se pierden, aunque el paso de fotos no se muestre

## RENAMED Requirements

- FROM: `### Requirement: Subida guiada con formato elegido de antemano`
- TO: `### Requirement: Subida mínima con detección automática del formato`

## MODIFIED Requirements

### Requirement: Subida mínima con detección automática del formato
El asistente del Excel MUST ofrecer, antes de subir el archivo, solo una zona donde arrastrar y soltar o seleccionar un archivo `.xlsx` o `.csv` y el botón para subirlo. La plantilla de mapeo (el **formato**) SHALL detectarse siempre por los títulos de las columnas; el asistente MUST NOT pedir elegir un formato antes de subir. La guía de lo que debe traer el archivo (no más de cinco líneas: una fila por pieza, títulos en la primera fila, denominación y régimen de tenencia) SHALL quedar plegada bajo un único enlace, «¿Cómo preparo mi Excel?». Elegir o cambiar el formato SHALL ofrecerse después de subir, cuando la detección no reconoce el archivo o cuando la persona decide cambiarlo desde la revisión; un formato elegido así MUST aplicarse sin sugerir otro. La zona de subida SHALL rechazar en el momento, con un mensaje que indique qué tipos se admiten, cualquier archivo que no sea `.xlsx` o `.csv`, y MUST poder usarse con teclado y en una pantalla de 360 px de ancho. (RF-021, RF-022, RNF-001, RNF-010)

#### Scenario: Arrastrar un Excel
- **WHEN** una persona arrastra `lote_demo_sabana.xlsx` sobre la zona de subida
- **THEN** la zona resalta mientras el archivo está encima y, al soltarlo, muestra el nombre y el tamaño del archivo y habilita el botón de subir

#### Scenario: Archivo de otro tipo
- **WHEN** una persona suelta un archivo `.docx` o `.pdf` sobre la zona de subida
- **THEN** el archivo no se selecciona y la zona indica que solo se admiten archivos Excel (.xlsx) o CSV

#### Scenario: Formato por defecto
- **WHEN** la persona abre el asistente del Excel sin tocar nada
- **THEN** la detección automática es el comportamiento por defecto: ve la zona de subida, el botón para subir y el enlace «¿Cómo preparo mi Excel?», y no ve ninguna lista de formatos

#### Scenario: Guía plegada
- **WHEN** la persona pulsa «¿Cómo preparo mi Excel?»
- **THEN** se despliegan como máximo cinco líneas con lo que debe traer el archivo, y al pulsar de nuevo se pliegan

#### Scenario: Archivo que ninguna plantilla reconoce
- **WHEN** la persona sube un archivo cuyos títulos no coinciden con ninguna plantilla
- **THEN** el asistente se detiene antes de validar, dice que no reconoce el formato y ofrece elegir uno de los formatos disponibles o ajustar las columnas

#### Scenario: Cambiar el formato desde la revisión
- **GIVEN** un lote revisado con un formato detectado
- **WHEN** la persona pulsa para cambiar el formato y elige otro
- **THEN** el lote se vuelve a leer con ese formato, sin volver a subir el archivo

### Requirement: Corrección del régimen de tenencia desde la previsualización
El sistema MUST permitir indicar un régimen de tenencia por defecto desde la previsualización, sin volver a subir el archivo, y no antes de subirlo. Cuando la previsualización contiene filas con el error de régimen faltante, SHALL mostrar un aviso con el número de filas afectadas y la acción de elegir un régimen para todas ellas y volver a validar el lote; como revalidar recalcula todas las filas, el aviso MUST decir antes de confirmar cuántas decisiones ya tomadas se descartarán, y el sistema SHALL indicar después cuántas filas dejaron de tener el error. El régimen elegido SHALL aplicar solo a las filas que no lo traen. Si ninguna fila tiene el error, el aviso MUST NOT mostrarse. (RF-022, RF-025, RF-026, RNF-010)

#### Scenario: Archivo sin columna de régimen
- **GIVEN** un lote validado en el que 30 filas muestran «Falta el régimen de tenencia.»
- **WHEN** la persona elige «Propiedad» en el aviso y confirma
- **THEN** el lote se revalida con ese régimen por defecto y la previsualización informa que 30 filas ya no tienen ese error

#### Scenario: Decisiones tomadas antes de revalidar
- **GIVEN** un lote en el que la persona ya dejó fuera 2 filas y rechazó 1
- **WHEN** abre el aviso de régimen para asignarlo a las filas sin dato
- **THEN** el aviso dice que las 3 decisiones que ya tomó se pierden al validar de nuevo, y no muestra ese texto si no hay decisiones

#### Scenario: Régimen elegido incompatible con los códigos de una fila
- **WHEN** la persona asigna «Comodato» a filas que traen código I
- **THEN** esas filas pasan a mostrar el error de comodato con código I, con su explicación y sugerencia, y no se aceptan

#### Scenario: Filas con régimen propio
- **WHEN** el lote trae régimen en algunas filas y la persona asigna uno por defecto a las demás
- **THEN** las filas que ya traían régimen conservan el suyo

#### Scenario: Archivo que ya trae el régimen en todas las filas
- **WHEN** el lote se valida y ninguna fila tiene el error de régimen faltante
- **THEN** la previsualización no muestra el aviso ni ofrece elegir un régimen por defecto
