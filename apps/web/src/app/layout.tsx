import type { Metadata } from "next";
import "@fontsource-variable/inter/wght.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "./globals.css";

import { MainLayout } from "@/components/layout/MainLayout";
import { SessionProvider } from "@/lib/auth/session";
import { MockStoreProvider } from "@/lib/data/mock-store";

export const metadata: Metadata = {
  title: "MATP · Gestión de Colecciones",
  description: "Sistema interno de gestión y digitalización de colecciones del MATP (PUCP).",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-crema-light font-sans text-tinta">
        <SessionProvider>
          <MockStoreProvider>
            <MainLayout>{children}</MainLayout>
          </MockStoreProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
