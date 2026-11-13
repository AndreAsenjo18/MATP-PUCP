/**
 * Combinaciones de texto sobre fondo permitidas por el sistema de diseño (docs/system-design.md).
 * Cada par debe cumplir contraste >= 4.5:1; lo verifica design-tokens.test.ts. "white" es el blanco
 * puro (#ffffff), que no es token.
 *
 * `ambar-alerta` y `carmin-peligro` NO figuran como texto sobre sus fondos suaves porque no alcanzan
 * el contraste (2.7:1 y 4.2:1): para texto se usan `ambar-texto` y `carmin-texto`. Los `carmin-*` son
 * un rojo ladrillo apagado (change `remodelacion-visual`, ficha).
 */
export interface ContrastPair {
  text: string;
  background: string;
  usage: string;
}

export const CONTRAST_PAIRS: ContrastPair[] = [
  { text: "white", background: "terracota", usage: "Button primary" },
  { text: "white", background: "terracota-dark", usage: "Button primary (hover)" },
  { text: "white", background: "carmin-peligro", usage: "Button danger" },
  { text: "white", background: "carmin-texto", usage: "Button danger (hover)" },
  { text: "tinta", background: "crema", usage: "Button secondary" },
  { text: "tinta", background: "borde", usage: "Button secondary (hover)" },
  { text: "tinta", background: "crema-light", usage: "Fondo de la aplicación" },
  { text: "tinta", background: "white", usage: "Tarjetas y encabezado" },
  { text: "terracota", background: "white", usage: "Button outline, códigos, enlaces" },
  { text: "terracota", background: "terracota-light", usage: "Button outline (hover)" },
  { text: "gris-texto", background: "white", usage: "Texto secundario en tarjetas" },
  { text: "gris-texto", background: "crema-light", usage: "Texto secundario" },
  { text: "crema", background: "tinta", usage: "Barra lateral" },
  { text: "tinta", background: "crema", usage: "Barra lateral: sección actual" },
  { text: "verde-exito", background: "verde-bg", usage: "Badge success" },
  { text: "terracota-dark", background: "terracota-light", usage: "Badge info" },
  { text: "ambar-texto", background: "ambar-bg", usage: "Badge warning, avisos" },
  { text: "carmin-texto", background: "carmin-bg", usage: "Badge danger, errores" },
  { text: "gris-texto", background: "borde", usage: "Badge default" },
  { text: "carmin-texto", background: "white", usage: "Mensajes de error de campos; Button danger-outline («Eliminar pieza»)" },
  { text: "carmin-texto", background: "carmin-bg", usage: "Button danger-outline (hover)" },
  { text: "ambar-texto", background: "white", usage: "Aviso «Sin foto» en tarjetas" },
  { text: "verde-exito", background: "white", usage: "Mensajes de éxito" },
  // Dirección «B · Cabecera audaz» (docs/guia-visual.md)
  { text: "crema", background: "terracota", usage: "Título y texto de la cabecera principal" },
  { text: "crema-light", background: "terracota", usage: "Texto claro de la cabecera principal" },
  { text: "terracota-dark", background: "crema-light", usage: "Nombre del museo en el Inicio" },
  { text: "anil", background: "anil-bg", usage: "IconCircle añil" },
  { text: "white", background: "anil", usage: "IconCircle añil sólido" },
  { text: "ciruela", background: "ciruela-bg", usage: "IconCircle ciruela" },
  { text: "white", background: "ciruela", usage: "IconCircle ciruela sólido" },
  { text: "white", background: "verde-exito", usage: "IconCircle verde sólido" },
  { text: "white", background: "ambar-texto", usage: "IconCircle ámbar sólido" },
  { text: "white", background: "gris-texto", usage: "IconCircle piedra sólido" },
  // Pares de la cola de duplicados: cada pieza en un panel de color suave.
  { text: "tinta", background: "ambar-bg", usage: "Panel de la primera pieza del par" },
  { text: "gris-texto", background: "ambar-bg", usage: "Panel de la primera pieza del par (detalle)" },
  { text: "terracota", background: "ambar-bg", usage: "Código I en el panel de la primera pieza" },
  { text: "tinta", background: "ciruela-bg", usage: "Panel de la segunda pieza del par" },
  { text: "gris-texto", background: "ciruela-bg", usage: "Panel de la segunda pieza del par (detalle)" },
  { text: "terracota", background: "ciruela-bg", usage: "Código I en el panel de la segunda pieza" },
  { text: "gris-texto", background: "crema", usage: "«vs» entre las dos piezas; títulos de tabla" },
  { text: "tinta", background: "crema", usage: "Fila de títulos de las tablas" },
  { text: "ambar-texto", background: "crema", usage: "Iniciales de la persona en la lista de usuarios" },
  { text: "terracota-dark", background: "white", usage: "Badge info tenue (filas de resultados)" },
];
