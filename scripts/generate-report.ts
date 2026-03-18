import fs from 'fs';
import path from 'path';




interface VitestReport {
  success: boolean;
  startTime: number;
  duration?: number;
  testResults: Array<{
    file: string;
    status: 'passed' | 'failed' | 'skipped';
    duration?: number;
    assertionResults: Array<{
      ancestorTitles: string[];
      title: string;
      fullName: string;
      status: 'passed' | 'failed' | 'skipped' | 'todo';
      duration?: number;
      failureMessages?: string[];
      location?: { line: number; column: number };
    }>;
  }>;
}

interface PlaywrightTestCase {
  title: string;
  fullTitle: string;
  file?: string;
  line?: number;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut' | 'interrupted';
  duration: number;
  errors?: Array<{ message: string; stack?: string }>;
  annotations?: Array<{ type: string; description?: string }>;
  expectedStatus?: string;
  retry?: number;
}

interface PlaywrightSuite {
  title: string;
  file?: string;
  suites?: PlaywrightSuite[];
  specs?: Array<{
    title: string;
    fullTitle?: string;
    file?: string;
    line?: number;
    tests: PlaywrightTestCase[];
  }>;
}

interface PlaywrightReport {
  config?: { startTime?: number };
  suites: PlaywrightSuite[];
  stats?: {
    startTime?: number;
    duration?: number;
    expected?: number;
    unexpected?: number;
    flaky?: number;
    skipped?: number;
  };
}

interface NormalizedTest {
  name: string;
  fullName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  file: string;
  line: number;
  failureMessage: string;
  domain: 'finance' | 'health' | 'commerce' | 'auth' | 'security' | 'other';
  source: 'vitest' | 'playwright';
  isExpectedFailure: boolean;
}

interface DomainSummary {
  domain: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

interface ReportData {
  generatedAt: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    passRate: number;
  };
  domains: DomainSummary[];
  failedTests: NormalizedTest[];
  intentionalBugsCaught: NormalizedTest[];
  aiSuggestions: Array<{ domain: string; suggestion: string; tests: string[] }>;
  allTests: NormalizedTest[];
}

//  Intentional bug detection 

const KNOWN_BUG_PATTERNS: RegExp[] = [
  /AUDIT_SILENT_FAILURE/i,
  /SUMMARY_FLOAT_DRIFT/i,
  /JWT_GRACE_PERIOD/i,
  /BALANCE_RACE_CONDITION/i,
  /ACCOUNT_ID_DISCLOSURE/i,
  /DOSAGE_TYPE_MISMATCH/i,
  /PATIENT_PII_DISCLOSURE/i,
  /APPOINTMENT_DOUBLE_BOOKING/i,
  /CANCEL_DIALOG_FOCUS_TRAP/i,
  /PATIENT_RECORDS_IDOR/i,
  /PROMO_CODE_STACKING/i,
  /INVENTORY_OVERSELL_RACE/i,
  /EMAIL_BEFORE_PAYMENT/i,
  /CHECKOUT_MOBILE_OVERFLOW/i,
  /PRICE_FLOAT_PRECISION/i,
  /race.condition/i,
  /float.arithmetic/i,
  /grace.period/i,
  /fire.and.forget/i,
  /idor/i,
  /stacks?\s+promo/i,
  /non.atomic/i,
  /dosage.*text/i,
  /patient.id.*echo/i,
  /accountId.*404/i,
  /concurrent.*appointment/i,
  /focus.trap/i,
  /horizontal.scroll/i,
  /raw.*float/i,
  /intentional/i,
  /known.*bug/i,
  /bug.*caught/i,
];

function isExpectedFailure(test: NormalizedTest): boolean {
  if (test.status !== 'failed') return false;
  const haystack = (test.fullName + ' ' + test.file).toLowerCase();
  return KNOWN_BUG_PATTERNS.some(p => p.test(haystack));
}

//  Domain classification 

function classifyDomain(file: string, name: string): NormalizedTest['domain'] {
  const text = (file + ' ' + name).toLowerCase();
  if (text.includes('/finance/') || text.includes('finance')) return 'finance';
  if (text.includes('/health/') || text.includes('health')) return 'health';
  if (text.includes('/commerce/') || text.includes('commerce')) return 'commerce';
  if (text.includes('auth') || text.includes('jwt') || text.includes('login')) return 'auth';
  if (text.includes('security') || text.includes('owasp')) return 'security';
  return 'other';
}

//  AI-style rule-based suggestions 

function buildAiSuggestions(failed: NormalizedTest[]): ReportData['aiSuggestions'] {
  const byDomain: Record<string, string[]> = {};
  for (const t of failed) {
    if (!byDomain[t.domain]) byDomain[t.domain] = [];
    byDomain[t.domain].push(t.fullName);
  }

  const suggestions: ReportData['aiSuggestions'] = [];

  const domainAdvice: Record<string, string> = {
    finance:
      'Check fin_transfers table atomicity (BALANCE_RACE_CONDITION), float arithmetic in reports.ts (SUMMARY_FLOAT_DRIFT), JWT grace-period in middleware/auth.ts (JWT_GRACE_PERIOD), async audit write (AUDIT_SILENT_FAILURE), and error body info disclosure (ACCOUNT_ID_DISCLOSURE).',
    health:
      'Verify patient ownership checks (IDOR PATIENT_RECORDS_IDOR), medication dosage column type (DOSAGE_TYPE_MISMATCH TEXT vs NUMERIC), and appointment conflict detection (APPOINTMENT_DOUBLE_BOOKING).',
    commerce:
      'Inspect promo-code stacking guard (PROMO_CODE_STACKING), inventory check-and-decrement atomicity (INVENTORY_OVERSELL_RACE), and email trigger ordering relative to payment confirmation (EMAIL_BEFORE_PAYMENT).',
    auth:
      'Verify JWT_SECRET env var matches between API startup and test harness. Check token expiry and the 30-second grace period in middleware/auth.ts.',
    security:
      'Review OWASP API Top 10 handlers. Confirm input sanitisation, rate-limiting middleware, and error messages do not leak internal identifiers.',
    other:
    ''
  };

  for (const [domain, tests] of Object.entries(byDomain)) {
    suggestions.push({
      domain,
      suggestion: domainAdvice[domain] ?? domainAdvice['other'],
      tests,
    });
  }

  return suggestions;
}

function parseVitest(raw: unknown): NormalizedTest[] {
  const report = raw as VitestReport;
  const results: NormalizedTest[] = [];

  if (!report.testResults) return results;

  for (const suite of report.testResults) {
    for (const assertion of suite.assertionResults ?? []) {
      const statusMap: Record<string, NormalizedTest['status']> = {
        passed: 'passed',
        failed: 'failed',
        skipped: 'skipped',
        todo: 'skipped',
      };
      const status = statusMap[assertion.status] ?? 'skipped';
      const file = suite.file ?? '';
      const line = assertion.location?.line ?? 0;
      const fullName = assertion.fullName ?? [...assertion.ancestorTitles, assertion.title].join(' > ');

      const t: NormalizedTest = {
        name: assertion.title,
        fullName,
        status,
        duration: assertion.duration ?? 0,
        file,
        line,
        failureMessage: assertion.failureMessages?.join('\n') ?? '',
        domain: classifyDomain(file, fullName),
        source: 'vitest',
        isExpectedFailure: false,
      };
      t.isExpectedFailure = isExpectedFailure(t);
      results.push(t);
    }
  }
  return results;
}

function flattenPlaywrightSuites(suites: PlaywrightSuite[]): NormalizedTest[] {
  const results: NormalizedTest[] = [];

  function walk(suite: PlaywrightSuite) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const statusMap: Record<string, NormalizedTest['status']> = {
          // Playwright JSON reporter uses 'expected'/'unexpected' as primary status
          expected: 'passed',
          unexpected: 'failed',
          flaky: 'passed',
          // Legacy / fallback values
          passed: 'passed',
          failed: 'failed',
          timedOut: 'failed',
          interrupted: 'failed',
          skipped: 'skipped',
        };
        const status = statusMap[test.status] ?? 'skipped';
        const file = spec.file ?? suite.file ?? '';
        const line = spec.line ?? 0;
        const fullName = spec.fullTitle ?? [suite.title, spec.title].filter(Boolean).join(' > ');

        const t: NormalizedTest = {
          name: spec.title,
          fullName,
          status,
          duration: test.duration ?? 0,
          file,
          line,
          failureMessage: test.errors?.map(e => e.message).join('\n') ?? '',
          domain: classifyDomain(file, fullName),
          source: 'playwright',
          isExpectedFailure: false,
        };
        t.isExpectedFailure = isExpectedFailure(t);
        results.push(t);
      }
    }
    for (const child of suite.suites ?? []) {
      walk(child);
    }
  }

  for (const s of suites) walk(s);
  return results;
}

function parsePlaywright(raw: unknown): NormalizedTest[] {
  const report = raw as PlaywrightReport;
  return flattenPlaywrightSuites(report.suites ?? []);
}

//  HTML generation 

function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    passed: '#22c55e',
    failed: '#ef4444',
    skipped: '#f59e0b',
  };
  const color = colors[status] ?? '#6b7280';
  return `<span class="badge" style="background:${color}">${status}</span>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function domainIcon(domain: string): string {
  const icons: Record<string, string> = {
    finance: '💰',
    health: '🏥',
    commerce: '🛒',
    auth: '🔐',
    security: '🛡️',
    other: '🔧',
  };
  return icons[domain] ?? '🔧';
}

function buildHtml(data: ReportData): string {
  const { summary, domains, failedTests, intentionalBugsCaught, aiSuggestions } = data;

  const domainRows = domains
    .map(d => {
      const passRate = d.total > 0 ? Math.round((d.passed / d.total) * 100) : 0;
      const barColor = passRate >= 80 ? '#22c55e' : passRate >= 50 ? '#f59e0b' : '#ef4444';
      return `
      <tr>
        <td>${domainIcon(d.domain)} ${d.domain}</td>
        <td class="num">${d.total}</td>
        <td class="num" style="color:#22c55e">${d.passed}</td>
        <td class="num" style="color:#ef4444">${d.failed}</td>
        <td class="num" style="color:#f59e0b">${d.skipped}</td>
        <td class="num">${(d.duration / 1000).toFixed(2)}s</td>
        <td>
          <div class="bar-wrap">
            <div class="bar" style="width:${passRate}%;background:${barColor}"></div>
            <span>${passRate}%</span>
          </div>
        </td>
      </tr>`;
    })
    .join('');

  const failedRows = failedTests
    .filter(t => !t.isExpectedFailure)
    .map(t => `
      <tr>
        <td>${statusBadge('failed')}</td>
        <td>${escapeHtml(t.domain)}</td>
        <td class="test-name">${escapeHtml(t.fullName)}</td>
        <td class="file-ref">${escapeHtml(path.basename(t.file))}${t.line ? ':' + t.line : ''}</td>
        <td class="failure-msg">${escapeHtml(t.failureMessage.split('\n')[0] ?? '').slice(0, 120)}</td>
      </tr>`)
    .join('') || '<tr><td colspan="5" class="empty">No unexpected failures</td></tr>';

  const bugRows = intentionalBugsCaught
    .map(t => `
      <tr>
        <td>${statusBadge('failed')}</td>
        <td>${escapeHtml(t.domain)}</td>
        <td class="test-name">${escapeHtml(t.fullName)}</td>
        <td class="file-ref">${escapeHtml(path.basename(t.file))}${t.line ? ':' + t.line : ''}</td>
      </tr>`)
    .join('') || '<tr><td colspan="4" class="empty">No intentional bugs detected in this run</td></tr>';

  const suggestionBlocks = aiSuggestions
    .map(s => `
      <div class="suggestion">
        <div class="suggestion-header">${domainIcon(s.domain)} ${s.domain}</div>
        <p>${escapeHtml(s.suggestion)}</p>
        <ul>${s.tests.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
      </div>`)
    .join('') || '<p class="empty">No suggestions — all tests passed.</p>';

  const overallColor =
    summary.failed === 0 ? '#22c55e' : summary.failed <= 3 ? '#f59e0b' : '#ef4444';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>1Platform Test Report — ${data.generatedAt}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         background: #f9fafb; color: #111827; line-height: 1.5; }
  .page { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
  h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 4px; }
  h2 { font-size: 1.15rem; font-weight: 600; margin: 32px 0 12px; border-bottom: 2px solid #e5e7eb;
       padding-bottom: 6px; }
  .meta { color: #6b7280; font-size: 0.875rem; margin-bottom: 28px; }
  .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                  gap: 16px; margin-bottom: 32px; }
  .stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
               padding: 16px 20px; text-align: center; }
  .stat-card .value { font-size: 2rem; font-weight: 700; }
  .stat-card .label { font-size: 0.78rem; color: #6b7280; text-transform: uppercase;
                      letter-spacing: 0.05em; margin-top: 4px; }
  .stat-card.highlight { border-color: ${overallColor}; }
  table { width: 100%; border-collapse: collapse; background: #fff;
          border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;
          font-size: 0.875rem; }
  th { background: #f3f4f6; text-align: left; padding: 10px 14px;
       font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em;
       color: #374151; font-weight: 600; }
  td { padding: 9px 14px; border-top: 1px solid #f3f4f6; vertical-align: top; }
  tr:hover td { background: #fafafa; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px;
           font-size: 0.72rem; font-weight: 600; color: #fff; white-space: nowrap; }
  .bar-wrap { display: flex; align-items: center; gap: 8px; min-width: 120px; }
  .bar-wrap .bar { height: 8px; border-radius: 4px; min-width: 2px; }
  .bar-wrap span { font-size: 0.8rem; color: #374151; white-space: nowrap; }
  .test-name { max-width: 360px; word-break: break-word; }
  .file-ref { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 0.78rem;
              color: #4b5563; white-space: nowrap; }
  .failure-msg { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 0.73rem;
                 color: #dc2626; max-width: 280px; word-break: break-all; }
  .empty { color: #9ca3af; padding: 20px; text-align: center; font-style: italic; }
  .suggestion { background: #fff; border: 1px solid #e5e7eb; border-left: 4px solid #6366f1;
                border-radius: 8px; padding: 16px 20px; margin-bottom: 12px; }
  .suggestion-header { font-weight: 600; margin-bottom: 6px; text-transform: capitalize; }
  .suggestion p { color: #374151; margin-bottom: 8px; }
  .suggestion ul { padding-left: 20px; color: #6b7280; font-size: 0.85rem; }
  .suggestion li { margin-bottom: 2px; font-family: 'SFMono-Regular', Consolas, monospace;
                   font-size: 0.78rem; }
  @media print {
    body { background: #fff; }
    .page { padding: 0; }
    table { font-size: 0.8rem; }
    h2 { break-before: auto; }
  }
</style>
</head>
<body>
<div class="page">
  <h1>1Platform Test Report</h1>
  <p class="meta">Generated ${data.generatedAt} &nbsp;|&nbsp; Duration ${(summary.duration / 1000).toFixed(2)}s &nbsp;|&nbsp; Sources: vitest + Playwright (multi-browser)</p>

  <div class="summary-grid">
    <div class="stat-card">
      <div class="value">${summary.total}</div>
      <div class="label">Total Tests</div>
    </div>
    <div class="stat-card" style="border-color:#22c55e">
      <div class="value" style="color:#22c55e">${summary.passed}</div>
      <div class="label">Passed</div>
    </div>
    <div class="stat-card" style="border-color:#ef4444">
      <div class="value" style="color:#ef4444">${summary.failed}</div>
      <div class="label">Failed</div>
    </div>
    <div class="stat-card" style="border-color:#f59e0b">
      <div class="value" style="color:#f59e0b">${summary.skipped}</div>
      <div class="label">Skipped</div>
    </div>
    <div class="stat-card highlight">
      <div class="value" style="color:${overallColor}">${summary.passRate}%</div>
      <div class="label">Pass Rate</div>
    </div>
    <div class="stat-card">
      <div class="value" style="color:#6366f1">${intentionalBugsCaught.length}</div>
      <div class="label">Bugs Caught</div>
    </div>
  </div>

  <h2>Domain Breakdown</h2>
  <table>
    <thead>
      <tr>
        <th>Domain</th>
        <th class="num">Total</th>
        <th class="num">Passed</th>
        <th class="num">Failed</th>
        <th class="num">Skipped</th>
        <th class="num">Duration</th>
        <th>Pass Rate</th>
      </tr>
    </thead>
    <tbody>${domainRows || '<tr><td colspan="7" class="empty">No data</td></tr>'}</tbody>
  </table>

  <h2>Failed Tests (Unexpected)</h2>
  <table>
    <thead>
      <tr>
        <th>Status</th>
        <th>Domain</th>
        <th>Test</th>
        <th>File:Line</th>
        <th>First Error</th>
      </tr>
    </thead>
    <tbody>${failedRows}</tbody>
  </table>

  <h2>Intentional Bugs Caught</h2>
  <p style="color:#6b7280;font-size:0.875rem;margin-bottom:12px">
    Seeded bugs expected failures.
  </p>
  <table>
    <thead>
      <tr>
        <th>Status</th>
        <th>Domain</th>
        <th>Test</th>
        <th>File:Line</th>
      </tr>
    </thead>
    <tbody>${bugRows}</tbody>
  </table>

  <h2>Slowest Tests</h2>
  <table>
    <thead>
      <tr><th>Test</th><th>Domain</th><th>Source</th><th class="num">Duration</th></tr>
    </thead>
    <tbody>
      ${data.allTests
        .filter(t => t.status === 'passed')
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 8)
        .map(t => `<tr>
          <td class="test-name">${escapeHtml(t.fullName)}</td>
          <td>${escapeHtml(t.domain)}</td>
          <td class="file-ref">${escapeHtml(t.source)}</td>
          <td class="num">${(t.duration / 1000).toFixed(2)}s</td>
        </tr>`).join('') || '<tr><td colspan="4" class="empty">No data</td></tr>'}
    </tbody>
  </table>

  <h2>AI-Assisted Root Cause Suggestions</h2>
  ${suggestionBlocks}
</div>
</body>
</html>`;
}

//  Main 

function readJsonSafe<T>(filePath: string): T | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function computeDomainSummaries(tests: NormalizedTest[]): DomainSummary[] {
  const map: Record<string, DomainSummary> = {};
  for (const t of tests) {
    if (!map[t.domain]) {
      map[t.domain] = { domain: t.domain, total: 0, passed: 0, failed: 0, skipped: 0, duration: 0 };
    }
    const d = map[t.domain];
    d.total++;
    d.duration += t.duration;
    if (t.status === 'passed') d.passed++;
    else if (t.status === 'failed') d.failed++;
    else d.skipped++;
  }
  return Object.values(map).sort((a, b) => b.total - a.total);
}

export function main(): void {
  const rootDir = path.resolve(__dirname, '..');
  const playwrightResultsPath = path.join(rootDir, 'results', 'playwright', 'results.json');
  const outputDir = path.join(rootDir, 'results');

  ensureDir(outputDir);
  ensureDir(path.join(outputDir, 'vitest'));
  ensureDir(path.join(outputDir, 'playwright'));

  const vitestResultsDir = path.join(rootDir, 'results', 'vitest');
  console.log('Reading vitest results from:', vitestResultsDir, '(all *.json files)');
  console.log('Reading playwright results from:', playwrightResultsPath);

  // Merge all per-suite vitest JSON files so every run is represented
  const vitestTests: NormalizedTest[] = [];
  if (fs.existsSync(vitestResultsDir)) {
    const jsonFiles = fs.readdirSync(vitestResultsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(vitestResultsDir, f));
    for (const f of jsonFiles) {
      const raw = readJsonSafe<unknown>(f);
      if (raw) vitestTests.push(...parseVitest(raw));
    }
    console.log(`  Merged ${jsonFiles.length} vitest file(s) → ${vitestTests.length} tests`);
  } else {
    console.warn(`Warning: vitest results directory not found at ${vitestResultsDir}`);
  }

  const playwrightRaw = readJsonSafe<unknown>(playwrightResultsPath);
  if (!playwrightRaw) {
    console.warn(`Warning: Could not read playwright results at ${playwrightResultsPath}. Continuing with empty results.`);
  }
  const playwrightTests = playwrightRaw ? parsePlaywright(playwrightRaw) : [];

  const allTests = [...vitestTests, ...playwrightTests];

  const totalDuration = allTests.reduce((sum, t) => sum + t.duration, 0);
  const passed = allTests.filter(t => t.status === 'passed').length;
  const failed = allTests.filter(t => t.status === 'failed').length;
  const skipped = allTests.filter(t => t.status === 'skipped').length;
  const total = allTests.length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  const failedTests = allTests.filter(t => t.status === 'failed');
  const intentionalBugsCaught = failedTests.filter(t => t.isExpectedFailure);
  const unexpectedFailed = failedTests.filter(t => !t.isExpectedFailure);
  const aiSuggestions = buildAiSuggestions(unexpectedFailed);
  const domains = computeDomainSummaries(allTests);

  const reportData: ReportData = {
    generatedAt: new Date().toISOString(),
    summary: { total, passed, failed, skipped, duration: totalDuration, passRate },
    domains,
    failedTests,
    intentionalBugsCaught,
    aiSuggestions,
    allTests,
  };

  const htmlPath = path.join(outputDir, 'report.html');
  const jsonPath = path.join(outputDir, 'report.json');

  fs.writeFileSync(htmlPath, buildHtml(reportData), 'utf-8');
  fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2), 'utf-8');

  console.log('\n=== Report Generation Complete ===');
  console.log(`  Total:   ${total}`);
  console.log(`  Passed:  ${passed}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Pass rate: ${passRate}%`);
  console.log(`  Intentional bugs caught: ${intentionalBugsCaught.length}`);
  console.log(`\nHTML report: ${htmlPath}`);
  console.log(`JSON report: ${jsonPath}`);
}

main();
