import { describe, it, expect } from 'vitest';
import { FlakinessPredictor, type TestRun } from '../flakiness-predictor/predictor';

function makeRun(
  testId: string,
  passed: boolean,
  daysAgo: number,
  overrides: Partial<TestRun> = {}
): TestRun {
  const runAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return {
    testId,
    domain: 'finance',
    file: `tests/finance/${testId}.spec.ts`,
    passed,
    durationMs: 200 + Math.floor(Math.random() * 100),
    runAt,
    ...overrides,
  };
}

describe('FlakinessPredictor', () => {
  const predictor = new FlakinessPredictor();

  describe('analyze()', () => {
    it('throws on empty history', () => {
      expect(() => predictor.analyze([])).toThrow('empty history');
    });

    it('healthy test has low flakiness score', () => {
      const history = Array.from({ length: 20 }, (_, i) =>
        makeRun('always-passes', true, i)
      );
      const report = predictor.analyze(history);
      expect(report.flakinessScore).toBeLessThan(0.2);
      expect(report.recommendation).toBe('healthy');
    });

    it('always-failing test has low flakiness but consecutive failure quarantine', () => {
      const history = Array.from({ length: 10 }, (_, i) =>
        makeRun('always-fails', false, i)
      );
      const report = predictor.analyze(history);
      // consecutiveFailures >= 3 → quarantine regardless of flakiness
      expect(report.recommendation).toBe('quarantine');
      expect(report.consecutiveFailures).toBeGreaterThanOrEqual(3);
    });

    it('alternating pass/fail test has high flakiness score', () => {
      const history = Array.from({ length: 20 }, (_, i) =>
        makeRun('alternating', i % 2 === 0, i * 0.5)
      );
      const report = predictor.analyze(history);
      expect(report.flakinessScore).toBeGreaterThan(0.5);
      expect(['quarantine', 'investigate']).toContain(report.recommendation);
    });

    it('recent failures penalise more than old ones', () => {
      const recentFail = [
        ...Array.from({ length: 5 }, (_, i) => makeRun('t1', true, i + 5)),
        ...Array.from({ length: 5 }, (_, i) => makeRun('t1', false, i)),
      ];
      const oldFail = [
        ...Array.from({ length: 5 }, (_, i) => makeRun('t2', false, i + 5)),
        ...Array.from({ length: 5 }, (_, i) => makeRun('t2', true, i)),
      ];

      const r1 = predictor.analyze(recentFail);
      const r2 = predictor.analyze(oldFail);

      expect(r1.passRate).toBeLessThan(r2.passRate);
    });

    it('confidence increases with more runs', () => {
      const few = Array.from({ length: 3 }, (_, i) => makeRun('sparse', true, i));
      const many = Array.from({ length: 30 }, (_, i) => makeRun('rich', true, i));

      expect(predictor.analyze(few).confidence).toBeLessThan(predictor.analyze(many).confidence);
    });

    it('detects environment correlation when failures cluster on one shard', () => {
      const history: TestRun[] = [
        ...Array.from({ length: 8 }, (_, i) =>
          makeRun('shard-flaky', false, i, { shard: 2, environment: 'shard-2' })
        ),
        ...Array.from({ length: 8 }, (_, i) =>
          makeRun('shard-flaky', true, i, { shard: 1, environment: 'shard-1' })
        ),
      ];
      const report = predictor.analyze(history);
      expect(report.environmentCorrelation).toBe('shard-2');
    });

    it('returns null environmentCorrelation when failures are spread evenly', () => {
      const history: TestRun[] = [
        ...Array.from({ length: 5 }, (_, i) =>
          makeRun('even', i % 2 === 0, i, { environment: 'shard-1' })
        ),
        ...Array.from({ length: 5 }, (_, i) =>
          makeRun('even', i % 2 === 0, i, { environment: 'shard-2' })
        ),
      ];
      const report = predictor.analyze(history);
      expect(report.environmentCorrelation).toBeNull();
    });

    it('timingCv is high for a test with wildly variable duration', () => {
      const history = [100, 900, 120, 850, 110, 870].map((ms, i) => ({
        ...makeRun('timing-variable', true, i),
        durationMs: ms,
      }));
      const report = predictor.analyze(history);
      expect(report.timingCv).toBeGreaterThan(0.5);
    });
  });

  describe('analyzeAll()', () => {
    it('groups runs by testId and returns sorted results', () => {
      const runs: TestRun[] = [
        ...Array.from({ length: 10 }, (_, i) => makeRun('stable', true, i)),
        ...Array.from({ length: 10 }, (_, i) => makeRun('flaky', i % 2 === 0, i)),
      ];
      const reports = predictor.analyzeAll(runs);
      expect(reports).toHaveLength(2);
      // flaky should be first (sorted by score descending)
      expect(reports[0].testId).toBe('flaky');
    });
  });

  describe('quarantineList()', () => {
    it('returns only tests needing quarantine', () => {
      const runs: TestRun[] = [
        ...Array.from({ length: 10 }, (_, i) => makeRun('healthy-test', true, i)),
        ...Array.from({ length: 5 }, (_, i) => makeRun('broken-test', false, i)), // consecutive
      ];
      const quarantined = predictor.quarantineList(runs);
      expect(quarantined.every(r => r.recommendation === 'quarantine')).toBe(true);
      expect(quarantined.map(r => r.testId)).toContain('broken-test');
    });
  });
});
