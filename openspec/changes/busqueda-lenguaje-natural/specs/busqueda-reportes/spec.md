## ADDED Requirements

### Requirement: Interpretación de la búsqueda en lenguaje natural o por voz

La caja de búsqueda por código o texto que ya existe MUST aceptar también una frase completa,
escrita o dictada por voz desde el mismo campo (sin una caja ni una pantalla aparte); mientras la
persona escribe, la búsqueda instantánea de texto libre SHALL seguir funcionando sin cambios, y al
terminar de escribir o de dictar el sistema SHALL interpretar la frase y aplicar los filtros
combinables que reconozca (RF-032) como las mismas etiquetas editables que ya existen — sin un paso
de confirmación aparte, porque quitar una etiqueta mal interpretada ya es la misma acción de un
clic que corregir cualquier filtro hoy. La interpretación MUST NOT proponer filtros sobre campos
sensibles (valorización, datos del comodante o del préstamo); esos se siguen filtrando solo con los
controles manuales que ya exigen el permiso correspondiente (RF-041). Sin proveedor de IA
disponible, la caja SHALL seguir funcionando como búsqueda de texto libre normal. (RF-049, RIA-06)

#### Scenario: Frase con varios filtros reconocidos
- **WHEN** una persona escribe, en la misma caja de búsqueda de siempre, «toros de cerámica de Puno
  que no tengan foto y estén en el depósito 1» y termina de escribir
- **THEN** el sistema aplica categoría «toro», material «cerámica», procedencia «Puno», «sin foto» y
  ubicación «depósito 1» como etiquetas editables, y los resultados se actualizan con esos filtros

#### Scenario: Quitar un filtro mal interpretado
- **WHEN** una persona quita una de las etiquetas que la interpretación aplicó
- **THEN** la búsqueda se vuelve a ejecutar sin ese filtro, igual que al quitar cualquier otro

#### Scenario: Código dictado o mal escrito
- **WHEN** el texto incluye «i cero dos tres seis» o «mmz quince»
- **THEN** el sistema lo normaliza al mismo formato que usan los identificadores de pieza (`I-0236`, `MMZ-15`) antes de proponerlo como filtro

#### Scenario: Nada reconocible en la frase
- **WHEN** el sistema no reconoce ningún filtro en el texto
- **THEN** la frase se usa tal cual como búsqueda de texto libre, sin etiquetas nuevas

#### Scenario: Proveedor de IA no disponible
- **WHEN** el proveedor de IA no responde o está en modo simulado sin ninguna coincidencia
- **THEN** la caja de texto sigue aceptando búsquedas como texto libre normal, sin bloquear la pantalla

#### Scenario: Filtro sensible no propuesto
- **WHEN** el texto menciona un valor de tasación o el nombre de un comodante
- **THEN** el sistema no lo propone como filtro, sin importar el permiso de quien pregunta

#### Scenario: Escribir no interrumpe la búsqueda instantánea
- **WHEN** una persona está escribiendo una frase larga en la caja de búsqueda
- **THEN** los resultados se siguen filtrando por texto libre al instante con cada tecla, sin esperar a que la IA interprete nada

#### Scenario: Dictado por voz
- **WHEN** una persona pulsa el ícono de micrófono y dicta su búsqueda
- **THEN** el texto dictado llena la misma caja, y al terminar de hablar se interpreta igual que si se hubiera escrito
