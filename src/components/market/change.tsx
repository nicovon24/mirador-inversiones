import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent, formatSigned, trend } from "@/lib/format";

/** Variación con flecha + signo + color: el color nunca es el único indicador. */
export function Change({
  change,
  pct,
  showAbs = true,
  className,
  decimals = 2,
}: {
  change?: number | null;
  pct: number | null | undefined;
  showAbs?: boolean;
  className?: string;
  decimals?: number;
}) {
  const t = trend(pct);
  const Icon = t === "up" ? ArrowUpRight : t === "down" ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "num inline-flex items-center gap-0.5 text-xs font-medium whitespace-nowrap",
        t === "up" && "text-up",
        t === "down" && "text-down",
        t === "flat" && "text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {showAbs && change != null && <span>{formatSigned(change, decimals)}</span>}
      <span>{showAbs && change != null ? `(${formatPercent(pct)})` : formatPercent(pct)}</span>
    </span>
  );
}

/** Píldora compacta para tablas. */
export function ChangePill({ pct, className }: { pct: number | null | undefined; className?: string }) {
  const t = trend(pct);
  return (
    <span
      className={cn(
        "num inline-flex min-w-[4.5rem] justify-end rounded-md px-1.5 py-0.5 text-xs font-medium",
        t === "up" && "bg-up-soft text-up",
        t === "down" && "bg-down-soft text-down",
        t === "flat" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      {formatPercent(pct)}
    </span>
  );
}
