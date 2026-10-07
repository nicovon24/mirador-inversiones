import { findBond } from "@/lib/bonds";
import { CEDEAR_RATIOS } from "@/lib/cedears";

/** Ficha "qué es" en lenguaje simple (RF-46). */
export interface InstrumentInfo {
  kind: string;
  what: string;
  issuer: string;
  currency: string;
  drivers: string;
  risks: string;
  /** Guía de Aprender relacionada. */
  guide?: { slug: string; label: string };
}

export function instrumentInfo(market: "AR" | "US", symbol: string): InstrumentInfo {
  if (symbol.startsWith("^"))
    return {
      kind: "Índice",
      what: "Resume cómo se mueve un grupo de acciones. No se compra directamente: se sigue para entender el mercado o se replica con un fondo.",
      issuer: "Lo calcula un proveedor de índices; no lo emite una empresa.",
      currency: "Puntos, no una moneda.",
      drivers: "El precio de las acciones que lo componen, ponderadas por su tamaño.",
      risks: "Al ser un promedio puede esconder caídas fuertes de empresas individuales.",
    };

  if (market === "US")
    return {
      kind: "Acción de EE.UU.",
      what: "Una parte del capital de una empresa que cotiza en NYSE o NASDAQ.",
      issuer: "La propia empresa.",
      currency: "Dólares.",
      drivers: "Las ganancias presentes y esperadas de la empresa, las tasas de interés y el ánimo general del mercado.",
      risks: "Puede perder valor sin límite inferior distinto de cero. No garantiza dividendos ni rendimiento.",
      guide: { slug: "acciones-y-cedears", label: "Cómo analizar una acción o un CEDEAR" },
    };

  const bond = findBond(symbol);
  if (bond)
    return {
      kind: "Bono soberano en dólares",
      what: `${bond.name}: un préstamo al Estado argentino que paga intereses cada seis meses y devuelve el capital según un cronograma.`,
      issuer: `${bond.issuer}, bajo ley ${bond.law === "Argentina" ? "argentina" : "de Nueva York"}.`,
      currency:
        "Paga en dólares. En pesos cotiza al valor del dólar implícito; terminado en D es dólar MEP y en C, dólar cable.",
      drivers:
        "La confianza en que el Estado va a pagar (riesgo país), las tasas internacionales y el plazo que falta. Si el precio baja, la TIR sube.",
      risks:
        "Riesgo de incumplimiento o reestructuración, y de que el precio caiga si suben las tasas o empeora la confianza. Los de ley local suelen tener menos protección que los de ley Nueva York.",
      guide: { slug: "bonos", label: "Cómo analizar un bono" },
    };

  if (/^(AL|GD|AE|TX|TZX|S\d|X\d|T\d|AN|BA)/.test(symbol))
    return {
      kind: "Bono o letra",
      what: "Un título de deuda: prestás plata a un emisor que promete devolverla con intereses.",
      issuer: "El Estado nacional, una provincia o una empresa, según el título.",
      currency: "Depende del título: pesos, dólares o ajustado por inflación.",
      drivers: "La confianza en el emisor, las tasas de interés y el plazo que falta para el vencimiento.",
      risks: "Que el emisor no pague o reestructure, y que el precio caiga si suben las tasas.",
      guide: { slug: "bonos", label: "Cómo analizar un bono" },
    };

  const cedear = CEDEAR_RATIOS[symbol];
  if (cedear)
    return {
      kind: "CEDEAR",
      what: `Certificado que representa una fracción de ${cedear.name} y cotiza en pesos en BYMA.`,
      issuer: `Un banco depositario local; la acción original es de ${cedear.name}.`,
      currency: "Pesos en BYMA. Terminado en D, dólar MEP; terminado en C, dólar cable.",
      drivers:
        "El precio de la acción en EE.UU. y el dólar implícito (CCL). Puede subir en pesos solo porque sube el dólar.",
      risks:
        "Riesgo de la empresa, riesgo cambiario y la brecha del dólar implícito: podés pagar un CEDEAR más caro que su acción.",
      guide: { slug: "acciones-y-cedears", label: "Cómo analizar una acción o un CEDEAR" },
    };

  return {
    kind: "Acción o CEDEAR (BYMA)",
    what: "Si es una empresa argentina, una parte de su capital; si es un CEDEAR, un certificado que replica una acción del exterior.",
    issuer: "La empresa, o un banco depositario si es CEDEAR.",
    currency: "Pesos en BYMA. Terminado en D, dólar MEP; terminado en C, dólar cable.",
    drivers: "Las ganancias de la empresa, el dólar, la inflación y el contexto del país.",
    risks: "Puede perder valor y tiene más volatilidad cuando el contexto económico cambia rápido.",
    guide: { slug: "acciones-y-cedears", label: "Cómo analizar una acción o un CEDEAR" },
  };
}
