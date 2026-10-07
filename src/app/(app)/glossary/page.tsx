import type { Metadata } from "next";
import { GlossaryList } from "@/components/help/glossary-list";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Glosario" };

export default function GlossaryPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Glosario"
        description="Los términos del mercado explicados en lenguaje simple: qué son, cómo se leen y por qué importan."
      />
      <GlossaryList />
    </div>
  );
}
