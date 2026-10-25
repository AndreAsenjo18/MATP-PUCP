/**
 * Web Worker que calcula la huella SHA-256 de un archivo (change `importacion-masiva-fotografias`,
 * tarea 6.1; diseño D2). Así la interfaz no se congela al calcular miles de huellas.
 *
 * JavaScript plano en `public/`: se sirve tal cual desde el mismo origen (la CSP no admite workers
 * `blob:`) y no depende de cómo el empaquetador trate `new Worker(new URL(...))`. Lo usa
 * `src/lib/data/importPhotos.ts`.
 */
self.onmessage = async (event) => {
  const { id, file } = event.data;
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    self.postMessage({ id, hex });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
