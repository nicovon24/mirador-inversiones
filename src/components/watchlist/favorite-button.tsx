"use client";

import { Star } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { addToWatchlist, removeFromWatchlist } from "@/server/actions";

/** Estrella para marcar/desmarcar favorito (lista principal) desde cualquier tabla o ficha. */
export function FavoriteButton({
  instrumentKey,
  name,
  active,
  className,
}: {
  instrumentKey: string;
  name?: string | null;
  active: boolean;
  className?: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(active);
  const [, start] = useTransition();
  const symbol = instrumentKey.split(":")[1];

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      setOptimistic(!optimistic);
      const res = optimistic
        ? await removeFromWatchlist({ key: instrumentKey })
        : await addToWatchlist({ key: instrumentKey, name });
      if (!res.ok) toast.error(res.error);
      else toast.success(optimistic ? `${symbol} quitado de tus listas` : `${symbol} agregado a tu lista`);
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={optimistic}
      aria-label={optimistic ? `Quitar ${symbol} de favoritos` : `Agregar ${symbol} a favoritos`}
      className={cn(
        "inline-flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        optimistic ? "text-primary" : "text-muted-foreground/60 hover:text-foreground",
        className,
      )}
    >
      <Star className={cn("size-4", optimistic && "fill-current")} />
    </button>
  );
}
