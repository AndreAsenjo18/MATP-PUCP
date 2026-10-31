## ADDED Requirements

### Requirement: Procedencia visible de las fotografías importadas
Cada fotografía registrada desde un lote de importación MUST conservar el nombre del archivo y la ruta de carpetas con que se subió, el lote del que proviene y, si lo hubo, el nombre de la versión de menor resolución que se descartó en su lugar. La galería de la ficha SHALL mostrar esa procedencia a quien puede ver la foto, y esos datos MUST NOT poder editarse. (RF-046, RF-013, RN-005)

#### Scenario: Procedencia de una foto del archivo histórico
- **WHEN** un usuario de Consulta interna abre en la galería de una pieza una foto aplicada desde el lote 12 con la ruta `FOTOS/ALTAS/82LF4169 copy.jpg`
- **THEN** ve la ruta original, el lote 12 y que reemplazó a la versión de menor resolución `FOTOS/82LF4169.jpg`

#### Scenario: Foto subida a mano
- **WHEN** se abre una foto subida desde la ficha, sin lote
- **THEN** la procedencia muestra solo el nombre original del archivo y «subida desde la ficha»

#### Scenario: Intento de editar la procedencia
- **WHEN** alguien envía un cambio a la ruta original de una foto por la API
- **THEN** la API ignora ese campo y la procedencia no cambia
