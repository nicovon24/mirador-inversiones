import Link from "next/link";
import { PERIOD_LABEL, PERIOD_RANGES, type PeriodRange } from "@/lib/series";
import { cn } from "@/lib/utils";

const chip =
  "h-7 min-w-9 rounded-md px-2 text-xs leading-7 font-medium text-center transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
const on = "bg-card text-primary shadow-sm";
const off = "text-muted-foreground hover:text-foreground";

/**
 * Selector de período (1S · 1M · 3M · 6M · 1A · Todo).
 * Con `hrefFor` genera links (el rango vive en la URL, sirve en componentes de servidor);
 * con `onChange` genera botones (para usar dentro de un componente cliente).
 */
export function RangePicker({
  value,
  hrefFor,
  onChange,
  label = "Período",
}: {
  value: PeriodRange;
  hrefFor?: (r: PeriodRange) => string;
  onChange?: (r: PeriodRange) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5" role="group" aria-label={label}>
      {PERIOD_RANGES.map((r) =>
        hrefFor ? (
          <Link key={r} href={hrefFor(r)} scroll={false} aria-current={value === r ? "true" : undefined} className={cn(chip, value === r ? on : off)}>
            {PERIOD_LABEL[r]}
          </Link>
        ) : (
          <button
            key={r}
            type="button"
            onClick={() => onChange?.(r)}
            aria-pressed={value === r}
            className={cn(chip, "cursor-pointer", value === r ? on : off)}
          >
            {PERIOD_LABEL[r]}
          </button>
        ),
      )}
    </div>
  );
}
