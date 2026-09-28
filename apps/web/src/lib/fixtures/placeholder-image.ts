/**
 * Fotos placeholder generadas en el cliente (data: URI, sin red) — equivalente en el frontend
 * a `apps/api/app/seed/images.py`. Necesario para que la maqueta funcione sin internet
 * (spec plataforma: "Demo sin internet").
 */
const PALETTE = ["#78716c", "#57534e", "#a8a29e", "#8b5e34", "#6b7280", "#9a6b4c"];

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** SVG en data: URI con el título y el tipo de vista, coloreado de forma determinista. */
export function placeholderPhotoDataUrl(title: string, viewLabel: string, width = 320, height = 240): string {
  const color = PALETTE[hashString(title + viewLabel) % PALETTE.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="${color}"/>
    <rect x="8" y="8" width="${width - 16}" height="${height - 16}" fill="none" stroke="white" stroke-opacity="0.5" stroke-width="2"/>
    <text x="50%" y="46%" text-anchor="middle" font-family="system-ui, sans-serif" font-size="16" fill="white">${escapeXml(title)}</text>
    <text x="50%" y="60%" text-anchor="middle" font-family="system-ui, sans-serif" font-size="13" fill="white" opacity="0.85">${escapeXml(viewLabel)} (foto sintética)</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
