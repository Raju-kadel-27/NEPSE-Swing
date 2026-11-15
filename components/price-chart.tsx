"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";

export type ChartPoint = { date: string; close: number; sma50: number | null; sma200: number | null };

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };

export function PriceChart({ data, stopLoss, target }: { data: ChartPoint[]; stopLoss: number; target: number }) {
  return (
    <div className="h-80 w-full min-w-0">
      <LineChart responsive style={{ width: "100%", height: "100%" }} data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={false} minTickGap={48} tickFormatter={(d: string) => d.slice(5)} />
        <YAxis domain={["auto", "auto"]} tick={axis} tickLine={false} axisLine={false} width={52} />
        <Tooltip
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" }}
          labelStyle={{ color: "var(--muted-foreground)" }}
        />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <ReferenceLine ifOverflow="extendDomain" y={target} stroke="var(--success)" strokeDasharray="4 4" label={{ value: "Target", fill: "var(--success)", fontSize: 11, position: "insideTopLeft" }} />
        <ReferenceLine ifOverflow="extendDomain" y={stopLoss} stroke="var(--destructive)" strokeDasharray="4 4" label={{ value: "Stop", fill: "var(--destructive)", fontSize: 11, position: "insideBottomLeft" }} />
        <Line type="monotone" dataKey="close" name="Close" stroke="var(--chart-1)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
        <Line type="monotone" dataKey="sma50" name="50-day avg" stroke="var(--chart-2)" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
        <Line type="monotone" dataKey="sma200" name="200-day avg" stroke="var(--chart-3)" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
      </LineChart>
    </div>
  );
}
