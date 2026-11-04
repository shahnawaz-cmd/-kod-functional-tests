// fixtures/sessionStickiness.fixture.ts
import { test as base, Page, TestInfo } from '@playwright/test';
import { SessionIpStickinessTask } from '../tasks/SessionIpStickinessTask';
import { gotoWithResilience, reloadWithResilience, isTransientNetworkError } from '../utils/resilientNavigation';

// ─────────────────────────────────────────────────────────────
// 1. RESILIENT NAVIGATION & TIMEOUT SHIELD HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Resilient Home Navigation: Commits fast on HTTP stream and waits for business anchor.
 */
export async function resilientNavigateToHome(page: Page, testInfo: TestInfo) {
  await gotoWithResilience(page, '/', {
    timeout: 30000,
    waitUntil: 'domcontentloaded',
    maxRetries: 3,
    readySelector: 'input, button, form, [data-testid="vin-input"]'
  });
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

    const isNetworkOrTimeout = isTransientNetworkError(error);
    if (!isNetworkOrTimeout) throw error;

    console.warn(`🛡️ [Timeout Shield Active] ${actionName} encountered an infrastructure issue: ${error?.message}`);
    testInfo.annotations.push({
      type: 'warning',
      description: `[Timeout Shield] Recovered transient issue during ${actionName}: ${error?.message?.slice(0, 150)}`
    });

    // 1. Recovery action: reload with resilience
    try {
      await reloadWithResilience(page, {
        timeout: 25000,
        waitUntil: 'domcontentloaded',
        readySelector: 'input, button, form, [data-testid="vin-input"]'
      });
      await page.waitForTimeout(1000);
    } catch (recoveryErr: any) {
      console.warn(`⚠️ [Timeout Shield] Recovery reload had issue: ${recoveryErr?.message}`);
    }

    // 2. Re-run task: if it still fails, it is a genuine outage
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
