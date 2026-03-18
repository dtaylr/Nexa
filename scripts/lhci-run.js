#!/usr/bin/env node

const { spawnSync } = require('child_process');
const { existsSync, readdirSync, renameSync } = require('fs');
const os = require('os');
const path = require('path');

function findMacChrome() {
  const cacheDir = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
  if (!existsSync(cacheDir)) return null;
  const entries = readdirSync(cacheDir)
    .filter(e => e.startsWith('chromium-'))
    .sort()
    .reverse();
  for (const entry of entries) {
    const candidate = path.join(
      cacheDir, entry,
      'chrome-mac-x64',
      'Google Chrome for Testing.app',
      'Contents', 'MacOS',
      'Google Chrome for Testing'
    );
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const env = { ...process.env };

if (process.platform === 'darwin' && !env.CHROME_PATH) {
  const chrome = findMacChrome();
  if (chrome) {
    env.CHROME_PATH = chrome;
    console.log(`Using Chrome for Testing: ${chrome}`);
  } else {
    console.warn('Warning: No Playwright Chrome found on macOS. Run: npx playwright install chromium');
  }
}

const lhci = path.join(__dirname, '..', 'node_modules', '.bin', 'lhci');
const result = spawnSync(lhci, ['autorun'], { env, stdio: 'inherit' });

// Rename output files from the LHCI default (localhost--YYYY_MM_DD_HH_MM_SS.report.*)
// to a cleaner format: lh-report-YYYY-MM-DD-HH-MM.{html,json}
const outputDir = path.resolve(__dirname, '..', 'results', 'lighthouse');
if (existsSync(outputDir)) {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
  ].join('-');

  const files = readdirSync(outputDir);
  // Find freshly created reports (modified in last 5 minutes)
  const cutoff = Date.now() - 5 * 60 * 1000;
  const fresh = files.filter(f => {
    if (!f.endsWith('.html') && !f.endsWith('.json')) return false;
    if (f.startsWith('lh-report-')) return false; // already renamed
    const stat = require('fs').statSync(path.join(outputDir, f));
    return stat.mtimeMs > cutoff;
  });

  const counters = {};
  for (const f of fresh.sort()) {
    const ext = path.extname(f);
    const isIndex = f.includes('index_html');
    const urlSlug = isIndex ? 'index' : 'root';
    const key = `${urlSlug}${ext}`;
    counters[key] = (counters[key] ?? 0) + 1;
    const n = counters[key];
    const newName = n === 1
      ? `lh-report-${stamp}-${urlSlug}${ext}`
      : `lh-report-${stamp}-${urlSlug}-run${n}${ext}`;
    renameSync(path.join(outputDir, f), path.join(outputDir, newName));
  }

  if (fresh.length > 0) {
    console.log(`\nRenamed ${fresh.length} report(s) → lh-report-${stamp}-*.{html,json}`);
  }
}

process.exit(result.status ?? 1);
