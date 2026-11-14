export function tone(score: number) {
  return score >= 70 ? "good" : score >= 55 ? "ok" : "bad";
}

const fill = { good: "bg-good", ok: "bg-ok", bad: "bg-bad" };

export function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-muted">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-line overflow-hidden">
        <div className={`h-full rounded-full ${fill[tone(score)]}`} style={{ width: `${score}%` }} />
      </div>
      <span className="w-7 text-right tabular-nums">{score}</span>
    </div>
  );
}

const badge = { good: "bg-good-soft text-good", ok: "bg-ok-soft text-ok", bad: "bg-bad-soft text-bad" };

export function ScoreBadge({ score, size = "md" }: { score: number; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "text-3xl w-20 h-20" : "text-xl w-14 h-14";
  return (
    <div className={`${badge[tone(score)]} ${cls} rounded-xl flex items-center justify-center font-semibold tabular-nums shrink-0`}>
      {score}
    </div>
  );
}
