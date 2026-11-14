import { isTradingDay } from "../market";
import type { Action, Candle, Company, Quarter, StockData } from "../types";

// Fixed anchor so demo output is deterministic and prerender-safe.
export const DEMO_AS_OF = "2026-11-12";

type Profile = Company & { drift: number; vol: number; quality: number; price: number };

// drift/day, vol/day and quality (0-1, drives fundamentals) are invented for demo only
const UNIVERSE: Profile[] = [
  { symbol: "NABIL", name: "Nabil Bank", sector: "Commercial Banks", drift: 0.0006, vol: 0.016, quality: 0.8, price: 520 },
  { symbol: "NICA", name: "NIC Asia Bank", sector: "Commercial Banks", drift: 0.0009, vol: 0.017, quality: 0.75, price: 410 },
  { symbol: "SCBL", name: "Standard Chartered Nepal", sector: "Commercial Banks", drift: 0.0003, vol: 0.013, quality: 0.85, price: 560 },
  { symbol: "GBIME", name: "Global IME Bank", sector: "Commercial Banks", drift: 0.0001, vol: 0.016, quality: 0.55, price: 215 },
  { symbol: "EBL", name: "Everest Bank", sector: "Commercial Banks", drift: 0.0007, vol: 0.015, quality: 0.7, price: 640 },
  { symbol: "SBL", name: "Siddhartha Bank", sector: "Commercial Banks", drift: -0.0004, vol: 0.016, quality: 0.4, price: 235 },
  { symbol: "MBL", name: "Machhapuchchhre Bank", sector: "Commercial Banks", drift: -0.0006, vol: 0.017, quality: 0.3, price: 190 },
  { symbol: "CZBIL", name: "Citizens Bank Intl", sector: "Commercial Banks", drift: 0.0005, vol: 0.016, quality: 0.6, price: 220 },
  { symbol: "GBBL", name: "Garima Bikas Bank", sector: "Development Banks", drift: 0.001, vol: 0.021, quality: 0.65, price: 330 },
  { symbol: "MNBBL", name: "Muktinath Bikas Bank", sector: "Development Banks", drift: 0.0004, vol: 0.02, quality: 0.6, price: 380 },
  { symbol: "SHL", name: "Soaltee Hotel", sector: "Hotels & Tourism", drift: 0.0005, vol: 0.022, quality: 0.5, price: 450 },
  { symbol: "TRH", name: "Taragaon Regency Hotel", sector: "Hotels & Tourism", drift: -0.0003, vol: 0.024, quality: 0.25, price: 520 },
  { symbol: "NLIC", name: "Nepal Life Insurance", sector: "Life Insurance", drift: 0.0008, vol: 0.021, quality: 0.7, price: 780 },
  { symbol: "LICN", name: "Life Insurance Corp Nepal", sector: "Life Insurance", drift: 0.0002, vol: 0.02, quality: 0.5, price: 640 },
  { symbol: "NICL", name: "Nepal Insurance", sector: "Non-Life Insurance", drift: 0.0006, vol: 0.021, quality: 0.65, price: 690 },
  { symbol: "SICL", name: "Shikhar Insurance", sector: "Non-Life Insurance", drift: -0.0002, vol: 0.022, quality: 0.45, price: 710 },
  { symbol: "HRL", name: "Himalayan Reinsurance", sector: "Non-Life Insurance", drift: 0.0007, vol: 0.023, quality: 0.6, price: 580 },
  { symbol: "UPPER", name: "Upper Tamakoshi Hydropower", sector: "Hydropower", drift: 0.0011, vol: 0.023, quality: 0.8, price: 295 },
  { symbol: "CHCL", name: "Chilime Hydropower", sector: "Hydropower", drift: 0.0004, vol: 0.022, quality: 0.7, price: 560 },
  { symbol: "AKPL", name: "Arun Kabeli Power", sector: "Hydropower", drift: 0.0012, vol: 0.026, quality: 0.6, price: 340 },
  { symbol: "BPCL", name: "Butwal Power Company", sector: "Hydropower", drift: -0.0005, vol: 0.025, quality: 0.35, price: 520 },
  { symbol: "NHPC", name: "National Hydro Power", sector: "Hydropower", drift: 0.0003, vol: 0.024, quality: 0.5, price: 150 },
  { symbol: "SWBBL", name: "Swabalamban Laghubitta", sector: "Microfinance", drift: 0.0008, vol: 0.026, quality: 0.65, price: 960 },
  { symbol: "CBBL", name: "Chhimek Laghubitta", sector: "Microfinance", drift: -0.0004, vol: 0.027, quality: 0.3, price: 880 },
  { symbol: "NTC", name: "Nepal Telecom", sector: "Others", drift: 0.0002, vol: 0.012, quality: 0.85, price: 880 },
];

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

function tradingDays(endISO: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(endISO + "T00:00:00Z");
  while (out.length < n) {
    if (isTradingDay(d)) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out.reverse();
}

function genCandles(u: Profile, days: string[]): Candle[] {
  const r = rng(hash(u.symbol));
  const rets = days.map(() => Math.max(-0.1, Math.min(0.1, u.drift + u.vol * gauss(r))));
  const closes: number[] = new Array(days.length);
  let p = u.price;
  for (let i = days.length - 1; i >= 0; i--) { closes[i] = p; p = p / (1 + rets[i]); }
  return days.map((date, i) => {
    const close = +closes[i].toFixed(1);
    const open = +(i > 0 ? closes[i - 1] : close / (1 + rets[i])).toFixed(1);
    const high = +(Math.max(open, close) * (1 + Math.abs(gauss(r)) * u.vol * 0.4)).toFixed(1);
    const low = +(Math.min(open, close) * (1 - Math.abs(gauss(r)) * u.vol * 0.4)).toFixed(1);
    const volume = Math.round(20000 * (0.5 + u.quality) * (0.6 + r() * 1.2) * (1 + Math.abs(rets[i]) * 15));
    return { date, open, high, low, close, volume };
  });
}

function genFinancials(u: Profile, isBank: boolean): { quarters: Quarter[]; actions: Action[] } {
  const r = rng(hash(u.symbol + "fin"));
  const q = u.quality;
  const baseEps = (u.price / (isBank ? 16 : 22)) * (0.6 + q * 0.8);
  const growth = (q - 0.45) * 0.5;
  const bookValue = u.price / (0.9 + (1 - q) * 1.6);
  const labels: [string, number][] = [["081/82", 3], ["081/82", 4], ["082/83", 1], ["082/83", 2], ["082/83", 3]];
  const quarters: Quarter[] = labels.map(([fiscalYear, quarter], i) => {
    const eps = +(baseEps * Math.pow(1 + growth / 4, i) * (0.95 + r() * 0.1)).toFixed(2);
    const nw = +(bookValue * (0.97 + i * 0.01)).toFixed(1);
    return {
      fiscalYear, quarter, eps,
      netWorthPerShare: nw,
      roe: +((eps / nw) * 100).toFixed(1),
      npl: isBank ? +(1.2 + (1 - q) * 5 + r() * 0.4).toFixed(2) : undefined,
      car: isBank ? +(11.5 + q * 4 + r()).toFixed(2) : undefined,
      netProfit: Math.round(eps * 100 * (1 + i * 0.02)),
    };
  });
  const actions: Action[] = [
    { fiscalYear: "080/81", cashDividendPct: +(q * 6 * r()).toFixed(1), bonusPct: +(q * 12 * r()).toFixed(1) },
    {
      fiscalYear: "081/82", cashDividendPct: +(q * 8 * r()).toFixed(1), bonusPct: +(q * 14 * r()).toFixed(1),
      bookClosureDate: r() > 0.8 ? "2026-12-05" : undefined,
      rightRatio: r() > 0.85 ? "1:0.5" : undefined,
    },
  ];
  return { quarters, actions };
}

export function getDemoStocks(): StockData[] {
  const days = tradingDays(DEMO_AS_OF, 420);
  return UNIVERSE.map((u) => {
    const { quarters, actions } = genFinancials(u, u.sector.includes("Banks"));
    return { company: { symbol: u.symbol, name: u.name, sector: u.sector }, candles: genCandles(u, days), quarters, actions };
  });
}
