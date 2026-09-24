## ADDED Requirements

### Requirement: Solicitud de sugerencias con minimización de datos
La API MUST permitir a usuarios con permiso de solicitar IA pedir una sugerencia para una pieza, SHALL enviar al servicio de IA solo los campos permitidos para esa función, sin campos sensibles ni datos personales [SUPUESTO B12], y MUST guardar la sugerencia como pendiente con la entrada exactamente enviada, la salida, el proveedor, el modelo y la fecha; si el servicio de IA no responde dentro del tiempo límite, SHALL informar que la asistencia no está disponible sin alterar el catálogo. (RN-009, RIA-01, RNF-008, RNF-014)

#### Scenario: Solicitud con proveedor simulado
- **WHEN** un Catalogador solicita la extracción sobre las observaciones de una pieza con el proveedor simulado
- **THEN** la API responde 201 con una sugerencia pendiente y la ficha de la pieza no cambia

#### Scenario: Pieza en comodato con comodante registrado
- **WHEN** se solicita una sugerencia para una pieza en comodato
- **THEN** la entrada guardada y enviada no contiene el nombre del comodante ni la referencia del acuerdo

#### Scenario: Servicio de IA caído
- **WHEN** el servicio de IA no responde dentro del tiempo límite
- **THEN** la API responde 503 `ai_unavailable`, no se crea sugerencia y la búsqueda y la edición de fichas siguen funcionando

#### Scenario: Usuario sin permiso
- **WHEN** un usuario de Consulta interna solicita una sugerencia
- **THEN** la API responde 403

### Requirement: Revisión total, parcial o con edición aplicada con reglas de dominio
El sistema MUST aplicar al catálogo solo los ítems de una sugerencia que un usuario con permiso de revisión aprueba explícitamente, con los valores editados si los modifica, validándolos con las mismas reglas que el ingreso manual en una única transacción y registrando la auditoría con origen "IA aprobada" y referencia a la sugerencia; SHALL exigir motivo al rechazar y MUST impedir revisar dos veces la misma sugerencia. Ningún componente distinto del flujo de aprobación SHALL escribir datos provenientes de IA. (RN-009, RF-040)

#### Scenario: Aprobación parcial con edición
- **GIVEN** una sugerencia con alto 23 cm, diámetro 15 cm y estado de conservación "regular"
- **WHEN** un Gestor de colecciones aprueba el alto corrigiéndolo a 24 cm y el diámetro, sin aprobar el estado
- **THEN** la pieza recibe alto 24 cm y diámetro 15 cm, no se registra evaluación de conservación, la sugerencia queda parcialmente aprobada con edición y la auditoría referencia la sugerencia

#### Scenario: Valor editado inválido
- **WHEN** el revisor edita el alto a `-5`
- **THEN** la API responde 422 y no se aplica ningún ítem

#### Scenario: Rechazo sin motivo
- **WHEN** un revisor intenta rechazar una sugerencia sin motivo
- **THEN** la API responde 422 y la sugerencia sigue pendiente

#### Scenario: Doble revisión
- **WHEN** se intenta aprobar una sugerencia ya rechazada
- **THEN** la API responde 409

### Requirement: Detección de sugerencias obsoletas por huella
El sistema MUST registrar al crear una sugerencia una huella de los valores del campo de origen y de los campos destino, y SHALL rechazar su aprobación cuando esos valores cambiaron, mostrando los valores actuales frente a los del momento de la sugerencia, salvo confirmación explícita del revisor. (RN-009)

#### Scenario: Medidas editadas después de la sugerencia
- **WHEN** un Catalogador edita manualmente las medidas y luego un revisor intenta aprobar la sugerencia de medidas anterior
- **THEN** la API responde 409 con los valores actuales y los sugeridos, y solo aplica si el revisor confirma

### Requirement: Destinos de los datos extraídos desde texto libre
La extracción desde texto libre MUST clasificar cada dato propuesto como medida, estado de conservación, participación en exposición o marca de revisión, con su fragmento de origen, y SHALL aplicar cada tipo aprobado a su destino: medidas estructuradas conservando el texto original, nueva evaluación de conservación con un término activo del vocabulario, nota de marca de revisión en observaciones, y exposiciones retenidas en la sugerencia hasta que exista el registro de exposiciones [SUPUESTO]. (RIA-01, RF-006, RF-012, RF-018)

#### Scenario: Estado sin término correspondiente
- **WHEN** la IA propone el estado de conservación "deteriorado leve" que no es un término activo
- **THEN** el ítem solo puede aprobarse eligiendo un término activo del vocabulario

#### Scenario: Exposición aprobada
- **WHEN** un revisor aprueba la participación en una exposición de 1998
- **THEN** el dato queda aprobado y visible como pendiente de aplicar, sin modificar la ficha

#### Scenario: Texto sin datos
- **WHEN** se solicita la extracción sobre un texto sin medidas, estados, exposiciones ni marcas
- **THEN** la API informa que no encontró datos y no crea una sugerencia

### Requirement: Indicadores de aceptación de la IA
El sistema SHALL ofrecer indicadores por función de IA con el número de sugerencias por estado y los porcentajes de ítems aprobados, editados y rechazados en un periodo, sin exponer datos de las piezas. (RIA-01, RNF-004)

#### Scenario: Tasa de aceptación mensual
- **WHEN** un Administrador consulta los indicadores de RIA-01 del último mes
- **THEN** obtiene los conteos por estado y los porcentajes de ítems aprobados, editados y rechazados

#### Scenario: Periodo sin sugerencias
- **WHEN** se consultan los indicadores de un periodo sin sugerencias
- **THEN** los conteos son cero y los porcentajes se indican como no aplicables
