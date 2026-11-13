/**
 * Primera pantalla de Importación: «¿Qué desea importar?» con tres tarjetas (change
 * `importacion-elegir-origen`, D5/D7). Son enlaces, sin estado propio: la elección vive en la
 * dirección. Solo presentación.
 */
import { FileSpreadsheet, Images, Layers, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { cardClassName } from "@/components/ui/Card";
import { importHref } from "@/lib/data/import-origin";

interface OriginOption {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export const IMPORT_ORIGIN_OPTIONS: OriginOption[] = [
  {
    href: importHref({ origin: "excel" }),
    title: "Solo Excel",
    description: "Sábanas de piezas en Excel o CSV.",
    icon: FileSpreadsheet,
  },
  {
    href: "/importacion/fotos",
    title: "Solo imágenes",
    description: "Fotos de piezas que ya están registradas. Una foto sin pieza no crea una pieza.",
    icon: Images,
  },
  {
    href: importHref({ origin: "excel-fotos" }),
    title: "Excel e imágenes",
    description: "Piezas en Excel y sus fotos. Las fotos se suben después del Excel.",
    icon: Layers,
  },
];

export function ImportOriginPicker() {
  return (
    <section aria-labelledby="importar-que" className="flex flex-col gap-4">
      <PageHeader title="¿Qué desea importar?" titleId="importar-que" />
      <ul className="grid gap-4 md:grid-cols-3">
        {IMPORT_ORIGIN_OPTIONS.map(({ href, title, description, icon: Icon }) => (
          <li key={href} className="flex">
            <Link
              href={href}
              className={cardClassName({
                interactive: true,
                className:
                  "flex min-h-11 w-full flex-col gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota",
              })}
            >
              <Icon size={28} aria-hidden="true" className="text-terracota" />
              <span className="text-lg font-semibold text-tinta">{title}</span>
              <span className="text-base text-gris-texto">{description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
