# ADR-019 — Uso de los Excel reales del museo en pruebas y demos

- **Estado**: Propuesto
- **Fecha**: 2026-10-31
- **Change de origen**: `formatos-reales-importacion`

## Contexto

Hasta ahora el proyecto usó solo datos sintéticos (RNF-014, Ley 29733; guardrail 3 del `CLAUDE.md`). Los fixtures reproducían a propósito los problemas reales, pero los formatos del museo eran supuestos [SUPUESTO A1].

El 2026-10-31 el museo entregó y **autorizó usar** sus 61 Excel históricos para el desarrollo, las pruebas y las demos. La revisión de esos archivos mostró dos familias de formato, 10 variantes de encabezados y formas de código que los fixtures no tenían (`formatos-reales-importacion`). Las fotos de las piezas no están incluidas en esa autorización de uso: siguen siendo sintéticas.

Los Excel contienen datos personales de propietarios: nombres y direcciones de particulares. El repositorio `AndreAsenjo18/MATP-PUCP` es **público**.

## Decisión

1. Los Excel reales se usan para probar la importación, medir su calidad (`scripts/check_real_excels.py`) y hacer las demos con el museo.
2. **No se suben al repositorio.** Viven en `data/real/`, carpeta ignorada por git, y el equipo los comparte por el Drive del grupo. El repositorio es público y sus datos personales quedarían expuestos e indexados sin vuelta atrás, cosa que la autorización de uso no requiere.
3. Las pruebas de CI siguen con fixtures sintéticos, que ahora copian los **encabezados reales** con valores inventados, para que corran sin los archivos reales.
4. Las fotos siguen siendo sintéticas en fixtures y demos.
5. Las capturas del Drive del museo sí están en el repositorio (`docs/capturas de pantalla de carpetas con fotos/`), con autorización expresa del museo para ese uso.
6. Un ambiente donde se carguen los Excel reales aplica las mismas restricciones de datos sensibles que producción (permiso `sensitive.donor_data`, RF-041).

## Consecuencias

- La regla «solo datos sintéticos» del `CLAUDE.md` pasa a ser «solo datos sintéticos en el repositorio y en CI; los Excel reales del museo, con su autorización, solo en `data/real/` (ADR-019)».
- Quien necesite los archivos los baja del Drive del grupo a `data/real/`; nunca se adjuntan a issues, PR ni mensajes públicos.
- Si el equipo decide subirlos al repositorio, primero hay que hacerlo privado o anonimizar las columnas del propietario, y este ADR se actualiza.
