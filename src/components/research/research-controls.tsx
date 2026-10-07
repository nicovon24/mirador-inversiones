"use client";

import { Loader2, RefreshCw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounced } from "@/hooks/use-debounced";
import { tableHref, type TableQuery } from "@/lib/research-table";
import { refreshResearchData } from "@/server/actions";

/** Buscador de la tabla: escribe en la URL para que el filtrado y la paginación sucedan en el servidor. */
export function ResearchSearch({ query }: { query: TableQuery }) {
  const router = useRouter();
  const [value, setValue] = useState(query.q);
  const debounced = useDebounced(value, 300);

  useEffect(() => {
    if (debounced.trim() !== query.q) router.replace(tableHref(query, { q: debounced.trim() }), { scroll: false });
  }, [debounced, query, router]);

  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Empresa o ticker (Galicia, AAPL…)"
        aria-label="Buscar empresa"
        className="pl-8"
      />
    </div>
  );
}

/** Filtro por rubro: un select nativo, accesible y liviano para listas largas. */
export function SectorFilter({ query, sectors }: { query: TableQuery; sectors: string[] }) {
  const router = useRouter();
  return (
    <select
      value={query.sector}
      onChange={(e) => router.push(tableHref(query, { sector: e.target.value }), { scroll: false })}
      aria-label="Filtrar por rubro"
      className="h-8 rounded-lg border bg-card px-2.5 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <option value="">Todos los rubros</option>
      {sectors.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

/** Baja lo que falta o venció (favoritos primero) y recarga la tabla. */
export function RefreshResearchButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await refreshResearchData();
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          const n = res.data?.updated ?? 0;
          toast.success(n === 0 ? "Todo está al día." : `Se actualizaron ${n} empresas.`);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {pending ? "Actualizando…" : "Actualizar datos"}
    </Button>
  );
}
