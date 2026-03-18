import { describe, it, expect, beforeAll } from 'vitest';
import {
  AnomalyDetector,
  IsolationForest,
  TransactionFeatureExtractor,
  type TransactionFeatures,
} from '../anomaly-detection/detector';

//  Fixtures 

function normalTx(overrides: Partial<TransactionFeatures> = {}): TransactionFeatures {
  return {
    amount: 120,
    hourOfDay: 14,
    dayOfWeek: 2,
    accountVelocity24h: 2,
    amountZScore: 0.3,
    isWeekend: false,
    ...overrides,
  };
}

function anomalousTx(overrides: Partial<TransactionFeatures> = {}): TransactionFeatures {
  return {
    amount: 45_000,
    hourOfDay: 3,
    dayOfWeek: 6,
    accountVelocity24h: 18,
    amountZScore: 7.2,
    isWeekend: true,
    ...overrides,
  };
}

function generateNormalDataset(n: number): TransactionFeatures[] {
  return Array.from({ length: n }, (_, i) => ({
    amount: 50 + (i % 400),
    hourOfDay: 9 + (i % 9),
    dayOfWeek: i % 5,
    accountVelocity24h: 1 + (i % 4),
    amountZScore: ((i % 10) - 5) / 5,
    isWeekend: false,
  }));
}

//  IsolationForest unit tests 

describe('IsolationForest', () => {
  it('scores a point in a dense cluster higher than 0 and below threshold', () => {
    const forest = new IsolationForest(50, 64, 0.05);
    const data = generateNormalDataset(200).map(t =>
      new TransactionFeatureExtractor().extract(t)
    );
    forest.train(data);

    const normalVec = new TransactionFeatureExtractor().extract(normalTx());
    const score = forest.score(normalVec);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(forest.threshold);
  });

  it('scores an outlier above the threshold', () => {
    const forest = new IsolationForest(100, 128, 0.05);
    const data = generateNormalDataset(300).map(t =>
      new TransactionFeatureExtractor().extract(t)
    );
    forest.train(data);

    const outlierVec = new TransactionFeatureExtractor().extract(anomalousTx());
    const score = forest.score(outlierVec);
    expect(score).toBeGreaterThanOrEqual(forest.threshold);
  });

  it('produces deterministic scores with the same seed', () => {
    const data = generateNormalDataset(200).map(t =>
      new TransactionFeatureExtractor().extract(t)
    );
    const f1 = new IsolationForest(50, 64);
    const f2 = new IsolationForest(50, 64);
    f1.train(data, 123);
    f2.train(data, 123);

    const point = new TransactionFeatureExtractor().extract(normalTx());
    expect(f1.score(point)).toBe(f2.score(point));
  });

  it('throws if score() called before train()', () => {
    const forest = new IsolationForest();
    expect(() => forest.score([1, 2, 3])).toThrow('not trained');
  });

  it('threshold is 0.5 when contamination is 0', () => {
    const forest = new IsolationForest(10, 64, 0);
    expect(forest.threshold).toBe(0.5);
  });
});

//  TransactionFeatureExtractor 

describe('TransactionFeatureExtractor', () => {
  const extractor = new TransactionFeatureExtractor();

  it('produces a vector of length 8', () => {
    expect(extractor.extract(normalTx())).toHaveLength(8);
  });

  it('all values are bounded to a sensible range', () => {
    const vec = extractor.extract(anomalousTx());
    for (const v of vec) {
      expect(v).toBeGreaterThanOrEqual(-1.5);
      expect(v).toBeLessThanOrEqual(1.5);
    }
  });

  it('midnight and 23:00 are close in cyclic encoding', () => {
    const midnight = extractor.extract(normalTx({ hourOfDay: 0 }));
    const eleven = extractor.extract(normalTx({ hourOfDay: 23 }));
    const midday = extractor.extract(normalTx({ hourOfDay: 12 }));

    const euclidean = (a: number[], b: number[]) =>
      Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));

    // 0:00 and 23:00 should be closer than 0:00 and 12:00
    expect(euclidean(midnight, eleven)).toBeLessThan(euclidean(midnight, midday));
  });
});

//  AnomalyDetector (integration) 

describe('AnomalyDetector', () => {
  let detector: AnomalyDetector;
  const training = generateNormalDataset(400);

  beforeAll(() => {
    detector = new AnomalyDetector();
    detector.fit(training);
  });

  it('isTrained is true after fit()', () => {
    expect(detector.isTrained).toBe(true);
  });

  it('classifies normal transaction as non-anomaly', () => {
    const result = detector.predict(normalTx());
    expect(result.isAnomaly).toBe(false);
    expect(result.score).toBeLessThan(0.55);
  });

  it('classifies off-hours large transfer as anomaly', () => {
    const result = detector.predict(anomalousTx());
    expect(result.isAnomaly).toBe(true);
    expect(result.score).toBeGreaterThan(0.5);
  });

  it('explanation mentions amount signal for high z-score', () => {
    const result = detector.predict(anomalousTx({ amountZScore: 8 }));
    expect(result.explanation).toMatch(/amount >> account average/);
  });

  it('explanation mentions velocity spike for high tx count', () => {
    const result = detector.predict(anomalousTx({ accountVelocity24h: 15 }));
    expect(result.explanation).toMatch(/velocity spike/);
  });

  it('predictBatch returns results sorted by score descending', () => {
    const batch = [normalTx(), anomalousTx(), normalTx({ amount: 200 })];
    const results = detector.predictBatch(batch);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('throws if predict() called before fit()', () => {
    const fresh = new AnomalyDetector();
    expect(() => fresh.predict(normalTx())).toThrow('fit()');
  });
});
