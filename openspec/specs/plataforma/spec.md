# plataforma Specification

## Purpose
Borrador sujeto a aprobación de alcance (S7) y validación con la contraparte. Define los atributos transversales de plataforma del sistema del MATP: diseño responsive, operación en free tier y en la VM institucional, documentación para terceros, tolerancia a conexión lenta, independencia de servicios productivos, API documentada, usabilidad, respaldos y capacidad.
## Requirements
### Requirement: Interfaz responsive
El sistema MUST ser plenamente usable en escritorio como dispositivo principal y SHALL ofrecer en tablet y móvil al menos búsqueda por código, consulta de ficha con fotos y ubicación, y registro de movimientos y verificaciones físicas en depósito. (RNF-001)

#### Scenario: Consulta en depósito desde móvil
- **WHEN** un Personal auxiliar de depósito busca un código desde un móvil de 360 px de ancho
- **THEN** ve la ficha resumida, las fotos y la ubicación sin desplazamiento horizontal

#### Scenario: Función de escritorio en móvil
- **WHEN** un usuario abre el asistente de importación desde un móvil
- **THEN** el sistema informa que se recomienda usar escritorio para esa función, sin romper la interfaz

### Requirement: Operación en free tier y portabilidad de despliegue
El sistema MUST desplegarse completo mediante contenedores parametrizados por variables de entorno, tanto en la VM Linux institucional como en servicios free tier de contingencia, sin cambios de código al cambiar de base de datos gestionada, almacenamiento S3-compatible o proveedor de hosting. (RNF-002, RNF-008)

#### Scenario: Cambio de almacenamiento
- **WHEN** se cambia la configuración de almacenamiento de MinIO local a un servicio S3-compatible en la nube
- **THEN** el sistema funciona modificando solo variables de entorno

#### Scenario: Variable obligatoria ausente
- **WHEN** se inicia un servicio sin una variable de entorno obligatoria
- **THEN** el servicio no arranca e indica con claridad qué variable falta

### Requirement: Independencia de servicios productivos
El sistema MUST poder ejecutarse y demostrarse completo en local sin depender de servicios externos pagados ni productivos, incluida la IA (proveedor simulado) y el correo. (RNF-008)

#### Scenario: Demo sin internet
- **GIVEN** el entorno local levantado sin conexión a internet
- **WHEN** se recorre el flujo de búsqueda, ficha, importación y sugerencias de IA
- **THEN** todas las funciones responden usando servicios locales y el proveedor simulado

### Requirement: Documentación para mantenimiento por terceros
El sistema MUST mantener documentación suficiente para que un equipo ajeno lo instale, opere y mantenga: guía de instalación, arquitectura, decisiones (ADR), modelo de datos, contratos de API, procedimientos de respaldo y restauración, y specs vigentes. (RNF-004)

#### Scenario: Instalación por un tercero
- **WHEN** una persona que no participó en el desarrollo sigue la guía de instalación
- **THEN** levanta el entorno local sin asistencia del equipo

#### Scenario: Cambio sin documentación
- **WHEN** un PR modifica un contrato de API sin actualizar la especificación publicada
- **THEN** la integración continua falla indicando la desactualización [SUPUESTO: verificación automatizada en CI]

### Requirement: Tolerancia a conexión lenta
El sistema SHALL funcionar con conexiones lentas o inestables: carga progresiva de imágenes en tamaños reducidos, paginación, indicadores de carga, reintentos en subidas de archivos y conservación de formularios no guardados ante cortes. (RNF-005)

#### Scenario: Galería con conexión lenta
- **WHEN** un usuario abre la galería de una pieza con una conexión lenta
- **THEN** ve primero miniaturas livianas y el original solo se descarga a demanda

#### Scenario: Corte durante la subida
- **WHEN** se corta la conexión durante la subida de una foto
- **THEN** el sistema informa el fallo y permite reintentar sin volver a llenar los datos

### Requirement: API documentada para integraciones futuras
El sistema MUST exponer una API REST versionada y documentada con una especificación OpenAPI publicada, apta para integraciones futuras (SURDOC, Getty AAT), y SHALL marcar explícitamente los endpoints no implementados. (RNF-009)

#### Scenario: Consulta de la especificación
- **WHEN** un desarrollador autorizado consulta la documentación de la API
- **THEN** obtiene la especificación OpenAPI con esquemas y ejemplos

#### Scenario: Endpoint no implementado
- **WHEN** se invoca un endpoint marcado como no implementado
- **THEN** la API responde con un estado que lo indica explícitamente y no con un error genérico

### Requirement: Usabilidad para baja alfabetización digital
El sistema SHALL ser operable por personas con baja alfabetización digital: textos en español claro, botones grandes con etiqueta, mensajes de error que indican cómo corregir, confirmación antes de acciones irreversibles o masivas y flujos por pasos. (RNF-010)

#### Scenario: Confirmación antes de acción masiva
- **WHEN** un usuario pulsa aprobar un lote de importación
- **THEN** el sistema muestra un resumen en lenguaje claro y pide confirmación antes de aplicar

#### Scenario: Mensaje de error comprensible
- **WHEN** una validación falla
- **THEN** el mensaje indica en español qué dato corregir y dónde, sin códigos técnicos

### Requirement: Respaldos automáticos con restauración probada
El sistema MUST ejecutar respaldos automáticos periódicos de la base de datos y del almacenamiento de archivos, con retención configurable y copia fuera del servidor principal, y SHALL contar con un procedimiento de restauración documentado y probado periódicamente. La frecuencia y retención son [SUPUESTO: diario con 30 días]. (RNF-011)

#### Scenario: Respaldo diario
- **WHEN** se cumple la hora programada
- **THEN** se genera el respaldo, se verifica su integridad y queda registrado su resultado

#### Scenario: Respaldo fallido
- **WHEN** un respaldo programado falla
- **THEN** el sistema registra el fallo y notifica al Administrador

#### Scenario: Prueba de restauración
- **WHEN** se ejecuta el procedimiento de restauración en un entorno de prueba con el último respaldo
- **THEN** el sistema queda operativo con los datos del respaldo y se registra el resultado de la prueba

### Requirement: Capacidad y concurrencia
El sistema MUST soportar al menos 20 000 piezas con sus identificadores, fotos y auditoría, y 10 usuarios concurrentes, manteniendo los tiempos de respuesta objetivo. (RNF-015)

#### Scenario: Prueba de carga
- **GIVEN** una base sintética de 20 000 piezas
- **WHEN** 10 usuarios concurrentes buscan, consultan fichas y editan
- **THEN** no se producen errores y los tiempos se mantienen dentro del objetivo de búsqueda

#### Scenario: Superación del volumen objetivo
- **WHEN** el catálogo supera las 20 000 piezas
- **THEN** el sistema sigue operando y los indicadores de monitoreo permiten detectar degradación

### Requirement: Entorno local reproducible con verificación de salud
El sistema MUST poder levantarse completo en local con un único comando documentado que inicia la base de datos, el almacenamiento S3-compatible, la API —que incluye la IA asistiva en su propio contenedor— y la interfaz web; cada servicio de backend SHALL exponer una verificación de salud consultable sin autenticación que no revela secretos, y la IA asistiva MUST arrancar con el proveedor simulado cuando no se configure otro. (RNF-002, RNF-004, RNF-008, RN-009)

#### Scenario: Levantar el entorno completo
- **GIVEN** una copia del repositorio con el archivo de variables de ejemplo copiado como configuración local
- **WHEN** una persona ejecuta el comando documentado para levantar el entorno
- **THEN** los cuatro servicios quedan en ejecución y la interfaz web muestra el estado de la API y de la IA asistiva

#### Scenario: Verificación de salud de la API
- **WHEN** se consulta la verificación de salud de la API con la base de datos disponible
- **THEN** responde correctamente indicando el nombre del servicio, su versión y el estado de sus dependencias, sin incluir contraseñas ni claves

#### Scenario: Dependencia caída
- **WHEN** se consulta la verificación de salud de la API y la base de datos no está disponible
- **THEN** la respuesta indica un estado degradado y qué dependencia falla, sin exponer credenciales

#### Scenario: Proveedor de IA por defecto
- **WHEN** la API arranca sin la variable de proveedor de IA definida
- **THEN** la IA asistiva utiliza el proveedor simulado y su verificación de salud, servida por la API, lo informa

#### Scenario: Proveedor de IA desconocido
- **WHEN** la API arranca con un nombre de proveedor de IA no soportado
- **THEN** el arranque falla e indica los valores de proveedor permitidos

#### Scenario: IA asistiva sin contenedor propio
- **WHEN** se levanta el entorno y se consulta la verificación de salud de la IA asistiva
- **THEN** responde en la misma dirección y puerto de la API, bajo la ruta configurada para la IA, sin que exista un contenedor ni un puerto dedicados

### Requirement: Integración continua obligatoria
El repositorio MUST ejecutar automáticamente en cada pull request el análisis estático y las pruebas de la API, de la IA asistiva y de la interfaz web, además de la validación estricta de todas las specs y changes de OpenSpec, y SHALL marcar el pull request como fallido si cualquiera de esos pasos falla. (RNF-004, RNF-009)

#### Scenario: Pull request correcto
- **WHEN** se abre un pull request cuyo código pasa análisis estático, pruebas y validación de specs
- **THEN** la integración continua finaliza en estado exitoso

#### Scenario: Spec inválida
- **WHEN** un pull request incluye un change de OpenSpec con un requirement sin escenarios
- **THEN** la integración continua falla e indica el error de validación de specs

#### Scenario: Prueba fallida
- **WHEN** un pull request rompe una prueba de la API
- **THEN** la integración continua falla y el pull request no puede considerarse listo para revisión

### Requirement: Datos de demostración sintéticos reproducibles
El sistema MUST ofrecer un comando documentado que cargue en un entorno vacío un conjunto de datos exclusivamente sintético y reproducible (misma semilla, mismos datos) que reproduzca a propósito los problemas reales del catálogo: códigos con puntos, espacios y ceros a la izquierda, varios códigos en una misma celda, piezas sin código I, piezas en comodato, duplicados probables, épocas en texto libre, ubicaciones incompletas y varias fotos por pieza; SHALL negarse a ejecutarse sobre un catálogo que ya contiene piezas. Las siglas y nombres de colecciones usados son ilustrativos [SUPUESTO]. (RNF-008, RNF-014)

#### Scenario: Carga inicial de demostración
- **GIVEN** una base de datos migrada y sin piezas
- **WHEN** se ejecuta el comando de datos semilla
- **THEN** el catálogo contiene alrededor de 300 piezas sintéticas en varias colecciones ficticias, piezas sueltas, aproximadamente la mitad sin código I y piezas en comodato sin código I

#### Scenario: Reproducibilidad
- **WHEN** se ejecuta el comando dos veces con la misma semilla sobre bases vacías distintas
- **THEN** ambas bases contienen las mismas piezas con los mismos códigos originales

#### Scenario: Catálogo con datos
- **WHEN** se ejecuta el comando sobre una base que ya contiene piezas
- **THEN** el comando no modifica nada e indica cómo recrear un entorno vacío

#### Scenario: Ausencia de datos personales reales
- **WHEN** se revisan los usuarios, registradores, donantes y comodantes de los datos semilla
- **THEN** todos los nombres y correos son ficticios y están identificados como sintéticos

### Requirement: Contrato OpenAPI versionado, exportable y con cliente tipado
La API MUST publicar todas sus rutas de negocio bajo un prefijo de versión (`/api/v1`), con esquemas de entrada y salida, ejemplos y un formato de error uniforme en español (código estable, mensaje y detalles). Toda operación aún no implementada SHALL estar marcada en la especificación OpenAPI (`x-status: stub` y el change responsable) y responder `501` con un cuerpo que lo indique y un ejemplo de respuesta. La especificación MUST poder exportarse a `docs/api/` con un comando documentado sin levantar contenedores, y el cliente tipado del frontend SHALL generarse desde ese archivo. (RNF-009, RNF-004)

#### Scenario: Exportación reproducible del contrato
- **WHEN** un desarrollador ejecuta el comando de exportación de OpenAPI dos veces sin cambiar el código
- **THEN** obtiene exactamente el mismo archivo `docs/api/openapi.json`

#### Scenario: Contrato desactualizado
- **GIVEN** un cambio en un esquema o ruta de la API sin volver a exportar el contrato
- **WHEN** se ejecutan las pruebas de la API
- **THEN** una prueba falla indicando que se debe ejecutar el comando de exportación

#### Scenario: Operación stub
- **WHEN** un cliente invoca una operación marcada como stub, por ejemplo aprobar un lote de importación
- **THEN** recibe estado 501 con código `not_implemented`, el nombre del change que la implementará y un ejemplo del cuerpo que devolverá

#### Scenario: Error de negocio
- **WHEN** un cliente crea una colección con una sigla que coincide, tras normalizarla, con la de otra colección vigente
- **THEN** recibe un error 422 con código estable `duplicate_acronym` y un mensaje en español que indica la colección existente

#### Scenario: Recurso inexistente o eliminado
- **WHEN** un cliente solicita una pieza eliminada lógicamente o inexistente
- **THEN** recibe 404 con código `not_found` sin datos de la pieza

### Requirement: Prototipo navegable en modo simulado (mock)
La interfaz web MUST poder ejecutarse y recorrerse completa sin backend, base de datos ni conexión a internet, sirviendo datos sintéticos tipados según el contrato de la API vigente, mediante una variable de entorno de modo de datos (`NEXT_PUBLIC_API_MODE`). El modo simulado SHALL expresar en la interfaz las reglas de negocio (RN-001..RN-010) sin persistir ningún cambio: el código I no es editable una vez asignado, una pieza en comodato nunca puede recibir código I, ninguna acción destructiva se presenta como borrado físico (siempre "marcar como...", "fusionar" o equivalente con confirmación previa), y ninguna sugerencia de IA se muestra como aprobada sin una acción explícita de revisión humana. El sistema SHALL permitir cambiar al modo conectado a la API real sin modificar el código de las pantallas. (RNF-002, RNF-008, RNF-010, RNF-001)

#### Scenario: Recorrido completo sin backend
- **GIVEN** el frontend iniciado en modo simulado y sin ningún otro servicio del proyecto en ejecución
- **WHEN** una persona recorre búsqueda, ficha de pieza, asistente de importación, cola de duplicados y revisión de sugerencias de IA
- **THEN** todas las pantallas responden con datos sintéticos coherentes, sin errores de red ni pantallas en blanco

#### Scenario: Intento de editar un código I en modo simulado
- **WHEN** en modo simulado se intenta editar el código I de una pieza que ya lo tiene
- **THEN** el campo se muestra bloqueado (candado) y el sistema explica que solo un Administrador puede corregirlo mediante un procedimiento auditado, igual que en la API real

#### Scenario: Acción irreversible sin confirmación
- **WHEN** una persona pulsa una acción destructiva (por ejemplo, fusionar un duplicado) sin haber confirmado el diálogo
- **THEN** el sistema no aplica ningún cambio sobre los datos simulados hasta que se confirma explícitamente

#### Scenario: Cambio a modo conectado sin datos disponibles
- **GIVEN** el frontend configurado en modo conectado a la API real
- **WHEN** la API no responde o el endpoint todavía es un stub del contrato
- **THEN** la pantalla muestra un mensaje claro de que la función no está disponible en este entorno, en vez de fallar silenciosamente o mostrar datos simulados sin advertirlo

### Requirement: Sistema de diseño institucional con tokens y contraste accesible
La interfaz web MUST definir sus colores y tipografías como tokens con nombre en un único lugar del frontend (paleta institucional: `terracota`, `terracota-dark`, `terracota-light`, `tinta`, `crema`, `crema-light`, `borde`, `gris-texto`, `verde-exito`, `verde-bg`, `ambar-alerta`, `ambar-bg`, `ambar-texto`, `carmin-peligro`, `carmin-bg`, `carmin-texto`; tipografías `heading` y `sans`), y los componentes y pantallas SHALL usar únicamente esos tokens, sin clases de la paleta genérica de Tailwind (`stone`, `gray`, `red`, `amber`, `emerald`, `sky`, etc.) ni valores hexadecimales sueltos. Todo par de texto sobre fondo que el sistema de diseño declare como combinación de uso MUST alcanzar una relación de contraste de al menos 4.5:1 (WCAG 2.2 AA para texto normal). Los valores de la paleta provienen del documento del equipo; que coincidan con la identidad visual oficial del museo es un [SUPUESTO]. (RNF-004, RNF-010)

#### Scenario: Cambio de un color institucional en un solo lugar
- **GIVEN** que todas las pantallas usan los tokens del sistema de diseño
- **WHEN** una persona del equipo cambia el valor del token `terracota`
- **THEN** botones primarios, enlaces activos y badges informativos de todas las pantallas cambian de color sin editar ningún otro archivo

#### Scenario: Clase de paleta genérica en un componente
- **WHEN** un componente o una pantalla usa una clase como `bg-stone-900` o `text-red-700`, o un color hexadecimal escrito a mano
- **THEN** la prueba automática del frontend falla e indica el archivo y la clase que debe reemplazarse por un token

#### Scenario: Par de colores sin contraste suficiente
- **WHEN** se declara una combinación de uso cuyo texto sobre fondo tiene un contraste menor de 4.5:1 (por ejemplo, `ambar-alerta` sobre `ambar-bg`, 2.7:1)
- **THEN** la prueba de contraste falla y la combinación no puede usarse para texto; el texto de advertencia usa `ambar-texto` sobre `ambar-bg`

### Requirement: Biblioteca de componentes por niveles
El frontend MUST organizar sus componentes compartidos en tres niveles con dependencias en un solo sentido: `ui` (átomos sin reglas del museo: `Button`, `Badge`, `Card`, `Input`, `Select`, `Textarea`), `domain` (moléculas que aplican reglas del museo: `PieceCard`, `PieceSheet`, `ImportConflictModal` y los badges de tenencia, alertas, candado y estado) y `layout` (estructura de pantalla: `Sidebar`, `MainLayout`). Un componente de `ui` MUST NOT importar de `domain`, `layout` ni de los datos del dominio; un componente de `layout` MUST NOT contener reglas de inventario. Las pantallas SHALL construirse combinando estos componentes, y los nombres de componentes y propiedades SHALL estar en inglés (ADR-002). (RNF-004)

#### Scenario: Botón reutilizado en una pantalla nueva
- **WHEN** una persona del equipo necesita un botón de acción principal con icono en una pantalla nueva
- **THEN** usa `Button` con `variant="primary"` e `icon`, sin repetir clases de estilo, y obtiene el mismo tamaño, color y estado deshabilitado que en el resto del sistema

#### Scenario: Átomo que importa lógica del museo
- **WHEN** un archivo de `components/ui/` importa de `components/domain/`, `components/layout/` o de `lib/fixtures`/`lib/data`
- **THEN** la prueba de arquitectura del frontend falla y nombra el archivo y la importación prohibida

#### Scenario: Acción irreversible con el botón de peligro
- **WHEN** una pantalla necesita una acción irreversible o masiva (fusionar duplicados, aprobar un lote)
- **THEN** usa el botón de confirmación del sistema, que se apoya en `Button` con `variant="danger"` o `"primary"` y sigue pidiendo confirmación explícita antes de aplicar (RNF-010, RN-005)

### Requirement: Representación uniforme de estados de pieza
El sistema MUST mostrar cada estado de una pieza siempre con la misma intención visual del componente `Badge` en todas las pantallas: `success` para pieza ubicada o decisión aprobada, `info` para comodato y préstamo temporal, `warning` para información incompleta, sin foto o decisión pendiente, `danger` para conflictos de importación, rechazos y alertas bloqueantes, y `default` para códigos y estados neutros. Todo badge SHALL incluir un texto visible en español (el color nunca es el único portador del significado), y el candado del código I SHALL mostrarse con un icono accesible, no con un emoji. (RNF-010, RN-002, RN-003, RN-008, RN-009)

#### Scenario: Pieza en comodato en búsqueda y ficha
- **WHEN** una pieza en comodato aparece en los resultados de búsqueda y en su ficha
- **THEN** en ambos lugares se muestra el badge «Comodato» con la intención `info`

#### Scenario: Pieza sin foto
- **WHEN** una pieza no tiene fotografías
- **THEN** su tarjeta muestra el aviso «Sin foto» con la intención `warning`, un icono y el texto, legible en blanco y negro

#### Scenario: Estado desconocido
- **WHEN** llega un valor de estado o de alerta que el frontend no tiene mapeado (por ejemplo, un nuevo tipo de alerta añadido en la API)
- **THEN** el badge se muestra con la intención `default` y un texto genérico legible, sin romper la pantalla

### Requirement: Navegación principal con barra lateral responsive
Las pantallas autenticadas MUST compartir una estructura común (`MainLayout`) con barra lateral de navegación en escritorio y, en pantallas menores de 768 px, un botón de menú con etiqueta visible que abre y cierra la navegación. La navegación SHALL mostrar solo las secciones permitidas al rol activo (RF-039), marcar la sección actual, poder usarse con teclado (el menú móvil se cierra con Escape y al elegir una sección) y no producir desplazamiento horizontal en un móvil de 360 px. (RNF-001, RNF-010, RF-039)

#### Scenario: Personal de depósito en móvil
- **GIVEN** un Personal auxiliar de depósito en un móvil de 360 px de ancho
- **WHEN** abre el menú y elige «Vista de depósito»
- **THEN** el menú se cierra, se muestra la pantalla elegida sin desplazamiento horizontal y en el menú solo aparecen las secciones que su rol permite

#### Scenario: Escritorio
- **WHEN** un usuario abre cualquier pantalla autenticada en un monitor de escritorio
- **THEN** ve la barra lateral fija con el nombre del sistema, las secciones permitidas y la actual resaltada, y un encabezado con su nombre, su rol y el cambio de rol

#### Scenario: Pantalla sin sesión
- **WHEN** no hay sesión iniciada (pantalla de acceso)
- **THEN** la pantalla se muestra sin barra lateral ni menú, igual que en la maqueta actual

### Requirement: Tipografía e iconos disponibles sin internet
Las tipografías (Poppins para títulos, Inter para texto) y los iconos del sistema de diseño MUST servirse desde el propio frontend, sin solicitar recursos a servicios externos ni durante la ejecución ni durante la compilación de la imagen, y SHALL tener una familia de respaldo del sistema si la fuente no carga. Los iconos decorativos SHALL ocultarse a lectores de pantalla y los iconos sin texto visible SHALL tener una etiqueta accesible en español. (RNF-008, RNF-010)

#### Scenario: Demo sin conexión
- **GIVEN** el frontend compilado y ejecutándose en una máquina sin internet
- **WHEN** se recorren las pantallas de la maqueta
- **THEN** los títulos se ven en Poppins, el texto en Inter y los iconos se muestran, sin peticiones de red a dominios externos

#### Scenario: Fuente no disponible
- **WHEN** el navegador no puede cargar el archivo de una fuente
- **THEN** el texto se muestra con la fuente de respaldo del sistema, legible y sin texto invisible durante la carga

#### Scenario: Botón solo con icono
- **WHEN** un botón muestra únicamente un icono (por ejemplo, cerrar un diálogo)
- **THEN** tiene una etiqueta accesible en español (por ejemplo, «Cerrar») que anuncia el lector de pantalla

### Requirement: Conformidad con el contrato de interfaces del equipo
Las rutas, los verbos, los identificadores de operación y los campos requeridos de cada esquema de la API MUST coincidir con el documento de interfaces acordado por el equipo (`docs/fuentes/endpoints-api-v1.yaml`), verificado por una prueba automática. Toda operación de la API que ese documento no contemple SHALL estar declarada como añadido justificado en el mapeo publicado (`docs/api/mapeo-endpoints-v1.md`), y ninguna ruta renombrada por el documento SHALL conservarse como alias. Las operaciones que el documento sitúa en fases posteriores MUST exponerse con su forma definitiva y responder `501` citando el change que las implementará. (RNF-009, RNF-004)

#### Scenario: Conformidad con el documento de interfaces
- **WHEN** se ejecutan las pruebas de la API
- **THEN** una prueba compara cada ruta, verbo, identificador de operación y campo requerido del documento de interfaces del equipo con la especificación que genera la aplicación, y falla indicando las diferencias encontradas

#### Scenario: Operación fuera del documento de interfaces
- **GIVEN** una operación de la API que el documento de interfaces del equipo no contempla y que no figura en la lista publicada de añadidos justificados
- **WHEN** se ejecutan las pruebas de la API
- **THEN** la prueba falla indicando la operación y pidiendo que se justifique en el mapeo o se elimine

#### Scenario: Ruta renombrada por el documento
- **WHEN** un cliente invoca una ruta anterior que el documento renombró, por ejemplo la de auditoría sin el sufijo del documento
- **THEN** la API responde 404 y solo la ruta del documento atiende la operación

#### Scenario: Operación de una fase posterior
- **WHEN** un cliente invoca una operación que el documento sitúa en la fase 3, por ejemplo el registro de un préstamo
- **THEN** recibe 501 con el esquema definitivo de la respuesta y el nombre del change que la implementará

### Requirement: Valores de enumerado del contrato en la API
La API MUST aceptar y devolver los valores de enumerado tal como los define el documento de interfaces del equipo (por ejemplo `Propiedad`, `Comodato` y `Préstamo Temporal` para el régimen de tenencia, y `Frontal`, `Perfil`, `Posterior`, `Detalle`, `Abierto` y `Cerrado` para el tipo de vista de una fotografía), SHALL traducirlos en un único punto hacia los códigos internos del dominio, y MUST NOT exponer los códigos internos en ninguna respuesta. Un valor que no pertenezca al enumerado SHALL producir un error de validación que liste los valores admitidos. (RNF-009, RF-005, RF-013)

#### Scenario: Alta de pieza con el valor del documento
- **WHEN** un Catalogador registra una pieza con régimen de tenencia "Comodato"
- **THEN** la API la acepta, la guarda con su código interno y devuelve "Comodato" en la respuesta

#### Scenario: Valor de enumerado no admitido
- **WHEN** un cliente envía el régimen de tenencia "OWNED"
- **THEN** la API responde 422 indicando los valores admitidos: "Propiedad", "Comodato" y "Préstamo Temporal"

#### Scenario: Ninguna respuesta expone códigos internos
- **WHEN** se ejecutan las pruebas de la API sobre las respuestas de piezas, multimedia e importaciones
- **THEN** ninguna contiene los códigos internos en inglés del régimen de tenencia ni del tipo de vista

### Requirement: Paginación uniforme en listados y búsqueda
Los listados y la búsqueda de piezas MUST aceptar los parámetros `page` (desde 1) y `limit`, y SHALL responder con el total de coincidencias, la página, el límite y los elementos de esa página. Un `page` o `limit` fuera de rango SHALL producir un error de validación, y un `page` posterior a la última página SHALL devolver una lista vacía con el total real. (RNF-009, RF-031, RF-032, RF-038)

#### Scenario: Segunda página de resultados
- **GIVEN** 45 piezas que cumplen un filtro de búsqueda
- **WHEN** un usuario solicita la página 2 con límite 20
- **THEN** la respuesta indica un total de 45, la página 2, el límite 20 y contiene las piezas 21 a 40

#### Scenario: Página posterior a la última
- **GIVEN** 45 piezas que cumplen un filtro
- **WHEN** un usuario solicita la página 10 con límite 20
- **THEN** la respuesta indica un total de 45 y una lista vacía de elementos

#### Scenario: Límite fuera de rango
- **WHEN** un usuario solicita un límite de 5000 elementos
- **THEN** la API responde 422 indicando el límite máximo permitido por página

### Requirement: Migraciones verificadas contra PostgreSQL en la integración continua
La integración continua MUST aplicar en cada pull request todas las migraciones de la base de datos sobre una base PostgreSQL vacía, de la misma versión mayor que usa el entorno local, y SHALL marcar el pull request como fallido si alguna de estas condiciones no se cumple:
- la migración hasta la última versión termina sin errores;
- el esquema resultante coincide con el modelo de datos de la aplicación;
- las protecciones que dependen del motor están presentes y activas: búsqueda por similitud, unicidad parcial del código I vigente y registros de solo inserción;
- la reversión completa y la nueva aplicación de las migraciones terminan sin errores.

Las mismas verificaciones MUST poder ejecutarse en local contra la base del entorno con contenedores, y la suite de pruebas habitual SHALL seguir funcionando sin PostgreSQL. (RNF-004, RNF-011, RN-005, RN-002)

#### Scenario: Migración correcta
- **WHEN** se abre un pull request cuyas migraciones se aplican sin errores en PostgreSQL y producen el esquema del modelo de datos
- **THEN** la verificación de migraciones de la integración continua finaliza en estado exitoso

#### Scenario: Migración que solo falla en PostgreSQL
- **WHEN** un pull request incluye una migración que funciona en la base usada por las pruebas unitarias pero falla en PostgreSQL, por ejemplo por una sintaxis de índice parcial no válida
- **THEN** la verificación de migraciones falla, muestra el error del motor y el pull request no puede integrarse en la rama principal

#### Scenario: Modelo y migración desalineados
- **WHEN** un pull request agrega una columna al modelo de datos sin la migración correspondiente
- **THEN** la verificación de migraciones falla e indica la diferencia entre el esquema migrado y el modelo

#### Scenario: Protección de la auditoría ausente
- **WHEN** una migración elimina o deja sin efecto el mecanismo que impide modificar o borrar registros de auditoría
- **THEN** la verificación de migraciones falla porque una modificación de un registro de auditoría en PostgreSQL no es rechazada

#### Scenario: Reversión incompleta
- **WHEN** una migración nueva no define cómo revertirse o su reversión deja objetos en la base
- **THEN** la verificación de migraciones falla en el paso de reversión completa

#### Scenario: Sin PostgreSQL disponible
- **WHEN** un integrante ejecuta la suite de pruebas habitual en una máquina sin PostgreSQL ni Docker
- **THEN** las pruebas que requieren PostgreSQL se informan como omitidas, con el motivo, y el resto de la suite se ejecuta con normalidad

### Requirement: Historial de migraciones lineal
El historial de migraciones MUST tener en todo momento una única versión final. La integración continua SHALL rechazar cualquier pull request que deje dos o más versiones finales en paralelo, e indicar cuáles son para que el autor rebase su migración sobre la última de la rama principal. (RNF-004)

#### Scenario: Una sola versión final
- **WHEN** un pull request agrega una migración que parte de la última migración de la rama principal
- **THEN** la verificación del historial de migraciones finaliza en estado exitoso

#### Scenario: Dos células agregan migraciones en paralelo
- **GIVEN** la rama principal ya integró una migración de otra célula después de que se creó la rama del pull request
- **WHEN** el pull request se actualiza con la rama principal sin ajustar el origen de su propia migración
- **THEN** la verificación falla, lista las dos versiones finales y el pull request no puede integrarse hasta que su migración parta de la última de la rama principal

