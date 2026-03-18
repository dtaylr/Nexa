/**
 * Self-Healing Page
 *
 * Wraps a Playwright Page and provides locator resolution with
 * automatic fallback. When a primary locator fails, the resolver
 * walks through a ranked list of alternative strategies and logs
 * every healing event to a JSON report.
 *
 * Healing strategy precedence (fastest/most-stable first):
 *   1. data-testid attribute (owned by devs, highest stability)
 *   2. ARIA role + accessible name
 *   3. Visible text content
 *   4. CSS class (fragile — last resort)
 *
 * Healing events are written to artifacts/healing-events.json
 * so CI can surface them as warnings, prompting test maintenance
 * before they become failures.
 */

import type { Page, Locator } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export type LocatorStrategyKind =
  | 'testid'
  | 'aria-role'
  | 'text'
  | 'css'
  | 'placeholder'
  | 'label';

export interface LocatorStrategy {
  kind: LocatorStrategyKind;
  value: string;
  /** Optional ARIA role for 'aria-role' kind */
  role?: string;
}

export interface HealingEvent {
  timestamp: string;
  testFile: string;
  primarySelector: string;
  healedWith: LocatorStrategy;
  url: string;
}

const HEALING_LOG_PATH = path.join(process.cwd(), 'artifacts', 'healing-events.json');

function appendHealingEvent(event: HealingEvent): void {
  fs.mkdirSync(path.dirname(HEALING_LOG_PATH), { recursive: true });
  const existing: HealingEvent[] = fs.existsSync(HEALING_LOG_PATH)
    ? JSON.parse(fs.readFileSync(HEALING_LOG_PATH, 'utf-8'))
    : [];
  existing.push(event);
  fs.writeFileSync(HEALING_LOG_PATH, JSON.stringify(existing, null, 2));
}

export class SelfHealingPage {
  constructor(
    readonly page: Page,
    private readonly testFile: string = 'unknown'
  ) {}

  /**
   * Resolve a locator with automatic fallback.
   *
   * @param primary  - The primary Playwright Locator to try first.
   * @param alternatives - Ordered list of fallback strategies.
   * @param timeout - Time (ms) to wait for each locator.
   */
  async locate(
    primary: Locator,
    alternatives: LocatorStrategy[],
    timeout = 3000
  ): Promise<Locator> {
    try {
      await primary.waitFor({ state: 'attached', timeout });
      return primary;
    } catch {
      // Primary locator failed — walk alternatives
      for (const strategy of alternatives) {
        const candidate = this.buildLocator(strategy);
        try {
          await candidate.waitFor({ state: 'attached', timeout: Math.floor(timeout / 3) });
          appendHealingEvent({
            timestamp: new Date().toISOString(),
            testFile: this.testFile,
            primarySelector: primary.toString(),
            healedWith: strategy,
            url: this.page.url(),
          });
          console.warn(
            `[self-heal] ${this.testFile}: healed locator via ${strategy.kind}="${strategy.value}"`
          );
          return candidate;
        } catch {
          // try next strategy
        }
      }

      throw new Error(
        `[self-heal] Could not locate element with primary or any of ${alternatives.length} alternatives.\n` +
          `  Primary: ${primary.toString()}\n` +
          `  Tried: ${alternatives.map(s => `${s.kind}="${s.value}"`).join(', ')}`
      );
    }
  }

  /** click() with self-healing locator resolution. */
  async click(
    primary: Locator,
    alternatives: LocatorStrategy[],
    timeout?: number
  ): Promise<void> {
    const loc = await this.locate(primary, alternatives, timeout);
    await loc.click();
  }

  /** fill() with self-healing locator resolution. */
  async fill(
    primary: Locator,
    value: string,
    alternatives: LocatorStrategy[],
    timeout?: number
  ): Promise<void> {
    const loc = await this.locate(primary, alternatives, timeout);
    await loc.fill(value);
  }

  private buildLocator(strategy: LocatorStrategy): Locator {
    switch (strategy.kind) {
      case 'testid':
        return this.page.getByTestId(strategy.value);
      case 'aria-role':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return this.page.getByRole(strategy.role as any, { name: strategy.value });
      case 'text':
        return this.page.getByText(strategy.value, { exact: false });
      case 'placeholder':
        return this.page.getByPlaceholder(strategy.value);
      case 'label':
        return this.page.getByLabel(strategy.value);
      case 'css':
        return this.page.locator(strategy.value);
      default:
        throw new Error(`Unknown locator strategy kind: ${(strategy as LocatorStrategy).kind}`);
    }
  }

  /** Delegate to underlying Playwright page for non-healed operations. */
  get url(): string {
    return this.page.url();
  }

  async goto(url: string): Promise<void> {
    await this.page.goto(url);
  }

  async screenshot(path: string): Promise<void> {
    await this.page.screenshot({ path });
  }
}
