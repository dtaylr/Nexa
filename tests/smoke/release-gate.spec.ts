import { test, expect } from '../playwright/fixtures';
import {
  expectNoHorizontalOverflow,
  gotoDomain,
  loginAndStoreToken,
  writeJsonArtifact,
} from '../playwright/hooks';

test.describe('@smoke @regression @release-gate 1Platform release readiness', () => {
  test('validates domain landing routes and writes release evidence @finance @health @commerce', async ({
    page,
    request,
    apiURL,
  }, testInfo) => {
    const api = await request.get(`${apiURL}/health`);
    expect(api.status()).toBe(200);

    const evidence: Array<{ domain: string; path: string; status: 'ready' }> = [];

    await loginAndStoreToken(page, request, 'finance');
    await gotoDomain(page, 'finance');
    await expect(page.getByText(/BrightBank|Welcome back|Accounts/i).first()).toBeVisible();
    await expectNoHorizontalOverflow(page, 'Finance dashboard');
    evidence.push({ domain: 'finance', path: page.url(), status: 'ready' });

    await loginAndStoreToken(page, request, 'health');
    await gotoDomain(page, 'health');
    await expect(page.getByText(/HealthyU|Appointments|Patient/i).first()).toBeVisible();
    await expectNoHorizontalOverflow(page, 'Health dashboard');
    evidence.push({ domain: 'health', path: page.url(), status: 'ready' });

    await gotoDomain(page, 'commerce');
    await expect(page.locator('a[href^="/BuyItAll/products/"]').first()).toBeVisible();
    await expectNoHorizontalOverflow(page, 'Commerce product listing');
    evidence.push({ domain: 'commerce', path: page.url(), status: 'ready' });

    const projectName = testInfo.project.name.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    writeJsonArtifact(`release-gate-evidence-${projectName}.json`, {
      generatedAt: new Date().toISOString(),
      project: testInfo.project.name,
      status: 'ready',
      checks: evidence,
    });
  });
});
