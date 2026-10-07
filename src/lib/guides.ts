/** Guías paso a paso de la sección Aprender (RF-53). */

export interface GuideStep {
  title: string;
  body: string;
  /** Ids del glosario que se muestran como ayuda en este paso. */
  terms?: string[];
  /** Qué mirar en la ficha del instrumento. */
  look?: string;
}

export interface Guide {
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  steps: GuideStep[];
  caveat: string;
}

const CAVEAT =
  "Esta guía explica cómo leer los datos. No es una recomendación de compra o venta: la decisión es tuya.";

export const GUIDES: Guide[] = [
  {
    slug: "acciones-y-cedears",
    title: "Cómo analizar una acción o un CEDEAR",
    summary: "Cinco pasos para entender qué estás comprando y si el precio tiene sentido.",
    minutes: 6,
    caveat: CAVEAT,
    steps: [
      {
        title: "Entendé qué es y qué hace la empresa",
        body: "Antes de mirar números, respondé en una frase: ¿de qué vive esta empresa? Si no podés explicarlo, todavía no sabés qué riesgo asumís.",
        terms: ["accion", "cedear"],
        look: "Leé la ficha “qué es” del instrumento en su página.",
      },
      {
        title: "Si es CEDEAR, revisá el ratio y el dólar implícito",
        body: "El CEDEAR copia a una acción de EE.UU. Su precio en pesos depende de esa acción, del ratio y del dólar. Comparar el dólar implícito con el CCL de referencia muestra si cotiza caro o barato.",
        terms: ["ratio", "ccl", "brecha"],
        look: "Fijate en la brecha contra el CCL de referencia.",
      },
      {
        title: "Mirá el tamaño y la liquidez",
        body: "La capitalización dice qué tan grande es la empresa. El volumen dice qué tan fácil es comprar y vender sin mover el precio.",
        terms: ["market-cap", "volumen"],
        look: "Compará el volumen de hoy con el habitual.",
      },
      {
        title: "Evaluá si el precio es razonable",
        body: "El PER compara el precio con lo que la empresa gana. No hay un número bueno en abstracto: compará con el PER histórico de la misma empresa y con empresas del mismo rubro.",
        terms: ["per", "eps", "dividend-yield"],
        look: "Revisá el PER, la ganancia por acción y el dividendo.",
      },
      {
        title: "Medí cuánto se mueve",
        body: "El beta y el rango de 52 semanas muestran cuánto sube y baja. Preguntate si aguantarías una caída así sin vender por miedo.",
        terms: ["beta", "maximo-minimo"],
        look: "Ubicá el precio actual entre el mínimo y el máximo de 52 semanas.",
      },
    ],
  },
  {
    slug: "bonos",
    title: "Cómo analizar un bono",
    summary: "Qué mirar para saber cuánto rinde un bono, cuándo paga y qué riesgos tiene.",
    minutes: 7,
    caveat: CAVEAT,
    steps: [
      {
        title: "Identificá emisor, moneda y ley",
        body: "Quién emite (el Estado o una empresa), en qué moneda paga y bajo qué ley. Los tres definen el riesgo antes de mirar cualquier número.",
        terms: ["bono", "on", "ley"],
        look: "Leé la ficha “qué es” y los datos de emisión.",
      },
      {
        title: "Mirá el rendimiento: la TIR",
        body: "La TIR es lo que ganás por año si mantenés el bono hasta el final y el emisor paga todo. Si el precio cae, la TIR sube: un rendimiento muy alto casi siempre refleja más riesgo.",
        terms: ["tir"],
        look: "Compará la TIR con la de otros bonos de plazo parecido.",
      },
      {
        title: "Revisá la paridad",
        body: "La paridad compara el precio con el valor técnico. Una paridad baja dice que el mercado descuenta riesgo o exige más rendimiento.",
        terms: ["paridad", "valor-tecnico"],
        look: "Mirá la paridad en la ficha del bono.",
      },
      {
        title: "Medí la sensibilidad a la tasa",
        body: "La duration indica cuánto cae el precio si suben las tasas. A mayor duration, más se mueve el precio.",
        terms: ["duration"],
        look: "Un bono con duration alta es más volátil.",
      },
      {
        title: "Chequeá los pagos futuros",
        body: "Los cupones y las amortizaciones definen cuándo cobrás. Un bono que amortiza antes devuelve capital más rápido.",
        terms: ["cupon", "amortizacion"],
        look: "Revisá el cronograma de pagos.",
      },
    ],
  },
  {
    slug: "velas",
    title: "Cómo leer un gráfico de velas",
    summary: "Qué cuenta cada vela y cómo usar medias móviles y volumen sin marearte.",
    minutes: 4,
    caveat: CAVEAT,
    steps: [
      {
        title: "Entendé una vela",
        body: "Cada vela resume un período. El cuerpo va de la apertura al cierre y las mechas llegan al máximo y al mínimo. Verde es que cerró más arriba de donde abrió; rojo, más abajo.",
        terms: ["velas", "apertura-cierre", "maximo-minimo"],
        look: "Cambiá el gráfico a velas con el selector.",
      },
      {
        title: "Elegí el rango adecuado",
        body: "Un rango corto muestra el ruido del día; uno largo, la tendencia. Mirá varios rangos antes de sacar conclusiones.",
        look: "Alterná entre 1M, 6M y 1A.",
      },
      {
        title: "Sumá una media móvil",
        body: "La media móvil suaviza el precio. Si el precio se mantiene por encima, la tendencia reciente es alcista; por debajo, bajista.",
        terms: ["media-movil"],
        look: "Activá las medias móviles sobre el gráfico.",
      },
      {
        title: "Cruzá con el volumen",
        body: "Un movimiento con mucho volumen es más confiable que uno con poco. Un salto sin volumen puede revertirse.",
        terms: ["volumen"],
        look: "Mirá las barras de volumen bajo el gráfico.",
      },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
