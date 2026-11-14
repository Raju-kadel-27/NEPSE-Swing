export const num = (n: number | null | undefined, digits = 1) =>
  n == null || !Number.isFinite(n) ? "–" : n.toLocaleString("en-IN", { maximumFractionDigits: digits });

export const signedPct = (n: number, digits = 2) => `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;

export const pctFrom = (to: number, from: number) => (to / from - 1) * 100;

// Nepali convention: lakh (1e5) and crore (1e7).
export const npr = (n: number | null | undefined) => {
  if (n == null) return "–";
  if (n >= 1e7) return `Rs ${num(n / 1e7, 2)} cr`;
  if (n >= 1e5) return `Rs ${num(n / 1e5, 1)} lakh`;
  return `Rs ${num(n, 0)}`;
};

export const longDate = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
