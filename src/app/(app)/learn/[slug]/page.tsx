import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HelpTip } from "@/components/help/help-tip";
import { PageHeader } from "@/components/page-header";
import { glossaryEntry } from "@/lib/glossary";
import { getGuide } from "@/lib/guides";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const guide = getGuide((await params).slug);
  return { title: guide?.title ?? "Aprender" };
}

export default async function GuidePage({ params }: { params: Promise<Params> }) {
  const guide = getGuide((await params).slug);
  if (!guide) notFound();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/learn" className="text-sm text-muted-foreground hover:text-foreground">
        ← Todas las guías
      </Link>
      <PageHeader title={guide.title} description={guide.summary} />

      <ol className="flex flex-col gap-4">
        {guide.steps.map((s, i) => (
          <li key={s.title} className="flex gap-4 rounded-xl border bg-card p-5">
            <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-2.5">
              <h2 className="font-semibold">{s.title}</h2>
              <p className="text-sm leading-relaxed text-foreground/85">{s.body}</p>
              {s.look && (
                <p className="rounded-lg bg-muted/60 px-3 py-2 text-[13px]">
                  <span className="font-medium">Qué mirar: </span>
                  {s.look}
                </p>
              )}
              {s.terms && (
                <ul className="flex flex-wrap gap-2">
                  {s.terms.map((id) => {
                    const e = glossaryEntry(id);
                    if (!e) return null;
                    return (
                      <li key={id} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs">
                        {e.term}
                        <HelpTip id={id} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>

      <p className="text-xs text-muted-foreground">{guide.caveat}</p>
    </div>
  );
}
