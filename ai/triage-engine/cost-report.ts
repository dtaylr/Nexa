import fs from 'fs';
import path from 'path';

interface RunRecord {
  date: string;
  totalTests: number;
  defectsCaught: number;
  durationMs: number;
}

// GitHub Actions free tier: 2000 min/month for public repos = £0
// Compute cost estimate based on runner minutes (ubuntu-latest ≈ £0.008/min)
const COST_PER_RUNNER_MINUTE = 0.008;

function estimateCost(durationMs: number, parallelRunners: number): number {
  const minutes = (durationMs / 1000 / 60) * parallelRunners;
  return minutes * COST_PER_RUNNER_MINUTE;
}

function loadHistory(): RunRecord[] {
  const histPath = path.join(process.cwd(), 'artifacts', 'run-history.json');
  if (!fs.existsSync(histPath)) return [];
  return JSON.parse(fs.readFileSync(histPath, 'utf-8'));
}

function report() {
  const history = loadHistory();

  if (!history.length) {
    console.log('\nNo run history found. CI cost report will populate after first full pipeline run.\n');
    return;
  }

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthRuns = history.filter(r => r.date.startsWith(thisMonth));

  const totalRuns = monthRuns.length;
  const totalDefects = monthRuns.reduce((s, r) => s + r.defectsCaught, 0);
  const totalCost = monthRuns.reduce((s, r) => s + estimateCost(r.durationMs, 6), 0);
  const costPerDefect = totalDefects > 0 ? totalCost / totalDefects : 0;

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  NexaCore — CI Cost Report');
  console.log(`  Month: ${thisMonth}`);
  console.log('═══════════════════════════════════════════════════\n');
  console.log(`  Total runs this month : ${totalRuns}`);
  console.log(`  Defects caught        : ${totalDefects}`);
  console.log(`  Estimated CI cost     : £${totalCost.toFixed(2)}`);
  console.log(`  Cost per defect       : £${costPerDefect.toFixed(2)}`);
  console.log('\n  Note: GitHub Actions public repo = free tier (2000 min/month)');
  console.log('  Costs above are estimates for private repo billing reference.\n');

  const reportPath = path.join(process.cwd(), 'artifacts', 'cost-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({
    month: thisMonth,
    totalRuns,
    totalDefects,
    estimatedCostGBP: parseFloat(totalCost.toFixed(2)),
    costPerDefectGBP: parseFloat(costPerDefect.toFixed(2)),
  }, null, 2));
}

report();
