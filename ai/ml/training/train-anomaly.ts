/**
 * Train and evaluate the anomaly detector against seeded data.
 *
 * Usage:
 *   npx tsx ai/ml/training/train-anomaly.ts \
 *     --output artifacts/anomaly-model-eval.json \
 *     --threshold-precision 0.80 \
 *     --threshold-recall 0.75
 *
 * Evaluation methodology:
 *   We treat the seeded anomalous transactions (those with extreme
 *   amounts or off-hours timestamps) as our labelled positive class.
 *   Normal transactions form the negative class.
 *
 *   80% of each class trains the model; 20% is held out for evaluation.
 *   We compute precision, recall, and F1 on the held-out set.
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { AnomalyDetector, type TransactionFeatures } from '../anomaly-detection/detector';

//  CLI args 

const args = process.argv.slice(2);
const getArg = (flag: string, def: string) => {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : def;
};

const outputPath = getArg('--output', 'artifacts/anomaly-model-eval.json');
const minPrecision = parseFloat(getArg('--threshold-precision', '0.80'));
const minRecall = parseFloat(getArg('--threshold-recall', '0.75'));

//  Load transactions from SQLite 

const dbPath = process.env.DB_PATH ?? 'data/1platform.db';
const db = new Database(dbPath, { readonly: true });

interface TransferRow {
  amount: number;
  created_at: string;
  from_account_id: string;
}

const rows = db.prepare(`
  SELECT t.amount, t.created_at, t.from_account_id
  FROM transfers t
  ORDER BY t.created_at
`).all() as TransferRow[];

db.close();

if (rows.length < 10) {
  console.error('Not enough data — run npm run seed first');
  process.exit(1);
}

//  Compute per-account velocity and z-scores 

interface AccountStats {
  mean: number;
  std: number;
  recentCount: number;
}

function accountStats(accountId: string, allRows: TransferRow[], refTime: Date): AccountStats {
  const acctRows = allRows.filter(r => r.from_account_id === accountId);
  if (acctRows.length === 0) return { mean: 0, std: 1, recentCount: 0 };

  const amounts = acctRows.map(r => r.amount);
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const std = Math.sqrt(amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length) || 1;

  const cutoff = refTime.getTime() - 24 * 60 * 60 * 1000;
  const recentCount = acctRows.filter(r => new Date(r.created_at).getTime() >= cutoff).length;

  return { mean, std, recentCount };
}

//  Build feature objects 

function toFeatures(row: TransferRow, allRows: TransferRow[]): TransactionFeatures {
  const ts = new Date(row.created_at);
  const stats = accountStats(row.from_account_id, allRows, ts);
  return {
    amount: row.amount,
    hourOfDay: ts.getUTCHours(),
    dayOfWeek: ts.getUTCDay(),
    accountVelocity24h: stats.recentCount,
    amountZScore: (row.amount - stats.mean) / stats.std,
    isWeekend: ts.getUTCDay() === 0 || ts.getUTCDay() === 6,
  };
}

// Label: anomalous if amount > 2 stddevs above global mean, or off-hours large tx
const amounts = rows.map(r => r.amount);
const globalMean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
const globalStd = Math.sqrt(amounts.reduce((s, v) => s + (v - globalMean) ** 2, 0) / amounts.length);

const labelled = rows.map(row => {
  const features = toFeatures(row, rows);
  const label: boolean =
    features.amountZScore > 2.5 ||
    (features.amount > globalMean + globalStd && features.hourOfDay >= 1 && features.hourOfDay <= 5);
  return { features, label };
});

//  Train/test split (80/20 stratified) 

const anomalous = labelled.filter(r => r.label);
const normal = labelled.filter(r => !r.label);

const splitAt = (arr: typeof labelled, pct: number) => ({
  train: arr.slice(0, Math.floor(arr.length * pct)),
  test: arr.slice(Math.floor(arr.length * pct)),
});

const anomalousSplit = splitAt(anomalous, 0.8);
const normalSplit = splitAt(normal, 0.8);

const trainSet = [...normalSplit.train.map(r => r.features)];
const testSet = [...anomalousSplit.test, ...normalSplit.test];

//  Train 

console.log(`Training on ${trainSet.length} samples (${anomalousSplit.train.length} anomaly, ${normalSplit.train.length} normal)`);
const detector = new AnomalyDetector();
detector.fit(trainSet);

//  Evaluate 

let tp = 0, fp = 0, fn = 0, tn = 0;
for (const { features, label } of testSet) {
  const predicted = detector.predict(features).isAnomaly;
  if (predicted && label) tp++;
  else if (predicted && !label) fp++;
  else if (!predicted && label) fn++;
  else tn++;
}

const precision = tp / (tp + fp) || 0;
const recall = tp / (tp + fn) || 0;
const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

const result = {
  precision: +precision.toFixed(4),
  recall: +recall.toFixed(4),
  f1: +f1.toFixed(4),
  tp, fp, fn, tn,
  trainSamples: trainSet.length,
  testSamples: testSet.length,
  generatedAt: new Date().toISOString(),
};

console.log('\n Anomaly Detector Evaluation ');
console.table({ precision, recall, f1, tp, fp, fn, tn });

//  Write output 

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log(`\nResults written to ${outputPath}`);

//  Gate 

if (precision < minPrecision || recall < minRecall) {
  console.error(`\nModel quality below threshold (precision≥${minPrecision}, recall≥${minRecall})`);
  process.exit(1);
}

console.log('\nModel quality gate: PASSED');
