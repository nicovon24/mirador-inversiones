"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { SymbolAvatar } from "@/components/market/symbol-avatar";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebounced } from "@/hooks/use-debounced";
import { useSearch } from "@/hooks/use-market";
import type { SearchResult } from "@/lib/market/types";

/** Buscador compacto para elegir un instrumento (agregar a lista, cargar posición…). */
export function InstrumentPicker({
  onPick,
  label = "Agregar instrumento",
  trigger,
}: {
  onPick: (r: SearchResult) => void;
  label?: string;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 220);
  const { data, isFetching } = useSearch(debounced);
  const results = debounced.trim() ? (data?.results ?? []) : [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger ?? <Button size="sm" />}>
        {!trigger && (
          <>
            <Plus /> {label}
          </>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="GGAL, AAPL, AL30…" value={query} onValueChange={setQuery} autoFocus />
          <CommandList>
            {isFetching && results.length === 0 && (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Buscando…
              </div>
            )}
            {debounced.trim() && !isFetching && <CommandEmpty>Sin resultados.</CommandEmpty>}
            {!debounced.trim() && <p className="px-3 py-4 text-xs text-muted-foreground">Escribí un ticker o nombre.</p>}
            {results.length > 0 && (
              <CommandGroup>
                {results.map((r) => (
                  <CommandItem
                    key={`${r.market}:${r.symbol}`}
                    value={`${r.market}:${r.symbol}`}
                    onSelect={() => {
                      onPick(r);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="gap-3"
                  >
                    <SymbolAvatar symbol={r.symbol} market={r.market} className="size-7" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{r.symbol}</span>
                      <span className="truncate text-xs text-muted-foreground">{r.name}</span>
                    </span>
                    {r.type && <span className="text-[11px] text-muted-foreground">{r.type}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
