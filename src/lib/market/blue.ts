import "server-only";
import { z } from "zod";
import { cached } from "./cache";

const blueSchema = z.object({
  venta: z.number().positive(),
  fechaActualizacion: z.string().nullish(),
});

/** Cotización de venta: pesos necesarios para obtener un dólar blue. */
export function getBlueRate(): Promise<{ rate: number; updatedAt: string | null }> {
  return cached("fx:blue", 60_000, async () => {
    const response = await fetch("https://dolarapi.com/v1/dolares/blue", {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`DolarApi blue → ${response.status}`);
    const data = blueSchema.parse(await response.json());
    return { rate: data.venta, updatedAt: data.fechaActualizacion ?? null };
  });
}
