import type { Metadata } from "next";
import { GlossaryList } from "@/components/help/glossary-list";
import { LearnTabs } from "@/components/help/learn-tabs";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Glosario" };

export default function GlossaryPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Aprender"
        description="Guías paso a paso para leer los datos y un glosario con cada término en lenguaje simple."
      />
      <LearnTabs active="glossary" />
      <GlossaryList />
    </div>
  );
}
