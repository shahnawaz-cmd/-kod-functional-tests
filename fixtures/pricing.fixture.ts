// fixtures/pricing.fixture.ts
import { test as base, Page, TestInfo } from '@playwright/test';
import { PricingApiParityTask } from '../tasks/pricing/PricingApiParityTask';
import { PricingTabSwitchTask } from '../tasks/pricing/PricingTabSwitchTask';
import { PricingFaqAndNavigationTask } from '../tasks/pricing/PricingFaqAndNavigationTask';
import { PricingResponsiveUiTask } from '../tasks/pricing/PricingResponsiveUiTask';
import { PricingRegionalCurrencyTask } from '../tasks/pricing/PricingRegionalCurrencyTask';
import { PricingCouponDiscountTask } from '../tasks/pricing/PricingCouponDiscountTask';
import { PricingToCheckoutNavigationTask } from '../tasks/pricing/PricingToCheckoutNavigationTask';

// ─────────────────────────────────────────────────────────────
// 1. INFRASTRUCTURE & NAVIGATION HELPERS
// ─────────────────────────────────────────────────────────────

export function getPricingRoute(testInfo: TestInfo): string {
  return testInfo?.project?.name?.includes('DetailedVehicleHistory') ? '/vin-check-rates' : '/pricing';
}

/**
 * Resilient Navigation: Commits fast on HTTP headers, then waits for business anchor.
 */
export async function resilientNavigateToPricing(page: Page, testInfo: TestInfo) {
  const route = getPricingRoute(testInfo);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.locator('*').filter({
        hasText: /(Report|Sticker|Pricing|Plan|Basic|Silver|Personal|Business)/i
      }).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
      return;
    } catch (err: any) {
      if (attempt === 3) throw err;
      console.warn(`⚠️ [Navigation Retry] Attempt ${attempt} timed out. Retrying in 1.5s...`);
      await page.waitForTimeout(1500);
    }
  }
}

/**
 * Executes task with automatic timeout recovery:
 * Real functional bugs fail immediately; transient network/socket stalls are retried once.
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
    const isTimeout =
      error?.name === 'TimeoutError' ||
      error?.message?.toLowerCase().includes('timeout') ||
      error?.message?.toLowerCase().includes('target closed') ||
      error?.message?.toLowerCase().includes('execution context was destroyed');

    if (!isTimeout) throw error; // Real functional defect: fail immediately!

    console.warn(`⚠️ [Timeout Shield] ${actionName} hit a transient stall. Recovering...`);
    testInfo.annotations.push({
      type: 'warning',
      description: `[Timeout Shield] Recovered transient timeout during ${actionName}`
    });

    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1500);
    } catch {}

    return await fn();
  }
}

export function skipMobile(testInfo: TestInfo, tcName: string) {
  const isMobile = Boolean(testInfo.project.use?.isMobile || testInfo.project.name.includes('Mobile'));
  base.skip(isMobile, `${tcName} is configured for Desktop only`);
}

// ─────────────────────────────────────────────────────────────
// 2. FIXTURE DEFINITIONS & DEPENDENCY INJECTION
// ─────────────────────────────────────────────────────────────

export type PricingFixtures = {
  pricingPage: Page;
  apiParityTask: PricingApiParityTask;
  tabSwitchTask: PricingTabSwitchTask;
  faqTask: PricingFaqAndNavigationTask;
  responsiveUiTask: PricingResponsiveUiTask;
  regionalCurrencyTask: PricingRegionalCurrencyTask;
  couponTask: PricingCouponDiscountTask;
  checkoutNavTask: PricingToCheckoutNavigationTask;
};

export const test = base.extend<PricingFixtures>({
  pricingPage: async ({ page }, use, testInfo) => {
    const isMobile = Boolean(testInfo.project.use?.isMobile || testInfo.project.name.includes('Mobile'));
    if (!isMobile) {
      const cdp = await page.context().newCDPSession(page).catch(() => null);
      if (cdp) await cdp.send('Network.clearBrowserCache').catch(() => {});
    } else {
      await page.setViewportSize({ width: 393, height: 851 });
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

  apiParityTask: async ({ pricingPage }, use, testInfo) => {
    const task = new PricingApiParityTask();
    await use({
      performAs: () => executeShielded('TC_PRICING_01 (ApiParity)', pricingPage, testInfo, () => task.performAs(pricingPage))
    } as any);
  },

  tabSwitchTask: async ({ pricingPage }, use, testInfo) => {
    const task = new PricingTabSwitchTask();
    await use({
      performAs: () => executeShielded('TC_PRICING_02 (TabSwitch)', pricingPage, testInfo, () => task.performAs(pricingPage, testInfo))
    } as any);
  },

  faqTask: async ({ pricingPage }, use, testInfo) => {
    const task = new PricingFaqAndNavigationTask();
    await use({
      performAs: () => executeShielded('TC_PRICING_03 (Faq)', pricingPage, testInfo, () => task.performAs(pricingPage))
    } as any);
  },

  responsiveUiTask: async ({ pricingPage }, use, testInfo) => {
    const task = new PricingResponsiveUiTask();
    await use({
      performAs: () => executeShielded('TC_PRICING_04 (ResponsiveUi)', pricingPage, testInfo, () => task.performAs(pricingPage, testInfo))
    } as any);
  },

  regionalCurrencyTask: async ({ pricingPage }, use, testInfo) => {
    const task = new PricingRegionalCurrencyTask();
    await use({
      performAs: () => executeShielded('TC_PRICING_05 (RegionalCurrency)', pricingPage, testInfo, () => task.performAs(pricingPage, testInfo))
    } as any);
  },

  couponTask: async ({ pricingPage }, use, testInfo) => {
    const task = new PricingCouponDiscountTask('preview15', 15);
    await use({
      performAs: () => executeShielded('TC_PRICING_06 (CouponDiscount)', pricingPage, testInfo, () => task.performAs(pricingPage, testInfo))
    } as any);
  },

  checkoutNavTask: async ({ pricingPage }, use, testInfo) => {
    const task = new PricingToCheckoutNavigationTask('any');
    await use({
      performAs: () => executeShielded('TC_PRICING_07 (CheckoutNav)', pricingPage, testInfo, () => task.performAs(pricingPage, testInfo))
    } as any);
  },
});

export { expect } from '@playwright/test';
