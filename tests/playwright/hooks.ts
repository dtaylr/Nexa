import fs from 'fs';
import path from 'path';
import type { APIRequestContext, Locator, Page, TestInfo } from '@playwright/test';
import { expect } from '@playwright/test';

export type DemoDomain = 'finance' | 'health' | 'commerce';

export const domainRoutes: Record<DemoDomain, string> = {
  finance: '/BrightBank/dashboard',
  health: '/HealthyU/dashboard',
  commerce: '/BuyItAll/products',
};

export const demoUsers: Record<DemoDomain, { email: string; password: string; tokenKey: string }> = {
  finance: { email: 'alice@1platform.dev', password: 'password123', tokenKey: 'fin_token' },
  health: { email: 'patient.one@1platform.dev', password: 'password123', tokenKey: 'hlt_token' },
  commerce: { email: 'shopper@1platform.dev', password: 'password123', tokenKey: 'shop_token' },
};

export function apiBaseURL(): string {
  return process.env.API_URL ?? 'http://localhost:3001';
}

export async function loginAndStoreToken(
  page: Page,
  request: APIRequestContext,
  domain: DemoDomain
): Promise<string> {
  const user = demoUsers[domain];
  const response = await request.post(`${apiBaseURL()}/api/auth/login`, {
    data: { email: user.email, password: user.password },
  });

  expect(response.ok(), `${domain} demo login should succeed`).toBeTruthy();
  const body = await response.json();
  const token = body.token as string;

  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: user.tokenKey, value: token }
  );

  return token;
}

export async function gotoDomain(page: Page, domain: DemoDomain, pathOverride?: string): Promise<void> {
  await page.goto(pathOverride ?? domainRoutes[domain]);
  await page.waitForLoadState('domcontentloaded');
}

export async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth, `${label}: horizontal overflow ${scrollWidth}px > ${viewportWidth}px`)
    .toBeLessThanOrEqual(viewportWidth);
}

export async function expectMinTouchTarget(locator: Locator, label: string, minSize = 44): Promise<void> {
  const box = await locator.boundingBox();
  expect(box, `${label}: element should have a measurable box`).toBeTruthy();
  expect(box!.height, `${label}: touch target height < ${minSize}px`).toBeGreaterThanOrEqual(minSize);
  expect(box!.width, `${label}: touch target width < ${minSize}px`).toBeGreaterThanOrEqual(minSize);
}

export function writeJsonArtifact(name: string, payload: unknown): string {
  const artifactsDir = path.join(process.cwd(), 'artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });
  const safeName = name.endsWith('.json') ? name : `${name}.json`;
  const outputPath = path.join(artifactsDir, safeName);
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  return outputPath;
}

export async function attachJson(testInfo: TestInfo, name: string, payload: unknown): Promise<void> {
  await testInfo.attach(name, {
    body: JSON.stringify(payload, null, 2),
    contentType: 'application/json',
  });
}
