import { ArrowDown, ArrowUp, ArrowUpDown, Star } from "lucide-react";
import Link from "next/link";
import { HelpTip } from "@/components/help/help-tip";
import { ChangePill } from "@/components/market/change";
import { Sparkline } from "@/components/market/sparkline";
import { SymbolAvatar } from "@/components/market/symbol-avatar";
import { LivePrice } from "@/components/research/live-quotes";
import { formatDate } from "@/lib/format";
import { formatMetric } from "@/lib/research-format";
import { PERIOD_CHANGE, TABLE_COLUMNS, tableHref, type ResearchRow, type TableQuery } from "@/lib/research-table";
import { PERIOD_LABEL } from "@/lib/series";
import { cn } from "@/lib/utils";

function SortLink({ query, col, label, align = "right" }: { query: TableQuery; col: string; label: string; align?: "left" | "right" }) {
  const active = query.orden === col;
  const Icon = !active ? ArrowUpDown : query.dir === "asc" ? ArrowUp : ArrowDown;
  const nextDir = active ? (query.dir === "asc" ? "desc" : "asc") : undefined;
  return (
    <Link
      href={tableHref(query, { orden: col, ...(nextDir ? { dir: nextDir } : {}) })}
      scroll={false}
      className={cn(
        "inline-flex items-center gap-1 rounded transition-colors hover:text-foreground",
        align === "right" && "justify-end",
        active && "text-foreground",
      )}
    >
      {label}
      <Icon className={cn("size-3", !active && "opacity-50")} aria-hidden />
    </Link>
  );
}

function StatusCell({ row }: { row: ResearchRow }) {
  if (row.status === "pending") return <span className="text-[11px] text-muted-foreground">Cargando datos…</span>;
  if (row.status === "empty") return <span className="text-[11px] text-muted-foreground">Sin datos del proveedor</span>;
  if (row.status === "error") return <span className="text-[11px] text-muted-foreground">No se pudo bajar; se reintenta</span>;
  return null;
}

export function ResearchTable({
  rows,
  query,
  caption,
  favorites = false,
}: {
  rows: ResearchRow[];
  query: TableQuery;
  caption: string;
  favorites?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1240px] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-muted/40 px-4 py-2.5 font-medium backdrop-blur" aria-sort={query.orden === "name" ? (query.dir === "asc" ? "ascending" : "descending") : "none"}>
              <SortLink query={query} col="name" label="Empresa" align="left" />
            </th>
            {/* Precio en vivo: no se ordena porque mezcla pesos y dólares. */}
            <th scope="col" className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
              Precio
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium whitespace-nowrap">
              Tendencia {PERIOD_LABEL[query.rango]}
            </th>
            <th
              scope="col"
              className="border-r px-3 py-2.5 text-right font-medium whitespace-nowrap"
              aria-sort={query.orden === PERIOD_CHANGE ? (query.dir === "asc" ? "ascending" : "descending") : "none"}
            >
              <SortLink query={query} col={PERIOD_CHANGE} label={`Var. ${PERIOD_LABEL[query.rango]}`} />
            </th>
            {TABLE_COLUMNS.map((c) => (
              <th
                key={c.key}
                scope="col"
                className="px-3 py-2.5 text-right font-medium whitespace-nowrap"
                aria-sort={query.orden === c.key ? (query.dir === "asc" ? "ascending" : "descending") : "none"}
              >
                <span className="inline-flex items-center gap-1">
                  <SortLink query={query} col={c.key} label={c.short} />
                  {c.help && <HelpTip id={c.help} />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => {
            const ok = r.status === "ok";
            return (
              <tr key={r.key} className="group transition-colors hover:bg-muted/40">
                <td className="sticky left-0 z-10 bg-card px-4 py-2 group-hover:bg-muted/40">
                  <Link href={`/research?s=${encodeURIComponent(r.key)}`} className="flex items-center gap-3 hover:text-primary">
                    <SymbolAvatar symbol={r.symbol} className="size-7" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-medium">
                        {r.symbol}
                        {favorites && <Star className="size-3 fill-amber-400 text-amber-400" aria-label="Favorito" />}
                        <span className="rounded bg-muted px-1.5 text-[10px] font-normal text-muted-foreground">{r.type}</span>
                      </span>
                      <span className="block max-w-56 truncate text-xs text-muted-foreground">
                        {r.name}
                        {r.sector ? ` · ${r.sector}` : ""}
                      </span>
                      <StatusCell row={r} />
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <LivePrice k={r.key} />
                </td>
                <td className="px-3 py-2">
                  {r.spark.length >= 2 ? (
                    <Sparkline values={r.spark} width={88} height={26} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className={cn("border-r px-3 py-2 text-right", query.orden === PERIOD_CHANGE && "font-medium")}>
                  {r.periodChangePct !== null ? <ChangePill pct={r.periodChangePct} /> : <span className="text-muted-foreground">—</span>}
                </td>
                {TABLE_COLUMNS.map((c) => (
                  <td key={c.key} className={cn("num px-3 py-2 text-right", query.orden === c.key && "font-medium")}>
                    {ok ? formatMetric(r.metrics[c.key] ?? null, c) : "—"}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Fecha del dato más viejo de la vista, para que se sepa cuán actuales son los números. */
export function oldestFetch(rows: ResearchRow[]): string | null {
  const dates = rows.map((r) => r.fetchedAt).filter((d): d is string => Boolean(d)).sort();
  return dates[0] ? formatDate(dates[0]) : null;
}
