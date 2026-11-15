import type { StockData } from "../types";
import { type Component, pct, r1, scale, weighted } from "./util";

export type SectorStats = { pe: number | null; pbv: number | null };

export type FundamentalResult = {
  score: number; reasons: string[]; flags: string[];
  pe: number | null; pbv: number | null; roe: number | null; epsGrowthYoY: number | null;
};

// "082/83" -> 82
const fyStart = (fy: string) => parseInt(fy.slice(0, 3), 10) || 0;

export function valuation(s: StockData, price: number) {
  const latest = s.quarters.at(-1);
  if (!latest) return { pe: null, pbv: null };
  return {
    pe: latest.eps > 0 ? price / latest.eps : null,
    pbv: latest.netWorthPerShare > 0 ? price / latest.netWorthPerShare : null,
  };
}

export type Trend = { epsGrowth: number[]; bookGrowth: number | null };

// Year-on-year EPS growth for each stored quarter that has the same quarter a year earlier (oldest first), and book value growth for the latest one.
export function financialTrend(q: StockData["quarters"]): Trend {
  const key = (fy: string, qtr: number) => `${fyStart(fy)}-${qtr}`;
  const by = new Map(q.map((x) => [key(x.fiscalYear, x.quarter), x]));
  const sorted = [...q].sort((a, b) => fyStart(a.fiscalYear) - fyStart(b.fiscalYear) || a.quarter - b.quarter);
  const epsGrowth: number[] = [];
  let bookGrowth: number | null = null;
  for (const x of sorted) {
    const prior = by.get(key(String(fyStart(x.fiscalYear) - 1).padStart(3, "0"), x.quarter));
    if (!prior) continue;
    if (prior.eps !== 0) epsGrowth.push((x.eps - prior.eps) / Math.abs(prior.eps));
    if (x === sorted.at(-1) && prior.netWorthPerShare > 0 && x.netWorthPerShare > 0) bookGrowth = x.netWorthPerShare / prior.netWorthPerShare - 1;
  }
  return { epsGrowth, bookGrowth };
}

// Informational only until there is a year of stored quarters to backtest them: not part of the score.
function trendNotes(t: Trend, reasons: string[], flags: string[]) {
  const g = t.epsGrowth.slice(-4);
  if (g.length >= 2) {
    const ups = g.filter((x) => x > 0).length, last2 = g.slice(-2);
    if (ups === g.length) reasons.push(`Earnings improving: EPS up year on year in each of the last ${g.length} reported quarters`);
    else if (last2.every((x) => x < 0)) flags.push("Earnings weakening: EPS down year on year in the last 2 reported quarters");
    if (last2[1] - last2[0] >= 0.1 && last2[1] > 0) reasons.push(`Earnings growth speeding up: ${pct(last2[0])} then ${pct(last2[1])} year on year`);
  }
  if (t.bookGrowth !== null) {
    if (t.bookGrowth >= 0.1) reasons.push(`Book value per share up ${pct(t.bookGrowth)} in a year`);
    if (t.bookGrowth <= -0.05) flags.push(`Book value per share down ${pct(-t.bookGrowth)} in a year`);
  }
}

export function scoreFundamental(s: StockData, price: number, sector: SectorStats): FundamentalResult {
  const reasons: string[] = [];
  const flags: string[] = [];
  const parts: Component[] = [];
  const q = s.quarters;
  const latest = q.at(-1);
  if (!latest) return { score: 0, reasons, flags: ["No financial reports available"], pe: null, pbv: null, roe: null, epsGrowthYoY: null };

  // Same quarter last year
  const prior = q.find((x) => x.quarter === latest.quarter && x.fiscalYear !== latest.fiscalYear);
  let growth: number | null = null;
  if (prior && prior.eps !== 0) {
    growth = (latest.eps - prior.eps) / Math.abs(prior.eps);
    parts.push({ score: scale(growth, -0.2, 0.3), weight: 25 });
    if (growth >= 0.1) reasons.push(`EPS up ${pct(growth)} year on year (Q${latest.quarter} ${latest.fiscalYear})`);
    if (growth <= -0.05) flags.push(`EPS down ${pct(-growth)} year on year`);
  }

  const { pe, pbv } = valuation(s, price);
  if (pe === null) {
    parts.push({ score: 0, weight: 20 });
    flags.push("Loss-making or zero EPS");
  } else if (sector.pe) {
    const rel = pe / sector.pe;
    parts.push({ score: scale(rel, 1.5, 0.7), weight: 20 });
    if (rel <= 0.85) reasons.push(`Cheap vs peers: P/E ${r1(pe)} vs sector ${r1(sector.pe)}`);
    if (rel >= 1.3) flags.push(`Expensive vs peers: P/E ${r1(pe)} vs sector ${r1(sector.pe)}`);
  }
  if (pbv !== null && sector.pbv) parts.push({ score: scale(pbv / sector.pbv, 1.5, 0.7), weight: 10 });

  parts.push({ score: scale(latest.roe, 5, 18), weight: 20 });
  if (latest.roe >= 15) reasons.push(`Strong ROE of ${r1(latest.roe)}%`);
  if (latest.roe < 6) flags.push(`Weak ROE of ${r1(latest.roe)}%`);

  // Only a dividend from the last two fiscal years counts as current.
  const lastAction = s.actions.at(-1);
  const stale = !lastAction || fyStart(latest.fiscalYear) - fyStart(lastAction.fiscalYear) > 2;
  const payout = lastAction && !stale ? lastAction.cashDividendPct + lastAction.bonusPct : 0;
  parts.push({ score: scale(payout, 0, 15), weight: 10 });
  if (payout >= 10) reasons.push(`Good payout: ${r1(payout)}% dividend (cash + bonus) for ${lastAction!.fiscalYear}`);
  if (stale) flags.push(lastAction ? `No dividend since ${lastAction.fiscalYear}` : "No dividend history");

  if (latest.npl !== undefined) {
    parts.push({ score: scale(latest.npl, 5, 1.5), weight: 10 });
    if (latest.npl <= 2) reasons.push(`Clean loan book: NPL ${latest.npl}%`);
    if (latest.npl >= 4) flags.push(`High bad loans: NPL ${latest.npl}%`);
  }
  if (latest.car !== undefined) {
    parts.push({ score: scale(latest.car, 11, 14), weight: 5 });
    if (latest.car < 11.5) flags.push(`Capital adequacy close to the NRB minimum (CAR ${latest.car}%)`);
  }

  trendNotes(financialTrend(q), reasons, flags);
  return { score: weighted(parts), reasons, flags, pe, pbv, roe: latest.roe, epsGrowthYoY: growth };
}
