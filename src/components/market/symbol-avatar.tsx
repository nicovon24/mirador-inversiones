import { cn } from "@/lib/utils";

/**
 * Monograma del ticker. Sin logos de terceros: evita depender de CDNs de
 * marcas y mantiene la regla de un solo color de acento.
 */
export function SymbolAvatar({
  symbol,
  market,
  className,
}: {
  symbol: string;
  market?: "AR" | "US";
  className?: string;
}) {
  const label = symbol.replace(/^\^/, "").slice(0, symbol.length > 4 ? 2 : 3);
  return (
    <span
      className={cn(
        "relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/60 text-[10px] font-semibold tracking-tight text-foreground/80",
        className,
      )}
      aria-hidden
    >
      {label}
      {market && (
        <span className="absolute -right-1 -bottom-1 rounded-[4px] border bg-card px-0.5 text-[8px] leading-3 font-semibold text-muted-foreground">
          {market}
        </span>
      )}
    </span>
  );
}
