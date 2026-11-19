## 1. Web

- [x] 1.1 Quitar el bloque «Sugerencias de IA» de cada fila y «Pedir sugerencias de IA para estas filas» (`LiveImportWizard.tsx`, `ImportWizard.tsx`)
- [x] 1.2 Eliminar `ImportRowAiSuggestions.tsx`, `suggestRowAiFields` y `setRowAiFields`, y su uso en `ImportPlainLanguage.test.tsx`

## 2. Cierre

- [x] 2.1 Manual de usuario (`docs/manual-usuario/importacion.md`)
- [x] 2.2 `npm run test:web`, `npm run lint`, `openspec validate retirar-ia-revision-filas --strict`
- [ ] 2.3 `openspec archive retirar-ia-revision-filas -y` tras aprobar el PR, **después** de archivar `carga-masiva-con-ia`
