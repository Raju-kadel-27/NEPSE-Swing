// Nepali fiscal quarters (Shrawan-Ashad) and SEBON's ~30-day deadline for publishing quarterly results.

// Approximate Gregorian end of each Nepali quarter: Ashwin, Poush, Chaitra, Ashad (Q1-Q4).
const QUARTER_END: Record<1 | 2 | 3 | 4, [month: number, day: number]> = { 1: [10, 17], 2: [1, 14], 3: [4, 13], 4: [7, 16] };
export const REPORT_DAYS = 30;

export type QuarterRef = { fiscalYear: string; quarter: 1 | 2 | 3 | 4 };
export type ResultsStatus = "reported" | "pending" | "overdue" | "unknown";
export type ResultsInfo = {
  status: ResultsStatus;
  latest: string | null; // "Q4 082/83", the latest result we have
  expected: string; // "Q1 083/84", the latest quarter that has ended
  quarterEnd: string; due: string; // ISO dates
  daysLeft: number; // to the deadline; negative once past it
  inSeason: boolean; // inside the reporting window of the expected quarter
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const label = (q: QuarterRef) => `Q${q.quarter} ${q.fiscalYear}`;
const fy = (startBs: number) => `${String(startBs % 1000).padStart(3, "0")}/${String((startBs + 1) % 100).padStart(2, "0")}`;

// Gregorian end date of a quarter; fiscal year "083/84" starts mid-July 2026 (BS 2083 = AD 2026 + 57).
export function quarterEnd(q: QuarterRef): string {
  const startAd = 2000 + parseInt(q.fiscalYear.slice(0, 3), 10) - 57;
  const [m, d] = QUARTER_END[q.quarter];
  const year = q.quarter === 1 ? startAd : startAd + 1;
  return iso(new Date(Date.UTC(year, m - 1, d)));
}

// The latest quarter that has ended on or before `asOf`.
export function lastEndedQuarter(asOf: string): QuarterRef {
  const y = +asOf.slice(0, 4);
  const cands: QuarterRef[] = [];
  for (const startAd of [y - 2, y - 1, y]) for (const q of [1, 2, 3, 4] as const) cands.push({ fiscalYear: fy(startAd + 57), quarter: q });
  return cands.filter((c) => quarterEnd(c) <= asOf).sort((a, b) => quarterEnd(a).localeCompare(quarterEnd(b))).at(-1)!;
}

const order = (q: QuarterRef) => parseInt(q.fiscalYear.slice(0, 3), 10) * 4 + q.quarter;

export function resultsInfo(asOf: string, latest: { fiscalYear: string | null; quarter: number | null }): ResultsInfo {
  const expected = lastEndedQuarter(asOf);
  const end = quarterEnd(expected);
  const due = iso(new Date(Date.parse(end) + REPORT_DAYS * 86_400_000));
  const daysLeft = Math.round((Date.parse(due) - Date.parse(asOf)) / 86_400_000);
  const inSeason = daysLeft >= -7;
  const base = { expected: label(expected), quarterEnd: end, due, daysLeft, inSeason };
  const q = latest.quarter;
  if (!latest.fiscalYear || !q || q < 1 || q > 4) return { ...base, status: "unknown", latest: null };
  const have: QuarterRef = { fiscalYear: latest.fiscalYear, quarter: q as 1 | 2 | 3 | 4 };
  // More than one quarter behind means an earlier deadline was already missed.
  const gap = order(expected) - order(have);
  const status: ResultsStatus = gap <= 0 ? "reported" : gap === 1 && daysLeft >= 0 ? "pending" : "overdue";
  return { ...base, status, latest: label(have) };
}
