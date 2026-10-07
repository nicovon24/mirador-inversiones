"use client";

import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface SourceStatus {
  label: string;
  live: boolean;
  detail: string;
}

/** Pie con fuentes activas y hora de la última actualización recibida. */
export function StatusFooter({ sources }: { sources: SourceStatus[] }) {
  const client = useQueryClient();
  const fetching = useIsFetching();
  const [last, setLast] = useState<number | null>(null);

  useEffect(() => {
    return client.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") setLast(Date.now());
    });
  }, [client]);

  return (
    <footer className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-4 py-3 text-xs text-muted-foreground md:px-6">
      {sources.map((s) => (
        <span key={s.label} className="flex items-center gap-1.5" title={s.detail}>
          <span className={cn("size-1.5 rounded-full", s.live ? "bg-up" : "bg-chart-3")} aria-hidden />
          {s.label}
          <span className="text-muted-foreground/70">· {s.detail}</span>
        </span>
      ))}
      <span className="num ml-auto flex items-center gap-1.5" aria-live="polite">
        {fetching > 0 && <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />}
        {last ? `Actualizado ${formatTime(last)}` : "Conectando…"}
      </span>
    </footer>
  );
}
