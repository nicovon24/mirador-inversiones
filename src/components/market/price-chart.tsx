"use client";

import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  HistogramSeries,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { formatNumber } from "@/lib/format";
import type { Candle, Range } from "@/lib/market/types";

export type ChartMode = "line" | "candles";

/** lightweight-charts dibuja en canvas: convertimos los tokens oklch a rgb. */
function cssColor(variable: string, alpha = 1): string {
  const probe = document.createElement("canvas").getContext("2d");
  const raw = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  if (!probe || !raw) return `rgba(127,127,127,${alpha})`;
  probe.fillStyle = raw;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return `rgba(${r},${g},${b},${alpha})`;
}

const intraday = (range: Range) => range === "1D" || range === "1W";

export function PriceChart({
  candles,
  mode,
  range,
  height = 340,
  decimals = 2,
}: {
  candles: Candle[];
  mode: ChartMode;
  range: Range;
  height?: number;
  decimals?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    const text = cssColor("--muted-foreground");
    const grid = cssColor("--border", 0.6);
    const accent = cssColor("--primary");
    const up = cssColor("--up");
    const down = cssColor("--down");

    const chart = createChart(el, {
      height,
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: text,
        fontFamily: getComputedStyle(document.body).fontFamily,
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: grid, style: 2 } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.18 } },
      timeScale: {
        borderVisible: false,
        timeVisible: intraday(range),
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: cssColor("--primary", 0.4), labelBackgroundColor: accent },
        horzLine: { color: cssColor("--primary", 0.4), labelBackgroundColor: accent },
      },
      localization: {
        locale: "es-AR",
        priceFormatter: (p: number) => formatNumber(p, decimals),
      },
      handleScale: { axisPressedMouseMove: false },
    });
    chartRef.current = chart;

    const data = candles.map((c) => ({ ...c, time: c.time as UTCTimestamp }));

    if (mode === "line") {
      const series = chart.addSeries(AreaSeries, {
        lineColor: accent,
        lineWidth: 2,
        topColor: cssColor("--primary", 0.22),
        bottomColor: cssColor("--primary", 0.01),
        priceLineColor: accent,
        lastValueVisible: true,
        crosshairMarkerBackgroundColor: accent,
      });
      series.setData(data.map((c) => ({ time: c.time, value: c.close })));
    } else {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: up,
        downColor: down,
        borderUpColor: up,
        borderDownColor: down,
        wickUpColor: up,
        wickDownColor: down,
      });
      series.setData(data);
    }

    if (data.some((c) => c.volume)) {
      const volume = chart.addSeries(HistogramSeries, {
        priceScaleId: "volume",
        priceFormat: { type: "volume" },
        lastValueVisible: false,
        priceLineVisible: false,
      });
      chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.88, bottom: 0 } });
      volume.setData(
        data.map((c, i) => ({
          time: c.time,
          value: c.volume ?? 0,
          color: c.close >= (data[i - 1]?.close ?? c.open) ? cssColor("--up", 0.16) : cssColor("--down", 0.16),
        })),
      );
    }

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, mode, range, height, decimals, resolvedTheme]);

  return <div ref={container} style={{ height }} className="w-full" role="img" aria-label="Gráfico de precio" />;
}
