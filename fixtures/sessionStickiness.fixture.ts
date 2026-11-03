// fixtures/sessionStickiness.fixture.ts
import { test as base, Page, TestInfo } from '@playwright/test';
import { SessionIpStickinessTask } from '../tasks/SessionIpStickinessTask';

// ─────────────────────────────────────────────────────────────
// 1. RESILIENT NAVIGATION & TIMEOUT SHIELD HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Resilient Home Navigation: Commits fast on HTTP stream and waits for business anchor.
 */
export async function resilientNavigateToHome(page: Page, testInfo: TestInfo) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 25000 });
      // Business Ready Anchor: Ensure input, button, or search form is visible
      await page.locator('input, button, form, [data-testid="vin-input"]')
        .first()
        .waitFor({ state: 'visible', timeout: 15000 })
        .catch(() => {});
      return;
    } catch (err: any) {
      if (attempt === 3) throw err;
      console.warn(`⚠️ [Home Navigation Retry] Attempt ${attempt} timed out. Retrying in 1.5s...`);
      await page.waitForTimeout(1500);
    }
  }
}

/**
 * Timeout Shield: Real functional bugs fail immediately; transient network stalls are retried once.
 * Includes readiness guards to ensure the page is fully interactive before re-executing.
 */
export async function executeShielded<T>(
  actionName: string,
  page: Page,
  testInfo: TestInfo,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    // Discriminate between functional defect vs environmental timeout
    const isFunctionalDefect =
      error?.name === 'AssertionError' ||
      error?.message?.includes('expect(') ||
      error?.message?.includes('toBe(') ||
      error?.message?.includes('MISMATCH') ||
      error?.message?.includes('[FAILURE]');

    // If it's a real functional bug, fail immediately without masking it!
    if (isFunctionalDefect) {
      throw error;
    }

    const isTimeout =
      error?.name === 'TimeoutError' ||
      error?.message?.toLowerCase().includes('timeout') ||
      error?.message?.toLowerCase().includes('target closed') ||
      error?.message?.toLowerCase().includes('frame was detached') ||
      error?.message?.toLowerCase().includes('execution context was destroyed');

    if (!isTimeout) throw error;

    console.warn(`🛡️ [Timeout Shield Active] ${actionName} encountered an infrastructure timeout: ${error?.message}`);
    testInfo.annotations.push({
      type: 'warning',
      description: `[Timeout Shield] Recovered transient timeout during ${actionName}: ${error?.message?.slice(0, 150)}`
    });

    // 1. Recovery action: reload with readiness guard
    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
      // 2. Wait for business readiness before re-executing
      await page.locator('input, button, form, [data-testid="vin-input"]')
        .first()
        .waitFor({ state: 'visible', timeout: 15000 })
        .catch(() => {});
      await page.waitForTimeout(1000);
    } catch (recoveryErr: any) {
      console.warn(`⚠️ [Timeout Shield] Recovery reload had issue: ${recoveryErr?.message}`);
    }

    // 3. Re-run task: if it still times out, it is a genuine outage
    return await fn();
  }
}

/**
 * Centralized Device & Project Filter Helper
 */
export function skipUnsupportedEnvironments(testInfo: TestInfo, tcName: string) {
  const isMobile = Boolean(testInfo.project.use?.isMobile || testInfo.project.name.includes('Mobile'));
  const isDesktopChrome = !isMobile && (testInfo.project.use?.browserName === 'chromium' || !testInfo.project.use?.browserName);
  base.skip(!isDesktopChrome, `${tcName} only runs on Desktop Chrome; skipping on mobile or non-desktop browsers`);

  const projectName = testInfo.project.name;
  const isSkippedSite = ['VehicleHistoryEU', 'VINNumberCA'].some((site) => projectName.includes(site));
  base.skip(isSkippedSite, `IP stickiness case is disabled for ${projectName} (VHREU & VNCA)`);
}

// ─────────────────────────────────────────────────────────────
// 2. FIXTURE DEFINITIONS & INJECTION
// ─────────────────────────────────────────────────────────────

export type SessionStickinessFixtures = {
  sessionPage: Page;
  stickinessTask: {
    executeStickinessCheck: (page: Page, targetIp?: string, reloadCount?: number, testInfo?: TestInfo) => Promise<any>;
  };
};

export const test = base.extend<SessionStickinessFixtures>({
  sessionPage: async ({ page }, use, testInfo) => {
    const isMobile = Boolean(testInfo.project.use?.isMobile || testInfo.project.name.includes('Mobile'));
    if (!isMobile) {
      const cdp = await page.context().newCDPSession(page).catch(() => null);
      if (cdp) await cdp.send('Network.clearBrowserCache').catch(() => {});
    }

    // Apply anti-bot stealth scripts cleanly at the fixture layer
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      (window as any).chrome = { runtime: {}, loadTimes: () => {}, csi: () => {}, app: () => {} };
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });

    await use(page);
  },

  stickinessTask: async ({ sessionPage }, use, testInfo) => {
    const task = new SessionIpStickinessTask();
    await use({
      executeStickinessCheck: (page: Page, targetIp?: string, reloadCount: number = 2, info?: TestInfo) =>
        executeShielded('TC_IP_01 (SessionIpStickinessTask)', page, info || testInfo, () =>
          task.executeStickinessCheck(page, targetIp, reloadCount, info || testInfo)
        ),
    });
  },
});

export { expect } from '@playwright/test';
