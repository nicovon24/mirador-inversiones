"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InstrumentPicker } from "@/components/watchlist/instrument-picker";

/** Elige qué empresa investigar; el resultado vive en la URL para poder compartirlo y volver atrás. */
export function ResearchPicker({ label = "Buscar empresa" }: { label?: string }) {
  const router = useRouter();
  return (
    <InstrumentPicker
      onPick={(r) => router.push(`/research?s=${r.market}:${encodeURIComponent(r.symbol)}`)}
      trigger={
        <Button size="sm">
          <Search /> {label}
        </Button>
      }
    />
  );
}
