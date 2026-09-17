import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MATP · Gestión de Colecciones",
  description: "Sistema interno de gestión y digitalización de colecciones del MATP (PUCP).",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-stone-50 font-sans">{children}</body>
    </html>
  );
}
