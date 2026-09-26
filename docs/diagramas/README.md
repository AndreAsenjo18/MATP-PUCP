# Diagramas del expediente de ingeniería (MATP)

Contenido de cada carpeta:

| Carpeta | Contenido |
|---|---|
| `cap6/` | Capítulo 6 — Modelo de análisis y diseño: diagramas de clases (`cls_*`), de estados (`st_*`), de secuencia (`sq_*`), de colaboración (`co_*`) y entidad-relación (`er_implementado.puml`, `er_extensiones.puml`) |
| `cap7/` | Capítulo 7 — Arquitectura e implementación: diagramas de componentes (`comp_*`) |
| `cap8/` | Capítulo 8 — Despliegue: diagramas de despliegue (`dep_*`: local, VM, AWS, flujo) |
| `modelo-datos/` | `er.puml`, ER generado automáticamente desde los modelos SQLAlchemy (`npm run diagrams:er`) |

Cada carpeta de capítulos incluye un `_header.iuml` con los `skinparam` y estilos comunes.

## Regenerar los PNG

Requiere PlantUML 1.2024.x o superior:

```bash
java -jar plantuml.jar -tpng docs/diagramas/**/*.puml
```

Los diagramas grandes `er_implementado.puml` y `er_extensiones.puml` necesitan un límite de tamaño
superior:

```bash
java -DPLANTUML_LIMIT_SIZE=30000 -jar plantuml.jar -tpng docs/diagramas/cap6/er_*.puml
```

El ER de `modelo-datos/` no se dibuja con PlantUML a mano: se regenera desde el código con
`npm run diagrams:er` y CI verifica que esté actualizado con `npm run diagrams:check`.

## Regla

**Todo cambio de modelo, flujo o despliegue actualiza su diagrama en el mismo PR.** El diagrama
`modelo-datos/er.puml` se deriva de los modelos SQLAlchemy y su migración; el PDF de
`docs/fuentes/` es solo la versión inicial del equipo (referencia histórica).
