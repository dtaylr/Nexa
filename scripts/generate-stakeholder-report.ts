import fs from 'fs';
import path from 'path';

// (mirrors test-matrix.ts output)

interface HistoryEntry {
  runId: string;
  status: 'passed' | 'failed' | 'skipped';
  timestamp: string;
  duration: number;
}

interface MatrixEntry {
  id: string;
  name: string;
  fullName: string;
  suite: string;
  domain: string;
  layer: string;
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
  domain: string;
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  passRate: number;
}

interface LayerStat {
  layer: string;
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

//  Helpers 

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// Human-readable domain names for a non-technical audience
function domainLabel(domain: string): string {
  const labels: Record<string, string> = {
    finance: 'BrightBank (Finance)',
    health: 'HealthyU (Health)',
    commerce: 'BuyItAll (Commerce)',
    security: 'Security',
    auth: 'Authentication',
    other: 'Other',
  };
  return labels[domain] ?? domain;
}

function layerLabel(layer: string): string {
  const labels: Record<string, string> = {
    api: 'API Tests',
    'e2e-desktop': 'E2E Desktop',
    'e2e-mobile': 'E2E Mobile',
    security: 'Security',
    a11y: 'Accessibility',
    smoke: 'Smoke Tests',
    contracts: 'Contract Tests',
    bdd: 'Behavior Tests',
    other: 'Other',
  };
  return labels[layer] ?? layer;
}

// Health color thresholds used for the overall pass rate indicator
function healthColor(rate: number): string {
  if (rate >= 95) return '#2e7d32';
  if (rate >= 80) return '#e65100';
  return '#b71c1c';
}

function healthLabel(rate: number): string {
  if (rate >= 95) return 'Healthy';
  if (rate >= 80) return 'At Risk';
  return 'Critical';
}

// Collect unique run IDs in chronological order for the trend chart.
// Each entry in history has a timestamp - one data point per runId.
function buildTrendData(tests: MatrixEntry[]): Array<{ runId: string; date: string; passRate: number }> {
  // Gather all history entries across all tests
  const runMap = new Map<string, { passed: number; total: number; timestamp: string }>();

  for (const test of tests) {
    for (const h of test.history) {
      if (!runMap.has(h.runId)) {
        runMap.set(h.runId, { passed: 0, total: 0, timestamp: h.timestamp });
      }
      const r = runMap.get(h.runId)!;
      r.total++;
      if (h.status === 'passed') r.passed++;
    }
  }

  // Sort runs chronologically and keep the most recent 10
  return [...runMap.entries()]
    .sort(([, a], [, b]) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-10)
    .map(([runId, data]) => ({
      runId,
      date: formatDate(data.timestamp),
      passRate: data.total > 0 ? parseFloat(((data.passed / data.total) * 100).toFixed(1)) : 0,
    }));
}

//  HTML generation 

function buildHtml(matrix: TestMatrix): string {
  const { summary, domains, layers, tests, generatedAt, branch, commit, runId } = matrix;

  const hColor = healthColor(summary.passRate);
  const hLabel = healthLabel(summary.passRate);
  const dateFormatted = formatDate(generatedAt);

  // Unexpected failures are those that are not flagged as intentional bugs
  const unexpectedFailed = tests.filter(t => t.status === 'failed' && !t.intentionalBug);
  const flakyTests = tests.filter(t => t.status === 'flaky');
  const bugTests = tests.filter(t => t.intentionalBug && (t.status === 'failed' || t.status === 'flaky'));

  const trendData = buildTrendData(tests);
  const hasTrend = trendData.length >= 2;

  // Per-domain data for the stacked bar chart — serialise as JSON for Chart.js
  const domainLabels = JSON.stringify(domains.map(d => domainLabel(d.domain)));
  const domainPassed = JSON.stringify(domains.map(d => d.passed));
  const domainFailed = JSON.stringify(domains.map(d => d.failed));
  const domainFlaky = JSON.stringify(domains.map(d => d.flaky));
  const domainSkipped = JSON.stringify(domains.map(d => d.skipped));

  // Layer donut chart data
  const layerLabels = JSON.stringify(layers.map(l => layerLabel(l.layer)));
  const layerCounts = JSON.stringify(layers.map(l => l.total));

  // Trend chart data
  const trendLabels = JSON.stringify(trendData.map(r => r.date));
  const trendRates = JSON.stringify(trendData.map(r => r.passRate));

  //  Domain accordion sections 
  const domainGroups: Record<string, MatrixEntry[]> = {};
  for (const t of tests) {
    if (!domainGroups[t.domain]) domainGroups[t.domain] = [];
    domainGroups[t.domain].push(t);
  }

  const accordionSections = Object.entries(domainGroups).map(([domain, entries]) => {
    const passCount = entries.filter(e => e.status === 'passed').length;
    const rate = entries.length > 0 ? Math.round((passCount / entries.length) * 100) : 0;

    const rows = entries.map(e => {
      const icon = { passed: '✓', failed: '✗', flaky: '~', skipped: '–' }[e.status] ?? '?';
      const iconClass = { passed: 'icon-pass', failed: 'icon-fail', flaky: 'icon-flaky', skipped: 'icon-skip' }[e.status] ?? '';
      return `
          <tr class="test-row" data-status="${e.status}">
            <td><span class="${iconClass}">${icon}</span></td>
            <td class="test-name-cell">${escapeHtml(e.fullName)}</td>
            <td><span class="layer-pill">${escapeHtml(layerLabel(e.layer))}</span></td>
            <td>${e.browser ? `<span class="browser-pill">${escapeHtml(e.browser)}</span>` : '–'}</td>
            <td class="duration-cell">${formatDuration(e.duration)}</td>
          </tr>`;
    }).join('');

    return `
      <div class="accordion-item">
        <button class="accordion-header" onclick="toggleAccordion(this)">
          <span class="acc-domain">${escapeHtml(domainLabel(domain))}</span>
          <span class="acc-meta">${entries.length} tests &nbsp;·&nbsp; ${rate}% passing</span>
          <span class="acc-chevron">▼</span>
        </button>
        <div class="accordion-body">
          <div class="filter-bar">
            <button class="filter-btn active" onclick="filterRows(this,'all')">All</button>
            <button class="filter-btn" onclick="filterRows(this,'passed')">Passed</button>
            <button class="filter-btn" onclick="filterRows(this,'failed')">Failed</button>
            <button class="filter-btn" onclick="filterRows(this,'flaky')">Flaky</button>
            <button class="filter-btn" onclick="filterRows(this,'skipped')">Skipped</button>
          </div>
          <table class="matrix-table">
            <thead>
              <tr>
                <th style="width:32px"></th>
                <th>Test Name</th>
                <th>Layer</th>
                <th>Browser</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }).join('');

  //  Bugs caught table 
  const bugRows = bugTests.map(t => `
        <tr>
          <td><span class="bug-id">${escapeHtml(t.intentionalBugId ?? '—')}</span></td>
          <td>${escapeHtml(t.fullName)}</td>
          <td>${escapeHtml(domainLabel(t.domain))}</td>
          <td><span class="status-detected">detected</span></td>
        </tr>`).join('');

  //  Unexpected failures table 
  const failureRows = unexpectedFailed.map(t => `
        <tr class="failure-row">
          <td class="test-name-cell">${escapeHtml(t.fullName)}</td>
          <td>${escapeHtml(domainLabel(t.domain))}</td>
          <td>${escapeHtml(layerLabel(t.layer))}</td>
          <td class="error-cell">${escapeHtml((t.errorMessage ?? '').slice(0, 100))}</td>
          <td>${t.browser ? escapeHtml(t.browser) : '–'}</td>
        </tr>`).join('');

  //  Flaky tests table 
  const flakyRows = flakyTests.map(t => {
    const recent = t.history.slice(0, 10);
    const failCount = recent.filter(h => h.status === 'failed').length;
    return `
        <tr class="flaky-row">
          <td class="test-name-cell">${escapeHtml(t.fullName)}</td>
          <td>${escapeHtml(domainLabel(t.domain))}</td>
          <td>${failCount}/${recent.length} recent runs failed</td>
          <td><span class="status-flaky">${escapeHtml(t.status)}</span></td>
        </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>1Platform Quality Report — ${escapeHtml(dateFormatted)}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: system-ui, -apple-system, sans-serif;
    background: #f0f2f5;
    color: #1a1a2e;
    line-height: 1.6;
    font-size: 15px;
  }

  .page { max-width: 1120px; margin: 0 auto; padding: 36px 24px 60px; }

  /*  Header  */
  .report-header {
    background: #1a1a2e;
    color: #fff;
    border-radius: 16px;
    padding: 32px 36px;
    margin-bottom: 32px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .report-header h1 { font-size: 1.9rem; font-weight: 700; letter-spacing: -0.02em; }
  .report-header .subtitle { color: #a0aec0; margin-top: 4px; font-size: 1rem; }
  .meta-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .meta-pill {
    background: rgba(255,255,255,0.12);
    border-radius: 20px;
    padding: 3px 12px;
    font-size: 0.8rem;
    color: #e2e8f0;
  }
  .print-btn {
    background: #0066cc;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 10px 20px;
    font-size: 0.9rem;
    cursor: pointer;
    white-space: nowrap;
    margin-top: 4px;
  }
  .print-btn:hover { background: #0052a3; }

  /*  Section headings  */
  .section { margin-bottom: 36px; }
  .section-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid #e2e8f0;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 0.82rem;
  }

  /*  KPI cards  */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
    margin-bottom: 36px;
  }
  .kpi-card {
    background: #fff;
    border-radius: 12px;
    padding: 24px 28px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.07);
  }
  .kpi-card .kpi-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #718096;
    margin-bottom: 10px;
  }
  .kpi-card .kpi-value {
    font-size: 2.4rem;
    font-weight: 800;
    line-height: 1;
  }
  .kpi-card .kpi-sub {
    font-size: 0.82rem;
    color: #718096;
    margin-top: 6px;
  }
  .health-ring {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    border: 8px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    font-weight: 800;
    margin-bottom: 8px;
  }

  /*  Charts  */
  .charts-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 36px;
  }
  .chart-card {
    background: #fff;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.07);
  }
  .chart-card h3 {
    font-size: 0.9rem;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 16px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .chart-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 120px;
    background: #f7fafc;
    border-radius: 8px;
    color: #a0aec0;
    font-size: 0.85rem;
    text-align: center;
    padding: 16px;
  }

  /*  Tables  */
  .data-table {
    width: 100%;
    border-collapse: collapse;
    background: #fff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.07);
    font-size: 0.875rem;
  }
  .data-table th {
    background: #f7fafc;
    text-align: left;
    padding: 11px 16px;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #4a5568;
    font-weight: 700;
    border-bottom: 1px solid #e2e8f0;
  }
  .data-table td {
    padding: 11px 16px;
    border-bottom: 1px solid #f0f2f5;
    vertical-align: top;
  }
  .data-table tr:last-child td { border-bottom: none; }
  .data-table tr:nth-child(even) td { background: #fafbfc; }

  .failure-row td { border-left: 4px solid #b71c1c; }
  .failure-row td:first-child { padding-left: 12px; }
  .flaky-row td { border-left: 4px solid #e65100; }
  .flaky-row td:first-child { padding-left: 12px; }

  /*  Status badges  */
  .status-detected {
    display: inline-block;
    background: #fff3e0;
    color: #e65100;
    border-radius: 20px;
    padding: 2px 10px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .status-flaky {
    display: inline-block;
    background: #fff8e1;
    color: #f9a825;
    border-radius: 20px;
    padding: 2px 10px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .bug-id {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 0.8rem;
    background: #e8f5e9;
    color: #2e7d32;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 600;
  }

  /*  Accordion (Full Matrix)  */
  .accordion-item {
    background: #fff;
    border-radius: 12px;
    margin-bottom: 12px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.07);
    overflow: hidden;
  }
  .accordion-header {
    width: 100%;
    background: none;
    border: none;
    padding: 18px 24px;
    display: flex;
    align-items: center;
    gap: 16px;
    cursor: pointer;
    text-align: left;
    font-size: 0.95rem;
  }
  .accordion-header:hover { background: #f7fafc; }
  .acc-domain { font-weight: 700; color: #1a1a2e; }
  .acc-meta { color: #718096; font-size: 0.85rem; }
  .acc-chevron { margin-left: auto; color: #a0aec0; font-size: 0.75rem; transition: transform 0.2s; }
  .accordion-header.open .acc-chevron { transform: rotate(180deg); }
  .accordion-body { display: none; padding: 0 0 16px; border-top: 1px solid #f0f2f5; }
  .accordion-body.open { display: block; }

  /*  Matrix table  */
  .filter-bar { padding: 12px 20px; display: flex; gap: 8px; flex-wrap: wrap; }
  .filter-btn {
    background: #f0f2f5;
    border: none;
    border-radius: 20px;
    padding: 4px 14px;
    font-size: 0.8rem;
    cursor: pointer;
    color: #4a5568;
  }
  .filter-btn.active { background: #0066cc; color: #fff; }
  .filter-btn:hover:not(.active) { background: #e2e8f0; }

  .matrix-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  .matrix-table th {
    background: #f7fafc;
    padding: 8px 14px;
    text-align: left;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #718096;
    font-weight: 600;
  }
  .matrix-table td { padding: 7px 14px; border-top: 1px solid #f0f2f5; }
  .test-name-cell { max-width: 400px; word-break: break-word; }
  .duration-cell { color: #718096; white-space: nowrap; font-size: 0.78rem; }
  .error-cell { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 0.75rem; color: #b71c1c; max-width: 260px; word-break: break-word; }

  .icon-pass { color: #2e7d32; font-weight: 700; }
  .icon-fail { color: #b71c1c; font-weight: 700; }
  .icon-flaky { color: #e65100; font-weight: 700; }
  .icon-skip { color: #a0aec0; }

  .layer-pill {
    background: #eef2ff;
    color: #3730a3;
    border-radius: 20px;
    padding: 2px 8px;
    font-size: 0.72rem;
    white-space: nowrap;
  }
  .browser-pill {
    background: #f0fdf4;
    color: #166534;
    border-radius: 20px;
    padding: 2px 8px;
    font-size: 0.72rem;
    white-space: nowrap;
  }

  .empty-state {
    padding: 32px;
    text-align: center;
    color: #a0aec0;
    font-style: italic;
  }

  /*  Footer  */
  .report-footer {
    margin-top: 48px;
    padding-top: 20px;
    border-top: 1px solid #e2e8f0;
    text-align: center;
    color: #a0aec0;
    font-size: 0.8rem;
    line-height: 1.8;
  }

  /*  Print styles  */
  @media print {
    body { background: #fff; }
    .print-btn { display: none; }
    .page { padding: 0; max-width: 100%; }
    .charts-row { grid-template-columns: 1fr; }
    .accordion-body { display: block !important; }
    .accordion-header { pointer-events: none; }
    .filter-bar { display: none; }
    .kpi-grid { grid-template-columns: repeat(4, 1fr); }
    .report-header { border-radius: 0; }
    .section { break-inside: avoid; }
  }

  @media (max-width: 720px) {
    .charts-row { grid-template-columns: 1fr; }
    .kpi-grid { grid-template-columns: 1fr 1fr; }
    .report-header { flex-direction: column; gap: 12px; }
  }
</style>
</head>
<body>
<div class="page">

  <!--  Header  -->
  <div class="report-header">
    <div>
      <h1>1Platform Quality Report</h1>
      <div class="subtitle">Automated Test Results — ${escapeHtml(dateFormatted)}</div>
      <div class="meta-pills">
        <span class="meta-pill">Branch: ${escapeHtml(branch)}</span>
        <span class="meta-pill">Commit: ${escapeHtml(commit)}</span>
        <span class="meta-pill">Run: ${escapeHtml(runId)}</span>
        <span class="meta-pill">Duration: ${formatDuration(summary.duration)}</span>
      </div>
    </div>
    <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
  </div>

  <!--  Executive Summary  -->
  <div class="section">
    <div class="section-title">Executive Summary</div>
    <div class="kpi-grid">

      <div class="kpi-card" style="border-top: 4px solid ${hColor}">
        <div class="kpi-label">Overall Health</div>
        <div class="health-ring" style="border-color:${hColor}; color:${hColor}">
          ${summary.passRate}%
        </div>
        <div class="kpi-sub" style="color:${hColor}; font-weight:600">${hLabel}</div>
      </div>

      <div class="kpi-card" style="border-top: 4px solid #2e7d32">
        <div class="kpi-label">Tests Passing</div>
        <div class="kpi-value" style="color:#2e7d32">${summary.passed}</div>
        <div class="kpi-sub">${summary.passed} / ${summary.total} tests verified working</div>
      </div>

      <div class="kpi-card" style="border-top: 4px solid ${summary.failed > 0 ? '#b71c1c' : '#2e7d32'}">
        <div class="kpi-label">Issues Found</div>
        <div class="kpi-value" style="color:${summary.failed > 0 ? '#b71c1c' : '#2e7d32'}">${summary.failed}</div>
        <div class="kpi-sub">unexpected failures</div>
      </div>

      <div class="kpi-card" style="border-top: 4px solid ${summary.flaky > 0 ? '#e65100' : '#2e7d32'}">
        <div class="kpi-label">Flaky Tests</div>
        <div class="kpi-value" style="color:${summary.flaky > 0 ? '#e65100' : '#2e7d32'}">${summary.flaky}</div>
        <div class="kpi-sub">inconsistent behavior detected</div>
      </div>

    </div>
  </div>

  <!--  Charts row  -->
  <div class="charts-row">
    <div class="chart-card">
      <h3>Domain Health</h3>
      <canvas id="domainChart" height="200"></canvas>
    </div>
    <div class="chart-card">
      <h3>Test Coverage by Layer</h3>
      <canvas id="layerChart" height="200"></canvas>
    </div>
  </div>

  <!--  Quality Trend  -->
  <div class="section">
    <div class="section-title">Quality Trend</div>
    ${hasTrend
      ? `<div class="chart-card"><h3>Pass Rate Over Time</h3><canvas id="trendChart" height="120"></canvas></div>`
      : `<div class="chart-card"><div class="chart-placeholder">Trend data builds up over multiple CI runs.<br>Run the pipeline again to start seeing history.</div></div>`
    }
  </div>

  <!--  Bugs Caught  -->
  ${bugTests.length > 0 ? `
  <div class="section">
    <div class="section-title">&#10003; Intentional Defects Detected</div>
    <p style="color:#718096; font-size:0.875rem; margin-bottom:14px">
      The following known defects were correctly identified by the test suite.
      These results confirm the test coverage is working as designed.
    </p>
    <table class="data-table">
      <thead>
        <tr>
          <th>Bug ID</th>
          <th>Description</th>
          <th>Domain</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${bugRows}</tbody>
    </table>
  </div>` : ''}

  <!--  Unexpected Failures  -->
  ${unexpectedFailed.length > 0 ? `
  <div class="section">
    <div class="section-title">&#9888; Issues Requiring Attention</div>
    <table class="data-table">
      <thead>
        <tr>
          <th>Test Name</th>
          <th>Domain</th>
          <th>Layer</th>
          <th>Error</th>
          <th>Browser</th>
        </tr>
      </thead>
      <tbody>${failureRows}</tbody>
    </table>
  </div>` : ''}

  <!--  Flaky Tests  -->
  ${flakyTests.length > 0 ? `
  <div class="section">
    <div class="section-title">&#9889; Inconsistent Tests</div>
    <p style="color:#718096; font-size:0.875rem; margin-bottom:14px">
      These tests sometimes pass and sometimes fail. Investigate for reliability issues
      such as timing dependencies, shared state, or network flakiness.
    </p>
    <table class="data-table">
      <thead>
        <tr>
          <th>Test Name</th>
          <th>Domain</th>
          <th>Flake Rate</th>
          <th>Last Result</th>
        </tr>
      </thead>
      <tbody>${flakyRows}</tbody>
    </table>
  </div>` : ''}

  <!--  Full Test Matrix  -->
  <div class="section">
    <div class="section-title">Full Test Matrix</div>
    ${accordionSections || '<div class="empty-state">No test results found.</div>'}
  </div>

  <!--  Footer  -->
  <div class="report-footer">
    <div>Generated by 1Platform CI Pipeline &nbsp;·&nbsp; ${escapeHtml(generatedAt)} &nbsp;·&nbsp; Confidential</div>
    <div style="margin-top:4px">Share with: Engineering Lead, Product Management, Executive Team</div>
  </div>

</div><!-- /page -->

<script>
// Chart.js renders after DOM is ready
document.addEventListener('DOMContentLoaded', function () {

  // Domain stacked bar chart
  const domainCtx = document.getElementById('domainChart');
  if (domainCtx) {
    new Chart(domainCtx, {
      type: 'bar',
      data: {
        labels: ${domainLabels},
        datasets: [
          { label: 'Passed',  data: ${domainPassed},  backgroundColor: '#2e7d32' },
          { label: 'Failed',  data: ${domainFailed},  backgroundColor: '#b71c1c' },
          { label: 'Flaky',   data: ${domainFlaky},   backgroundColor: '#e65100' },
          { label: 'Skipped', data: ${domainSkipped}, backgroundColor: '#cfd8dc' },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
        },
      },
    });
  }

  // Layer donut chart
  const layerCtx = document.getElementById('layerChart');
  if (layerCtx) {
    new Chart(layerCtx, {
      type: 'doughnut',
      data: {
        labels: ${layerLabels},
        datasets: [{
          data: ${layerCounts},
          backgroundColor: ['#0066cc','#2e7d32','#00897b','#b71c1c','#6a1b9a','#e65100','#37474f','#f9a825','#795548'],
          borderWidth: 2,
          borderColor: '#fff',
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'right',
            labels: { font: { size: 11 }, padding: 10, boxWidth: 12 },
          },
        },
        cutout: '60%',
      },
    });
  }

  // Trend line chart (only rendered if we have enough history)
  const trendCtx = document.getElementById('trendChart');
  if (trendCtx) {
    new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: ${trendLabels},
        datasets: [{
          label: 'Pass Rate %',
          data: ${trendRates},
          borderColor: '#0066cc',
          backgroundColor: 'rgba(0,102,204,0.08)',
          tension: 0.3,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: '#0066cc',
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            min: 0,
            max: 100,
            grid: { color: '#f0f2f5' },
            ticks: { callback: (v) => v + '%', font: { size: 11 } },
          },
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        },
      },
    });
  }
});

// Accordion toggle
function toggleAccordion(btn) {
  btn.classList.toggle('open');
  const body = btn.nextElementSibling;
  body.classList.toggle('open');
}

// Filter rows inside an accordion section
function filterRows(btn, status) {
  const bar = btn.closest('.filter-bar');
  bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const tbody = btn.closest('.accordion-body').querySelector('tbody');
  tbody.querySelectorAll('.test-row').forEach(row => {
    if (status === 'all' || row.dataset.status === status) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}
</script>
</body>
</html>`;
}

//  Main 

function main(): void {
  const rootDir = path.resolve(__dirname, '..');
  const matrixPath = path.join(rootDir, 'results', 'test-matrix.json');
  const outputPath = path.join(rootDir, 'results', 'stakeholder-report.html');

  if (!fs.existsSync(matrixPath)) {
    console.error(`Error: test-matrix.json not found at ${matrixPath}`);
    console.error('Run "npm run matrix:build" first.');
    process.exit(1);
  }

  let matrix: TestMatrix;
  try {
    matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf-8')) as TestMatrix;
  } catch (err) {
    console.error('Error: could not parse test-matrix.json:', err);
    process.exit(1);
  }

  const html = buildHtml(matrix);

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, html, 'utf-8');

  console.log('\n=== Stakeholder Report Complete ===');
  console.log(`  Total tests: ${matrix.summary.total}`);
  console.log(`  Pass rate:   ${matrix.summary.passRate}%`);
  console.log(`  Domains:     ${matrix.domains.map(d => d.domain).join(', ')}`);
  console.log(`\nHTML report: ${outputPath}`);
}

main();
