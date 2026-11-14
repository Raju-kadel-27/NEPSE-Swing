import Link from "next/link";
import { notFound } from "next/navigation";
import { type ChartPoint, PriceChart } from "@/components/PriceChart";
import { ScoreBadge, ScoreBar } from "@/components/ScoreBar";
import { getDataSource } from "@/lib/data";
import { sma } from "@/lib/indicators";
import { shortDay } from "@/lib/market";
import { rankStocks, verdict } from "@/lib/scoring";

export async function generateStaticParams() {
  return (await getDataSource()).stocks.map((s) => ({ symbol: s.company.symbol }));
}

const fmt = (n: number | null | undefined, d = 1) => (n == null ? "–" : n.toLocaleString("en-IN", { maximumFractionDigits: d }));
const toneText = { good: "text-good", ok: "text-ok", bad: "text-bad" };

export default async function StockPage(props: PageProps<"/stock/[symbol]">) {
  const { symbol } = await props.params;
  const ds = await getDataSource();
  const stock = ds.stocks.find((s) => s.company.symbol === symbol.toUpperCase());
  const ranked = rankStocks(ds);
  const pick = ranked.find((p) => p.symbol === symbol.toUpperCase());
  if (!stock || !pick) notFound();

  const closes = stock.candles.map((c) => c.close);
  const s50 = sma(closes, 50), s200 = sma(closes, 200);
  const chart: ChartPoint[] = stock.candles
    .map((c, i) => ({ date: c.date, close: c.close, sma50: s50[i] && +s50[i]!.toFixed(1), sma200: s200[i] && +s200[i]!.toFixed(1) }))
    .slice(-180);
  const v = verdict(pick.total);
  const m = pick.metrics;

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-muted hover:text-fg">← All picks</Link>

      <section className="flex flex-wrap gap-4 items-start">
        <ScoreBadge score={pick.total} size="lg" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{pick.symbol} <span className="text-base font-normal text-muted">{pick.name}</span></h1>
          <div className="text-sm text-muted">{pick.sector} · Rank #{ranked.indexOf(pick) + 1} of {ranked.length}</div>
          <div className={`mt-1 font-medium ${toneText[v.tone]}`}>{pick.excluded ? "Excluded: too illiquid" : v.label}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-2xl font-semibold tabular-nums">Rs {fmt(pick.price)}</div>
          <div className={`text-sm tabular-nums ${pick.changePct >= 0 ? "text-good" : "text-bad"}`}>{pick.changePct >= 0 ? "+" : ""}{pick.changePct.toFixed(2)}% today</div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="min-w-0 rounded-xl border border-line bg-surface p-4 md:col-span-2">
          <h2 className="text-sm font-medium mb-2">{chart.length >= 20 ? `Price, last ${Math.min(chart.length, 180)} trading days` : "Price history"}</h2>
          {chart.length >= 20 ? (
            <PriceChart data={chart} stopLoss={pick.stopLoss} target={pick.target} />
          ) : (
            <div className="h-72 flex flex-col items-center justify-center text-center text-sm text-muted gap-2 px-6">
              <p>Price history is still being collected: {chart.length} trading day{chart.length === 1 ? "" : "s"} so far.</p>
              <p>The chart appears after 20 days. Until then the trend uses the 120-day and 180-day averages published by ShareSansar.</p>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 space-y-4">
          <div className="space-y-2">
            <h2 className="text-sm font-medium">Score breakdown</h2>
            <ScoreBar label="Fundamental" score={pick.fundamental} />
            <ScoreBar label="Technical" score={pick.technical} />
            <ScoreBar label="Risk / liquidity" score={pick.risk} />
          </div>
          <div className="space-y-1 text-sm">
            <h2 className="font-medium">Trade plan (2-3 months)</h2>
            <div className="flex justify-between"><span className="text-muted">Buy zone</span><span className="tabular-nums">{fmt(pick.entryLow)} – {fmt(pick.entryHigh)}</span></div>
            <div className="flex justify-between"><span className="text-bad">Stop-loss</span><span className="tabular-nums">{fmt(pick.stopLoss)} ({((pick.stopLoss / pick.price - 1) * 100).toFixed(1)}%)</span></div>
            <div className="flex justify-between"><span className="text-good">Target</span><span className="tabular-nums">{fmt(pick.target)} (+{((pick.target / pick.price - 1) * 100).toFixed(1)}%)</span></div>
            <div className="flex justify-between"><span className="text-muted">Buy on</span><span>{shortDay(pick.buyDate)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Can sell from</span><span>{shortDay(pick.sellableFrom)}</span></div>
            {pick.lockMovePct !== null && (
              <div className="flex justify-between"><span className="text-muted">Typical move until then</span><span className="tabular-nums">±{pick.lockMovePct}%</span></div>
            )}
            <p className="text-xs text-muted pt-1">
              New shares reach your demat account and can be sold 3 trading days after you buy, so the stop-loss can&apos;t protect you
              before then. Size the position for that. After that, sell if it closes below the stop. Re-check after each quarterly report.
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-medium mb-2">Why it scores well</h2>
          {pick.reasons.length ? (
            <ul className="space-y-1.5 text-sm">{pick.reasons.map((r) => <li key={r} className="flex gap-2"><span className="text-good">✓</span>{r}</li>)}</ul>
          ) : <p className="text-sm text-muted">Nothing stands out.</p>}
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-medium mb-2">Watch out for</h2>
          {pick.flags.length ? (
            <ul className="space-y-1.5 text-sm">{pick.flags.map((f) => <li key={f} className="flex gap-2 text-ok"><span>!</span>{f}</li>)}</ul>
          ) : <p className="text-sm text-muted">No red flags found.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-medium mb-3">Key numbers</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          {[
            ["P/E", fmt(m.pe)], ["P/B", fmt(m.pbv, 2)], ["ROE", m.roe == null ? "–" : `${fmt(m.roe)}%`],
            ["EPS growth YoY", m.epsGrowthYoY == null ? "–" : `${(m.epsGrowthYoY * 100).toFixed(0)}%`],
            ["RSI (14)", fmt(m.rsi)],
            ...(m.sma50 !== null && m.sma200 !== null
              ? [["50-day avg", fmt(m.sma50)], ["200-day avg", fmt(m.sma200)]]
              : [["120-day avg", fmt(m.avg120)], ["180-day avg", fmt(m.avg180)]]),
            ["Avg daily turnover", m.avgTurnover == null ? "–" : `Rs ${fmt(m.avgTurnover / 1e5)} lakh`],
          ].map(([k, val]) => (
            <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="tabular-nums font-medium">{val}</dd></div>
          ))}
        </dl>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-4 overflow-x-auto">
          <h2 className="text-sm font-medium mb-2">Quarterly reports</h2>
          <table className="w-full text-sm tabular-nums">
            <thead className="text-xs text-muted text-left">
              <tr><th className="py-1">Quarter</th><th>EPS (ann.)</th><th>Book value</th><th>ROE</th>{stock.quarters[0]?.npl !== undefined && <><th>NPL</th><th>CAR</th></>}</tr>
            </thead>
            <tbody>
              {[...stock.quarters].reverse().map((q) => (
                <tr key={`${q.fiscalYear}-${q.quarter}`} className="border-t border-line">
                  <td className="py-1.5">Q{q.quarter} {q.fiscalYear}</td><td>{fmt(q.eps, 2)}</td><td>{fmt(q.netWorthPerShare)}</td><td>{fmt(q.roe)}%</td>
                  {q.npl !== undefined && <><td>{q.npl}%</td><td>{q.car}%</td></>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4 overflow-x-auto">
          <h2 className="text-sm font-medium mb-2">Dividends and corporate actions</h2>
          <table className="w-full text-sm tabular-nums">
            <thead className="text-xs text-muted text-left"><tr><th className="py-1">Fiscal year</th><th>Cash</th><th>Bonus</th><th>Right</th><th>Book close</th></tr></thead>
            <tbody>
              {[...stock.actions].reverse().map((a) => (
                <tr key={a.fiscalYear} className="border-t border-line">
                  <td className="py-1.5">{a.fiscalYear}</td><td>{a.cashDividendPct}%</td><td>{a.bonusPct}%</td><td>{a.rightRatio ?? "–"}</td><td>{a.bookClosureDate ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
