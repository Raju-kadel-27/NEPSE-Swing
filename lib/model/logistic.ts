import { FEATURE_KEYS, type Features } from "./features";

export type Model = {
  horizon: string; trainedAt: string; trainedOn: number; label: string;
  mean: number[]; std: number[]; weights: number[]; bias: number;
  // Walk-forward results; `useful` is false when the model doesn't beat the plain score, and the app then hides it.
  validation: { auc: number; brier: number; scoreAuc: number; baseBrier: number; n: number; calibration: { predicted: number; actual: number; n: number }[] };
  useful: boolean;
};

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const vec = (x: Features) => FEATURE_KEYS.map((k) => x[k]);

export function predict(m: Pick<Model, "mean" | "std" | "weights" | "bias">, x: Features): number {
  const v = vec(x);
  return sigmoid(m.bias + v.reduce((a, xi, i) => a + m.weights[i] * ((xi - m.mean[i]) / m.std[i]), 0));
}

// L2-regularised logistic regression by full-batch gradient descent on standardised features.
export function train(xs: Features[], ys: number[], { epochs = 400, lr = 0.3, l2 = 0.01 } = {}) {
  const X = xs.map(vec);
  const d = FEATURE_KEYS.length, n = X.length;
  const mean = Array.from({ length: d }, (_, j) => X.reduce((a, r) => a + r[j], 0) / n);
  const std = Array.from({ length: d }, (_, j) => Math.sqrt(X.reduce((a, r) => a + (r[j] - mean[j]) ** 2, 0) / n) || 1);
  const Z = X.map((r) => r.map((v, j) => (v - mean[j]) / std[j]));
  const w = new Array(d).fill(0);
  let b = Math.log((ys.reduce((a, y) => a + y, 0) + 1) / (n - ys.reduce((a, y) => a + y, 0) + 1));
  for (let e = 0; e < epochs; e++) {
    const g = new Array(d).fill(0);
    let gb = 0;
    for (let i = 0; i < n; i++) {
      const err = sigmoid(b + Z[i].reduce((a, z, j) => a + w[j] * z, 0)) - ys[i];
      gb += err;
      for (let j = 0; j < d; j++) g[j] += err * Z[i][j];
    }
    for (let j = 0; j < d; j++) w[j] -= lr * (g[j] / n + l2 * w[j]);
    b -= (lr * gb) / n;
  }
  return { mean, std, weights: w, bias: b };
}

// Area under the ROC curve: the chance a random winner is ranked above a random loser.
export function auc(scores: number[], ys: number[]): number {
  const idx = scores.map((s, i) => [s, ys[i]] as const).sort((a, b) => a[0] - b[0]);
  let rank = 0, posRanks = 0, pos = 0;
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j < idx.length && idx[j][0] === idx[i][0]) j++;
    const avg = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) if (idx[k][1] === 1) { posRanks += avg; pos++; }
    rank = j;
    i = j;
  }
  const neg = rank - pos;
  return pos && neg ? (posRanks - (pos * (pos + 1)) / 2) / (pos * neg) : 0.5;
}

export const brier = (ps: number[], ys: number[]) => ps.reduce((a, p, i) => a + (p - ys[i]) ** 2, 0) / (ps.length || 1);

// Predicted vs actual win rate in probability buckets.
export function calibration(ps: number[], ys: number[], edges = [0, 0.3, 0.4, 0.5, 0.6, 0.7, 1.01]) {
  return edges.slice(0, -1).map((lo, i) => {
    const sel = ps.map((p, k) => [p, ys[k]] as const).filter(([p]) => p >= lo && p < edges[i + 1]);
    const r2 = (x: number) => Math.round(x * 100) / 100;
    return { predicted: r2(sel.reduce((a, [p]) => a + p, 0) / (sel.length || 1)), actual: r2(sel.reduce((a, [, y]) => a + y, 0) / (sel.length || 1)), n: sel.length };
  }).filter((b) => b.n > 0);
}
