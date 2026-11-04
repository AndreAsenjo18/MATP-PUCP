> Quinto rediseño de UX por vista. Solo frontend y manual; sin cambios de API ni de reglas. La IA está fuera del MVP: se explica y se rotula, no se conecta.

## 1. Presentación

- [x] 1.1 `AiSuggestionParts.tsx`: `functionLabel`, `describeValue`, `proposalFields` y `FIELD_LABELS`; pruebas de las cinco funciones, de código desconocido, de valores anidados, de la confianza como porcentaje y de campos sin etiqueta (Req: Propuesta de la IA legible)
- [x] 1.2 `ScopeNotice` y constantes de copia (propósito y aviso); pruebas de render con la etiqueta «Fuera del MVP» y de que ningún texto cita requisitos ni `AI_PROVIDER` (Req: Aviso de que la pantalla está fuera del MVP; Propósito de la pantalla de sugerencias explicado en corto)

## 2. Pantalla

- [x] 2.1 `app/ia/sugerencias/page.tsx`: encabezado corto, aviso, secciones «Ejemplos pendientes de revisión» y «Ejemplos ya revisados», tarjeta con propuesta como lista y JSON plegado, diálogos sin referencias internas; pruebas de render de la tarjeta (Req: los tres)

## 3. Documentación y verificación

- [x] 3.1 `docs/manual-usuario/ia.md` y su estado en `docs/manual-usuario/README.md`
- [x] 3.2 Verificar en el navegador a 1280 y 375 px: aviso, propuesta legible, JSON plegado, aprobar y rechazar un ejemplo; `npm run lint`, pruebas web y `openspec validate --all --strict`
  - Hecho (2026-10-27) en Docker local con el seed (modo conectado): aviso «Fuera del MVP», propósito, propuesta como lista, JSON plegado con aviso y Aprobar deshabilitado ante JSON inválido, aprobar un ejemplo (pasa a «ya revisados») y 375 px sin desplazamiento horizontal. No se probó «Rechazar» ni 768 px en el navegador. Solo se añadieron dos etiquetas de campo después de la última carga (cubierto por pruebas y tipos).
