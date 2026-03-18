/**
 * Flakiness analysis over historical JUnit XML results.
 *
 * Usage:
 *   npx tsx ai/ml/training/evaluate-flakiness.ts \
 *     --results-dir results/ \
 *     --output artifacts/flakiness-report.json
 */

import fs from 'fs';
import path from 'path';
import { FlakinessPredictor, type TestRun } from '../flakiness-predictor/predictor';

const args = process.argv.slice(2);
const getArg = (flag: string, def: string) =>
  args[args.indexOf(flag) + 1] ?? def;

const resultsDir = getArg('--results-dir', 'results');
const outputPath = getArg('--output', 'artifacts/flakiness-report.json');

//  Parse JUnit XML into TestRun records 
function parseJUnit(filePath: string, domain: string): TestRun[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const runs: TestRun[] = [];

  // Extract individual attributes regardless of order (Vitest writes classname first,
  // other runners may differ — pull each attr independently).
  const testcaseRe = /<testcase([^>]*)>([\s\S]*?)<\/testcase>/g;
  const attrRe = (key: string) => new RegExp(`\\b${key}="([^"]*)"`);
  let match: RegExpExecArray | null;

  while ((match = testcaseRe.exec(content)) !== null) {
    const [, attrs, body] = match;
    const name      = attrRe('name').exec(attrs)?.[1] ?? '';
    const time      = attrRe('time').exec(attrs)?.[1] ?? '0';
    const classname = attrRe('classname').exec(attrs)?.[1] ?? '';
    const failed = body.includes('<failure') || body.includes('<error');
    runs.push({
      testId: `${classname}::${name}`,
      domain,
      file: classname.replace(/\./g, '/') + '.spec.ts',
      passed: !failed,
      durationMs: parseFloat(time) * 1000,
      runAt: new Date(), // JUnit doesn't carry wall-clock timestamps
    });
  }
  return runs;
}

//  Collect all domain results 

const allRuns: TestRun[] = [];
const domains = ['finance', 'health', 'commerce'];

for (const domain of domains) {
  // Support both the per-suite path (results/vitest/api-finance.junit.xml)
  // and the legacy nested path (results/api/finance/junit.xml).
  const perSuite = path.join(resultsDir, 'vitest', `api-${domain}.junit.xml`);
  const legacy   = path.join(resultsDir, 'api', domain, 'junit.xml');
  allRuns.push(...parseJUnit(fs.existsSync(perSuite) ? perSuite : legacy, domain));
}

if (allRuns.length === 0) {
  console.log('No test result files found — skipping flakiness analysis');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ message: 'No data', reports: [] }, null, 2));
  process.exit(0);
}

//  Analyse 

const predictor = new FlakinessPredictor();
const reports = predictor.analyzeAll(allRuns);
const quarantined = reports.filter(r => r.recommendation === 'quarantine');

console.log('\n Flakiness Analysis ');
console.log(`Tests analysed: ${reports.length}`);
console.log(`Quarantine candidates: ${quarantined.length}`);

if (quarantined.length > 0) {
  console.log('\nQuarantine candidates:');
  for (const r of quarantined) {
    console.log(`  - [${r.domain}] ${r.testId} (score=${r.flakinessScore.toFixed(3)}, consecutive=${r.consecutiveFailures})`);
  }
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2)
);
console.log(`\nReport written to ${outputPath}`);
