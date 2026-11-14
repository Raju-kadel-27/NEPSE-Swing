// Linear 0-100 score: `bad` maps to 0, `good` to 100 (works in either direction), clamped.
export function scale(x: number, bad: number, good: number): number {
  const t = (x - bad) / (good - bad);
  return Math.max(0, Math.min(100, t * 100));
}

export type Component = { score: number; weight: number };

export function weighted(parts: Component[]): number {
  const w = parts.reduce((a, p) => a + p.weight, 0);
  return w === 0 ? 0 : parts.reduce((a, p) => a + p.score * p.weight, 0) / w;
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
export const r1 = (x: number) => Math.round(x * 10) / 10;
