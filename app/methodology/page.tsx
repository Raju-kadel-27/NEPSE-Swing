import type { Metadata } from "next";

export const metadata: Metadata = { title: "How it works · NEPSE Picks" };

const sections = [
  {
    title: "Fundamentals · 40%",
    body: "From the latest quarterly report the company publishes.",
    items: [
      "EPS growth versus the same quarter last year (Nepali fiscal quarters)",
      "P/E and P/B compared with the median of the stock's own sector, so banks are compared with banks and hydros with hydros",
      "Return on equity",
      "Last year's dividend, cash plus bonus",
      "Banks only: non-performing loans (NPL) and capital adequacy (CAR) against the NRB minimum",
    ],
  },
  {
    title: "Technicals · 35%",
    body: "From daily closing prices and volume.",
    items: [
      "Trend: price against its 50-day and 200-day moving averages",
      "RSI (14): best between 45 and 65, penalised above 75 (overbought)",
      "MACD histogram: positive and rising is best",
      "Position in the 52-week range",
      "Volume over the last 20 days against the last 60 (accumulation)",
    ],
  },
  {
    title: "Risk and liquidity · 25%",
    body: "Can you get in and out safely within 2-3 months?",
    items: [
      "Average daily turnover. Stocks under Rs 10 lakh a day are excluded from picks",
      "Volatility (ATR as a % of price)",
      "Circuit-sized moves (±10%) in the last 3 months, a sign of operator activity",
      "Upcoming book closure (the price adjusts down for bonus) and pending right shares (dilution)",
      "Settlement lock: shares bought today can only be sold 3 trading days later (buy Monday, sell from Thursday). Stocks up sharply in the last few days are penalised, because a pullback in that window can't be stopped out",
    ],
  },
  {
    title: "Where the data comes from",
    body: "Public pages, fetched once a day by the scraper (npm run scrape).",
    items: [
      "Prices: ShareSansar's Today's Share Price page, every listed stock in one request. Each day is saved, so price history grows over time",
      "Fundamentals: each company's Merolagani page, for the latest EPS, P/E, book value, and cash dividend, bonus and right-share history. Refreshed weekly, about 2.5 seconds between requests",
      "EPS growth needs the same quarter a year earlier, so it fills in as quarters are collected. Until then it is left out of the score",
      "Mutual funds, debentures, bonds and promoter shares are skipped",
    ],
  },
  {
    title: "Trade plan",
    body: "Levels are based on ATR, the stock's average daily range.",
    items: [
      "Buy zone: from half an ATR below the last close to a quarter ATR above it",
      "Stop-loss: 2.5 ATR below the close",
      "Target: twice the risk above the close, capped at +35%",
      "Buy and sell dates follow NEPSE's Monday to Friday week. Public holidays are not accounted for yet",
    ],
  },
];

export default function Methodology() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">How the picks are made</h1>
        <p className="mt-2 text-sm text-muted">
          Each stock gets three sub-scores from 0 to 100, combined with the weights below. 70 and above is a strong candidate, 55 to 69 is
          a watchlist, and below 55 is avoid for now. Every score comes with the reasons and warnings behind it, so you can check them
          before you trade.
        </p>
      </div>
      {sections.map((s) => (
        <section key={s.title} className="rounded-xl border border-line bg-surface p-5">
          <h2 className="font-medium">{s.title}</h2>
          <p className="text-sm text-muted mt-1">{s.body}</p>
          <ul className="mt-3 space-y-1.5 text-sm list-disc pl-5">{s.items.map((i) => <li key={i}>{i}</li>)}</ul>
        </section>
      ))}
      <section className="rounded-xl border border-line bg-ok-soft p-5 text-sm">
        <h2 className="font-medium text-ok">Limits</h2>
        <p className="mt-1">
          This is a ranking, not a forecast. NEPSE is driven by liquidity cycles, NRB policy and a few large traders, and no score sees
          those coming. Use the picks as a shortlist, read the company&apos;s report yourself, and always set the stop-loss.
        </p>
      </section>
    </div>
  );
}
