/**
 * Primera pantalla de Importación: «¿Qué desea importar?» con tres tarjetas (change
 * `importacion-elegir-origen`, D5/D7). Son enlaces, sin estado propio: la elección vive en la
 * dirección. Solo presentación.
 */
import { ArrowRight, FileSpreadsheet, Images, Layers, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { cardClassName } from "@/components/ui/Card";
import { IconCircle } from "@/components/ui/IconCircle";
import { cn } from "@/lib/cn";
import { importHref } from "@/lib/data/import-origin";

interface OriginOption {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Color del icono y de la etiqueta (maqueta B). */
  tone: "anil" | "ciruela" | "verde";
  /** Etiqueta corta del tipo de carga (maqueta B). */
  tag: string;
}

export const IMPORT_ORIGIN_OPTIONS: OriginOption[] = [
  {
    href: importHref({ origin: "excel" }),
    title: "Solo Excel",
    description: "Sábanas de piezas en Excel o CSV.",
    icon: FileSpreadsheet,
    tone: "anil",
    tag: "Para piezas nuevas",
  },
  {
    href: "/importacion/fotos",
    title: "Solo imágenes",
    description: "Fotos de piezas que ya están registradas. Una foto sin pieza no crea una pieza.",
    icon: Images,
    tone: "ciruela",
    tag: "Para fotos",
  },
  {
    href: importHref({ origin: "excel-fotos" }),
    title: "Excel e imágenes",
    description: "Piezas en Excel y sus fotos. Las fotos se suben después del Excel.",
    icon: Layers,
    tone: "verde",
    tag: "Paso a paso",
  },
];

const TAG_TONES: Record<OriginOption["tone"], string> = {
  anil: "bg-anil-bg text-anil",
  ciruela: "bg-ciruela-bg text-ciruela",
  verde: "bg-verde-bg text-verde-exito",
};

/**
 * Tres tarjetas grandes (unos 300 px de alto): el icono en un círculo de color, el título de 27 px,
 * la descripción de 19 px, una etiqueta corta del tipo y un botón redondo terracota con una flecha.
 * Toda la tarjeta es el enlace; el botón es solo la señal.
 */
export function ImportOriginPicker() {
  return (
    <section aria-labelledby="importar-que" className="flex flex-col gap-5">
      <PageHeader title="¿Qué desea importar?" titleId="importar-que" />
      <ul className="grid gap-tarjetas md:grid-cols-3">
        {IMPORT_ORIGIN_OPTIONS.map(({ href, title, description, icon, tone, tag }) => (
          <li key={href} className="flex">
            <Link href={href} className={cardClassName({ interactive: true, padded: false, className: "group flex min-h-72 w-full flex-col gap-4 p-7" })}>
              <IconCircle icon={icon} tone={tone} size="lg" />
              <span className="text-opcion font-bold text-tinta">{title}</span>
              <span className="text-opcion-texto text-gris-texto">{description}</span>
              <span className="mt-auto flex items-center justify-between gap-3 pt-2">
                <span className={cn("rounded-full px-3 py-1 text-base font-semibold", TAG_TONES[tone])}>{tag}</span>
                <span
                  aria-hidden="true"
                  className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-terracota text-white shadow-sm transition-[translate] duration-150 ease-out group-hover:bg-terracota-dark motion-safe:group-hover:translate-x-0.5"
                >
                  <ArrowRight size={22} />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
