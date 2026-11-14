"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { shortDay } from "@/lib/market";
import type { Pick } from "@/lib/types";
import { ScoreBadge, ScoreBar } from "./ScoreBar";

const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 1 });

function PickCard({ p, rank }: { p: Pick; rank: number }) {
  const upside = ((p.target / p.price - 1) * 100).toFixed(0);
  const downside = ((1 - p.stopLoss / p.price) * 100).toFixed(0);
  return (
    <Link href={`/stock/${p.symbol}`} className="block rounded-xl border border-line bg-surface p-4 hover:border-accent transition-colors">
      <div className="flex gap-4">
        <ScoreBadge score={p.total} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xs text-muted">#{rank}</span>
            <span className="font-semibold">{p.symbol}</span>
            <span className="text-sm text-muted truncate">{p.name}</span>
          </div>
          <div className="text-xs text-muted">{p.sector}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="tabular-nums font-medium">Rs {fmt(p.price)}</span>
            <span className={`text-xs tabular-nums ${p.changePct >= 0 ? "text-good" : "text-bad"}`}>
              {p.changePct >= 0 ? "+" : ""}{p.changePct.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        <ScoreBar label="Fundamental" score={p.fundamental} />
        <ScoreBar label="Technical" score={p.technical} />
        <ScoreBar label="Risk / liquidity" score={p.risk} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-bg p-2">
          <div className="text-muted">Buy zone</div>
          <div className="tabular-nums font-medium">{fmt(p.entryLow)}–{fmt(p.entryHigh)}</div>
        </div>
        <div className="rounded-lg bg-bad-soft p-2">
          <div className="text-bad">Stop-loss</div>
          <div className="tabular-nums font-medium">{fmt(p.stopLoss)} <span className="text-muted">−{downside}%</span></div>
        </div>
        <div className="rounded-lg bg-good-soft p-2">
          <div className="text-good">Target</div>
          <div className="tabular-nums font-medium">{fmt(p.target)} <span className="text-muted">+{upside}%</span></div>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        Buy {shortDay(p.buyDate)} · can sell from {shortDay(p.sellableFrom)}
        {p.lockMovePct !== null && <> · typical move until then ±{p.lockMovePct}%</>}
      </p>

      {p.reasons.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {p.reasons.slice(0, 3).map((r) => <li key={r} className="flex gap-2"><span className="text-good">✓</span>{r}</li>)}
        </ul>
      )}
      {p.flags.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {p.flags.slice(0, 2).map((f) => <li key={f} className="flex gap-2 text-ok"><span>!</span>{f}</li>)}
        </ul>
      )}
    </Link>
  );
}

export function PicksBoard({ picks }: { picks: Pick[] }) {
  const sectors = useMemo(() => ["All", ...new Set(picks.map((p) => p.sector))], [picks]);
  const [sector, setSector] = useState("All");
  const [showAll, setShowAll] = useState(false);

  const shown = picks.filter((p) => sector === "All" || p.sector === sector);
  const top = shown.filter((p) => !p.excluded && p.total >= 55);
  const rest = shown.filter((p) => p.excluded || p.total < 55);

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        {sectors.map((s) => (
          <button
            key={s}
            onClick={() => setSector(s)}
            className={`shrink-0 rounded-full border px-3 py-1 text-sm ${s === sector ? "border-accent bg-accent text-white" : "border-line bg-surface text-muted hover:text-fg"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {top.length === 0 ? (
        <p className="mt-6 text-muted">No stock in this sector meets the bar right now.</p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {top.map((p) => <PickCard key={p.symbol} p={p} rank={picks.indexOf(p) + 1} />)}
        </div>
      )}

      {rest.length > 0 && (
        <div className="mt-8">
          <button onClick={() => setShowAll(!showAll)} className="text-sm text-accent">
            {showAll ? "Hide" : "Show"} {rest.length} stocks to avoid for now
          </button>
          {showAll && (
            <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted text-left">
                  <tr><th className="p-3">Stock</th><th className="p-3">Score</th><th className="p-3">Main concern</th></tr>
                </thead>
                <tbody>
                  {rest.map((p) => (
                    <tr key={p.symbol} className="border-t border-line">
                      <td className="p-3"><Link href={`/stock/${p.symbol}`} className="font-medium hover:text-accent">{p.symbol}</Link></td>
                      <td className="p-3 tabular-nums">{p.total}</td>
                      <td className="p-3 text-muted">{p.flags[0] ?? "Weak overall score"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
