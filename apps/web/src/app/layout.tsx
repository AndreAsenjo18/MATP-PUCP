import type { Metadata } from "next";
import "./globals.css";

import { AppShell } from "@/components/AppShell";
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
      <body className="flex min-h-full flex-col bg-stone-50 font-sans">
        <SessionProvider>
          <MockStoreProvider>
            <AppShell>{children}</AppShell>
          </MockStoreProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
