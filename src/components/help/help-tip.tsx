"use client";

import { CircleHelp } from "lucide-react";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { glossaryEntry } from "@/lib/glossary";
import { cn } from "@/lib/utils";

/** Ícono de ayuda junto a un dato: explica qué es, cómo se lee y por qué importa (RF-44). */
export function HelpTip({ id, className }: { id: string; className?: string }) {
  const entry = glossaryEntry(id);
  if (!entry) return null;

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Qué es ${entry.term}`}
        className={cn(
          "inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          className,
        )}
      >
        <CircleHelp className="size-3.5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-3 p-3.5 text-left font-normal normal-case">
        <div className="flex flex-col gap-0.5">
          <p className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">{entry.category}</p>
          <p className="font-semibold">{entry.term}</p>
        </div>
        <p className="text-sm leading-relaxed">{entry.short}</p>
        <dl className="grid gap-2 text-[13px] leading-relaxed">
          <div>
            <dt className="font-medium">Cómo se lee</dt>
            <dd className="text-muted-foreground">{entry.read}</dd>
          </div>
          <div>
            <dt className="font-medium">Por qué importa</dt>
            <dd className="text-muted-foreground">{entry.why}</dd>
          </div>
        </dl>
        <Link href={`/glossary#${entry.id}`} className="text-xs font-medium text-primary hover:underline">
          Ver en el glosario
        </Link>
        <p className="text-[11px] text-muted-foreground">Es una explicación general, no una recomendación de inversión.</p>
      </PopoverContent>
    </Popover>
  );
}
