## Context

No existe ningún asistente. La ayuda al usuario está en el manual (`docs/manual-usuario/`, fuera de la aplicación) y en textos dentro de cada pantalla, que la auditoría de producción mostró excesivos. La estructura común de pantallas autenticadas es `MainLayout.tsx` (barra lateral, encabezado y `<main>`), que ya sabe cuándo no mostrar nada (sin sesión) y oculta el marco al imprimir (`print:hidden`).

`inicio-guia-de-tareas` introduce una tabla de tareas compartida (`lib/help/tasks.ts`) con verbo, explicación, destino y permiso, de la que salen el Inicio y el menú. El asistente se apoya en esa misma tabla.

La especificación de IA ya prevé, desactivado en fase 1, un asistente de consulta sobre el catálogo (RIA-05); aquí no se implementa. El proveedor de IA de producción (`llm`) y la política de datos (B12) siguen pendientes.

Restricciones: sin cambios de API, de base de datos ni dependencias nuevas; solo datos del propio sistema; nada se envía fuera del navegador; permisos por rol como el menú.

## Goals / Non-Goals

**Goals:**
- Que una persona perdida pueda decir lo que quiere hacer y llegar a la pantalla correcta, con el punto de partida señalado.
- Cero riesgo de privacidad: ni datos del catálogo ni preguntas salen del navegador.
- Accesible por teclado y lector de pantalla.

**Non-Goals:**
- Responder con lenguaje natural o con IA.
- Ejecutar acciones por la persona.
- Recorridos de varias pantallas.

## Decisions

### D1. Etapa 1 sin IA: un catálogo de tareas, no un chatbot

La ayuda es un panel con tareas en palabras de la persona y una búsqueda por palabras clave sobre ese catálogo. Un chatbot con modelo de lenguaje añadiría costo, latencia, alucinaciones y, sobre todo, enviar texto a un servicio externo con una política de datos aún sin decidir. El catálogo cubre las tareas frecuentes de forma determinista, y se puede probar con el mismo conjunto de seis tareas de la prueba de usabilidad.

*Alternativa*: un modelo que responda solo con el manual de usuario (texto público del proyecto, sin datos del catálogo). Es una etapa 2 posible si el museo la valora; no se prepara código ahora.

### D2. Misma tabla de tareas que el Inicio y el menú

Cada tarea del panel referencia una tarea de `lib/help/tasks.ts` (la del Inicio y el menú) o añade las que no tienen tarjeta propia («Quiero mover una pieza», «Quiero agregar fotos a una pieza»). Se añaden a la tabla los campos que el asistente necesita: palabras clave y sinónimos, y el identificador del elemento a resaltar. Una prueba comprueba que cada destino existe, que cada permiso es conocido y que cada elemento a resaltar está declarado en su pantalla.

### D3. «Llévame» por dirección y marca declarada en la pantalla

«Llévame» navega a la ruta de la tarea con un parámetro `ayuda=<id>`. Cada pantalla declara con un atributo (`data-ayuda="buscar-codigo"`) qué elemento corresponde a cada tarea; un pequeño módulo lee el parámetro, busca ese atributo, hace `scrollIntoView`, enfoca el elemento y dibuja el contorno y la indicación. Si el atributo no existe (rol sin permiso o pantalla cambiada), no hace nada y no falla. Al usarse el elemento o al cerrarse la indicación, se retira el parámetro de la dirección.

*Alternativa*: una librería de recorridos guiados. Descartada: dependencia nueva para un caso simple, con foco y accesibilidad que habría que verificar.

### D4. Posición y apilado

El botón es `position: fixed` abajo a la derecha con `z-index` por debajo de los diálogos y por encima del contenido. Para no tapar acciones, el contenedor principal reserva un margen inferior cuando hay barra de acción fija (la barra de aprobación de `importacion-revision-simplificada`), y el botón se eleva sobre ella mediante una variable de espaciado que esa barra declara. Se oculta con `print:hidden`, en el acceso (ya no hay `MainLayout`) y en las vistas de impresión.

### D5. Accesibilidad

El botón y el panel usan `aria-expanded`/`aria-controls`; el panel es un diálogo no modal con foco gestionado (entra al abrir, vuelve al botón al cerrar, Escape cierra); la indicación del resaltado se anuncia con una región `aria-live` educada; el contorno cumple contraste (token institucional) y no depende solo del color; sin animación con `prefers-reduced-motion`.

### D6. Privacidad por construcción

El panel no hace peticiones de red. El texto del cuadro de búsqueda vive en el estado del componente y no se persiste. No hay contadores ni registros de uso. Una prueba verifica que escribir y elegir tareas no dispara ninguna petición.

### D7. Búsqueda

Normalización sin tildes ni mayúsculas (`normalize('NFD')`), coincidencia por prefijo de palabra sobre el verbo, la explicación, las palabras clave y los sinónimos. Sin motor externo.

## Risks / Trade-offs

- **[La persona escribe algo que el catálogo no cubre]** → Mensaje de «no encontramos» y la lista completa; las palabras que no coincidan se anotan en la prueba de usabilidad para ampliar sinónimos (sin telemetría).
- **[El botón tapa algo importante]** → Reserva de margen, variable de elevación y prueba a 360 px y con barra fija.
- **[El resaltado apunta a un elemento que cambió de nombre]** → Atributos `data-ayuda` declarados y una prueba que comprueba que existen.
- **[Mantenimiento de dos listas de tareas]** → Una sola tabla compartida (D2).
- **[Expectativa de «chatbot»]** → La etapa 1 se presenta como «¿Necesita ayuda?»; la IA queda como etapa posterior, condicionada a la validación del museo y a la política de datos.

## Migration Plan

Solo interfaz, sin migraciones. Reversión: retirar el montaje en `MainLayout.tsx`. Actualizar el manual (`README.md`) y las capturas en el mismo PR.

## Open Questions

- ¿El museo prefiere un botón con la etiqueta «¿Necesita ayuda?» u otra palabra? (prueba de 5 segundos)
- ¿Qué otras tareas conviene incluir además de las seis? Se completa con la prueba de usabilidad.
- ¿Se quiere una etapa 2 con un modelo que lea solo el manual? Requiere ADR y la política de datos (B12).
