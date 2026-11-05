// fixtures/streaming.fixture.ts
import { test as base, expect, Page, BrowserContext, TestInfo } from '@playwright/test';
import { gotoWithResilience, reloadWithResilience, isTransientNetworkError } from '../utils/resilientNavigation';
import { ClarityVerificationTask } from '../tasks/ClarityVerificationTask';
import { ExitPopupBehaviour } from '../tasks/exit_popup_behaviour';

const { HomePage } = require('../streaming Task/pages/HomePage');
const { PreviewPage, PreviewToCheckoutPriceValidator } = require('../streaming Task/pages/PreviewPage');
const { CouponBannerHandler } = require('../streaming Task/pages/CouponFlowHandler');
const { StreamingYmmEditTask } = require('../streaming Task/tasks/StreamingYmmEditTask');
const { ClassicEditableSpecsUpdateTask } = require('../streaming Task/tasks/ClassicEditableSpecsUpdateTask');
const { StreamingRevisitBannerTask } = require('../streaming Task/tasks/StreamingRevisitBannerTask');
const { ClassicVinGenerator } = require('../streaming Task/tasks/ClassicVinGenerator');
const { VinErrorTask } = require('../streaming Task/tasks/VinErrorTask');
const { PlateErrorTask } = require('../streaming Task/tasks/PlateErrorTask');
const { UrlSpaceHandlingTask } = require('../streaming Task/tasks/UrlSpaceHandlingTask');
const { ErrorPageToHomeCollectionTask } = require('../streaming Task/tasks/ErrorPageToHomeCollectionTask');
const { ExitIntentHelper } = require('../tasks/exit_intent_banner');

// ─────────────────────────────────────────────────────────────
// 1. INFRASTRUCTURE & NAVIGATION HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Resilient navigation to home with readiness assertion on primary VIN entrypoint.
 */
export async function resilientNavigateHome(page: Page) {
  await gotoWithResilience(page, '/', {
    timeout: 30000,
    waitUntil: 'domcontentloaded',
    maxRetries: 3,
    readySelector: 'input[name="vin"], input[placeholder*="VIN" i], input[type="text"], button[type="submit"]'
  });
}

/**
 * Timeout Shield:
 * Distinguishes genuine functional assertion errors from transient network/socket/timing stalls.
 * Genuine assertion defects fail immediately with full diagnostics.
 * Transient environmental blips trigger resilient reload and single recovery execution.
 */
export async function executeShieldedStreaming<T>(
  actionName: string,
  page: Page,
  testInfo: TestInfo,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isFunctionalDefect =
      error?.name === 'AssertionError' ||
      error?.message?.includes('expect(') ||
      error?.message?.includes('toBe(') ||
      error?.message?.includes('MISMATCH') ||
      error?.message?.includes('[FAILURE]');

    if (isFunctionalDefect) {
      throw error;
    }

    const isNetworkOrTimeout = isTransientNetworkError(error);
    if (!isNetworkOrTimeout) throw error;

    console.warn(`🛡️ [Streaming Timeout Shield Active] ${actionName} hit a transient environmental stall. Recovering...`);
    testInfo.annotations.push({
      type: 'warning',
      description: `[Streaming Timeout Shield] Recovered transient issue during ${actionName}: ${error?.message?.slice(0, 150)}`
    });

    try {
      await reloadWithResilience(page, {
        timeout: 25000,
        waitUntil: 'domcontentloaded',
        readySelector: 'input[name="vin"], input[placeholder*="VIN" i], .vehicle-specs, h1, main'
      });
      await page.waitForTimeout(1000);
    } catch (recoveryErr: any) {
      console.warn(`⚠️ [Streaming Timeout Shield] Recovery reload warning: ${recoveryErr?.message}`);
    }

    return await fn();
  }
}

export function skipMobile(testInfo: TestInfo, tcName: string) {
  const isMobile = Boolean(testInfo.project.use?.isMobile || testInfo.project.name.toLowerCase().includes('mobile'));
  base.skip(isMobile, `${tcName} is configured for Desktop browsers only`);
}

// ─────────────────────────────────────────────────────────────
// 2. FIXTURE DEFINITIONS & DEPENDENCY INJECTION
// ─────────────────────────────────────────────────────────────

export type StreamingFixtures = {
  streamingPage: Page;
  homePage: any;
  previewPage: any;
  clarityTask: ClarityVerificationTask;
  exitPopupTask: ExitPopupBehaviour;
  ymmTask: any;
  classicSpecsUpdateTask: any;
  revisitBannerTask: any;
  couponBannerHandler: any;
  vinErrorTask: any;
  plateErrorTask: any;
  urlSpaceTask: any;
  errorPageTask: any;
  classicVinGenerator: typeof ClassicVinGenerator;
  exitIntentHelper: typeof ExitIntentHelper;
};

export const test = base.extend<StreamingFixtures>({
  streamingPage: async ({ page, context }, use, testInfo) => {
    await context.clearCookies();
    await context.clearPermissions();

    const client = await context.newCDPSession(page).catch(() => null);
    if (client) {
      await client.send('Network.clearBrowserCache').catch(() => {});
      await client.send('Network.setCacheDisabled', { cacheDisabled: true }).catch(() => {});
    }

    const isClarityTest = testInfo.title.toLowerCase().includes('clarity');
    const trackerPattern = isClarityTest
      ? /.*(google-analytics\.com|hotjar\.com|connect\.facebook\.net|snap\.licdn\.com).*/i
      : /.*(google-analytics\.com|googletagmanager\.com|hotjar\.com|clarity\.ms|connect\.facebook\.net|snap\.licdn\.com).*/i;
    await page.route(trackerPattern, (route) => route.abort()).catch(() => {});

    await use(page);
  },

  homePage: async ({ streamingPage }, use) => {
    await use(new HomePage(streamingPage));
  },

  previewPage: async ({ streamingPage }, use) => {
    await use(new PreviewPage(streamingPage));
  },

  clarityTask: async ({}, use, testInfo) => {
    await use(new ClarityVerificationTask(testInfo));
  },

  exitPopupTask: async ({}, use) => {
    await use(new ExitPopupBehaviour());
  },

  ymmTask: async ({ streamingPage }, use) => {
    await use(new StreamingYmmEditTask(streamingPage));
  },

  classicSpecsUpdateTask: async ({ streamingPage }, use) => {
    await use(new ClassicEditableSpecsUpdateTask(streamingPage));
  },

  revisitBannerTask: async ({}, use) => {
    await use(new StreamingRevisitBannerTask());
  },

  couponBannerHandler: async ({ streamingPage }, use) => {
    await use(new CouponBannerHandler(streamingPage));
  },

  vinErrorTask: async ({ streamingPage }, use) => {
    await use(new VinErrorTask(streamingPage));
  },

  plateErrorTask: async ({ streamingPage }, use) => {
    await use(new PlateErrorTask(streamingPage));
  },

  urlSpaceTask: async ({ streamingPage }, use) => {
    await use(new UrlSpaceHandlingTask(streamingPage));
  },

  errorPageTask: async ({ streamingPage }, use) => {
    await use(new ErrorPageToHomeCollectionTask(streamingPage));
  },

  classicVinGenerator: async ({}, use) => {
    await use(ClassicVinGenerator);
  },

  exitIntentHelper: async ({}, use) => {
    await use(ExitIntentHelper);
  }
});

export { expect };
