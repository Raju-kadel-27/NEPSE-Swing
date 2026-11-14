import { PicksBoard } from "@/components/PicksBoard";
import { getDataSource } from "@/lib/data";
import { rankStocks } from "@/lib/scoring";

export default async function Home() {
  const picks = rankStocks(await getDataSource());
  const strong = picks.filter((p) => !p.excluded && p.total >= 70).length;
  const watch = picks.filter((p) => !p.excluded && p.total >= 55 && p.total < 70).length;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Top picks for a 2-3 month hold</h1>
      <p className="mt-1 text-sm text-muted max-w-2xl">
        Each stock is scored 0-100 from its latest quarterly report (40%), price trend and momentum (35%) and liquidity and risk (25%).
        Click a stock to see why.
      </p>
      <div className="mt-4 flex flex-wrap gap-2 text-sm whitespace-nowrap">
        <span className="rounded-lg bg-good-soft text-good px-3 py-1">{strong} strong (70+)</span>
        <span className="rounded-lg bg-ok-soft text-ok px-3 py-1">{watch} watchlist (55-69)</span>
        <span className="rounded-lg bg-surface border border-line text-muted px-3 py-1">{picks.length} stocks scanned</span>
      </div>
      <div className="mt-6">
        <PicksBoard picks={picks} />
      </div>
    </div>
  );
}
