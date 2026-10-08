## ADDED Requirements

### Requirement: Conservación configurable del original en cargas masivas
El sistema MUST generar la miniatura y la versión de visualización de toda fotografía registrada desde un lote de importación antes de considerarla disponible, y SHALL conservar o no el archivo original según el parámetro de despliegue `MEDIA_KEEP_ORIGINALS`; cuando no se conserva, la versión de visualización MUST pasar a ser el archivo de referencia de la foto, guardando el tamaño y la huella del original recibido. El parámetro vigente y el volumen ocupado SHALL ser visibles en la estimación del volumen fotográfico. [SUPUESTO: la cuota de almacenamiento de la universidad no alcanza para ≈ 25 000 originales; valor por defecto `true` hasta confirmar] (RF-045, RNF-003, RNF-005, RNF-002)

#### Scenario: Despliegue con originales conservados
- **GIVEN** `MEDIA_KEEP_ORIGINALS=true`
- **WHEN** se aplica un lote con 500 fotos de 6 MB
- **THEN** cada foto conserva su original sin modificaciones, más su miniatura y su versión de visualización

#### Scenario: Despliegue sin originales por cuota limitada
- **GIVEN** `MEDIA_KEEP_ORIGINALS=false`
- **WHEN** se aplica un lote con 500 fotos de 6 MB
- **THEN** se almacenan solo la miniatura y la versión de visualización de cada foto, la foto registra el tamaño y la huella del original recibido y el original temporal se elimina del área de carga

#### Scenario: Derivado imposible de generar
- **GIVEN** `MEDIA_KEEP_ORIGINALS=false`
- **WHEN** no se puede generar la versión de visualización de una foto del lote
- **THEN** la foto queda rechazada en el lote con el motivo «no se pudo procesar la imagen» y no se aplica, para no perder la única copia

#### Scenario: Estimación con el parámetro vigente
- **WHEN** un Administrador consulta la estimación del volumen fotográfico
- **THEN** la respuesta indica si se conservan los originales, el volumen actual por tipo de archivo y la proyección para 25 000 fotos con ese parámetro
