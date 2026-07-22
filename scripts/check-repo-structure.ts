import fs from 'fs';
import path from 'path';

const requiredPaths = [
  'README.md',
  'CONTRIBUTING.md',
  'CHANGELOG.md',
  '.env.example',
  '.github/CODEOWNERS',
  'agents/AGENTS.md',
  'agents/project.md',
  'agents/workflows.md',
  'agents/coding-standards.md',
  'agents/guardrails.json',
  'agents/context/architecture.md',
  'agents/context/domain-model.md',
  'agents/context/api-contracts.md',
  'agents/context/data-schemas.md',
  'agents/context/data-sensitivity.md',
  'agents/prompts/scout.md',
  'agents/prompts/builder.md',
  'agents/prompts/verifier.md',
  'agents/plans/README.md',
  'agents/evals/README.md',
  'docs/adr/README.md',
  'docs/runbooks/README.md',
  'docs/qa/playwright-automation.md',
  'tests/playwright/tagging.md',
];

const forbiddenTextChecks = [
  { file: 'agents/AGENTS.md', pattern: /Contact Keep|Cypress|MongoDB|Mongoose|Jest/i },
  { file: 'agents/project.md', pattern: /Contact Keep|Cypress|MongoDB|Mongoose|Jest/i },
  { file: 'agents/workflows.md', pattern: /Contact Keep|Cypress|MongoDB|Mongoose|Jest/i },
  { file: 'agents/coding-standards.md', pattern: /Contact Keep|Cypress|MongoDB|Mongoose|Jest/i },
  { file: 'README.md', pattern: /travel app|Grenada|itinerary/i },
];

function exists(repoPath: string): boolean {
  return fs.existsSync(path.join(process.cwd(), repoPath));
}

function readJson(repoPath: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), repoPath), 'utf8'));
}

const failures: string[] = [];

for (const repoPath of requiredPaths) {
  if (!exists(repoPath)) failures.push(`Missing required path: ${repoPath}`);
}

if (exists('agents/guardrails.json')) {
  const guardrails = readJson('agents/guardrails.json') as {
    requireHumanSignoff?: unknown;
    requirePlanFor?: unknown;
  };
  if (!Array.isArray(guardrails.requireHumanSignoff)) {
    failures.push('agents/guardrails.json must define requireHumanSignoff[]');
  }
  if (!Array.isArray(guardrails.requirePlanFor)) {
    failures.push('agents/guardrails.json must define requirePlanFor[]');
  }
}

for (const check of forbiddenTextChecks) {
  if (!exists(check.file)) continue;
  const content = fs.readFileSync(path.join(process.cwd(), check.file), 'utf8');
  if (check.pattern.test(content)) {
    failures.push(`Stale template text found in ${check.file}`);
  }
}

if (failures.length > 0) {
  console.error(failures.map(failure => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('Repo structure check passed');
