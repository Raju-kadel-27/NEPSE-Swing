import { CalendarClock, Crosshair, Database, Gauge, LineChart, ShieldAlert, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { backtestFor } from "@/lib/backtest/results";
import { daysToExit, HORIZON_KEYS, HORIZONS, type Weights } from "@/lib/horizon";
import { TIGHT_RATE } from "@/lib/scoring/money";
import { REGIME_LABEL, type Regime } from "@/lib/scoring/regime";

const signed = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(1)}%`;

// e.g. "10-45%": the range a weight takes across holding periods.
const weightRange = (k: keyof Weights) => {
  const ws = HORIZON_KEYS.map((h) => Math.round(HORIZONS[h].weights[k] * 100));
  return `${Math.min(...ws)}-${Math.max(...ws)}%`;
};

export const metadata: Metadata = { title: "Methodology" };

const SECTIONS = [
  {
    id: "fundamental",
    icon: Gauge,
    title: "Company (fundamentals)",
    weight: weightRange("fundamental"),
    body: "From the latest quarterly report the company publishes.",
    items: [
      "EPS growth against the same quarter last year (Nepali fiscal quarters)",
      "P/E and P/B against the median of the stock's own sector, so banks are compared with banks and hydros with hydros",
      "Return on equity",
      "Dividend (cash plus bonus) from the last two fiscal years",
      "Banks: non-performing loans (NPL) and capital adequacy (CAR) against the NRB minimum, when available",
      "Shown but not scored yet: EPS up (or down) year on year over several quarters in a row, faster earnings growth, and book value per share growth. These count once a year of quarters is stored and they can be backtested",
    ],
  },
  {
    id: "technical",
    icon: LineChart,
    title: "Price trend (technicals)",
    weight: weightRange("technical"),
    body: "From daily closing prices and volume.",
    items: [
      "Trend: price against its 50-day and 200-day averages (120/180-day averages while history is short)",
      "RSI (14): best from 45 up; in NEPSE strong momentum tends to continue, so high RSI is not penalised much, and low RSI (falling) is",
      "MACD histogram: positive and rising is best",
      "Position in the 52-week range",
      "Recent volume against its average (accumulation)",
    ],
  },
  {
    id: "risk",
    icon: ShieldAlert,
    title: "Safety (risk and liquidity)",
    weight: weightRange("risk"),
    body: "Can you get in and out safely within 2-3 months?",
    items: [
      "Average daily turnover. Stocks under Rs 10 lakh a day are marked illiquid",
      "Volatility (average daily range as a % of price)",
      "Circuit-sized moves (±10%) in the last 3 months, a sign of operator activity",
      "Recent right shares (dilution). An upcoming book closure is not penalised: in the backtest, buys within a month before a bonus or right adjustment did better than average",
      "Recent spikes, which tend to pull back during the settlement lock",
      "Warnings that block a buy signal: a -10% lower circuit in the last 2 weeks, a death cross (50-day average falling below the 200-day) in the last 4 weeks, or heavy selling volume",
    ],
  },
  {
    id: "entry",
    icon: Crosshair,
    title: "Buy zone and entry signal",
    weight: null,
    body: "The score says whether a stock is good. The entry signal says whether today's price is a good place to buy it.",
    items: [
      "Support is the nearest level under the price: the 20-day average or 20-day low, the 50-day average, or the 120/180-day averages while history is short",
      "Buy zone: from the support up to one average daily range (ATR) above it. It does not move with today's price",
      "Ready to buy: score 60+ and the last close is inside the zone, with no sharp run-up in the last few days",
      "Breakout: closed at a new high on at least 1.3x normal volume. The zone sits just above the old high",
      "Wait for pullback: a good stock trading above its zone. Set a limit order at the top of the zone",
      "Not yet: price is below every support. Wait until it closes back above the nearest average",
      `Tight money: while banks lend to each other at ${TIGHT_RATE}% or more (NRB weighted average interbank rate, 30-day average), no stock is a buy`,
    ],
  },
  {
    id: "plan",
    icon: CalendarClock,
    title: "Stop, target and settlement",
    weight: null,
    body: "Measured from the top of the buy zone, the most you should pay.",
    items: [
      "Stop-loss: one ATR below the zone, and 2 to 4 ATR below its top depending on the holding period, so normal swings (and the settlement lock) don't trigger it",
      "Target: twice the risk above the top of the zone, but no further than the stock usually moves in your holding period, and never more than the period's cap. We publish 97% of the way to that level, so a rally that stalls just short still gets sold",
      "NEPSE trades Monday to Friday. Shares bought on a day can be sold 3 trading days later (buy Monday, sell from Thursday)",
      "Public holidays are not accounted for yet",
    ],
  },
  {
    id: "data",
    icon: Database,
    title: "Where the data comes from",
    weight: null,
    body: "Public pages, collected once each trading day.",
    items: [
      "Prices: ShareSansar's Today's Share Price page, every listed stock. Each day is stored, so price history grows over time",
      "Fundamentals: each company's Merolagani page (latest EPS, P/E, book value, dividend, bonus and right-share history), refreshed weekly. Each fetch is kept with its date, so trends build up over time",
      "Money conditions: Nepal Rastra Bank's daily interbank rate and liquidity series (from 2016), plus the current rate from its Short Term Interest Rates page each day",
      "EPS growth needs the same quarter a year earlier, so it fills in as quarters are collected",
      "Mutual funds, debentures, bonds and promoter shares are skipped",
    ],
  },
];

export default function Methodology() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">How the picks are made</h1>
        <p className="mt-2 text-muted-foreground">
          Every stock gets a quality score from 0 to 100, built from three parts: Company, Price trend and Safety. Separately, an entry signal says whether today&apos;s price is a good place to buy. Each score comes with the reasons and warnings behind it,
          so you can check the evidence yourself.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Strong candidate", range: "70 – 100", cls: "bg-success/10 text-success" },
          { label: "Watchlist", range: "55 – 69", cls: "bg-warning/10 text-warning" },
          { label: "Avoid for now", range: "0 – 54", cls: "bg-destructive/10 text-destructive" },
        ].map((b) => (
          <Card key={b.label} size="sm">
            <CardContent>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${b.cls}`}>{b.label}</span>
              <p className="mt-2 text-xl font-semibold tabular-nums">{b.range}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scoring components</CardTitle>
          <CardDescription>What goes into each part of the score</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" defaultValue={["fundamental"]}>
            {SECTIONS.map((s) => (
              <AccordionItem key={s.id} value={s.id}>
                <AccordionTrigger>
                  <span className="flex items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary"><s.icon className="size-4" /></span>
                    {s.title}
                    {s.weight && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">{s.weight}</span>}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-muted-foreground">{s.body}</p>
                  <ul className="mt-3 list-disc space-y-1.5 pl-5">{s.items.map((i) => <li key={i}>{i}</li>)}</ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Holding period</CardTitle>
          <CardDescription>
            Pick how long you plan to hold. Short holds weigh the price trend more; long holds weigh company quality more. Targets are sized to how
            far a stock usually moves in that time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hold</TableHead>
                <TableHead className="text-right">Company</TableHead>
                <TableHead className="text-right">Price trend</TableHead>
                <TableHead className="text-right">Safety</TableHead>
                <TableHead className="text-right">Max target</TableHead>
                <TableHead className="text-right">Days to sell after T+3</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {HORIZON_KEYS.map((k) => {
                const h = HORIZONS[k];
                return (
                  <TableRow key={k}>
                    <TableCell className="font-medium">{h.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{Math.round(h.weights.fundamental * 100)}%</TableCell>
                    <TableCell className="text-right tabular-nums">{Math.round(h.weights.technical * 100)}%</TableCell>
                    <TableCell className="text-right tabular-nums">{Math.round(h.weights.risk * 100)}%</TableCell>
                    <TableCell className="text-right tabular-nums">+{Math.round(h.targetCap * 100)}%</TableCell>
                    <TableCell className="text-right tabular-nums">{daysToExit(h)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TrackRecordCard />

      <Alert>
        <TriangleAlert />
        <AlertTitle>Limits</AlertTitle>
        <AlertDescription>
          This is a ranking, not a forecast. NEPSE is driven by liquidity cycles, NRB policy and a few large traders, and no score sees those
          coming. Use the picks as a shortlist, read the company&apos;s report yourself, and always set the stop-loss.
        </AlertDescription>
      </Alert>
    </div>
  );
}

// Backtest of the current rules: every holding period's main strategy, and the 2-month hold by market phase.
function TrackRecordCard() {
  const main = backtestFor("2m");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Track record</CardTitle>
        <CardDescription>
          The current rules replayed day by day over {main.stocks} stocks from {main.from.slice(0, 4)} to {main.to.slice(0, 4)}, using only the
          prices known on each day. A buy fills only if the price reaches the zone; it can&apos;t be sold before T+3; a day that touches both the
          stop and the target counts as stopped; results are after commission, fees and 7.5% capital gains tax. Company results have no history,
          so every company is scored as average here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hold</TableHead>
              <TableHead className="text-right">Trades</TableHead>
              <TableHead className="text-right">Made money</TableHead>
              <TableHead className="text-right">Hit target</TableHead>
              <TableHead className="text-right">Hit stop</TableHead>
              <TableHead className="text-right">Avg per trade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {HORIZON_KEYS.map((k) => {
              const st = backtestFor(k).strategies.buy_now_regime;
              return (
                <TableRow key={k}>
                  <TableCell className="font-medium">{HORIZONS[k].label}</TableCell>
                  <TableCell className="text-right tabular-nums">{st.n.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right tabular-nums">{Math.round(st.winRate * 100)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{Math.round(st.targetRate * 100)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{Math.round(st.stopRate * 100)}%</TableCell>
                  <TableCell className={`text-right tabular-nums ${st.avgNetPct >= 0 ? "text-success" : "text-destructive"}`}>{signed(st.avgNetPct)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="space-y-2">
          <p className="text-sm font-medium">2-month hold by market phase (before the falling-market filter)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(["bull", "neutral", "bear"] as Regime[]).map((r) => {
              const st = main.byRegime[r];
              if (!st) return null;
              return (
                <div key={r} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{REGIME_LABEL[r]}</p>
                  <p className={`text-lg font-semibold tabular-nums ${st.avgNetPct >= 0 ? "text-success" : "text-destructive"}`}>{signed(st.avgNetPct)}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{Math.round(st.winRate * 100)}% of {st.n.toLocaleString("en-IN")} trades made money</p>
                </div>
              );
            })}
          </div>
          {main.byMoney && (
            <>
              <p className="pt-2 text-sm font-medium">2-month hold by money conditions (before the tight-money filter)</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {([["easy", `Interbank rate under ${TIGHT_RATE}%`], ["tight", `Interbank rate ${TIGHT_RATE}% or more`]] as const).map(([k, label]) => {
                  const st = main.byMoney![k];
                  if (!st) return null;
                  return (
                    <div key={k} className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className={`text-lg font-semibold tabular-nums ${st.avgNetPct >= 0 ? "text-success" : "text-destructive"}`}>{signed(st.avgNetPct)}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{Math.round(st.winRate * 100)}% of {st.n.toLocaleString("en-IN")} trades made money</p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            The market phase and the cost of money decide most of the result, which is why buy signals are held back while the market is falling
            or banks are short of cash (the interbank rate was 4% or more in early 2018, the first half of 2019, and from late 2021 to late 2023). The typical single
            trade loses a little; the profit comes from a minority of large winners, so the stop-loss and position size matter more than any one pick.
            Be aware that results were much better in 2016-2021 than in 2022-2026, when buys made under 1% per trade even with both filters. The one filter that held
            up in both periods is price: stocks under Rs 500 averaged +1.0% per 2-month trade in 2022-2026, against -1.8% for pricier ones, which is
            why the picks show stocks under Rs 500 by default.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
