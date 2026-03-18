/**
 * Test Flakiness Predictor
 *
 * Models each test's pass rate as a Beta(α, β) random variable.
 * Flakiness peaks when the distribution centres near 0.5 — equal
 * chance of pass or fail.
 *
 * Recency weighting via exponential decay means a failure two
 * hours ago matters more than one from three weeks ago.
 *
 * Outputs actionable recommendations:
 *   quarantine  - remove from blocking suite immediately
 *   investigate - schedule a fix this sprint
 *   monitor - watch over next 5 runs
 *   healthy - no action needed
 */

export interface TestRun {
  testId: string
  domain: 'finance' | 'health' | 'commerce' | string;
  file: string;
  passed: boolean;
  durationMs: number;
  runAt: Date;
  shard?: number;
  environment?: string;
}

export interface FlakinessReport {
  testId: string;
  domain: string;
  file: string;
  flakinessScore: number;        // 0..1, higher = flakier
  passRate: number;              // recency-weighted pass rate
  timingCv: number;              // coefficient of variation (duration)
  consecutiveFailures: number;
  recommendation: 'quarantine' | 'investigate' | 'monitor' | 'healthy';
  confidence: number;            // 0..1, low if few samples
  totalRuns: number;
  environmentCorrelation: string | null; // env where failures cluster, if any
}

// Statistical helpers 

/** Exponential decay weight — half-life defaults to 7 days. */
function decayWeight(ageMs: number, halfLifeMs = 7 * 24 * 60 * 60 * 1000): number {
  return Math.exp((-Math.LN2 * ageMs) / halfLifeMs);
}

/** Beta distribution mean and standard deviation. */
function betaStats(alpha: number, beta: number) {
  const n = alpha + beta;
  const mean = alpha / n;
  const variance = (alpha * beta) / (n * n * (n + 1));
  return { mean, stdDev: Math.sqrt(variance) };
}

/** Sample coefficient of variation (stdDev / mean). */
function cv(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

//  Predictor 
export class FlakinessPredictor {
  private readonly minRunsForConfidence = 5;

  analyze(history: TestRun[]): FlakinessReport {
    if (history.length === 0) throw new Error('Cannot analyse empty history');

    const now = Date.now();
    const sorted = [...history].sort((a, b) => b.runAt.getTime() - a.runAt.getTime());

    // Beta distribution parameters — Laplace smoothing avoids extremes
    let α = 1;
    let β = 1;
    for (const run of sorted) {
      const w = decayWeight(now - run.runAt.getTime());
      if (run.passed) α += w;
      else β += w;
    }

    const { mean: passRate, stdDev } = betaStats(α, β);

    // Flakiness: symmetric around 0.5, boosted by high variance
    const baseFlakiness = 1 - Math.abs(2 * passRate - 1);
    const varianceBoost = Math.min(stdDev * 4, 0.25);
    const flakinessScore = Math.min(baseFlakiness + varianceBoost, 1);

    // Timing instability
    const timingCv = cv(history.map(r => r.durationMs));

    // Consecutive failures from most recent
    let consecutiveFailures = 0;
    for (const run of sorted) {
      if (!run.passed) consecutiveFailures++;
      else break;
    }

    // Environment correlation: do failures cluster in one env/shard?
    const environmentCorrelation = this.detectEnvironmentCorrelation(sorted);

    const confidence = Math.min(history.length / (this.minRunsForConfidence * 2), 1);

    return {
      testId: history[0].testId,
      domain: history[0].domain,
      file: history[0].file,
      flakinessScore,
      passRate,
      timingCv,
      consecutiveFailures,
      recommendation: this.recommend(flakinessScore, consecutiveFailures, history.length),
      confidence,
      totalRuns: history.length,
      environmentCorrelation,
    };
  }

  analyzeAll(runs: TestRun[]): FlakinessReport[] {
    const byTest = new Map<string, TestRun[]>();
    for (const run of runs) {
      const g = byTest.get(run.testId) ?? [];
      g.push(run);
      byTest.set(run.testId, g);
    }
    return Array.from(byTest.values())
      .map(h => this.analyze(h))
      .sort((a, b) => b.flakinessScore - a.flakinessScore);
  }

  /** Return tests that should be quarantined immediately. */
  quarantineList(runs: TestRun[]): FlakinessReport[] {
    return this.analyzeAll(runs).filter(r => r.recommendation === 'quarantine');
  }

  private recommend(
    flakinessScore: number,
    consecutiveFailures: number,
    totalRuns: number
  ): FlakinessReport['recommendation'] {
    if (consecutiveFailures >= 3) return 'quarantine';
    if (flakinessScore > 0.6 && totalRuns >= this.minRunsForConfidence) return 'quarantine';
    if (flakinessScore > 0.35) return 'investigate';
    if (flakinessScore > 0.15) return 'monitor';
    return 'healthy';
  }

  /**
   * Chi-square-inspired check: are failures significantly more common
   * in one environment/shard than others?
   */
  private detectEnvironmentCorrelation(sorted: TestRun[]): string | null {
    const failsByEnv = new Map<string, number>();
    const totalByEnv = new Map<string, number>();

    for (const run of sorted) {
      const env = run.environment ?? `shard-${run.shard ?? 0}`;
      totalByEnv.set(env, (totalByEnv.get(env) ?? 0) + 1);
      if (!run.passed) failsByEnv.set(env, (failsByEnv.get(env) ?? 0) + 1);
    }

    if (totalByEnv.size < 2) return null;

    const overallFailRate = sorted.filter(r => !r.passed).length / sorted.length;

    let worstEnv: string | null = null;
    let worstRatio = 1.5; // must be at least 50% above average to flag

    for (const [env, total] of totalByEnv.entries()) {
      if (total < 3) continue; // too few runs
      const envFailRate = (failsByEnv.get(env) ?? 0) / total;
      const ratio = overallFailRate > 0 ? envFailRate / overallFailRate : 0;
      if (ratio > worstRatio) {
        worstRatio = ratio;
        worstEnv = env;
      }
    }

    return worstEnv;
  }
}
