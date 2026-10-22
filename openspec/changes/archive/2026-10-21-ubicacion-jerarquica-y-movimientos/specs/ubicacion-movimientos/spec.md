## ADDED Requirements

### Requirement: Administración del catálogo de ubicaciones
La API MUST permitir a usuarios con permiso de administrar ubicaciones crear, editar y desactivar ubicaciones, SHALL validar que cada ubicación tenga un padre del nivel permitido y un código único entre ubicaciones activas, y MUST impedir desactivar o eliminar lógicamente una ubicación que contiene piezas. Las reglas de niveles son [SUPUESTO] (A7). (RF-016, RN-005)

#### Scenario: Crear un rack dentro de un depósito
- **WHEN** un Administrador crea el mueble "Rack B" con código `DEP2-RB` dentro del espacio "Depósito 2"
- **THEN** la ubicación queda creada y su ruta completa muestra sede, espacio y mueble

#### Scenario: Padre de nivel no permitido
- **WHEN** se intenta crear un nivel de estante directamente dentro de una sede
- **THEN** la API responde 422 indicando los niveles de padre permitidos

#### Scenario: Código repetido
- **WHEN** se intenta crear una ubicación con el código `dep2-rb` existiendo `DEP2-RB` activa
- **THEN** la API responde 409 indicando la ubicación existente

#### Scenario: Desactivar un contenedor con piezas
- **WHEN** un Administrador intenta desactivar la caja `DEP2-RB-N3-C12` que contiene piezas
- **THEN** la API responde 409 con el número de piezas que debe mover antes

### Requirement: Registro de movimientos con ubicación actual derivada
El sistema MUST registrar movimientos, verificaciones físicas y movimientos correctivos como registros de solo inserción y SHALL actualizar la ubicación actual de la pieza en la misma transacción que el movimiento; MUST rechazar un movimiento cuyo origen esperado no coincida con la ubicación actual registrada. (RF-017, RN-005, RF-040)

#### Scenario: Movimiento a otro depósito
- **WHEN** un Personal auxiliar de depósito mueve una pieza del rack A del depósito 1 a la caja 12 del rack B del depósito 2 con motivo "reorganización"
- **THEN** la ubicación actual de la pieza es la caja 12 y el historial muestra el movimiento con origen, destino, fecha, responsable y motivo

#### Scenario: Movimiento cruzado entre dos usuarios
- **GIVEN** dos usuarios ven la pieza en el rack A
- **WHEN** el primero la mueve al rack B y luego el segundo intenta moverla desde el rack A al taller
- **THEN** el segundo recibe 409 con la ubicación actual y no se registra su movimiento

#### Scenario: Verificación en una ubicación distinta
- **WHEN** se registra una verificación física indicando una ubicación distinta a la registrada
- **THEN** la API responde 422 y sugiere registrar un movimiento

#### Scenario: Movimiento correctivo
- **WHEN** un Administrador registra un movimiento correctivo que referencia un movimiento anterior mal registrado
- **THEN** se crea un movimiento nuevo enlazado al anterior, que permanece sin cambios

#### Scenario: Historial sin permiso de ubicación exacta
- **WHEN** un usuario de Consulta interna consulta el historial de movimientos de una pieza
- **THEN** ve solo sede y espacio de cada origen y destino

### Requirement: Movimiento en lote desde el depósito
La API MUST permitir mover o verificar varias piezas hacia un mismo destino en una sola operación que se aplica completa o no se aplica, informando el motivo de cada pieza que falla, y SHALL aceptar reintentos de la misma operación sin duplicar movimientos. (RF-017, RNF-001, RNF-005, RNF-010)

#### Scenario: Lote correcto
- **WHEN** un Personal auxiliar de depósito registra el traslado de 12 piezas escaneadas a la caja `DEP2-RB-N3-C12`
- **THEN** se registran 12 movimientos con un mismo motivo y todas las piezas quedan en la caja

#### Scenario: Una pieza del lote ya fue movida
- **WHEN** una de las 12 piezas tiene una ubicación actual distinta a la esperada
- **THEN** no se registra ningún movimiento y la respuesta indica cuál pieza falló y por qué

#### Scenario: Reintento por conexión lenta
- **WHEN** el móvil reenvía el mismo lote con la misma clave de idempotencia porque no recibió la respuesta
- **THEN** la API devuelve el resultado original sin registrar movimientos duplicados

### Requirement: Reubicación de un nodo con piezas
El sistema SHALL permitir cambiar el padre de una ubicación que contiene piezas solo con confirmación explícita del número de piezas afectadas, y MUST registrar un movimiento por cada pieza afectada con referencia común a la reubicación; SHALL rechazar ciclos en la jerarquía. (RF-016, RF-017)

#### Scenario: Mover un rack completo
- **WHEN** un Administrador mueve el rack `DEP1-RA` con 40 piezas al depósito 2 confirmando 40 piezas afectadas
- **THEN** el rack cuelga del depósito 2 y cada una de las 40 piezas tiene un movimiento con motivo de reubicación

#### Scenario: Confirmación con número desactualizado
- **WHEN** el Administrador confirma 38 piezas afectadas y el rack tiene 40
- **THEN** la API responde 409 con el número actual y no mueve nada

#### Scenario: Ciclo en la jerarquía
- **WHEN** se intenta colocar un mueble dentro de uno de sus propios niveles
- **THEN** la API responde 422

### Requirement: Coherencia de la disponibilidad con el tipo de espacio
El sistema SHALL clasificar los espacios por tipo (depósito, sala de exhibición, taller, otro) [SUPUESTO] y MUST rechazar un cambio manual de disponibilidad incoherente con el tipo del espacio de la ubicación actual, proponiendo la disponibilidad correspondiente al registrar un movimiento. (RF-020, RN-010)

#### Scenario: Movimiento a sala propone disponibilidad
- **WHEN** se mueve una pieza a un espacio de tipo sala de exhibición
- **THEN** la disponibilidad propuesta es "en sala" y queda registrada al confirmar el movimiento

#### Scenario: Disponibilidad incoherente
- **WHEN** un usuario marca como "en sala" una pieza cuya ubicación actual está en un depósito
- **THEN** la API responde 409 indicando la ubicación actual
