"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { GLOSSARY, type GlossaryCategory } from "@/lib/glossary";
import { cn } from "@/lib/utils";

const CATEGORIES: ("Todos" | GlossaryCategory)[] = ["Todos", "Mercado", "Acciones y CEDEARs", "Renta fija", "Dólar", "Gráficos"];

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Glosario buscable (RF-45). */
export function GlossaryList() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("Todos");

  const items = useMemo(() => {
    const needle = normalize(q.trim());
    return GLOSSARY.filter((g) => {
      if (cat !== "Todos" && g.category !== cat) return false;
      if (!needle) return true;
      return normalize([g.term, g.short, ...(g.aliases ?? [])].join(" ")).includes(needle);
    }).sort((a, b) => a.term.localeCompare(b.term, "es"));
  }, [q, cat]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar un término (TIR, CEDEAR, MEP…)"
            aria-label="Buscar en el glosario"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categoría">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              aria-pressed={cat === c}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors",
                cat === c ? "border-primary bg-primary/10 font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">No encontramos ese término. Probá con otra palabra.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((g) => (
            <li key={g.id} id={g.id} className="scroll-mt-24 rounded-xl border bg-card p-4 target:ring-2 target:ring-primary/40">
              <p className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">{g.category}</p>
              <h2 className="mt-0.5 font-semibold">{g.term}</h2>
              <p className="mt-2 text-sm leading-relaxed">{g.short}</p>
              <dl className="mt-3 grid gap-2 text-[13px] leading-relaxed">
                <div>
                  <dt className="font-medium">Cómo se lee</dt>
                  <dd className="text-muted-foreground">{g.read}</dd>
                </div>
                <div>
                  <dt className="font-medium">Por qué importa</dt>
                  <dd className="text-muted-foreground">{g.why}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
