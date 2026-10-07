/**
 * Cronogramas y métricas de bonos soberanos en dólares (RF-16).
 * Los flujos son por cada 100 de valor nominal original, en USD. Se arman con reglas
 * (cupón escalonado + amortización) contrastadas contra el cronograma de IOL.
 */

export interface BondTerms {
  /** Ticker en pesos, sin sufijo de moneda. */
  ticker: string;
  name: string;
  law: "Argentina" | "Nueva York";
  issuer: string;
  maturity: string;
  /** Saldo de capital antes del primer pago del cronograma. */
  openingBalance: number;
  /** Fechas de pago (YYYY-MM-DD) desde el primer flujo futuro cargado. */
  dates: string[];
  /** Tasa de cupón anual (%) desde cada fecha. Se aplica la última cuya fecha sea <= a la del pago. */
  couponSteps: [from: string, annualPct: number][];
  /** Amortización por pago desde cada fecha; el último pago devuelve el saldo restante. */
  amortSteps: [from: string, amount: number][];
}

export interface CashFlow {
  date: string;
  openingBalance: number;
  interest: number;
  amortization: number;
  total: number;
  residual: number;
}

const round = (n: number, d = 6) => Math.round(n * 10 ** d) / 10 ** d;

/** Pagos semestrales los días 9 de enero y julio entre dos años, ambos incluidos. */
function semiannual(fromYm: string, toYm: string): string[] {
  const [fy, fm] = fromYm.split("-").map(Number);
  const [ty, tm] = toYm.split("-").map(Number);
  const out: string[] = [];
  for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); ) {
    out.push(`${y}-${String(m).padStart(2, "0")}-09`);
    if (m === 1) m = 7;
    else {
      m = 1;
      y += 1;
    }
  }
  return out;
}

const GLOBAL_LAW = "Nueva York" as const;

export const BONDS: BondTerms[] = [
  {
    ticker: "AL35",
    name: "Bonar 2035",
    law: "Argentina",
    issuer: "República Argentina",
    maturity: "2035-07-09",
    openingBalance: 100,
    dates: semiannual("2027-01", "2035-07"),
    couponSteps: [
      ["2027-01-09", 4.125],
      ["2028-01-09", 4.75],
      ["2029-01-09", 5],
    ],
    amortSteps: [["2031-01-09", 10]],
  },
  {
    ticker: "GD35",
    name: "Global 2035",
    law: GLOBAL_LAW,
    issuer: "República Argentina",
    maturity: "2035-07-09",
    openingBalance: 100,
    dates: semiannual("2027-01", "2035-07"),
    couponSteps: [
      ["2027-01-09", 4.125],
      ["2028-01-09", 4.75],
      ["2029-01-09", 5],
    ],
    amortSteps: [["2031-01-09", 10]],
  },
  {
    ticker: "AE38",
    name: "Bonar 2038",
    law: "Argentina",
    issuer: "República Argentina",
    maturity: "2038-01-09",
    openingBalance: 100,
    dates: semiannual("2027-01", "2038-01"),
    couponSteps: [["2027-01-09", 5]],
    amortSteps: [["2027-07-09", 4.54]],
  },
  {
    ticker: "GD38",
    name: "Global 2038",
    law: GLOBAL_LAW,
    issuer: "República Argentina",
    maturity: "2038-01-09",
    openingBalance: 100,
    dates: semiannual("2027-01", "2038-01"),
    couponSteps: [["2027-01-09", 5]],
    amortSteps: [["2027-07-09", 4.54]],
  },
  {
    ticker: "AL41",
    name: "Bonar 2041",
    law: "Argentina",
    issuer: "República Argentina",
    maturity: "2041-07-09",
    openingBalance: 100,
    dates: semiannual("2027-01", "2041-07"),
    couponSteps: [
      ["2027-01-09", 3.5],
      ["2030-01-09", 4.875],
    ],
    amortSteps: [["2028-01-09", 3.57]],
  },
  {
    ticker: "GD41",
    name: "Global 2041",
    law: GLOBAL_LAW,
    issuer: "República Argentina",
    maturity: "2041-07-09",
    openingBalance: 100,
    dates: semiannual("2027-01", "2041-07"),
    couponSteps: [
      ["2027-01-09", 3.5],
      ["2030-01-09", 4.875],
    ],
    amortSteps: [["2028-01-09", 3.57]],
  },
  {
    ticker: "GD46",
    name: "Global 2046",
    law: GLOBAL_LAW,
    issuer: "República Argentina",
    maturity: "2046-07-09",
    openingBalance: 90.92,
    dates: semiannual("2027-01", "2046-07"),
    couponSteps: [
      ["2027-01-09", 4.125],
      ["2028-01-09", 4.375],
      ["2029-01-09", 5],
    ],
    amortSteps: [["2027-01-09", 2.27]],
  },
];

const BY_TICKER = new Map(BONDS.map((b) => [b.ticker, b]));

/** "GD35", "GD35D" y "GD35C" son el mismo bono operado en pesos, dólar MEP y dólar cable. */
export function bondTicker(symbol: string): string {
  const s = symbol.toUpperCase();
  return /^[A-Z]{2}\d{2}[CD]$/.test(s) ? s.slice(0, -1) : s;
}

export function findBond(symbol: string): BondTerms | undefined {
  return BY_TICKER.get(bondTicker(symbol));
}

function stepValue<T>(steps: [string, T][], date: string): T {
  let current = steps[0][1];
  for (const [from, v] of steps) if (from <= date) current = v;
  return current;
}

/** Cronograma completo de flujos futuros cargado para el bono. */
export function buildSchedule(bond: BondTerms): CashFlow[] {
  let balance = bond.openingBalance;
  const flows: CashFlow[] = [];
  bond.dates.forEach((date, i) => {
    const isLast = i === bond.dates.length - 1;
    const rate = stepValue(bond.couponSteps, date);
    const interest = round((balance * rate) / 200);
    const scheduled = bond.amortSteps.length && date >= bond.amortSteps[0][0] ? stepValue(bond.amortSteps, date) : 0;
    const amortization = round(isLast ? balance : Math.min(scheduled, balance));
    const residual = round(balance - amortization, 4);
    flows.push({ date, openingBalance: round(balance, 4), interest, amortization, total: round(interest + amortization), residual });
    balance = residual;
  });
  return flows;
}

const DAY = 86_400_000;
const toTime = (d: string) => new Date(`${d}T00:00:00Z`).getTime();

/** Flujos que todavía no se cobraron a la fecha de liquidación. */
export function remainingFlows(flows: CashFlow[], settlement: Date): CashFlow[] {
  const t = settlement.getTime();
  return flows.filter((f) => toTime(f.date) > t);
}

function addMonths(date: string, months: number): number {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.getTime();
}

export interface BondMetrics {
  /** Capital pendiente + intereses corridos, por cada 100 de VN original. */
  technicalValue: number;
  accrued: number;
  residual: number;
  /** Precio sucio / valor técnico. */
  parity: number | null;
  /** TIR efectiva anual (act/365), o null si no converge. */
  tir: number | null;
  macaulay: number | null;
  modified: number | null;
  nextPayment: CashFlow | null;
  /** Cupón anual vigente (%). */
  currentCoupon: number | null;
}

function npv(rate: number, flows: CashFlow[], settlement: number, price: number): number {
  let v = -price;
  for (const f of flows) v += f.total / (1 + rate) ** ((toTime(f.date) - settlement) / (365 * DAY));
  return v;
}

/** Calcula TIR, paridad, valor técnico y duration. `dirtyPrice` es por 100 de VN original, en USD. */
export function bondMetrics(bond: BondTerms, dirtyPrice: number | null, settlement: Date): BondMetrics {
  const all = buildSchedule(bond);
  const flows = remainingFlows(all, settlement);
  const next = flows[0] ?? null;
  const t = settlement.getTime();

  let accrued = 0;
  if (next) {
    const prevT = addMonths(next.date, -6);
    const rate = stepValue(bond.couponSteps, next.date);
    const days = Math.max(0, Math.min((t - prevT) / DAY, 182.5));
    accrued = round((next.openingBalance * rate) / 200 * (days / ((toTime(next.date) - prevT) / DAY)));
  }
  const residual = next?.openingBalance ?? 0;
  const technicalValue = round(residual + accrued);

  let tir: number | null = null;
  let macaulay: number | null = null;
  let modified: number | null = null;
  if (dirtyPrice && dirtyPrice > 0 && flows.length > 0) {
    // Bisección sobre la tasa: robusta y suficiente para flujos que siempre suman más que el precio.
    let lo = -0.5;
    let hi = 5;
    if (npv(lo, flows, t, dirtyPrice) * npv(hi, flows, t, dirtyPrice) < 0) {
      for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2;
        if (npv(lo, flows, t, dirtyPrice) * npv(mid, flows, t, dirtyPrice) <= 0) hi = mid;
        else lo = mid;
      }
      tir = (lo + hi) / 2;
      let pv = 0;
      let weighted = 0;
      for (const f of flows) {
        const years = (toTime(f.date) - t) / (365 * DAY);
        const p = f.total / (1 + tir) ** years;
        pv += p;
        weighted += p * years;
      }
      macaulay = weighted / pv;
      modified = macaulay / (1 + tir);
    }
  }

  return {
    technicalValue,
    accrued,
    residual,
    parity: dirtyPrice && technicalValue > 0 ? dirtyPrice / technicalValue : null,
    tir,
    macaulay,
    modified,
    nextPayment: next,
    currentCoupon: next ? stepValue(bond.couponSteps, next.date) : null,
  };
}
