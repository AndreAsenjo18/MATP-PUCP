# Guía visual del MATP (piloto)

Salió del piloto de identidad visual en el **Inicio** (change `piloto-identidad-visual-inicio`). Dice qué tokens, reglas y componentes usar para que las demás pantallas se vean igual. Complementa a `docs/system-design.md`, que sigue vigente.

**Estado: piloto.** Solo el Inicio usa lo de esta guía. Las demás pantallas no cambiaron.

> [SUPUESTO] La paleta, la tipografía y el motivo no son identidad oficial de la Dirección de Cultura (pregunta J1 de `docs/preguntas-contraparte.md`).

## Carácter

Cálido, artesanal y calmado: fondo crema, acentos terracota, tarjetas blancas con sombra suave y un motivo de tejido. Nada oscuro, brillante ni futurista.

## Tokens

Todos están en `apps/web/src/app/globals.css`, bajo el comentario «Piloto de identidad visual». Se añadieron sin tocar los anteriores.

### Color por tipo de tarea

| Tarea | Tono | Fondo suave / icono | Sólido |
|---|---|---|---|
| Buscar | `terracota` | `terracota-light` / `terracota-dark` | `terracota` |
| Registrar | `verde` | `verde-bg` / `verde-exito` | `verde-exito` |
| Cargar datos o fotos | `anil` (nuevo) | `anil-bg` `#DFE7F3` / `anil` `#2C4A7C` | `anil` |
| Revisar pendientes y faltantes | `ambar` | `ambar-bg` / `ambar-texto` | `ambar-texto` |
| Reportes | `ciruela` (nuevo) | `ciruela-bg` `#EFE0EC` / `ciruela` `#6B3566` | `ciruela` |
| Configuración | `piedra` | `borde` / `gris-texto` | `gris-texto` |

### Tipografía

| Token | Familia | Uso |
|---|---|---|
| `font-display` | Fraunces Variable (respaldo Georgia) | Título de la pantalla y nombre de las tareas principales |
| `font-sans` | Inter | Todo lo demás |

Fraunces está autoalojada (`@fontsource-variable/fraunces`), sin servicios externos.

### Espaciado, radios y sombras

| Token | Valor | Clase | Uso |
|---|---|---|---|
| `--spacing-seccion` | 1.5rem | `gap-seccion` | Entre bloques de la pantalla |
| `--spacing-tarjetas` | 1rem | `gap-tarjetas` | Entre tarjetas |
| `--spacing-tarjeta` | 1.5rem | `p-tarjeta` | Relleno de una tarjeta principal |
| `--radius-tarjeta` | 1rem | `rounded-tarjeta` | Tarjetas. Fichas y círculos usan `rounded-full` |
| `--shadow-suave` | tinte terracota | `shadow-suave` | Tarjeta en reposo |
| `--shadow-elevada` | tinte terracota | `shadow-elevada` | Tarjeta bajo el cursor |

## Reglas

1. **Letra de 16 px o más** (`text-base` como mínimo). Nunca `text-sm` ni `text-xs` en texto de lectura.
2. **Todo lo que se pulsa mide 44 px o más** de alto (`min-h-11`).
3. **El color nunca va solo**: siempre con icono y texto. Los pares de texto y fondo se declaran en `lib/design/contrast-pairs.ts` y la prueba exige contraste 4.5:1.
4. **Una jerarquía por pantalla**: lo más frecuente, grande y primero; el resto, más pequeño. Unas 7 opciones o menos.
5. **Un título y como máximo una línea de ayuda.** Sin siglas ni términos internos: «sin código de inventario», no «sin código I».
6. **Foco, cursor y pulsación visibles**: contorno terracota de 3 px con el teclado, sombra y borde al pasar el cursor, y vuelta al reposo al pulsar.
7. **Transiciones de 150 ms**, solo de posición, sombra y borde, y desactivadas con `motion-reduce:`. Nunca `transition-all`.
8. **Cifras con `tabular-nums`** y con `toLocaleString("es-PE")`.
9. **Imágenes**: solo motivos propios en SVG o sintéticas del repositorio.

## Componentes reutilizables

| Componente | Archivo | Para qué |
|---|---|---|
| `surfaceClassName` | `components/ui/Surface.ts` | Tarjeta blanca con radio y sombra. Con `interactive`, sus estados de cursor, pulsación y foco |
| `IconCircle` | `components/ui/IconCircle.tsx` | Icono en círculo de color. `tone` elige el color; `solid` y `size="lg"` son para lo principal |
| `StatChip` | `components/ui/StatChip.tsx` | Ficha de un dato: icono, cantidad y lo que cuenta. Con `href` es enlace y muestra una flecha |
| `TextileBand`, `TextileMark` | `components/brand/TextileMotif.tsx` | Cenefa y rombo de tejido, decorativos. Uno por pantalla como mucho |

```tsx
<Link href="/busqueda" className={surfaceClassName({ interactive: true, className: "flex items-center gap-5 p-tarjeta" })}>
  <IconCircle icon={Search} tone="terracota" size="lg" solid />
  <span className="font-display text-2xl font-semibold">Buscar una pieza</span>
</Link>

<StatChip icon={ImageOff} tone="ambar" value="138" label="sin foto" href="/busqueda?incompleteOnly=1" />
```

## Al homologar otra pantalla

- `globals.css` pone Poppins en todo `h1`, `h2` y `h3`, y esa regla gana a las clases. Por eso el Inicio envuelve el título en un `<span className="font-display">`. Al homologar, cambiar esa regla a `font-display` y quitar los `span`.
- La hoja de Fraunces se importa en `app/inicio/page.tsx`. Al homologar, moverla a `app/layout.tsx` con las demás.
- `Card` (`components/ui/Card.tsx`) sigue con su estilo anterior. Al homologar, hacer que use `surfaceClassName`.

Capturas de antes y después: `docs/capturas-piloto/`.
