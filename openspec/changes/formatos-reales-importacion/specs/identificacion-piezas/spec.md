## ADDED Requirements

### Requirement: Formas reales de código de colección
La regla de código de colección MUST aceptar, además de sigla + correlativo, tres formas encontradas en los archivos del museo:
- una **sigla compuesta con guiones** seguida del correlativo (`AMM-IN-V-1234`) [SUPUESTO FR2];
- un **sufijo de letras** después del correlativo (`ELA 123 CEL`), que forma parte del valor normalizado [SUPUESTO FR1];
- un **número sin sigla** en la columna del código de colección, que se completa con la sigla de la colección de la fila cuando esta se conoce [SUPUESTO FR3].

Cuando un valor de una de estas formas aparece en la columna de otro tipo de código (por ejemplo, en la del código I), la detección de tipo MUST proponerlo como código de colección. (RF-023, RF-004, RN-010)

#### Scenario: Sigla compuesta en la columna del código I
- **WHEN** la columna «N° Inventario MATP (I)» de una colección sin inventario trae `AMM-IN-V-0195`
- **THEN** el valor se propone como código de colección `AMM-IN-V 195` y no como código I, y la fila no recibe código I

#### Scenario: Sufijo después del correlativo
- **WHEN** se normaliza el código de colección `ela 012 cel`
- **THEN** obtiene el valor normalizado `ELA 12 CEL`, distinto de `ELA 12`

#### Scenario: Número sin sigla con la colección de la fila
- **WHEN** una fila trae `45` en «Código de la colección» y su colección es la de sigla `MMZ`
- **THEN** el código de colección queda `MMZ 45` y la previsualización indica que la sigla se tomó de la colección de la fila

#### Scenario: Número sin sigla y sin colección
- **WHEN** una fila trae `45` en «Código de la colección» y no tiene colección
- **THEN** el identificador queda «no normalizable» con el motivo «número sin sigla ni colección», y el valor original se conserva

#### Scenario: Componente de un juego
- **WHEN** una fila de la colección `MMZ` trae `40.1` en «Código de la colección»
- **THEN** el código queda `MMZ 40.1`, como componente de `MMZ 40`

### Requirement: Marcas de vacío y texto que no es un código
Las marcas «No presenta», «No registra», «Sin código» y «Sin codigo» MUST tratarse por defecto como ausencia de código, en cualquier columna de códigos, y formar parte de la lista administrable de marcas de vacío. Un texto en una columna de códigos que no tiene forma de código y tiene más de tres palabras [SUPUESTO] SHALL proponerse como **observación** de la pieza en lugar de identificador, conservando el valor original en los datos de origen. (RF-023, RF-008, RN-005, RN-010)

#### Scenario: No presenta en el registro nacional
- **WHEN** la columna «N° Inscripción Registro Nacional» trae `No presenta`
- **THEN** la pieza queda sin código RN, sin alerta de «identificador no normalizable», y la celda se ve como «sin dato» en la previsualización

#### Scenario: Nota en la columna del código I
- **WHEN** la columna del código I trae «número de inventario mal asignado, revisar»
- **THEN** la fila no recibe código I, la nota se propone como observación de la pieza y la previsualización lo indica

#### Scenario: Marca agregada por el Administrador
- **WHEN** el Administrador agrega «S/R» a las marcas de vacío
- **THEN** las importaciones siguientes la tratan como ausencia de código
