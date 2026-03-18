import fs from 'fs';
import path from 'path';
import crypto from 'crypto';



type Domain = 'finance' | 'health' | 'commerce' | 'security' | 'auth' | 'other';
type Layer = 'api' | 'e2e-desktop' | 'e2e-mobile' | 'security' | 'a11y' | 'smoke' | 'contracts' | 'bdd' | 'other';
type Status = 'passed' | 'failed' | 'skipped';

interface HistoryEntry {
  runId: string;
  status: Status;
  timestamp: string;
  duration: number;
}

interface MatrixEntry {
  id: string;
  name: string;
  fullName: string;
  suite: string;
  domain: Domain;
  layer: Layer;
  status: 'passed' | 'failed' | 'flaky' | 'skipped';
  duration: number;
  browser: string | null;
  errorMessage: string | null;
  tags: string[];
  intentionalBug: boolean;
  intentionalBugId: string | null;
  firstSeen: string;
  lastRun: string;
  history: HistoryEntry[];
}

interface DomainStat {
  domain: Domain;
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  passRate: number;
}

interface LayerStat {
  layer: Layer;
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
}

interface TestMatrix {
  generatedAt: string;
  runId: string;
  branch: string;
  commit: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    flaky: number;
    skipped: number;
    passRate: number;
    duration: number;
  };
  domains: DomainStat[];
  layers: LayerStat[];
  tests: MatrixEntry[];
}


const KNOWN_BROWSER_PROJECTS = new Set(['chromium', 'firefox', 'webkit', 'edge', 'msedge']);
const KNOWN_MOBILE_PROJECTS = new Set(['mobile-chrome', 'mobile-safari', 'mobile-small', 'tablet']);

// Same patterns as generate-report.ts — tests whose failures are intentional
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
];

// Tag tokens that may appear in test names
const KNOWN_TAGS = ['@smoke', '@regression', '@mobile', '@finance', '@health', '@commerce', '@isolation'];

//  Helpers 

function makeId(suite: string, name: string, browser: string | null): string {
  return crypto.createHash('sha256')
    .update(`${suite}::${name}::${browser ?? ''}`)
    .digest('hex')
    .slice(0, 16);
}

function classifyDomain(suite: string, name: string): Domain {
  const text = (suite + ' ' + name).toLowerCase();
  if (text.includes('finance') || text.includes('brightbank')) return 'finance';
  if (text.includes('health') || text.includes('healthyu')) return 'health';
  if (text.includes('commerce') || text.includes('buyitall')) return 'commerce';
  if (text.includes('security')) return 'security';
  if (text.includes('auth')) return 'auth';
  return 'other';
}

function classifyLayer(suite: string, hostname: string | null): Layer {
  const h = (hostname ?? '').toLowerCase();
  if (KNOWN_MOBILE_PROJECTS.has(h)) return 'e2e-mobile';
  if (KNOWN_BROWSER_PROJECTS.has(h)) return 'e2e-desktop';

  const s = suite.toLowerCase();
  if (s.includes('accessibility') || s.includes('a11y')) return 'a11y';
  if (s.includes('security')) return 'security';
  if (s.includes('smoke')) return 'smoke';
  if (s.includes('contracts')) return 'contracts';
  if (s.includes('bdd') || s.includes('.feature')) return 'bdd';
  // Playwright tests run in a named project that isn't a browser name end up here
  if (s.includes('/ui/') && !KNOWN_BROWSER_PROJECTS.has(h) && !KNOWN_MOBILE_PROJECTS.has(h)) return 'e2e-desktop';
  return 'api';
}

function extractTags(name: string): string[] {
  return KNOWN_TAGS.filter(tag => name.toLowerCase().includes(tag));
}

function detectBug(suite: string, name: string): { intentionalBug: boolean; intentionalBugId: string | null } {
  const haystack = `${suite} ${name}`;
  const intentionalBug = KNOWN_BUG_PATTERNS.some(p => p.test(haystack));

  let intentionalBugId: string | null = null;
  const idMatch = haystack.match(/\b(AUDIT_SILENT_FAILURE|SUMMARY_FLOAT_DRIFT|JWT_GRACE_PERIOD|BALANCE_RACE_CONDITION|ACCOUNT_ID_DISCLOSURE|DOSAGE_TYPE_MISMATCH|PATIENT_PII_DISCLOSURE|APPOINTMENT_DOUBLE_BOOKING|CANCEL_DIALOG_FOCUS_TRAP|PATIENT_RECORDS_IDOR|PROMO_CODE_STACKING|INVENTORY_OVERSELL_RACE|EMAIL_BEFORE_PAYMENT|CHECKOUT_MOBILE_OVERFLOW|PRICE_FLOAT_PRECISION)\b/i);
  if (idMatch) intentionalBugId = idMatch[1].toUpperCase();

  return { intentionalBug, intentionalBugId };
}

function isFlaky(history: HistoryEntry[]): boolean {
  const recent = history.slice(0, 10);
  const hasPassed = recent.some(h => h.status === 'passed');
  const hasFailed = recent.some(h => h.status === 'failed');
  return hasPassed && hasFailed;
}

//  XML parsing 

interface ParsedTestCase {
  name: string;
  classname: string;  // suite/file path
  time: number;       // seconds
  hostname: string | null;
  failure: string | null;
  skipped: boolean;
}

interface ParsedSuite {
  name: string;
  hostname: string | null;
  cases: ParsedTestCase[];
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

function attr(tag: string, key: string): string | null {
  const re = new RegExp(`\\b${key}="([^"]*)"`, 'i');
  const m = tag.match(re);
  return m ? decodeEntities(m[1]) : null;
}

function parseJUnit(xml: string): ParsedSuite[] {
  const suites: ParsedSuite[] = [];

  // Split by <testsuite to get each suite block
  const suiteBlocks = xml.split(/<testsuite\b/i).slice(1);

  for (const block of suiteBlocks) {
    const openTagEnd = block.indexOf('>');
    const openTag = block.slice(0, openTagEnd);

    const suiteName = attr(openTag, 'name') ?? '';
    const suiteHostname = attr(openTag, 'hostname');

    const suite: ParsedSuite = { name: suiteName, hostname: suiteHostname, cases: [] };

    const tcRegex = /<testcase\b([^>]*)>([\s\S]*?)<\/testcase>|<testcase\b([^>]*)\/>/gi;
    let m: RegExpExecArray | null;

    while ((m = tcRegex.exec(block)) !== null) {
      const attrs = (m[1] ?? m[3] ?? '');
      const inner = m[2] ?? '';

      const name = attr(attrs, 'name') ?? '';
      const classname = attr(attrs, 'classname') ?? suiteName;
      const timeStr = attr(attrs, 'time') ?? '0';
      const time = parseFloat(timeStr) || 0;

      const failureMatch = inner.match(/<failure\b[^>]*message="([^"]*)"[^>]*>/i)
        ?? inner.match(/<failure\b[^>]*>([\s\S]*?)<\/failure>/i);
      const failure = failureMatch ? failureMatch[1].trim() : null;

      const skipped = /<skipped\b/i.test(inner);

      // Some Playwright JUnits put hostname on the suite, not the testcase
      const caseHostname = attr(attrs, 'hostname') ?? suiteHostname;

      suite.cases.push({ name, classname, time, hostname: caseHostname, failure, skipped });
    }

    suites.push(suite);
  }

  return suites;
}

function findXmlFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  function walk(current: string) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.xml')) {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results;
}

function buildMatrix(
  xmlFiles: string[],
  existing: TestMatrix | null,
  runId: string,
  branch: string,
  commit: string,
  now: string,
): TestMatrix {
  // Build a lookup map from existing entries so history can be preserved
  const existingById = new Map<string, MatrixEntry>();
  for (const entry of existing?.tests ?? []) {
    existingById.set(entry.id, entry);
  }

  const newEntries: MatrixEntry[] = [];

  for (const xmlPath of xmlFiles) {
    let xml: string;
    try {
      xml = fs.readFileSync(xmlPath, 'utf-8');
    } catch {
      console.warn(`Warning: could not read ${xmlPath}`);
      continue;
    }

    const suites = parseJUnit(xml);

    for (const suite of suites) {
      for (const tc of suite.cases) {
        const suiteName = tc.classname || suite.name;
        const browser = (KNOWN_BROWSER_PROJECTS.has((tc.hostname ?? '').toLowerCase())
          || KNOWN_MOBILE_PROJECTS.has((tc.hostname ?? '').toLowerCase()))
          ? tc.hostname
          : null;

        const id = makeId(suiteName, tc.name, browser);
        const domain = classifyDomain(suiteName, tc.name);
        const layer = classifyLayer(suiteName, tc.hostname);
        const tags = extractTags(tc.name);
        const { intentionalBug, intentionalBugId } = detectBug(suiteName, tc.name);
        const durationMs = Math.round(tc.time * 1000);

        const baseStatus: Status = tc.skipped ? 'skipped' : tc.failure !== null ? 'failed' : 'passed';

        // Preserve history from previous runs, then append this run
        const prev = existingById.get(id);
        const existingHistory: HistoryEntry[] = prev?.history ?? [];

        const thisEntry: HistoryEntry = { runId, status: baseStatus, timestamp: now, duration: durationMs };

        let updatedHistory: HistoryEntry[];
        if (existingHistory.length > 0 && existingHistory[0].runId === runId) {
          // Same CI run already recorded — update in place instead of duplicating
          updatedHistory = [thisEntry, ...existingHistory.slice(1)];
        } else {
          updatedHistory = [thisEntry, ...existingHistory];
        }

        updatedHistory = updatedHistory.slice(0, 20);

        const flaky = isFlaky(updatedHistory);
        const finalStatus = flaky ? 'flaky' : baseStatus;

        const entry: MatrixEntry = {
          id,
          name: tc.name,
          fullName: tc.name,
          suite: suiteName,
          domain,
          layer,
          status: finalStatus,
          duration: durationMs,
          browser: browser ?? null,
          errorMessage: tc.failure ?? null,
          tags,
          intentionalBug,
          intentionalBugId,
          firstSeen: prev?.firstSeen ?? now,
          lastRun: now,
          history: updatedHistory,
        };

        newEntries.push(entry);
      }
    }
  }

  // Build per domain stats
  const domainMap = new Map<Domain, DomainStat>();
  for (const e of newEntries) {
    if (!domainMap.has(e.domain)) {
      domainMap.set(e.domain, { domain: e.domain, total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0, passRate: 0 });
    }
    const d = domainMap.get(e.domain)!;
    d.total++;
    if (e.status === 'passed') d.passed++;
    else if (e.status === 'failed') d.failed++;
    else if (e.status === 'flaky') d.flaky++;
    else d.skipped++;
  }
  const domains: DomainStat[] = [...domainMap.values()].map(d => ({
    ...d,
    passRate: d.total > 0 ? parseFloat(((d.passed / d.total) * 100).toFixed(1)) : 0,
  })).sort((a, b) => b.total - a.total);

  // Build per layer stats
  const layerMap = new Map<Layer, LayerStat>();
  for (const e of newEntries) {
    if (!layerMap.has(e.layer)) {
      layerMap.set(e.layer, { layer: e.layer, total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0 });
    }
    const l = layerMap.get(e.layer)!;
    l.total++;
    if (e.status === 'passed') l.passed++;
    else if (e.status === 'failed') l.failed++;
    else if (e.status === 'flaky') l.flaky++;
    else l.skipped++;
  }
  const layers: LayerStat[] = [...layerMap.values()].sort((a, b) => b.total - a.total);

  const total = newEntries.length;
  const passed = newEntries.filter(e => e.status === 'passed').length;
  const failed = newEntries.filter(e => e.status === 'failed').length;
  const flaky = newEntries.filter(e => e.status === 'flaky').length;
  const skipped = newEntries.filter(e => e.status === 'skipped').length;
  const duration = newEntries.reduce((s, e) => s + e.duration, 0);
  const passRate = total > 0 ? parseFloat(((passed / total) * 100).toFixed(1)) : 0;

  return {
    generatedAt: now,
    runId,
    branch,
    commit,
    summary: { total, passed, failed, flaky, skipped, passRate, duration },
    domains,
    layers,
    tests: newEntries,
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const dirArgIdx = args.indexOf('--results-dir');
  const resultsDir = dirArgIdx !== -1 && args[dirArgIdx + 1]
    ? path.resolve(args[dirArgIdx + 1])
    : path.resolve('results');

  const now = new Date().toISOString();
  const runId = process.env['GITHUB_RUN_ID'] ?? now;
  const branch = process.env['GITHUB_REF_NAME'] ?? 'local';
  const sha = process.env['GITHUB_SHA'] ?? 'local';
  const commit = sha === 'local' ? 'local' : sha.slice(0, 7);

  console.log(`Results directory: ${resultsDir}`);
  console.log(`Run ID: ${runId} | Branch: ${branch} | Commit: ${commit}`);

  const xmlFiles = findXmlFiles(resultsDir);
  console.log(`Found ${xmlFiles.length} JUnit XML file(s)`);
  for (const f of xmlFiles) console.log(`  ${f}`);

  // Load existing matrix for history preservation
  const matrixPath = path.join(resultsDir, 'test-matrix.json');
  let existing: TestMatrix | null = null;
  if (fs.existsSync(matrixPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(matrixPath, 'utf-8')) as TestMatrix;
      console.log(`Loaded existing matrix with ${existing.tests.length} entries`);
    } catch {
      console.warn('Warning: could not parse existing test-matrix.json — starting fresh');
    }
  }

  const matrix = buildMatrix(xmlFiles, existing, runId, branch, commit, now);

  // Ensure output directory exists
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  fs.writeFileSync(matrixPath, JSON.stringify(matrix, null, 2), 'utf-8');

  console.log('\n=== Test Matrix Complete ===');
  console.log(`  Total:   ${matrix.summary.total}`);
  console.log(`  Passed:  ${matrix.summary.passed}`);
  console.log(`  Failed:  ${matrix.summary.failed}`);
  console.log(`  Flaky:   ${matrix.summary.flaky}`);
  console.log(`  Skipped: ${matrix.summary.skipped}`);
  console.log(`  Pass rate: ${matrix.summary.passRate}%`);
  console.log(`\nMatrix written to: ${matrixPath}`);
}

main();
