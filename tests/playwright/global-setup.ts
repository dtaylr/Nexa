import fs from 'fs';
import path from 'path';

const ARTIFACT_DIRS = [
  'artifacts',
  'results/playwright',
  'test-results',
];

function ensureDir(dir: string): void {
  fs.mkdirSync(path.join(process.cwd(), dir), { recursive: true });
}

async function globalSetup(): Promise<void> {
  for (const dir of ARTIFACT_DIRS) ensureDir(dir);

  const context = {
    generatedAt: new Date().toISOString(),
    baseURL: process.env.BASE_URL ?? 'http://localhost:6173',
    apiURL: process.env.API_URL ?? 'http://localhost:3001',
    ci: Boolean(process.env.CI),
    runId: process.env.GITHUB_RUN_ID ?? process.env.PLAYWRIGHT_RUN_ID ?? 'local',
  };

  fs.writeFileSync(
    path.join(process.cwd(), 'artifacts', 'playwright-run-context.json'),
    `${JSON.stringify(context, null, 2)}\n`
  );
}

export default globalSetup;
