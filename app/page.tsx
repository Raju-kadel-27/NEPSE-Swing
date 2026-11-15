import { CircleDollarSign, ListChecks, ShieldCheck, TriangleAlert } from "lucide-react";
import { Suspense } from "react";
import { HorizonPicker } from "@/components/horizon-picker";
import { PicksExplorer } from "@/components/picks/picks-explorer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { getDataSource, getPicks } from "@/lib/data";
import { longDate } from "@/lib/format";
import { daysToExit, type Horizon, parseHorizon } from "@/lib/horizon";
import { shortDay, tradeWindow } from "@/lib/market";
import { isBuyableToday } from "@/lib/scoring";

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
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-12 w-full max-w-2xl" />
      </div>
      <Skeleton className="h-10 w-full max-w-lg" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-80 rounded-xl" />)}
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
  const [ds, picks] = await Promise.all([getDataSource(), getPicks(horizon.key)]);
  const buyToday = picks.filter(isBuyableToday).length;
  const up = picks.filter((p) => p.changePct > 0).length;
  const down = picks.filter((p) => p.changePct < 0).length;
  const { buyDate } = tradeWindow(ds.asOf);
  const exitDays = daysToExit(horizon);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-sm font-medium text-primary">For {shortDay(buyDate)} · based on {longDate(ds.asOf)} closing prices</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {buyToday > 0 ? <>{buyToday} NEPSE stocks worth buying for {horizon.label}</> : <>No stocks at a good buying price for {horizon.label}</>}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          We check every listed company&apos;s results, price trend and trading volume, then tell you which ones are at a good price to buy,
          where to buy, and when to sell. Choose how long you plan to hold and the picks, targets and stops adjust to it.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 pt-1 text-sm text-muted-foreground">
          <span>{picks.length} stocks checked</span>
          <span>
            Market today: <span className="font-medium text-success">{up} up</span> · <span className="font-medium text-destructive">{down} down</span>
          </span>
        </div>
      </section>

      <HorizonPicker current={horizon} />

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

      <section aria-label="How to use these picks" className="grid grid-cols-1 divide-y rounded-xl border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {steps(horizon).map((s, i) => (
          <div key={s.title} className="flex gap-3 p-3 sm:p-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <s.icon className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold"><span className="text-muted-foreground">{i + 1}.</span> {s.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{s.text}</p>
            </div>
          </div>
        ))}
      </section>

      <PicksExplorer key={horizon.key} picks={picks} horizon={horizon} />
    </div>
  );
}
