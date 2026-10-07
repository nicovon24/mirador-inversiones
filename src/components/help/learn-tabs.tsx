import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "guides", href: "/learn", label: "Guías" },
  { id: "glossary", href: "/glossary", label: "Glosario" },
] as const;

/** Pestañas de la sección Aprender: guías paso a paso y glosario comparten una sola entrada del menú. */
export function LearnTabs({ active }: { active: (typeof TABS)[number]["id"] }) {
  return (
    <nav aria-label="Secciones de Aprender" className="flex gap-1 border-b">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={active === t.id ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
            active === t.id
              ? "border-primary font-medium text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
