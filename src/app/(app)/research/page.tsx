import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ResearchPicker } from "@/components/research/research-picker";
import { ResearchView } from "@/components/research/research-view";
import { findCompany } from "@/lib/companies";
import { parseKey } from "@/lib/market/types";
import { getResearch } from "@/server/research";

export const metadata: Metadata = { title: "Investigación" };

const SUGGESTED = [
  { key: "AR:GGAL", label: "Galicia" },
  { key: "AR:YPFD", label: "YPF" },
  { key: "AR:PAMP", label: "Pampa Energía" },
  { key: "AR:VIST", label: "Vista" },
  { key: "AR:MELI", label: "MercadoLibre" },
  { key: "AR:AAPL", label: "Apple" },
  { key: "US:MSFT", label: "Microsoft" },
  { key: "AR:KO", label: "Coca-Cola" },
];

export default async function ResearchPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const parsed = s ? parseKey(decodeURIComponent(s)) : null;
  const result = parsed ? await getResearch(parsed.market, parsed.symbol) : null;
  const company = parsed?.market === "AR" ? findCompany(parsed.symbol) : undefined;
  const title = parsed ? `${company?.name ?? parsed.symbol} · ${parsed.symbol}` : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Investigación"
        description="Datos fundamentales de cada empresa: valuación, rentabilidad, crecimiento, deuda y dividendos, comparados con su rubro."
        actions={<ResearchPicker label={parsed ? "Otra empresa" : "Buscar empresa"} />}
      />

      <nav aria-label="Empresas sugeridas" className="flex flex-wrap gap-2">
        {SUGGESTED.map((x) => (
          <Link
            key={x.key}
            href={`/research?s=${x.key}`}
            aria-current={s === x.key ? "page" : undefined}
            className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:bg-primary/10 aria-[current=page]:font-medium aria-[current=page]:text-foreground"
          >
            {x.label}
          </Link>
        ))}
      </nav>

      {!parsed && (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          Elegí una empresa de la lista o buscala por nombre o ticker (por ejemplo “Galicia” o “AAPL”).
        </p>
      )}

      {parsed && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Link
            href={`/instrument/${parsed.market}/${encodeURIComponent(parsed.symbol)}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            Ver gráfico y cotización
          </Link>
        </div>
      )}

      {result && !result.ok && (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">{result.message}</p>
      )}
      {result?.ok && <ResearchView data={result.data} />}
    </div>
  );
}
