// fixtures/pricing.fixture.ts
import { test as base, Page, TestInfo } from '@playwright/test';
import { PricingApiParityTask } from '../tasks/pricing/PricingApiParityTask';
import { PricingTabSwitchTask } from '../tasks/pricing/PricingTabSwitchTask';
import { PricingFaqAndNavigationTask } from '../tasks/pricing/PricingFaqAndNavigationTask';
import { PricingResponsiveUiTask } from '../tasks/pricing/PricingResponsiveUiTask';
import { PricingRegionalCurrencyTask } from '../tasks/pricing/PricingRegionalCurrencyTask';
import { PricingCouponDiscountTask } from '../tasks/pricing/PricingCouponDiscountTask';
import { PricingToCheckoutNavigationTask } from '../tasks/pricing/PricingToCheckoutNavigationTask';
import { gotoWithResilience, reloadWithResilience, isTransientNetworkError } from '../utils/resilientNavigation';

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
  await gotoWithResilience(page, route, {
    timeout: 30000,
    waitUntil: 'domcontentloaded',
    maxRetries: 3,
    readySelector: '*:has-text("Report"), *:has-text("Sticker"), *:has-text("Pricing"), *:has-text("Plan")'
  });
}

/**
 * Executes task with automatic timeout & network recovery:
 * Real functional bugs fail immediately; transient network/socket stalls are retried once.
 * Includes readiness guards to ensure business cards are visible before re-executing.
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

    // If it's a real functional defect, fail immediately without masking it!
    if (isFunctionalDefect) {
      throw error;
    }

    const isNetworkOrTimeout = isTransientNetworkError(error);
    if (!isNetworkOrTimeout) throw error;

    console.warn(`🛡️ [Timeout Shield Active] ${actionName} hit a transient infrastructure/network stall. Recovering...`);
    testInfo.annotations.push({
      type: 'warning',
      description: `[Timeout Shield] Recovered transient issue during ${actionName}: ${error?.message?.slice(0, 150)}`
    });

    try {
      await reloadWithResilience(page, {
        timeout: 25000,
        waitUntil: 'domcontentloaded',
        readySelector: '*:has-text("Report"), *:has-text("Sticker"), *:has-text("Pricing"), *:has-text("Plan")'
      });
      await page.waitForTimeout(1000);
    } catch (recoveryErr: any) {
      console.warn(`⚠️ [Timeout Shield] Recovery reload had issue: ${recoveryErr?.message}`);
    }

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
