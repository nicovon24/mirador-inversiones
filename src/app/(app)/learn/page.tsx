import type { Metadata } from "next";
import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { GUIDES } from "@/lib/guides";

export const metadata: Metadata = { title: "Aprender" };

export default function LearnPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Aprender"
        description="Guías paso a paso para leer los datos y entender qué estás mirando."
        actions={
          <Link href="/glossary" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <BookOpen className="size-4" aria-hidden />
            Glosario
          </Link>
        }
      />
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {GUIDES.map((g) => (
          <li key={g.slug}>
            <Link
              href={`/learn/${g.slug}`}
              className="group flex h-full flex-col gap-3 rounded-xl border bg-card p-5 transition-colors hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <h2 className="font-semibold">{g.title}</h2>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{g.summary}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="num">
                  {g.steps.length} pasos · {g.minutes} min
                </span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
