# Administración

> Sección en construcción. Cada change del backlog añade aquí su parte (usuarios, permisos, colecciones, vocabularios, ubicaciones, parámetros, respaldos). Por ahora solo está escrita «Versión del sistema y actualizaciones» (change `pipeline-despliegue-ambientes`).

## Versión del sistema y actualizaciones

El sistema existe en dos lugares:

- **Sistema de pruebas**: el equipo técnico prueba ahí cada mejora apenas está lista. Solo tiene **datos inventados** (nunca piezas reales del museo). No está encendido todo el tiempo.
- **Sistema de uso diario**: es el que usa el museo. Solo cambia cuando una persona autorizada instala una **versión** ya probada, con un número como `v0.1.0`. Nunca se actualiza solo.

### Saber qué versión está funcionando

1. Abra en el navegador la dirección del sistema y añada `/health` al final. Por ejemplo: `https://<dirección-del-sistema>/health`.
2. Se muestra un texto corto con datos del sistema. No contiene información de piezas ni de personas.
3. Busque estas palabras:
   - **`release`**: la versión instalada, por ejemplo `v0.1.0`. En el sistema de pruebas aparece `sha-` seguido de letras y números. Si aparece `null`, la versión no se registró al instalarla: avise al equipo técnico.
   - **`commit`**: un código largo de letras y números que identifica exactamente la versión. Si alguien del equipo técnico le pregunta qué versión tiene, copie y envíe este código.
   - **`status`**: `ok` significa que todo funciona; `degraded` significa que alguna parte tiene problemas (ver «Si algo sale mal»).

### Pedir que una mejora llegue al sistema de uso diario

Una mejora que se ve en el sistema de pruebas **no** llega sola al sistema de uso diario. Para instalarla:

1. Escriba al equipo técnico del proyecto indicando qué mejora necesita y desde cuándo.
2. Solo pueden crear e instalar una versión el **Arquitecto de software**, el **Líder del proyecto** y los **Implantadores** del equipo técnico.
3. Ellos confirman que la mejora funcionó en el sistema de pruebas, crean la versión (por ejemplo `v0.2.0`) y la instalan en el sistema de uso diario.
4. Cuando terminen, compruebe la versión con los pasos de «Saber qué versión está funcionando».

### Si algo sale mal

- **La página muestra `degraded`**: el sistema funciona con problemas (por ejemplo, no llega a la base de datos o al almacenamiento de fotos). Avise al equipo técnico y envíe la página completa, que no contiene datos del museo.
- **La página no carga**: el sistema está apagado o sin conexión. En el sistema de pruebas es normal fuera de las sesiones de trabajo del equipo técnico. En el sistema de uso diario, avise de inmediato al equipo técnico.
- **Ve un cambio en el sistema de pruebas que todavía no está en el de uso diario**: es lo esperado. Pida la versión como se explica arriba.
