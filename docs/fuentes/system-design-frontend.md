# MATP-PUCP — System Design Frontend

Documentación del sistema de diseño para el inventario del museo. Stack: React + TypeScript + Tailwind CSS + `lucide-react`.

Este proyecto usa la variante **Atomic Design**, con tres niveles:

| Nivel      | Nombre                          | Qué es                               | Ejemplos en este proyecto                          |
| ---------- | ------------------------------- | ------------------------------------ | -------------------------------------------------- |
| Átomos     | `components/ui/`                | Piezas base, sin lógica de negocio   | `Button`, `Badge`, `Card`, `Input`                 |
| Moléculas  | `components/domain/`            | Combinan átomos con reglas del museo | `FichaPieza` / `CardPieza`, `ModalImportacion`     |
| Organismos | `components/layout/` + `pages/` | Estructuras completas de pantalla    | `Sidebar`, `MainLayout`, `Dashboard`, `Inventario` |

Beneficios para MATP:

- Colores institucionales centralizados en un solo lugar (`tailwind.config.js`).
- Estados de pieza (sala, comodato, incompleta, conflicto) siempre con mismo `Badge`.
- Pantallas nuevas se arman combinando bloques existentes, como Lego.
- Código mantenible y defendible ante requerimiento / jurado.

## 2. Estructura de carpetas propuesta

Ubicación: dentro de `src/`.

```plaintext
src/
 ├── components/
 │    ├── ui/               # Átomos reutilizables, sin negocio
 │    │    ├── Button.tsx
 │    │    ├── Badge.tsx
 │    │    ├── Card.tsx
 │    │    └── Input.tsx
 │    ├── layout/           # Estructura (Sidebar, Navbar, Layout)
 │    │    ├── Sidebar.tsx
 │    │    └── MainLayout.tsx
 │    └── domain/           # Negocio museo (ficha, filtros, importación)
 │         ├── FichaPieza.tsx   # alias actual: CardPieza.tsx
 │         └── ModalImportacion.tsx
 ├── pages/                 # Pantallas (o carpeta `app/` si usas Next.js App Router)
 │    ├── Dashboard.tsx
 │    └── Inventario.tsx
 ├── utils/                 # Auxiliares (fechas, códigos)
 └── tailwind.config.js     # Tokens institucionales
```

Reglas:

- `ui/` jamás importa de `domain/`. Solo recibe `props`.
- `domain/` sí puede importar de `ui/` (ej. `CardPieza` usa `Badge`).
- `layout/` envuelve páginas, no contiene lógica de inventario.
- `pages/` ensambla todo, no define estilos atómicos sueltos.
- `utils/` solo funciones puras (formato fecha, código pieza, etc.).

## 3. Configuración Tailwind (`tailwind.config.js`)

Traslada colores institucionales del museo (Terracota, Tinta, Crema) desde el `<script>` de `index.html` al config oficial. Así quedan disponibles como clases (`bg-terracota`, `text-tinta`, `bg-crema`, etc.).

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        terracota: {
          DEFAULT: "#A23C16",
          dark: "#852F0F",
          light: "#F0DAD0",
        },
        tinta: "#0C0F14",
        crema: {
          DEFAULT: "#F5F0DA",
          light: "#FAF7EE",
        },
        borde: "#E3DECB",
        "gris-texto": "#5B534C",
        "verde-exito": "#007438",
        "verde-bg": "#E1EFD8",
        "ambar-alerta": "#C8791E",
        "ambar-bg": "#F5E4CC",
        "carmin-peligro": "#DA2A4E",
        "carmin-bg": "#F7D9DF",
      },
      fontFamily: {
        heading: ["Poppins", "sans-serif"],
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
```

Tokens:

| Token                                              | Valor                             | Uso                                |
| -------------------------------------------------- | --------------------------------- | ---------------------------------- |
| `terracota` / `terracota-dark` / `terracota-light` | `#A23C16` / `#852F0F` / `#F0DAD0` | Primario, hover, fondos suaves     |
| `tinta`                                            | `#0C0F14`                         | Texto principal, sidebar           |
| `crema` / `crema-light`                            | `#F5F0DA` / `#FAF7EE`             | Fondo app                          |
| `borde`                                            | `#E3DECB`                         | Bordes, divisores                  |
| `gris-texto`                                       | `#5B534C`                         | Texto secundario                   |
| `verde-exito` / `verde-bg`                         | `#007438` / `#E1EFD8`             | Estado OK (En Sala / Depósito)     |
| `ambar-alerta` / `ambar-bg`                        | `#C8791E` / `#F5E4CC`             | Advertencia (incompleta, sin foto) |
| `carmin-peligro` / `carmin-bg`                     | `#DA2A4E` / `#F7D9DF`             | Error (conflicto Excel)            |
| `font-heading` / `font-sans`                       | Poppins / Inter                   | Títulos / cuerpo                   |

Requisito: importar fuentes Poppins + Inter en `index.html` o CSS global para que `font-heading` / `font-sans` apliquen.

## 4. Componentes base (`ui/`)

### 4.1 `Button.tsx` — `src/components/ui/Button.tsx`

Botón maestro con variantes. Evita repetir clases Tailwind en cada vista.

```tsx
import React, { ButtonHTMLAttributes } from "react";
import { LucideIcon } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger";
  icon?: LucideIcon;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  icon: Icon,
  className = "",
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center gap-2 px-4 py-2 font-medium rounded-md transition-colors duration-200";

  const variants = {
    primary: "bg-terracota hover:bg-terracota-dark text-white",
    secondary: "bg-crema hover:bg-borde text-tinta",
    outline: "border border-terracota text-terracota hover:bg-terracota-light",
    danger: "bg-carmin-peligro hover:bg-red-700 text-white",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};
```

Props:

| Prop        | Tipo                                                | Default     | Descripción                         |
| ----------- | --------------------------------------------------- | ----------- | ----------------------------------- |
| `variant`   | `'primary' \| 'secondary' \| 'outline' \| 'danger'` | `'primary'` | Estilo visual                       |
| `icon`      | `LucideIcon`                                        | —           | Ícono izquierda (ej. `PlusCircle`)  |
| `className` | `string`                                            | `''`        | Extensión Tailwind                  |
| `...props`  | `ButtonHTMLAttributes`                              | —           | `onClick`, `disabled`, `type`, etc. |

Uso:

```tsx
import { Button } from "./components/ui/Button";
import { PlusCircle } from "lucide-react";

<Button variant="primary" icon={PlusCircle} onClick={nuevaPieza}>
  Nueva Pieza
</Button>;
```

### 4.2 `Badge.tsx` — `src/components/ui/Badge.tsx`

Etiqueta de estado. Crítica para lectura rápida en inventario.

```tsx
import React from "react";

interface OpcionesBadge {
  children: React.ReactNode;
  intent?: "success" | "warning" | "danger" | "info" | "default";
}

export const Badge: React.FC<OpcionesBadge> = ({
  children,
  intent = "default",
}) => {
  const baseStyles =
    "px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider";

  const intents = {
    success: "bg-verde-bg text-verde-exito", // Ej: En Sala
    warning: "bg-ambar-bg text-ambar-alerta", // Ej: Información incompleta
    danger: "bg-carmin-bg text-carmin-peligro", // Ej: Conflicto en Excel
    info: "bg-terracota-light text-terracota-dark", // Ej: Comodato
    default: "bg-borde text-gris-texto", // Ej: Código asignado
  };

  return <span className={`${baseStyles} ${intents[intent]}`}>{children}</span>;
};
```

Mapeo recomendado museo:

| `intent`  | Significado                       |
| --------- | --------------------------------- |
| `success` | En Sala / En Depósito             |
| `info`    | Comodato / Préstamo               |
| `warning` | Información incompleta / Sin foto |
| `danger`  | Conflicto importación Excel       |
| `default` | Código asignado / genérico        |

> Nota: `Card.tsx` e `Input.tsx` están previstos en carpeta pero aún sin código. Mantener misma convención props (`variant`/`intent` + `className` extensible).

## 5. Componente dominio (`domain/`)

### 5.1 `CardPieza.tsx` — `src/components/domain/CardPieza.tsx`

Tarjeta para iterar lista de piezas en buscador / inventario. Combina `Badge` + iconos `lucide-react`.

```tsx
import React from "react";
import { Badge } from "../ui/Badge";
import { MapPin, Image as ImageIcon } from "lucide-react";

interface CardPiezaProps {
  codigo: string;
  denominacion: string;
  coleccion: string;
  ubicacion: string;
  estado: "success" | "warning" | "danger" | "info";
  textoEstado: string;
  tieneFoto?: boolean;
}

export const CardPieza: React.FC<CardPiezaProps> = ({
  codigo,
  denominacion,
  coleccion,
  ubicacion,
  estado,
  textoEstado,
  tieneFoto = false,
}) => {
  return (
    <div className="bg-white rounded-lg border border-borde p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <span className="font-mono text-sm text-terracota font-bold">
          {codigo}
        </span>
        <Badge intent={estado}>{textoEstado}</Badge>
      </div>

      <h3 className="font-heading font-semibold text-tinta text-lg mb-1 line-clamp-2">
        {denominacion}
      </h3>
      <p className="text-sm text-gris-texto mb-4">{coleccion}</p>

      <div className="flex items-center justify-between text-xs text-gris-texto border-t border-borde pt-3 mt-auto">
        <div className="flex items-center gap-1">
          <MapPin size={14} className="text-terracota" />
          <span>{ubicacion}</span>
        </div>
        {!tieneFoto && (
          <div
            className="flex items-center gap-1 text-ambar-alerta"
            title="Requiere fotografía"
          >
            <ImageIcon size={14} />
            <span>Sin foto</span>
          </div>
        )}
      </div>
    </div>
  );
};
```

Props:

| Prop                     | Obligatoria  | Descripción                                        |
| ------------------------ | ------------ | -------------------------------------------------- |
| `codigo`                 | Sí           | Código inventario (ej. `I-4502`)                   |
| `denominacion`           | Sí           | Nombre pieza, truncado a 2 líneas (`line-clamp-2`) |
| `coleccion`              | Sí           | Colección (ej. Florentino Jiménez Toma)            |
| `ubicacion`              | Sí           | Sala / depósito + estante                          |
| `estado` / `textoEstado` | Sí           | `intent` Badge + etiqueta visible                  |
| `tieneFoto`              | No (`false`) | Si `false`, muestra alerta “Sin foto”              |

> `line-clamp-2` requiere Tailwind v3.3+ core o plugin `@tailwindcss/line-clamp` en versiones viejas. Si no trunca, instalar plugin.

## 6. Layout principal (`layout/`)

### 6.1 `MainLayout.tsx` — `src/components/layout/MainLayout.tsx`

Estructura base donde se inyectan pantallas vía `children`.

```tsx
import React from "react";

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <div className="min-h-screen bg-crema text-tinta font-sans flex">
      {/* Aquí iría tu Sidebar.tsx */}
      <aside className="w-64 bg-tinta text-crema flex-shrink-0 hidden md:block">
        <div className="p-6">
          <h1 className="font-heading font-bold text-xl text-crema-light">
            MATP
          </h1>
          <p className="text-sm text-gray-400">Sistema de Colecciones</p>
        </div>
        {/* Navegación del Sidebar */}
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-borde flex items-center px-6">
          <h2 className="font-heading font-semibold text-lg text-tinta">
            Gestión de Inventario
          </h2>
        </header>

        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
};
```

Partes:

- `aside`: sidebar fijo `w-64`, fondo `tinta`, oculto en móvil (`hidden md:block`). Pendiente extraer a `Sidebar.tsx`.
- `header`: barra `h-16` con título sección.
- `div overflow-auto`: área scroll donde vive cada página.

## 7. Integración en página principal (`App.tsx`)

Ensamblaje estilo Lego: layout + encabezado + grilla.

```tsx
import { MainLayout } from "./components/layout/MainLayout";
import { CardPieza } from "./components/domain/CardPieza";
import { Button } from "./components/ui/Button";
import { PlusCircle } from "lucide-react";

function App() {
  return (
    <MainLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-tinta">
            Colecciones
          </h1>
          <p className="text-gris-texto text-sm">
            Explora las obras registradas en el museo
          </p>
        </div>
        <Button variant="primary" icon={PlusCircle}>
          Nueva Pieza
        </Button>
      </div>

      {/* Grilla de piezas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <CardPieza
          codigo="I-4502"
          denominacion="Retablo Ayacuchano tradicional de tres niveles"
          coleccion="Colección Florentino Jiménez Toma"
          ubicacion="Depósito 1 - Estante A"
          estado="success"
          textoEstado="En Depósito"
          tieneFoto={true}
        />
        <CardPieza
          codigo="AJB-105"
          denominacion="Máscara de la danza de la Diablada puneña"
          coleccion="Colección Arturo Jiménez Borja"
          ubicacion="Sala de Exposiciones Temporales"
          estado="info"
          textoEstado="Comodato"
          tieneFoto={false}
        />
      </div>
    </MainLayout>
  );
}

export default App;
```

Flujo lectura:

1. `MainLayout` pinta fondo crema + sidebar + header.
2. Encabezado página + `Button primary` con icono.
3. Grilla responsive (`1 → 2 → 3` columnas) itera `CardPieza`.
4. Cada tarjeta resuelve su `Badge` según `estado`.

## 8. Convenciones

- Nombres: `PascalCase` para componentes (`CardPieza.tsx`), `camelCase` para props/utils.
- Tipos: interfaces `XxxProps` exportables si se reutilizan.
- Estilos: solo clases Tailwind con tokens (`bg-terracota`, no hex sueltos).
- Iconos: `lucide-react`, tamaño 14–18 en tarjetas/botones. No mezclar con Material Icons.
- Imports dominio: `import { Badge } from '../ui/Badge';` (relativo, misma convención en todo `domain/`).
- `className` siempre último para permitir override.

## 9. Dependencias

```bash
npm i lucide-react
```

Tailwind debe estar configurado con `content` incluyendo `./src/**/*.{js,ts,jsx,tsx}`. Ver sección 3.

## 10. Próximos pasos / faltantes

1. Crear `ui/Card.tsx` e `ui/Input.tsx` (solo previstos en árbol).
2. Extraer `Sidebar.tsx` desde `MainLayout` + navegación real.
3. Crear `domain/FichaPieza.tsx` (detalle completo) y `domain/ModalImportacion.tsx` (conflictos Excel).
4. Crear `pages/Dashboard.tsx` e `pages/Inventario.tsx` + ruteo.
5. Crear `utils/` (formato fecha, código pieza, validación Excel).
6. Verificar `line-clamp-2` según versión Tailwind.
7. Agregar estados `loading` / `empty` a grilla inventario.
