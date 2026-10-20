\# ADR-015 — Formularios del frontend con React Hook Form y Zod



\- \*\*Estado\*\*: Propuesto

\- \*\*Fecha\*\*: 2026-10-19

\- \*\*Change de origen\*\*: `ficha-pieza-crud`



\## Contexto



El change `ficha-pieza-crud` incorpora formularios más extensos y con mayor interacción que los utilizados durante la maqueta navegable. En particular, las pantallas de registro y edición de piezas requieren manejo de múltiples secciones, validaciones locales, mensajes de error y advertencia, recuperación de borradores y coordinación con validaciones provenientes de la API.



El ADR-006 había pospuesto la adopción de una librería de formularios hasta que existieran formularios con mayor complejidad. Esa condición se cumple ahora con el formulario de pieza, que agrupa las secciones Identificación, Descripción, Procedencia y época, Medidas y materiales, Conservación y Observaciones.



Las reglas de negocio continúan siendo responsabilidad del backend. El frontend no debe duplicarlas, porque pueden cambiar como resultado de la validación con la contraparte. La validación local debe limitarse a formato, tipos y restricciones básicas necesarias para una buena experiencia de usuario.



\## Decisión



1\. \*\*Adoptar React Hook Form como librería principal para formularios complejos del frontend.\*\* Se utilizará para administrar el estado del formulario, los errores asociados a cada campo y el envío de los datos.



2\. \*\*Adoptar Zod para validaciones locales de formato y tipos.\*\* Zod se utilizará para validaciones como campos vacíos, tipos numéricos y estructura básica de los datos enviados. No se duplicarán en Zod las reglas de negocio implementadas por la API.



3\. \*\*Las validaciones de negocio serán provistas por la API.\*\* El formulario consumirá `validatePiece` y mostrará junto al campo correspondiente los errores y advertencias devueltos por el backend.



4\. \*\*Mantener compatibilidad con el modo mock y el modo live.\*\* La capa de datos definida en `lib/data/pieces.ts` seguirá siendo el punto de acceso para las operaciones de creación, actualización y validación de piezas.



5\. \*\*Persistir temporalmente el borrador en `sessionStorage`.\*\* Antes del envío, el estado necesario para recuperar el formulario se almacenará en `sessionStorage`, de modo que pueda restaurarse en escenarios como expiración de sesión.



6\. \*\*Versiones adoptadas.\*\* Para este change se incorporan `react-hook-form` `^7.90.0` y `zod` `^4.6.7` al workspace `apps/web`.



\## Alternativas consideradas



\- \*\*Continuar únicamente con `useState` o `useReducer`\*\*: sigue siendo una opción válida para formularios pequeños, pero el formulario completo de pieza tiene varias secciones, estados de validación y mensajes por campo. Gestionar todo manualmente aumentaría el código de estado y la complejidad de mantenimiento.



\- \*\*Usar Zod también para todas las reglas de negocio\*\*: descartado porque duplicaría reglas que ya corresponden al backend y aumentaría el riesgo de divergencia entre cliente y servidor.



\- \*\*Mantener exclusivamente `useReducer` como en la maqueta\*\*: se conserva como contingencia, pero deja de ser la alternativa principal para los formularios complejos que empiezan a conectarse con la API real.



\## Consecuencias



\- Los formularios complejos nuevos del frontend podrán utilizar un patrón común basado en React Hook Form.

\- Zod queda limitado a validaciones locales y estructurales; la API continúa siendo la fuente de verdad para las reglas de negocio.

\- Se agregan dos dependencias al workspace `apps/web`.

\- El formulario de registro y edición de piezas podrá integrar mensajes de validación del servidor sin duplicar esas reglas en el cliente.

\- El código existente de la maqueta basado en `useState` o `useReducer` no necesita migrarse automáticamente. La adopción se aplica a los formularios que lo justifiquen, comenzando por `ficha-pieza-crud`.

