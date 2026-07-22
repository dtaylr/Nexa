import { spawnSync } from 'child_process';

const projectAliases: Record<string, string[]> = {
  chrome: ['chromium'],
  chromium: ['chromium'],
  firefox: ['firefox'],
  safari: ['webkit'],
  webkit: ['webkit'],
  edge: ['edge'],
  desktop: ['chromium', 'firefox', 'webkit'],
  mobile: ['mobile-chrome', 'mobile-safari', 'mobile-small', 'tablet'],
  'all-mobile': ['mobile-chrome', 'mobile-safari', 'mobile-small', 'tablet'],
};

const knownTags = new Set([
  '@smoke',
  '@regression',
  '@release-gate',
  '@mobile',
  '@a11y',
  '@visual',
  '@finance',
  '@health',
  '@commerce',
  '@api',
  '@self-healing',
  '@isolation',
]);

const passThroughValueFlags = new Set([
  '--config',
  '--forbid-only',
  '--global-timeout',
  '--grep-invert',
  '--last-failed',
  '--max-failures',
  '--output',
  '--repeat-each',
  '--reporter',
  '--retries',
  '--shard',
  '--test-list',
  '--test-list-invert',
  '--timeout',
  '--tsconfig',
  '--update-snapshots',
  '--workers',
]);

function takeValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function normalizeTag(value: string): string {
  return value.startsWith('@') ? value : `@${value}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addTag(tags: string[], value: string): void {
  for (const raw of value.split(',')) {
    const tag = normalizeTag(raw.trim());
    if (!tag || tag === '@') continue;
    if (!knownTags.has(tag)) {
      console.warn(`[pw] Unknown tag "${tag}". Passing it through for grep matching.`);
    }
    tags.push(tag);
  }
}

function addProject(projects: string[], value: string): void {
  const aliases = projectAliases[value] ?? [value];
  projects.push(...aliases);
}

function buildGrep(tags: string[], explicitGrep: string[]): string | null {
  const parts = [
    ...tags.map(tag => `(?=.*${escapeRegex(tag)})`),
    ...explicitGrep.map(grep => `(?=.*${grep})`),
  ];
  return parts.length > 0 ? parts.join('') : null;
}

function parseArgs(rawArgs: string[]): { commandArgs: string[]; dryRun: boolean } {
  const tags: string[] = [];
  const projects: string[] = [];
  const explicitGrep: string[] = [];
  const passThrough: string[] = [];
  const positional: string[] = [];
  let dryRun = false;

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === '--tag' || arg === '--tags') {
      addTag(tags, takeValue(rawArgs, index, arg));
      index += 1;
    } else if (arg.startsWith('--tag=')) {
      addTag(tags, arg.split('=').slice(1).join('='));
    } else if (arg === '--domain') {
      addTag(tags, takeValue(rawArgs, index, arg));
      index += 1;
    } else if (arg.startsWith('--domain=')) {
      addTag(tags, arg.split('=').slice(1).join('='));
    } else if (arg === '--browser' || arg === '--device' || arg === '--project') {
      addProject(projects, takeValue(rawArgs, index, arg));
      index += 1;
    } else if (arg.startsWith('--browser=') || arg.startsWith('--device=') || arg.startsWith('--project=')) {
      addProject(projects, arg.split('=').slice(1).join('='));
    } else if (arg === '--grep') {
      explicitGrep.push(takeValue(rawArgs, index, arg));
      index += 1;
    } else if (arg.startsWith('--grep=')) {
      explicitGrep.push(arg.split('=').slice(1).join('='));
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (passThroughValueFlags.has(arg)) {
      passThrough.push(arg, takeValue(rawArgs, index, arg));
      index += 1;
    } else if (arg.startsWith('--')) {
      passThrough.push(arg);
    } else {
      positional.push(arg);
    }
  }

  const commandArgs = ['playwright', 'test', ...positional];
  const grep = buildGrep(tags, explicitGrep);
  if (grep) commandArgs.push('--grep', grep);

  for (const project of [...new Set(projects)]) {
    commandArgs.push('--project', project);
  }

  commandArgs.push(...passThrough);
  return { commandArgs, dryRun };
}

const { commandArgs, dryRun } = parseArgs(process.argv.slice(2));
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';

console.log(`[pw] npx ${commandArgs.join(' ')}`);

if (!dryRun) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}
