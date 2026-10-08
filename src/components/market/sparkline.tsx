"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const subscribeNoop = () => () => {};

/**
 * Mini gráfico SVG (sin librería): barato de renderizar en tablas y tarjetas.
 * Con `times`, al pasar el mouse muestra la fecha y el precio del punto más cercano y la variación
 * desde el inicio del período. El tooltip va en un portal para que no lo recorte el scroll de la tabla.
 */
export function Sparkline({
  values,
  times,
  className,
  width = 96,
  height = 32,
  formatValue = (v: number) => formatNumber(v),
}: {
  values: number[];
  /** Fecha (unix, segundos) de cada punto. Sin fechas, el gráfico no es interactivo. */
  times?: number[];
  className?: string;
  width?: number;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const id = useId();
  const [hover, setHover] = useState<{ i: number; rect: DOMRect } | null>(null);
  // El portal solo existe en el navegador.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  if (values.length < 2) {
    return <div className={cn("animate-pulse rounded bg-muted/60", className)} style={{ width, height }} />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const first = values[0];
  const last = values[values.length - 1];
  const up = last >= first;
  const interactive = Boolean(times && times.length === values.length);
  const summary = `${up ? "Subió" : "Bajó"} ${formatPercent(((last - first) / first) * 100).replace(/^[+−]/, "")} en el período`;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover({ i: Math.round(ratio * (values.length - 1)), rect });
  }

  const h = hover && interactive ? hover : null;
  const point = h ? pts[h.i] : null;

  return (
    <>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className={cn(up ? "text-up" : "text-down", interactive && "cursor-crosshair touch-none", className)}
        role="img"
        aria-label={summary}
        onPointerMove={interactive ? onMove : undefined}
        onPointerDown={interactive ? onMove : undefined}
        onPointerLeave={interactive ? () => setHover(null) : undefined}
      >
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {point && (
          <>
            <line x1={point[0]} x2={point[0]} y1={0} y2={height} stroke="currentColor" strokeOpacity={0.35} strokeWidth={1} />
            <circle cx={point[0]} cy={point[1]} r={2.5} fill="currentColor" stroke="var(--card)" strokeWidth={1} />
          </>
        )}
      </svg>
      {h &&
        point &&
        mounted &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md bg-foreground px-2.5 py-1.5 text-[11px] leading-tight whitespace-nowrap text-background shadow-md"
            style={{
              left: h.rect.left + (point[0] / width) * h.rect.width,
              top: h.rect.top - 6,
            }}
          >
            <span className="block opacity-75">{formatDate(times![h.i] * 1000)}</span>
            <span className="num block font-semibold">{formatValue(values[h.i])}</span>
            <span className="num block opacity-75">{formatPercent(((values[h.i] - first) / first) * 100)} desde el inicio</span>
          </div>,
          document.body,
        )}
    </>
  );
}
