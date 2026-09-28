## ADDED Requirements

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
