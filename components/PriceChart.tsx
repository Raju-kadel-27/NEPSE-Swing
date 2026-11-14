"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";

export type ChartPoint = { date: string; close: number; sma50: number | null; sma200: number | null };

export function PriceChart({ data, stopLoss, target }: { data: ChartPoint[]; stopLoss: number; target: number }) {
  return (
    <div className="h-72 w-full min-w-0">
      <LineChart responsive style={{ width: "100%", height: "100%" }} data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} minTickGap={40} tickFormatter={(d: string) => d.slice(5)} />
          <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} width={48} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }} />
          <ReferenceLine ifOverflow="extendDomain" y={target} stroke="var(--good)" strokeDasharray="4 4" label={{ value: "Target", fill: "var(--good)", fontSize: 11, position: "insideTopLeft" }} />
          <ReferenceLine ifOverflow="extendDomain" y={stopLoss} stroke="var(--bad)" strokeDasharray="4 4" label={{ value: "Stop", fill: "var(--bad)", fontSize: 11, position: "insideBottomLeft" }} />
          <Line type="monotone" dataKey="close" name="Close" stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
          <Line type="monotone" dataKey="sma50" name="50-day avg" stroke="var(--ok)" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
          <Line type="monotone" dataKey="sma200" name="200-day avg" stroke="var(--muted)" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
      </LineChart>
    </div>
  );
}
