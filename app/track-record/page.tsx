import { History, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HorizonPicker } from "@/components/horizon-picker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { backtestFor } from "@/lib/backtest/results";
import { getTrackRecord } from "@/lib/data";
import { longDate, num, signedPct } from "@/lib/format";
import { type Horizon, horizonQuery, parseHorizon } from "@/lib/horizon";
import { PREFERRED_MAX_PRICE } from "@/lib/scoring";
import { type GradedPick, type Status, summarizeTrack, type TrackSummary } from "@/lib/track";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Track record" };

// Below this many finished trades the averages are mostly noise.
const MIN_CLOSED = 30;
const MAX_ROWS = 300;

const STATUS: Record<Status, { label: string; cls: string }> = {
  waiting: { label: "Waiting to buy", cls: "bg-muted text-muted-foreground" },
  missed: { label: "Never bought", cls: "bg-muted text-muted-foreground" },
  open: { label: "Holding", cls: "bg-primary/10 text-primary" },
  target: { label: "Hit target", cls: "bg-success/10 text-success" },
  stop: { label: "Stopped out", cls: "bg-destructive/10 text-destructive" },
  time: { label: "Time up", cls: "bg-warning/10 text-warning" },
};

const tone = (x: number | null) => (x == null ? "" : x > 0 ? "text-success" : x < 0 ? "text-destructive" : "");
const pct = (x: number | null) => (x == null ? "–" : signedPct(x, 1));

export default function TrackRecordPage(props: PageProps<"/track-record">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <TrackView searchParams={props.searchParams} />
    </Suspense>
  );
}

async function TrackView({ searchParams }: { searchParams: PageProps<"/track-record">["searchParams"] }) {
  const horizon = parseHorizon((await searchParams).h);
  const { since, picks } = await getTrackRecord(horizon.key);
  const cheap = picks.filter((p) => p.price < PREFERRED_MAX_PRICE);
  const bt = backtestFor(horizon.key).strategies.buy_now_regime;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-primary"><History className="size-4" /> Live results, not a backtest</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">How our &ldquo;Buy today&rdquo; picks actually did</h1>
        <p className="max-w-2xl text-muted-foreground">
          Every pick is saved on the day we publish it and never edited. We then grade it against the prices that followed, with the same
          rules as the backtest: buy only if the price dips into the buy range within 3 trading days, hold at least until the shares can be
          sold (T+3), and sell at the stop, the target, or the end of the {horizon.label} holding period. Results are after broker fees, SEBON and
          DP charges and capital gains tax, for a Rs 1 lakh trade.
        </p>
        {since && <p className="text-sm text-muted-foreground">Tracking since {longDate(since)}.</p>}
      </section>

      <HorizonPicker current={horizon} basePath="/track-record" />

      {!since ? (
        <Alert>
          <Info />
          <AlertTitle>No saved picks yet</AlertTitle>
          <AlertDescription>The track record starts with the first daily update that saves picks to the database.</AlertDescription>
        </Alert>
      ) : (
        <>
          {summarizeTrack(picks).closed < MIN_CLOSED && (
            <Alert>
              <Info />
              <AlertTitle>Too early to judge</AlertTitle>
              <AlertDescription>
                {summarizeTrack(picks).closed === 1 ? "Only 1 trade has" : `Only ${summarizeTrack(picks).closed} trades have`} finished
                so far for {horizon.adj} holds. Wait for at least {MIN_CLOSED} before trusting
                the averages; a few lucky or unlucky trades swing them a lot. The backtest expects about {signedPct(bt.avgNetPct, 1)} per trade
                with {Math.round(bt.winRate * 100)}% winners.
              </AlertDescription>
            </Alert>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <SummaryBlock title={`Headline picks (under Rs ${PREFERRED_MAX_PRICE})`} s={summarizeTrack(cheap)} />
            <SummaryBlock title="All Buy today picks" s={summarizeTrack(picks)} />
          </div>
          <p className="text-xs text-muted-foreground">
            &ldquo;Typical stock&rdquo; is the median NEPSE stock&apos;s price change over the same days as each finished trade, before costs, so you
            can see whether the picks beat simply being in the market. Backtest for comparison ({backtestFor(horizon.key).from.slice(0, 4)}
            –{backtestFor(horizon.key).to.slice(0, 4)}, same rules): {signedPct(bt.avgNetPct, 1)} per trade, {Math.round(bt.winRate * 100)}% winners.
          </p>
          <PicksLog picks={picks} horizon={horizon} />
        </>
      )}
    </div>
  );
}

function SummaryBlock({ title, s }: { title: string; s: TrackSummary }) {
  const tiles = [
    { label: "Picks made", value: num(s.picks, 0), sub: `${s.waiting} waiting · ${s.missed} never bought` },
    { label: "Finished trades", value: num(s.closed, 0), sub: `${s.targets} target · ${s.stops} stop · ${s.timeExits} time up` },
    { label: "Winners", value: s.winRate == null ? "–" : `${Math.round(s.winRate * 100)}%`, sub: "of finished trades, after costs" },
    { label: "Avg per trade", value: pct(s.avgNetPct), sub: `median ${pct(s.medianNetPct)}`, cls: tone(s.avgNetPct) },
    { label: "Typical stock, same days", value: pct(s.avgMarketPct), sub: "what the market did meanwhile", cls: tone(s.avgMarketPct) },
    { label: "Holding now", value: num(s.open, 0), sub: s.openAvgNetPct == null ? "no open trades" : `${pct(s.openAvgNetPct)} if sold today`, cls: "" },
  ];
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <Card key={t.label} size="sm">
            <CardContent>
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className={cn("mt-1 text-xl font-semibold tabular-nums", t.cls)}>{t.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function PicksLog({ picks, horizon }: { picks: GradedPick[]; horizon: Horizon }) {
  const rows = picks.slice(0, MAX_ROWS);
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Every pick, newest first</h2>
      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="pl-4">Picked on</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead className="hidden text-right md:table-cell">Buy at</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Stop</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Target</TableHead>
              <TableHead>Result</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Bought</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Sold / now</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead className="hidden pr-4 text-right md:table-cell">Typical stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={`${p.symbol}-${p.asOf}`}>
                <TableCell className="pl-4 whitespace-nowrap tabular-nums">{longDate(p.asOf)}</TableCell>
                <TableCell>
                  <Link href={`/stock/${p.symbol}${horizonQuery(horizon)}`} className="font-semibold hover:underline">{p.symbol}</Link>
                  <div className="max-w-40 truncate text-xs text-muted-foreground">{p.price >= PREFERRED_MAX_PRICE ? `Rs ${num(p.price, 0)} · not a headline pick` : p.sector}</div>
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{num(p.entryLow, 0)}–{num(p.entryHigh, 0)}</TableCell>
                <TableCell className="hidden text-right tabular-nums text-destructive lg:table-cell">{num(p.stopLoss, 0)}</TableCell>
                <TableCell className="hidden text-right tabular-nums text-success lg:table-cell">{num(p.target, 0)}</TableCell>
                <TableCell>
                  <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", STATUS[p.status].cls)}>{STATUS[p.status].label}</span>
                  {p.exitDate && p.status !== "open" && <div className="mt-1 text-xs text-muted-foreground">{longDate(p.exitDate)}</div>}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{num(p.entry, 1)}</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{num(p.exit, 1)}</TableCell>
                <TableCell className={cn("text-right font-medium tabular-nums", tone(p.netPct))}>{pct(p.netPct)}</TableCell>
                <TableCell className={cn("hidden pr-4 text-right tabular-nums md:table-cell", tone(p.marketPct))}>{pct(p.marketPct)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {picks.length > MAX_ROWS && <p className="text-xs text-muted-foreground">Showing the latest {MAX_ROWS} of {picks.length} picks.</p>}
      <p className="text-xs text-muted-foreground">
        Buy, stop and target are the levels published that day. If a bonus or right share was issued since, &ldquo;Bought&rdquo; and
        &ldquo;Sold / now&rdquo; are in today&apos;s adjusted prices.
      </p>
    </section>
  );
}
