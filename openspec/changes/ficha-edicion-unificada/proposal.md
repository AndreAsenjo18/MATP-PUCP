# Proposal

## Why

La ficha de piezas del MATP presenta experiencias distintas entre los modos de demostración y conectado: el registro y la edición concentran demasiados campos, mientras que la ficha conectada distribuye acciones en formularios separados y omite información relevante. En el último sprint se busca que el personal del museo pueda registrar, consultar y mantener piezas con menos pasos, mensajes claros y una organización consistente, sin alterar las reglas de integridad ni auditoría existentes.

## What Changes

- **HU-12, HU-13 · Registro manual:** simplificar la presentación de los campos esenciales, distinguir los datos adicionales y revisar que «Guardar y registrar otra» y «Registrar a partir de esta pieza» faciliten el registro consecutivo sin copiar datos indebidos. (C3, C20)
- **HU-15 · Ficha y edición:** unificar la estructura visual de las fichas de demostración y conectadas, organizar los datos en secciones comprensibles y proponer un punto de guardado claro para los campos editables de la ficha. La decisión de «un solo Guardar» sigue sujeta a validación con la JP; se documentará el alcance antes de implementar una operación que involucre varios recursos. (C3, C9, C20)
- **HU-16, HU-17 · Fotografías y conservación:** integrar de forma coherente los componentes ya existentes en la ficha, con etiquetas y acciones comprensibles; preservar la gestión de varias vistas fotográficas y las evaluaciones con historial. El aviso de foto repetida (C6) corresponde a P5.
- **HU-18, HU-19 · Acciones sensibles:** hacer comprensibles los avisos y confirmaciones para la corrección auditada del código I, la baja lógica y la restauración, sin relajar permisos, motivos obligatorios ni trazabilidad. (C8, C19)
- **Identificadores y textos:** mostrar nombres legibles de los tipos de identificador a partir de `GET /api/v1/identifier-types`, con respaldo para códigos del seed, y retirar de la ficha los textos internos destinados a desarrolladores. (C8, C19)
- **Consulta de la ficha:** mantener visibles los datos de origen en solo lectura y la auditoría según permisos; coordinar con P3 la sección de ubicación e historial de movimientos. No duplicar el trabajo de otros responsables. (C20)
- **Organización técnica:** separar `apps/web/src/app/piezas/[id]/page.tsx` en componentes por sección para facilitar el desarrollo paralelo. Este refactor no debe modificar por sí mismo el comportamiento de la aplicación.
- **Validación:** agregar o actualizar pruebas automáticas y realizar pruebas humanas de las HU asignadas con datos sintéticos; registrar correcciones y capturas antes/después.

## Capabilities

### New Capabilities

- Ninguna. Se mejora la experiencia de capacidades que ya existen.

### Modified Capabilities

- `catalogo-piezas`: se precisará el comportamiento de consulta, registro y edición de la ficha en una interfaz coherente, con acciones principales claras, datos de origen visibles solo para lectura y tratamiento comprensible de errores y confirmaciones.
- `identificacion-piezas`: se precisará la presentación al usuario de los tipos de identificador mediante nombres comprensibles y la separación explícita del procedimiento restringido de corrección del código I.

## Impact

- **Responsable:** Manuel, paquete **P1 · Ficha**.
- **Historias y correcciones:** HU-12, HU-13, HU-15, HU-16, HU-17, HU-18 y HU-19; C3, C8, C9, C19 (solo dentro de la ficha) y C20.
- **Requisitos relacionados:** RF-002, RF-003, RF-006, RF-008, RF-013, RF-043; RNF-010; RN-001, RN-002, RN-003, RN-005, RN-008 y RN-010. Se mantienen las reglas de permisos y auditoría ya implementadas.
- **Código afectado:** principalmente `apps/web/src/app/piezas/[id]/page.tsx`, `apps/web/src/app/piezas/[id]/editar/`, `apps/web/src/app/piezas/nueva/` y componentes reutilizables de `apps/web/src/components/domain/`; pruebas de interfaz y documentación asociada.
- **Dependencias:** reutiliza las operaciones existentes de `ficha-pieza-crud`, identificadores, multimedia y auditoría, sin asumir cambios nuevos de API. La estructura modular debe permitir que P3, P4 y P5 integren sus secciones sin editar simultáneamente la página principal. La decisión final de guardado unificado está pendiente de la JP.
- **Fuera de alcance:** implementación de ubicación e historial de movimientos (P3), funciones de IA dentro de la ficha (P4), aviso de fotografías repetidas (P5), rediseño global del menú y estándar transversal de legibilidad (Base), nuevas reglas del backend, cambios de infraestructura y alteraciones de datos reales del museo.
