## ADDED Requirements

### Requirement: Subida verificada de fotografías al almacenamiento de objetos
El sistema MUST permitir subir fotografías de una pieza directamente al almacenamiento de objetos mediante una autorización de subida de corta duración emitida por la API, y SHALL registrar la foto solo después de verificar en el servidor que el archivo existe, que su tipo real es una imagen admitida, que no supera el tamaño máximo configurado y que su huella SHA-256 coincide con la declarada; el archivo original MUST conservarse sin modificaciones. (RF-013, RNF-005, RNF-002)

#### Scenario: Subida correcta de una vista frontal
- **WHEN** un Catalogador sube un JPEG de 6 MB como vista frontal de una pieza y confirma el registro
- **THEN** la foto queda asociada a la pieza con su tipo de vista, tamaño, dimensiones y huella, y la auditoría registra el alta

#### Scenario: Archivo con extensión engañosa
- **WHEN** se registra un archivo declarado como `image/jpeg` cuyo contenido real es un PDF
- **THEN** la API responde 422 indicando los formatos admitidos y la foto no se registra

#### Scenario: Huella distinta a la declarada
- **WHEN** el archivo almacenado no coincide con la huella SHA-256 declarada al pedir la autorización
- **THEN** la API responde 422 y la foto no se registra

#### Scenario: Autorización de subida vencida
- **WHEN** el navegador intenta subir el archivo después de que venció la autorización
- **THEN** el almacenamiento rechaza la subida y la interfaz ofrece reintentar solicitando una autorización nueva

#### Scenario: Usuario sin permiso de subida
- **WHEN** un usuario de Consulta interna solicita una autorización de subida
- **THEN** la API responde 403

### Requirement: Derivados livianos para visualización
El sistema SHALL generar para cada fotografía una miniatura y una versión de visualización de menor tamaño, usarlas en listados, galerías y resultados de búsqueda, y MUST conservar la foto registrada aunque la generación de derivados falle. (RF-013, RNF-005)

#### Scenario: Galería con conexión lenta
- **WHEN** un usuario abre la ficha de una pieza con 8 fotos
- **THEN** la galería carga las miniaturas y solo descarga la versión de visualización de la foto que el usuario abre

#### Scenario: Fallo al generar derivados
- **WHEN** la generación de derivados de un TIFF muy grande falla
- **THEN** la foto queda registrada, la ficha la muestra con un aviso de vista previa no disponible y un comando permite regenerar los derivados

### Requirement: Acceso a archivos con autorización de corta duración
El sistema MUST servir las imágenes solo mediante enlaces firmados de corta duración emitidos a usuarios autenticados con permiso de consulta, sin exponer el almacenamiento de forma pública, y SHALL distinguir la visualización interna de la descarga para uso externo. (RF-042, RF-014, RN-008)

#### Scenario: Enlace vencido
- **WHEN** alguien usa un enlace de imagen después de su vencimiento
- **THEN** el almacenamiento rechaza el acceso

#### Scenario: Acceso anónimo al almacenamiento
- **WHEN** una persona sin sesión intenta leer un objeto del almacenamiento por su ruta
- **THEN** el acceso se rechaza

### Requirement: Restricción efectiva heredada y bloqueo de descarga externa
El sistema MUST calcular para cada foto una restricción de uso efectiva con precedencia foto, pieza y colección en comodato, SHALL mostrarla junto con su origen y MUST rechazar la emisión de enlaces de descarga para uso externo cuando la restricción efectiva lo prohíba. Los tipos de restricción son [SUPUESTO] configurables (B2). (RF-014, RN-008)

#### Scenario: Herencia desde la colección en comodato
- **GIVEN** la colección en comodato `AJB` con restricción por defecto "no publicar" [SUPUESTO: sigla y restricción ilustrativas]
- **WHEN** se registra una foto nueva de una pieza de esa colección sin restricción propia
- **THEN** la foto muestra la restricción "no publicar" con origen "colección"

#### Scenario: Descarga externa bloqueada
- **WHEN** un Gestor de colecciones pide un enlace de descarga para uso externo de esa foto
- **THEN** la API responde 409 indicando la restricción y el acuerdo del que proviene

#### Scenario: Visualización interna permitida
- **WHEN** un Catalogador abre la misma foto en la ficha
- **THEN** la ve con la etiqueta de restricción visible

### Requirement: Gestión de galería con foto principal única
El sistema MUST mantener como máximo una foto principal activa por pieza, SHALL permitir reordenar todas las fotos en una sola operación y MUST retirar fotos solo de forma lógica con motivo, designando automáticamente otra principal si se retira la actual. (RF-013, RNF-006, RN-005)

#### Scenario: Cambio de principal
- **WHEN** un Catalogador marca como principal la vista perfil de una pieza cuya principal era la frontal
- **THEN** solo la vista perfil queda como principal

#### Scenario: Retiro de la foto principal
- **WHEN** un Gestor de colecciones retira con motivo la foto principal
- **THEN** la foto queda retirada y conservada, y la siguiente en orden pasa a ser principal

#### Scenario: Reordenamiento con lista incompleta
- **WHEN** se envía un reordenamiento que omite alguna foto activa de la pieza
- **THEN** la API responde 422 y el orden no cambia

### Requirement: Operación de estimación del volumen fotográfico
La API MUST ofrecer la estimación del volumen fotográfico con el volumen actual almacenado (originales y derivados), los promedios reales de fotos por pieza y tamaño por foto, y la proyección para parámetros indicados por el usuario, rechazando parámetros negativos. (RNF-003)

#### Scenario: Proyección con parámetros
- **WHEN** un Administrador pide la estimación para 20 000 piezas, 5 fotos por pieza y 4 MB por foto [SUPUESTO: parámetros ilustrativos, C1]
- **THEN** la respuesta incluye un volumen proyectado de originales de aproximadamente 400 GB, el volumen actual y los promedios reales

#### Scenario: Parámetros inválidos
- **WHEN** se pide la estimación con un número negativo de fotos por pieza
- **THEN** la API responde 422
