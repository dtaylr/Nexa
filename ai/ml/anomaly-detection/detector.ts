/**
 * Isolation Forest Anomaly Detector
 * Applied to 1Platform finance domain: detects anomalous
 * transactions using unsupervised learning no labelled
 * fraud data required.
 *
 * Key insight: anomalies are isolated in fewer random
 * partitioning steps than normal points. Average path
 * length across the forest gives the anomaly score.
 */

export interface TransactionFeatures {
  amount: number;
  hourOfDay: number;       // 0–23
  dayOfWeek: number;       // 0=Mon … 6=Sun
  accountVelocity24h: number; // tx count last 24h
  amountZScore: number;    // (amount - accountMean) / accountStdDev
  isWeekend: boolean;
}

//  Internal tree types 

interface InternalNode {
  kind: 'internal';
  featureIndex: number;
  splitValue: number;
  left: TreeNode;
  right: TreeNode;
}

interface LeafNode {
  kind: 'leaf';
  size: number;
}

type TreeNode = InternalNode | LeafNode;

//  Core algorithm 

const EULER_MASCHERONI = 0.5772156649;

function c(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + EULER_MASCHERONI) - 2 * (n - 1) / n;
}

/** Reproducible LCG random number generator seeded at training time. */
function makeLcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return (s >>> 0) / 0x100000000;
  };
}

function buildTree(
  samples: number[][],
  depth: number,
  maxDepth: number,
  rng: () => number
): TreeNode {
  if (samples.length <= 1 || depth >= maxDepth) {
    return { kind: 'leaf', size: samples.length };
  }

  const numFeatures = samples[0].length;
  const fi = Math.floor(rng() * numFeatures);
  const values = samples.map(s => s[fi]);
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) return { kind: 'leaf', size: samples.length };

  const split = min + rng() * (max - min);
  return {
    kind: 'internal',
    featureIndex: fi,
    splitValue: split,
    left: buildTree(samples.filter(s => s[fi] < split), depth + 1, maxDepth, rng),
    right: buildTree(samples.filter(s => s[fi] >= split), depth + 1, maxDepth, rng),
  };
}

function pathLength(node: TreeNode, point: number[], depth: number): number {
  if (node.kind === 'leaf') return depth + c(node.size);
  return point[node.featureIndex] < node.splitValue
    ? pathLength(node.left, point, depth + 1)
    : pathLength(node.right, point, depth + 1);
}

// iso Forest
export class IsolationForest {
  private trees: TreeNode[] = [];
  private trainedSampleSize = 0;

  constructor(
    readonly numTrees = 100,
    readonly maxSamples = 256,
    /** Estimated proportion of outliers in the db */
    readonly contamination = 0.10
  ) {}

  train(data: number[][], seed = 42): void {
    const sampleSize = Math.min(this.maxSamples, data.length);
    this.trainedSampleSize = sampleSize;
    const maxDepth = Math.ceil(Math.log2(sampleSize));
    const rng = makeLcg(seed);

    this.trees = Array.from({ length: this.numTrees }, () => {
      const sub: number[][] = [];
      for (let i = 0; i < sampleSize; i++) {
        sub.push(data[Math.floor(rng() * data.length)]);
      }
      return buildTree(sub, 0, maxDepth, rng);
    });
  }

  /**
   * Anomaly score in [0, 1].
   * score > 0.5 → likely anomaly; closer to 1 → more anomalous.
   */
  score(point: number[]): number {
    if (this.trees.length === 0) throw new Error('Forest not trained');
    const avgLen = this.trees.reduce((s, t) => s + pathLength(t, point, 0), 0) / this.trees.length;
    return Math.pow(2, -avgLen / c(this.trainedSampleSize));
  }

  /** Threshold derived from contamination rate. */
  get threshold(): number {
    return 0.5 + this.contamination * 0.5;
  }
}

/**
 * Cyclic encoding (sin/cos) for time features so midnight ↔ 23:00
 * are neighbours in feature space.
 */
export class TransactionFeatureExtractor {
  extract(f: TransactionFeatures): number[] {
    return [
      Math.log1p(f.amount) / 12,                     // log-scale, cap ~$160k
      Math.sin(2 * Math.PI * f.hourOfDay / 24),       // cyclic hour
      Math.cos(2 * Math.PI * f.hourOfDay / 24),
      Math.sin(2 * Math.PI * f.dayOfWeek / 7),        // cyclic DOW
      Math.cos(2 * Math.PI * f.dayOfWeek / 7),
      Math.min(f.accountVelocity24h / 20, 1),          // saturate at 20 tx/day
      Math.tanh(f.amountZScore / 3),                   // tanh squash z-score
      f.isWeekend ? 1 : 0,
    ];
  }
}

//  Highlvl API 

export interface AnomalyResult {
  score: number;
  isAnomaly: boolean;
  explanation: string;
  features: TransactionFeatures;
}

export class AnomalyDetector {
  private forest = new IsolationForest(100, 256, 0.10);
  private extractor = new TransactionFeatureExtractor();
  private ready = false;

  /** Train on a representative sample of normal transactions. */
  fit(transactions: TransactionFeatures[]): this {
    const vectors = transactions.map(t => this.extractor.extract(t));
    this.forest.train(vectors);
    this.ready = true;
    return this;
  }

  predict(tx: TransactionFeatures): AnomalyResult {
    if (!this.ready) throw new Error('Call fit() before predict()');
    const vec = this.extractor.extract(tx);
    const score = this.forest.score(vec);
    return {
      score,
      isAnomaly: score > this.forest.threshold,
      explanation: this.buildExplanation(tx, score),
      features: tx,
    };
  }

  /** Batch prediction (sorted descending by anomaly score. )*/
  predictBatch(transactions: TransactionFeatures[]): AnomalyResult[] {
    return transactions
      .map(t => this.predict(t))
      .sort((a, b) => b.score - a.score);
  }

  get isTrained(): boolean {
    return this.ready;
  }

  private buildExplanation(f: TransactionFeatures, score: number): string {
    const signals: string[] = [];
    if (f.amountZScore > 2.5) signals.push('amount >> account average');
    if (f.accountVelocity24h > 10) signals.push('velocity spike (>10 tx/24h)');
    if (f.hourOfDay >= 1 && f.hourOfDay <= 5) signals.push('off-hours (1–5 am)');
    if (f.amount > 10_000) signals.push('large amount (>$10k)');
    const base = `score=${score.toFixed(3)}`;
    return signals.length ? `${base} — ${signals.join('; ')}` : `${base} — no dominant signal`;
  }
}
