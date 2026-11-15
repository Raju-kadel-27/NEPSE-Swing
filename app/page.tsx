import { ChevronDown, CircleDollarSign, Lightbulb, ListChecks, ShieldCheck, TrendingDown, TriangleAlert } from "lucide-react";
import { Suspense } from "react";
import { HorizonPicker } from "@/components/horizon-picker";
import { MarketStrip } from "@/components/market-strip";
import { PicksExplorer } from "@/components/picks/picks-explorer";
import { ZoneAlerts } from "@/components/picks/zone-alerts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { getMarketOverview, getMeta, getPicks, getSparklines, getZoneChanges } from "@/lib/data";
import { longDate } from "@/lib/format";
import { daysToExit, type Horizon, parseHorizon } from "@/lib/horizon";
import { shortDay, tradeWindow } from "@/lib/market";
import { isBuyableToday, isPreferredPrice, PREFERRED_MAX_PRICE } from "@/lib/scoring";
import { BEAR_MIN_SCORE } from "@/lib/scoring/entry";

const steps = (h: Horizon) => [
  { icon: ListChecks, title: "Pick a stock", text: "Start with Buy today: good stocks trading at a sensible price right now." },
  { icon: CircleDollarSign, title: "Buy inside the range", text: "Place a limit order in the Buy at range. Never chase above the top number." },
  { icon: ShieldCheck, title: "Set your exits", text: `Sell if it closes below the stop. Take profit near the target within ${h.label}.` },
];

function HomeSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-9 w-full max-w-xl" />
      </div>
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}
      </div>
    </div>
  );
}

// searchParams are read inside Suspense so switching holding period streams in behind a skeleton.
export default function Home(props: PageProps<"/">) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeView searchParams={props.searchParams} />
    </Suspense>
  );
}

async function HomeView({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const horizon = parseHorizon((await searchParams).h);
  const [ds, picks, overview, zone, sparks] = await Promise.all([getMeta(), getPicks(horizon.key), getMarketOverview(), getZoneChanges(horizon.key), getSparklines()]);
  const market = overview.last;
  const buyToday = picks.filter((p) => isBuyableToday(p) && isPreferredPrice(p)).length;
  const { buyDate } = tradeWindow(ds.asOf);
  const exitDays = daysToExit(horizon);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">For {shortDay(buyDate)} · based on {longDate(ds.asOf)} closing prices</p>
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {buyToday > 0
              ? <><span className="text-primary">{buyToday} stocks</span> under Rs {PREFERRED_MAX_PRICE} worth buying for {horizon.label}</>
              : <>No stocks at a good buying price for {horizon.label}</>}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            Where to buy, where to stop out and where to take profit, for every NEPSE stock, adjusted to how long you hold.
          </p>
        </div>
        <HorizonPicker current={horizon} className="shrink-0" />
      </section>

      <MarketStrip {...overview} checked={picks.length} />

      {market?.regime === "bear" && (
        <Alert className="border-destructive/40 bg-destructive/5">
          <TrendingDown className="text-destructive" />
          <AlertTitle>The market is falling</AlertTitle>
          <AlertDescription>
            Only {Math.round(market.breadth * 100)}% of stocks are above their 50-day average and the market index is below its own. Most buys lose
            money in this phase, so only stocks scoring {BEAR_MIN_SCORE}+ are shown as buys. Keep positions small, or wait for the market to turn.
          </AlertDescription>
        </Alert>
      )}

      {exitDays <= 7 && (
        <Alert className="border-warning/40 bg-warning/5">
          <TriangleAlert className="text-warning" />
          <AlertTitle>Short holds are riskier in NEPSE</AlertTitle>
          <AlertDescription>
            Shares can only be sold 3 trading days after you buy, so a {horizon.adj} trade leaves just {exitDays} trading day{exitDays === 1 ? "" : "s"} to
            exit. These picks lean on price momentum, and targets are smaller. Use small positions.
          </AlertDescription>
        </Alert>
      )}

      <ZoneAlerts entered={zone.entered} near={zone.near} picks={picks} horizon={horizon} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Picks</h2>
          <details className="group w-full rounded-xl border bg-card text-sm open:pb-1 sm:w-auto sm:min-w-80">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
              <Lightbulb className="size-4 text-primary" /> New here? How to use these picks
              <ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" />
            </summary>
            <ol className="space-y-3 px-3 pt-1 pb-2">
              {steps(horizon).map((st, i) => (
                <li key={st.title} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><st.icon className="size-3.5" /></span>
                  <div>
                    <p className="font-medium">{i + 1}. {st.title}</p>
                    <p className="text-xs text-muted-foreground">{st.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </details>
        </div>
        <PicksExplorer key={horizon.key} picks={picks} horizon={horizon} sparks={sparks} />
      </section>
    </div>
  );
}
