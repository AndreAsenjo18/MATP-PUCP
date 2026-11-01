# Sugerencias de la IA

> **Fuera del MVP.** Esta pantalla muestra **ejemplos de demostración con datos sintéticos**. Aún no hay un proveedor de IA conectado y lo que apruebe o rechace aquí **no cambia el catálogo**. Que falten sugerencias sobre sus piezas reales no es un fallo: se construye después del MVP.

## Para qué sirve

La IA lee el texto libre de una ficha (por ejemplo, una descripción pegada de un libro o de un Word) y propone sus campos: categoría, estado de conservación, procedencia, términos. Usted revisa, corrige y aprueba. **Sin su aprobación no se guarda nada.**

Para entrar necesita un rol con permiso de revisar sugerencias de IA (por ejemplo, Administrador o Gestora de colecciones). Si su rol no lo tiene, la pantalla lo indica.

## Cómo se ve

Abra **Sugerencias IA** en el menú. Arriba están el propósito y la etiqueta **Fuera del MVP**. Debajo, **Ejemplos pendientes de revisión** y, cuando revise alguno, **Ejemplos ya revisados**.

Cada tarjeta dice qué hizo la IA (**Extraer datos de un texto**, **Detectar posibles duplicados**, **Sugerir términos**, **Redactar una descripción** o **Responder consultas**) y, si corresponde, a qué pieza se refiere. Tiene dos cuadros:

- **Texto de la ficha**: lo que se le dio a la IA.
- **Propuesta de la IA**: los campos que sugiere, uno por línea, con su **confianza** en porcentaje.

## Revisar una sugerencia

1. Compare **Texto de la ficha** con **Propuesta de la IA**.
2. Si algo no es correcto, abra **Corregir antes de aprobar**, edite el contenido (es un formato técnico llamado JSON; si lo escribe mal, un aviso rojo le dice que revise la sintaxis y **Aprobar** queda deshabilitado) y siga.
3. Pulse **Aprobar** para dejar la propuesta, corregida o no, como dato revisado por una persona; o **Rechazar** y escriba el **motivo**.
4. La tarjeta pasa a **Ejemplos ya revisados**. Al rechazar, el motivo queda visible en ella.

En esta demostración el resultado se guarda solo mientras la página está abierta y no llega al catálogo.

## Si algo no coincide con lo que espera

- **No aparecen sugerencias sobre mis piezas:** es lo esperado. Los ejemplos son fijos y sintéticos.
- **No veo «Sugerencias IA» en el menú:** su rol no tiene permiso de revisar sugerencias.
