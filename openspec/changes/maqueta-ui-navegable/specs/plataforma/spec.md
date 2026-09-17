## ADDED Requirements

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
