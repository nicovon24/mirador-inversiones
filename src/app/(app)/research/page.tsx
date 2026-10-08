import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { RefreshResearchButton, ResearchSearch, SectorFilter } from "@/components/research/research-controls";
import { ResearchPicker } from "@/components/research/research-picker";
import { oldestFetch, ResearchTable } from "@/components/research/research-table";
import { ResearchView } from "@/components/research/research-view";
import { LiveQuotesProvider } from "@/components/research/live-quotes";
import { RangePicker } from "@/components/market/range-picker";
import { findCompany } from "@/lib/companies";
import { hasFinnhub } from "@/lib/env";
import { parseKey } from "@/lib/market/types";
import { parseTableQuery, tableHref, TYPE_FILTERS } from "@/lib/research-table";
import { getResearch } from "@/server/research";
import { getResearchTable } from "@/server/research-table";

export const metadata: Metadata = { title: "Investigación" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Detail({ s }: { s: string }) {
  const parsed = parseKey(decodeURIComponent(s));
  if (!parsed) return <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Instrumento inválido.</p>;
  const result = await getResearch(parsed.market, parsed.symbol);
  const company = parsed.market === "AR" ? findCompany(parsed.symbol) : undefined;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {company?.name ?? parsed.symbol} · {parsed.symbol}
        </h2>
        <Link
          href={`/instrument/${parsed.market}/${encodeURIComponent(parsed.symbol)}`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Ver gráfico y cotización
        </Link>
      </div>
      {result.ok ? (
        <ResearchView data={result.data} />
      ) : (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">{result.message}</p>
      )}
    </div>
  );
}

export default async function ResearchPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const s = typeof sp.s === "string" ? sp.s : undefined;

  if (s) {
    return (
      <div className="flex flex-col gap-6">
        <Link href="/research" className="text-sm text-muted-foreground hover:text-foreground">
          ← Volver a la tabla
        </Link>
        <Detail s={s} />
      </div>
    );
  }

  const query = parseTableQuery(sp);
  const table = await getResearchTable(query);
  const since = oldestFetch([...table.favorites, ...table.rows]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Investigación"
        description="Compará datos fundamentales de todas las empresas a la vez: valuación, rentabilidad, crecimiento, deuda y dividendos."
        actions={
          <>
            {hasFinnhub && <RefreshResearchButton />}
            <ResearchPicker label="Buscar cualquier empresa" />
          </>
        }
      />

      {!hasFinnhub && (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          Falta configurar FINNHUB_API_KEY: se muestran solo los datos ya guardados.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Precio actual, evolución y variación de cada empresa en el período elegido.
        </p>
        <RangePicker value={query.rango} hrefFor={(r) => tableHref(query, { rango: r })} label="Período de los gráficos" />
      </div>

      <LiveQuotesProvider keys={[...table.favorites, ...table.rows].map((r) => r.key)}>
        <section className="rounded-xl border bg-card">
          <div className="flex flex-wrap items-baseline justify-between gap-2 p-4 pb-3">
            <h2 className="font-medium">Tus favoritos</h2>
            <p className="text-xs text-muted-foreground">Empresas de tus listas con datos disponibles</p>
          </div>
          {table.favorites.length > 0 ? (
            <ResearchTable rows={table.favorites} query={query} caption="Datos fundamentales de tus favoritos" favorites />
          ) : (
            <p className="px-4 pb-4 text-sm text-muted-foreground">
              Todavía no tenés favoritos con datos fundamentales. Marcá empresas con la estrella en Mercados o en su ficha.
            </p>
          )}
        </section>

        <section className="rounded-xl border bg-card">
          <div className="flex flex-wrap items-center gap-3 border-b p-4">
            <h2 className="mr-auto font-medium">Todas las empresas</h2>
            <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-0.5" role="group" aria-label="Tipo">
              {TYPE_FILTERS.map((t) => (
                <Link
                  key={t.id}
                  href={tableHref(query, { tipo: t.id })}
                  scroll={false}
                  aria-current={query.tipo === t.id ? "page" : undefined}
                  className="h-7 rounded-md px-2.5 text-xs leading-7 font-medium text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-sm"
                >
                  {t.label}
                </Link>
              ))}
            </div>
            <SectorFilter query={query} sectors={table.sectors} />
            <ResearchSearch query={query} />
          </div>

          {table.rows.length > 0 ? (
            <ResearchTable rows={table.rows} query={query} caption="Datos fundamentales de todas las empresas" />
          ) : (
            <p className="p-6 text-sm text-muted-foreground">
              No hay empresas que coincidan con el filtro.{" "}
              <Link href="/research" className="font-medium text-primary hover:underline">
                Ver todas
              </Link>
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground">
            <span className="num">
              {table.total} empresas · página {table.page} de {table.pages}
              {since ? ` · datos desde el ${since}` : ""}
            </span>
            <nav aria-label="Paginación" className="flex gap-2">
              {table.page > 1 && (
                <Link
                  href={tableHref(query, { pag: table.page - 1 })}
                  scroll={false}
                  className="rounded-md border px-2.5 py-1 font-medium hover:text-foreground"
                >
                  ← Anterior
                </Link>
              )}
              {table.page < table.pages && (
                <Link
                  href={tableHref(query, { pag: table.page + 1 })}
                  scroll={false}
                  className="rounded-md border px-2.5 py-1 font-medium hover:text-foreground"
                >
                  Siguiente →
                </Link>
              )}
            </nav>
          </div>
        </section>
      </LiveQuotesProvider>

      {table.pending > 0 && (
        <p className="text-xs text-muted-foreground">
          {table.pending} empresas todavía no tienen datos: se bajan de a poco para no pasar el límite de Finnhub. Recargá en unos
          segundos o tocá “Actualizar datos”.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Fuente: Finnhub (ADR en Nueva York para empresas argentinas, acción original para CEDEARs). En empresas argentinas los
        balances en pesos están afectados por la inflación. No es una recomendación de compra o venta.
      </p>
    </div>
  );
}
