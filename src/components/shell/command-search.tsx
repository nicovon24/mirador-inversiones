"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Command } from "@/components/ui/command";
import { SymbolAvatar } from "@/components/market/symbol-avatar";
import { NAV } from "@/components/shell/sidebar";
import { useDebounced } from "@/hooks/use-debounced";
import { useSearch } from "@/hooks/use-market";

export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 220);
  const { data, isFetching } = useSearch(debounced);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const results = debounced.trim() ? (data?.results ?? []) : [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-sm cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-ring/40 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Search className="size-4" aria-hidden />
        <span className="flex-1 truncate text-left">Buscar ticker o nombre…</span>
        <kbd className="hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Buscar instrumentos"
        description="Buscá por ticker o nombre en Argentina y EE.UU."
      >
        <Command shouldFilter={false}>
          <CommandInput placeholder="Ticker o nombre: GGAL, AAPL, AL30…" value={query} onValueChange={setQuery} />
          <CommandList>
            {debounced.trim() && !isFetching && <CommandEmpty>Sin resultados para “{debounced}”.</CommandEmpty>}
            {isFetching && results.length === 0 && (
              <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Buscando…
              </div>
            )}
            {results.length > 0 && (
              <CommandGroup heading="Instrumentos">
                {results.map((r) => (
                  <CommandItem
                    key={`${r.market}:${r.symbol}`}
                    value={`${r.market}:${r.symbol}`}
                    onSelect={() => go(`/instrument/${r.market}/${encodeURIComponent(r.symbol)}`)}
                    className="gap-3"
                  >
                    <SymbolAvatar symbol={r.symbol} market={r.market} className="size-7" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{r.symbol}</span>
                      <span className="truncate text-xs text-muted-foreground">{r.name}</span>
                    </div>
                    {r.type && <span className="text-xs text-muted-foreground">{r.type}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!debounced.trim() && (
              <CommandGroup heading="Ir a">
                {NAV.map(({ href, label, icon: Icon }) => (
                  <CommandItem key={href} value={label} onSelect={() => go(href)}>
                    <Icon className="size-4" /> {label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
