import { AlertTriangle, ArrowLeft, CheckCircle2, LineChart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GLOSSARY, InfoTip } from "@/components/info-tip";
import { type ChartPoint, PriceChart } from "@/components/price-chart";
import { ChangeText, PART_LABEL, ScoreMeter, ScoreRing, SignalBadge } from "@/components/score";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ZoneBar } from "@/components/zone-bar";
import { RupeeLine } from "@/components/picks/pick-card";
import { ExternalLinks } from "@/components/external-links";
import { AccumulationBadge, ResultsBadge } from "@/components/results-badges";
import { TrackRecord } from "@/components/track-record";
import { backtestFor } from "@/lib/backtest/results";
import { HorizonPicker } from "@/components/horizon-picker";
import { getMeta, getPicks, getStock } from "@/lib/data";
import { horizonQuery, parseHorizon } from "@/lib/horizon";
import { npr, num, pctFrom } from "@/lib/format";
import { sma } from "@/lib/indicators";
import { shortDay } from "@/lib/market";
import { isBuyableToday } from "@/lib/scoring";
import type { Pick } from "@/lib/types";
import { cn } from "@/lib/utils";

export async function generateStaticParams() {
  return (await getMeta()).symbols.map((symbol) => ({ symbol }));
}

export async function generateMetadata(props: PageProps<"/stock/[symbol]">): Promise<Metadata> {
  const { symbol } = await props.params;
  return { title: symbol.toUpperCase() };
}

// The one-sentence answer to "should I buy this today?"
function headline(p: Pick): string {
  const range = `Rs ${num(p.entryLow, 0)}–${num(p.entryHigh, 0)}`;
  switch (p.signal) {
    case "ready":
    case "breakout":
      return isBuyableToday(p) ? `Buy between ${range}` : `Price is right, but the score is only fair. Small position at most, ${range}`;
    case "wait":
      return `Wait. Buy only at Rs ${num(p.entryHigh, 0)} or lower`;
    case "not_yet":
      return "Don't buy yet. The price is still falling";
    default:
      return "Avoid for now";
  }
}

const DECISION_STYLE: Record<Pick["signal"], string> = {
  ready: "border-success/40 bg-success/5",
  breakout: "border-primary/40 bg-primary/5",
  wait: "border-warning/40 bg-warning/5",
  not_yet: "border-border",
  avoid: "border-destructive/30 bg-destructive/5",
};

function PlanCell({ label, tip, value, sub, className }: { label: string; tip: string; value: string; sub?: string; className?: string }) {
  return (
    <div className="rounded-lg bg-background/70 px-3 py-2.5 ring-1 ring-foreground/5">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">{label} <InfoTip text={tip} /></div>
      <div className={cn("mt-0.5 text-lg font-semibold tabular-nums", className)}>{value}</div>
      {sub && <div className={cn("text-xs tabular-nums opacity-80", className)}>{sub}</div>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function StockSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-16 w-72" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}

// params are read inside Suspense so navigation can show the skeleton instantly.
export default function StockPage(props: PageProps<"/stock/[symbol]">) {
  return (
    <Suspense fallback={<StockSkeleton />}>
      <StockView params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function StockView({ params, searchParams }: { params: PageProps<"/stock/[symbol]">["params"]; searchParams: PageProps<"/stock/[symbol]">["searchParams"] }) {
  const [{ symbol }, query] = await Promise.all([params, searchParams]);
  const horizon = parseHorizon(query.h);
  const [stock, picks] = await Promise.all([getStock(symbol.toUpperCase()), getPicks(horizon.key)]);
  const pick = picks.find((p) => p.symbol === symbol.toUpperCase());
  if (!stock || !pick) notFound();

  const closes = stock.candles.map((c) => c.close);
  const s50 = sma(closes, 50), s200 = sma(closes, 200);
  const chart: ChartPoint[] = stock.candles
    .map((c, i) => ({ date: c.date, close: c.close, sma50: s50[i] == null ? null : +s50[i]!.toFixed(1), sma200: s200[i] == null ? null : +s200[i]!.toFixed(1) }))
    .slice(-180);
  const m = pick.metrics;
  const bt = backtestFor(horizon.key);
  const hasLongAverages = m.sma50 !== null && m.sma200 !== null;

  return (
    <div className="space-y-6">
      <Link href={`/${horizonQuery(horizon)}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All picks
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4 rounded-3xl border bg-card p-5 sm:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{pick.symbol}</h1>
            <Badge variant="secondary">{pick.sector}</Badge>
          </div>
          <p className="text-muted-foreground">{pick.name}</p>
          <ExternalLinks symbol={pick.symbol} className="mt-2" />
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums">Rs {num(pick.price)}</div>
          <ChangeText pct={pick.changePct} className="text-sm" /> <span className="text-xs text-muted-foreground">on the last trading day</span>
        </div>
      </header>

      <div className="rounded-2xl border bg-card px-4 py-3">
        <HorizonPicker current={horizon} basePath={`/stock/${pick.symbol}`} className="sm:justify-between" />
      </div>

      <Card className={cn("border-2 ring-0", DECISION_STYLE[pick.signal])}>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <SignalBadge signal={pick.signal} />
              <span className="text-xs text-muted-foreground">for a {horizon.adj} hold</span>
              <AccumulationBadge p={pick} />
              <ResultsBadge p={pick} />
            </div>
            <p className="text-xl font-semibold tracking-tight sm:text-2xl">{headline(pick)}</p>
            <p className="text-sm text-muted-foreground">{pick.note}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <PlanCell label="Buy at" tip={GLOSSARY.buyAt} value={`${num(pick.entryLow, 0)}–${num(pick.entryHigh, 0)}`} />
            <PlanCell label="Sell if below" tip={GLOSSARY.sellIfBelow} value={num(pick.stopLoss)} sub={`${pctFrom(pick.stopLoss, pick.entryHigh).toFixed(1)}% from the buy price`} className="text-destructive" />
            <PlanCell label="Take profit" tip={GLOSSARY.takeProfit} value={num(pick.target)} sub={`+${pctFrom(pick.target, pick.entryHigh).toFixed(1)}% from the buy price`} className="text-success" />
            <PlanCell label="Sellable from" tip={GLOSSARY.sellable} value={shortDay(pick.sellableFrom)} sub={`if bought ${shortDay(pick.buyDate)}`} />
          </div>

          <ZoneBar stop={pick.stopLoss} low={pick.entryLow} high={pick.entryHigh} target={pick.target} price={pick.price} />
          <RupeeLine p={pick} className="text-sm" />
          <TrackRecord symbol={pick.symbol} stats={bt.bySymbol[pick.symbol]} from={bt.from} className="border-t pt-4" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Why it looks good</CardTitle></CardHeader>
          <CardContent>
            {pick.reasons.length ? (
              <ul className="space-y-2.5 text-sm">
                {pick.reasons.map((r) => <li key={r} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />{r}</li>)}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Nothing stands out.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Things to watch</CardTitle></CardHeader>
          <CardContent>
            {pick.flags.length ? (
              <ul className="space-y-2.5 text-sm">
                {pick.flags.map((f) => <li key={f} className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />{f}</li>)}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No red flags found.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">Quality score <InfoTip text={GLOSSARY.score} /></CardTitle>
            <CardDescription>How good the stock is for a {horizon.adj} hold, separate from today&apos;s price</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <ScoreRing score={pick.total} size={72} />
              <p className="text-sm text-muted-foreground">
                {pick.total >= 70 ? "Strong overall." : pick.total >= 55 ? "Decent, with some weak spots." : "Weak overall."} 70+ is strong, 55-69 is fair.
              </p>
            </div>
            <div className="space-y-3">
              <ScoreMeter label={PART_LABEL.fundamental} score={pick.fundamental} tip={GLOSSARY.company} />
              <ScoreMeter label={PART_LABEL.technical} score={pick.technical} tip={GLOSSARY.trend} />
              <ScoreMeter label={PART_LABEL.risk} score={pick.risk} tip={GLOSSARY.safety} />
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>Price</CardTitle>
            <CardDescription>
              {chart.length >= 20 ? `Last ${Math.min(chart.length, 180)} trading days, with the stop and target` : "Price history is still being collected"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chart.length >= 20 ? (
              <PriceChart data={chart} stopLoss={pick.stopLoss} target={pick.target} />
            ) : (
              <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground">
                <LineChart className="size-8 opacity-50" />
                <p>The price chart appears once we have 20 trading days of prices ({chart.length} so far).</p>
                <p className="text-xs">Average price over the last 120 days: Rs {num(m.avg120)} · last 180 days: Rs {num(m.avg180)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Company details</h2>
        <Tabs defaultValue="numbers" className="gap-4">
          <TabsList>
            <TabsTrigger value="numbers">Key numbers</TabsTrigger>
            <TabsTrigger value="results">Quarterly results</TabsTrigger>
            <TabsTrigger value="dividends">Dividends</TabsTrigger>
          </TabsList>

          <TabsContent value="numbers">
            <Card>
              <CardContent>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Metric label="EPS (annualised)" value={m.eps == null ? "–" : `Rs ${num(m.eps)}`} />
                  <Metric label="P/E (price ÷ earnings)" value={num(m.pe)} />
                  <Metric label="1-year change (incl. bonus)" value={m.change1y == null ? "Not enough data yet" : `${m.change1y > 0 ? "+" : ""}${num(m.change1y)}%`} />
                  <Metric label="P/B (price ÷ book value)" value={num(m.pbv, 2)} />
                  <Metric label="Return on equity" value={m.roe == null ? "–" : `${num(m.roe)}%`} />
                  <Metric label="Earnings growth (YoY)" value={m.epsGrowthYoY == null ? "Not enough data yet" : `${(m.epsGrowthYoY * 100).toFixed(0)}%`} />
                  <Metric label="RSI (momentum)" value={m.rsi == null ? "Not enough data yet" : num(m.rsi)} />
                  <Metric label={hasLongAverages ? "50-day average" : "120-day average"} value={num(hasLongAverages ? m.sma50 : m.avg120)} />
                  <Metric label={hasLongAverages ? "200-day average" : "180-day average"} value={num(hasLongAverages ? m.sma200 : m.avg180)} />
                  <Metric label="Traded per day" value={npr(m.avgTurnover)} />
                </dl>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results">
            <Card>
              <CardHeader><CardDescription>Earnings per share are annualised. New quarters are added as companies report.</CardDescription></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Quarter</TableHead><TableHead className="text-right">EPS</TableHead><TableHead className="text-right">Book value</TableHead><TableHead className="text-right">ROE</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...stock.quarters].reverse().map((q) => (
                      <TableRow key={`${q.fiscalYear}-${q.quarter}`}>
                        <TableCell>Q{q.quarter} {q.fiscalYear}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(q.eps, 2)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(q.netWorthPerShare)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(q.roe)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dividends">
            <Card>
              <CardHeader><CardDescription>Only dividends from the last two fiscal years count toward the score.</CardDescription></CardHeader>
              <CardContent>
                {stock.actions.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Fiscal year</TableHead><TableHead className="text-right">Cash</TableHead><TableHead className="text-right">Bonus shares</TableHead><TableHead className="text-right">Right shares</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...stock.actions].reverse().map((a) => (
                        <TableRow key={a.fiscalYear}>
                          <TableCell>{a.fiscalYear}</TableCell>
                          <TableCell className="text-right tabular-nums">{a.cashDividendPct}%</TableCell>
                          <TableCell className="text-right tabular-nums">{a.bonusPct}%</TableCell>
                          <TableCell className="text-right">{a.rightRatio ?? "–"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : <p className="text-sm text-muted-foreground">No dividend history.</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
