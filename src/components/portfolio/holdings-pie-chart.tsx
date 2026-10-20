"use client";

import { useState, type MouseEvent, type PointerEvent } from "react";
import { formatMoney, formatNumber } from "@/lib/format";

export interface HoldingSlice {
  key: string;
  label: string;
  value: number;
  pct: number;
}

const color = (index: number) =>
  index < 5 ? `var(--chart-${index + 1})` : `oklch(0.68 0.15 ${(index * 137 + 25) % 360})`;

function slicePath(start: number, end: number) {
  if (end - start >= Math.PI * 2 - 0.000001) {
    return "M 100 12 A 88 88 0 1 1 100 188 A 88 88 0 1 1 100 12 Z";
  }
  const point = (angle: number) => ({ x: 100 + 88 * Math.cos(angle), y: 100 + 88 * Math.sin(angle) });
  const from = point(start);
  const to = point(end);
  return `M 100 100 L ${from.x} ${from.y} A 88 88 0 ${end - start > Math.PI ? 1 : 0} 1 ${to.x} ${to.y} Z`;
}

export function HoldingsPieChart({ slices, currency }: { slices: HoldingSlice[]; currency: "ARS" | "USD" }) {
  const [active, setActive] = useState<{ key: string; x: number; y: number } | null>(null);
  if (slices.length === 0) return <p className="text-sm text-muted-foreground">Sin tenencias valuadas.</p>;

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const sectors = slices.reduce<Array<{ slice: HoldingSlice; start: number; end: number }>>((result, slice) => {
    const start = result.at(-1)?.end ?? -Math.PI / 2;
    return [...result, { slice, start, end: start + (slice.value / total) * Math.PI * 2 }];
  }, []);
  const activeIndex = slices.findIndex((slice) => slice.key === active?.key);
  const activeSlice = slices[activeIndex];

  const showAtPointer = (event: MouseEvent<SVGPathElement> | PointerEvent<SVGPathElement>, key: string) => {
    const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!bounds) return;
    setActive({
      key,
      x: Math.max(40, Math.min(bounds.width - 40, event.clientX - bounds.left)),
      y: event.clientY - bounds.top,
    });
  };

  return (
    <>
      <p className="text-xs text-muted-foreground">Por instrumento, según su valuación en {currency === "ARS" ? "pesos" : "dólares"}.</p>
      <div className="relative mx-auto size-48 max-w-full">
        <svg viewBox="0 0 200 200" className="size-full" role="group" aria-label="Gráfico de distribución por instrumento" onClick={() => setActive(null)}>
          {sectors.map(({ slice, start, end }, index) => (
            <path
              key={slice.key}
              d={slicePath(start, end)}
              fill={color(index)}
              stroke="var(--card)"
              strokeWidth="1"
              tabIndex={0}
              className="cursor-help focus-visible:outline-2 focus-visible:outline-primary"
              aria-label={`${slice.label}: ${formatNumber(slice.pct, 1)} %, ${formatMoney(slice.value, currency, 0)}`}
              onPointerEnter={(event) => showAtPointer(event, slice.key)}
              onPointerMove={(event) => showAtPointer(event, slice.key)}
              onPointerLeave={(event) => { if (event.pointerType !== "touch") setActive(null); }}
              onFocus={() => {
                const middle = (start + end) / 2;
                setActive({ key: slice.key, x: Math.max(40, Math.min(152, (100 + 60 * Math.cos(middle)) * 0.96)), y: (100 + 60 * Math.sin(middle)) * 0.96 });
              }}
              onBlur={() => setActive(null)}
              onKeyDown={(event) => { if (event.key === "Escape") setActive(null); }}
              onClick={(event) => { event.stopPropagation(); showAtPointer(event, slice.key); }}
            />
          ))}
        </svg>
        {active && activeSlice && (
          <div
            role="tooltip"
            className={`pointer-events-none absolute z-10 w-44 -translate-x-1/2 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md ${active.y < 96 ? "mt-2" : "-translate-y-full -mt-2"}`}
            style={{ left: active.x, top: active.y }}
          >
            <div className="flex items-center gap-2 font-medium">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: color(activeIndex) }} aria-hidden="true" />
              {activeSlice.label}
            </div>
            <div className="mt-1 flex justify-between gap-2">
              <span>{formatMoney(activeSlice.value, currency, 0)}</span>
              <span className="num font-medium">{formatNumber(activeSlice.pct, 1)} %</span>
            </div>
          </div>
        )}
      </div>
      <ul className="flex flex-col gap-2.5" aria-label="Distribución por instrumento">
        {slices.map((slice, index) => (
          <li key={slice.key} className="flex items-center gap-2.5 text-sm">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color(index) }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate" title={slice.label}>{slice.label}</span>
            <span className="num text-xs text-muted-foreground">{formatMoney(slice.value, currency, 0)}</span>
            <span className="num w-14 shrink-0 text-right font-medium">{formatNumber(slice.pct, 1)} %</span>
          </li>
        ))}
      </ul>
    </>
  );
}
