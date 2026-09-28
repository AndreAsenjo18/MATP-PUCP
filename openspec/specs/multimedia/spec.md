# multimedia Specification

## Purpose
Borrador sujeto a aprobación de alcance (S7) y validación con la contraparte. Define la gestión de fotografías múltiples por pieza tridimensional, las restricciones contractuales de uso de imágenes (comodato), los documentos asociados preparados para el archivo documental y la estimación del volumen fotográfico.

## Requirements

### Requirement: Múltiples fotografías por pieza
El sistema MUST permitir asociar a una pieza cero o más fotografías, cada una con tipo de vista de un vocabulario controlado (por ejemplo frontal, perfil, posterior, superior, detalle, abierta, cerrada), orden de presentación, foto principal, autor y fecha de la toma, y SHALL almacenar los archivos fuera de la base de datos conservando el archivo original sin modificar. (RF-013, RN-010)

#### Scenario: Subir varias vistas
- **WHEN** un Catalogador sube tres fotos de una pieza con tipos de vista frontal, perfil y detalle
- **THEN** la ficha muestra una galería con las tres fotos agrupadas por tipo de vista y en el orden indicado

#### Scenario: Reordenar y elegir principal
- **WHEN** un Catalogador cambia el orden de las fotos y marca la vista perfil como principal
- **THEN** los listados y resultados de búsqueda muestran la foto marcada como principal

#### Scenario: Archivo no admitido
- **WHEN** un usuario intenta subir un archivo que no es una imagen admitida o supera el tamaño máximo configurado [SUPUESTO: formatos JPEG, PNG, TIFF y límite configurable]
- **THEN** el sistema rechaza el archivo con un mensaje que indica formatos y tamaño permitidos

#### Scenario: Misma foto subida dos veces
- **WHEN** se sube a la misma pieza un archivo idéntico a una foto ya asociada
- **THEN** el sistema detecta el duplicado por huella del contenido y advierte antes de guardarlo

#### Scenario: Retirar una foto
- **WHEN** un Gestor de colecciones retira una foto de la galería
- **THEN** la foto deja de mostrarse, se conserva marcada como retirada y la acción queda en auditoría

### Requirement: Restricciones de uso y publicación de fotografías
El sistema SHALL permitir registrar restricciones de uso y publicación por fotografía y por pieza (heredadas del acuerdo de comodato cuando corresponda), y MUST mostrar la restricción de forma visible y bloquear las exportaciones y descargas de imágenes que la incumplan. (RF-014, RN-008)

#### Scenario: Pieza en comodato con prohibición de publicación
- **GIVEN** una pieza en comodato cuyo acuerdo prohíbe la publicación de imágenes [SUPUESTO: tipos de restricción a validar]
- **WHEN** un usuario visualiza sus fotos
- **THEN** cada foto muestra la etiqueta de restricción y la opción de descarga para uso externo no está disponible

#### Scenario: Exportación que incluye fotos restringidas
- **WHEN** un usuario genera una exportación con imágenes que incluye piezas con fotos restringidas
- **THEN** el sistema excluye esas imágenes de la exportación e informa cuántas se omitieron y por qué

### Requirement: Documentos asociados
El sistema SHALL permitir, de forma preparatoria, asociar a una pieza documentos (cartas, recibos, actas, expedientes) con tipo de documento, descripción, fecha y referencia opcional a un registro del archivo documental externo, sin implementar la gestión completa del archivo documental. (RF-015)

#### Scenario: Asociar un recibo digitalizado
- **WHEN** un Gestor de colecciones asocia un PDF de recibo a una pieza con tipo "recibo" y fecha
- **THEN** el documento aparece en la ficha de la pieza y puede descargarse por usuarios con permiso

#### Scenario: Referencia al archivo documental sin archivo adjunto
- **WHEN** se registra un documento solo con la referencia a un registro del archivo documental y sin archivo
- **THEN** el sistema guarda la referencia y la muestra como documento sin digitalizar

### Requirement: Estimación del volumen fotográfico
El sistema MUST ofrecer una estimación del volumen de almacenamiento fotográfico (número de fotos, tamaño total y proyección según fotos por pieza y tamaño medio) para decidir la arquitectura de almacenamiento antes de comprometerla. (RNF-003)

#### Scenario: Proyección de almacenamiento
- **WHEN** un Administrador consulta la estimación con 20 000 piezas, 5 fotos por pieza y 4 MB por foto [SUPUESTO: parámetros ilustrativos]
- **THEN** el sistema muestra el volumen total proyectado y el volumen actualmente almacenado

#### Scenario: Sin fotos registradas
- **WHEN** se consulta la estimación sin fotos almacenadas
- **THEN** el sistema muestra volumen actual cero y calcula la proyección solo con los parámetros ingresados
