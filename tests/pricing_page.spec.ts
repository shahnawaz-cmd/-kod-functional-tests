// tests/pricing_page.spec.ts
import { test } from '@playwright/test';
import { PricingApiParityTask } from '../tasks/pricing/PricingApiParityTask';
import { PricingTabSwitchTask } from '../tasks/pricing/PricingTabSwitchTask';
import { PricingFaqAndNavigationTask } from '../tasks/pricing/PricingFaqAndNavigationTask';
import { PricingResponsiveUiTask } from '../tasks/pricing/PricingResponsiveUiTask';
import { PricingRegionalCurrencyTask } from '../tasks/pricing/PricingRegionalCurrencyTask';
import { PricingCouponDiscountTask } from '../tasks/pricing/PricingCouponDiscountTask';
import { PricingToCheckoutNavigationTask } from '../tasks/pricing/PricingToCheckoutNavigationTask';

// Helper function to resolve pricing route based on project domain
function getPricingRoute(testInfo: any): string {
  const baseURL = testInfo.project.use?.baseURL || '';
  const projectName = testInfo.project.name || '';
  if (baseURL.includes('detailedvehiclehistory.com') || projectName.includes('DetailedVehicleHistory')) {
    return '/vin-check-rates';
  }
  return '/pricing';
}

test.describe('Pricing Page Suite', () => {
  // Use clean isolated session state
  test.use({ storageState: { cookies: [], origins: [] } });

  // ─────────────────────────────────────────────────────────────
  // TC_01: Pricing Card Render & API Parity (Desktop Only)
  // ─────────────────────────────────────────────────────────────
  test('TC_PRICING_01 — Verify Personal pricing cards render and match /api/pricing backend parity', async ({ page }, testInfo) => {
    const isMobile = Boolean(testInfo.project.use?.isMobile || testInfo.project.name.includes('Mobile'));
    test.skip(isMobile, 'TC_PRICING_01 is configured for Desktop only');

    testInfo.setTimeout(process.env.CI ? 120000 : 90000);

    // Navigate to current project's pricing route
    const pricingRoute = getPricingRoute(testInfo);
    await page.goto(pricingRoute, { waitUntil: 'domcontentloaded' });
    const task = new PricingApiParityTask();
    await task.performAs(page);

    await page.close();
  });

  // ─────────────────────────────────────────────────────────────
  // TC_02: Business Tab Toggle Verification (Desktop Only)
  // ─────────────────────────────────────────────────────────────
  test('TC_PRICING_02 — Verify Personal vs Business tab switching and dynamic plan rendering', async ({ page }, testInfo) => {
    const isMobile = Boolean(testInfo.project.use?.isMobile || testInfo.project.name.includes('Mobile'));
    test.skip(isMobile, 'TC_PRICING_02 is configured for Desktop only');

    testInfo.setTimeout(process.env.CI ? 120000 : 90000);

    const pricingRoute = getPricingRoute(testInfo);
    await page.goto(pricingRoute, { waitUntil: 'domcontentloaded' });
    const task = new PricingTabSwitchTask();
    await task.performAs(page);

    await page.close();
  });

  // ─────────────────────────────────────────────────────────────
  // TC_03: FAQ Accordions & External Navigation (Desktop Only)
  // ─────────────────────────────────────────────────────────────
  test('TC_PRICING_03 — Verify FAQ accordion expand/collapse and external link integrity', async ({ page }, testInfo) => {
    const isMobile = Boolean(testInfo.project.use?.isMobile || testInfo.project.name.includes('Mobile'));
    test.skip(isMobile, 'TC_PRICING_03 is configured for Desktop only');

    testInfo.setTimeout(process.env.CI ? 120000 : 90000);

    const pricingRoute = getPricingRoute(testInfo);
    await page.goto(pricingRoute, { waitUntil: 'domcontentloaded' });
    const task = new PricingFaqAndNavigationTask();
    await task.performAs(page);

    await page.close();
  });

  // ─────────────────────────────────────────────────────────────
  // TC_04: Mobile Responsive UI & Viewport Layout (Mobile Only)
  // ─────────────────────────────────────────────────────────────
  test('TC_PRICING_04 — Verify mobile layout stacking, toggle accessibility, and capture screenshot', async ({ page }, testInfo) => {
    testInfo.setTimeout(process.env.CI ? 120000 : 90000);

    const isMobile = Boolean(testInfo.project.use?.isMobile || testInfo.project.name.includes('Mobile'));
    if (!isMobile) {
      await page.setViewportSize({ width: 393, height: 851 });
    }

    const pricingRoute = getPricingRoute(testInfo);
    await page.goto(pricingRoute, { waitUntil: 'domcontentloaded' });
    const task = new PricingResponsiveUiTask();
    await task.performAs(page, testInfo);

    await page.close();
  });

  // ─────────────────────────────────────────────────────────────
  // TC_05: Multi-Currency Regional Pricing Validation (Desktop Only)
  // ─────────────────────────────────────────────────────────────
  test('TC_PRICING_05 — Verify random regional IP & country cookie injection updates pricing to relevant currency code', async ({ page }, testInfo) => {
    const isMobile = Boolean(testInfo.project.use?.isMobile || testInfo.project.name.includes('Mobile'));
    test.skip(isMobile, 'TC_PRICING_05 is configured for Desktop only');

    // Skip for sites locked to a single regional local currency (VehicleHistoryEU is EUR-only, VINNumberCA is CAD-only)
    const isLockedCurrencySite = ['VehicleHistoryEU', 'VINNumberCA'].some(site => testInfo.project.name.includes(site));
    test.skip(isLockedCurrencySite, `TC_PRICING_05 multi-currency is disabled on ${testInfo.project.name} (locked regional currency)`);

    testInfo.setTimeout(process.env.CI ? 120000 : 90000);

    const pricingRoute = getPricingRoute(testInfo);
    await page.goto(pricingRoute, { waitUntil: 'domcontentloaded' });
    const task = new PricingRegionalCurrencyTask();
    await task.performAs(page, testInfo);

    await page.close();
  });

  // ─────────────────────────────────────────────────────────────
  // TC_06: Coupon Banner & Percentage Price Reflection (Desktop Only)
  // ─────────────────────────────────────────────────────────────
  test('TC_PRICING_06 — Verify coupon banner appearance and percentage price reflection on /pricing', async ({ page }, testInfo) => {
    const isMobile = Boolean(testInfo.project.use?.isMobile || testInfo.project.name.includes('Mobile'));
    test.skip(isMobile, 'TC_PRICING_06 is configured for Desktop only');

    testInfo.setTimeout(process.env.CI ? 120000 : 90000);

    const task = new PricingCouponDiscountTask('preview15', 15);
    await task.performAs(page, testInfo);

    await page.close();
  });

  // ─────────────────────────────────────────────────────────────
  // TC_07: Pricing to Checkout Navigation
  // ─────────────────────────────────────────────────────────────
  test('TC_PRICING_07 — Verify plan selection and navigation to checkout', async ({ page }, testInfo) => {
    const isMobile = Boolean(testInfo.project.use?.isMobile || testInfo.project.name.includes('Mobile'));
    test.skip(isMobile, 'TC_PRICING_07 is configured for Desktop only');

    testInfo.setTimeout(process.env.CI ? 150000 : 120000);

    // Apply anti-bot stealth before navigation
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      (window as any).chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });

    // 1. Perform Pricing to Checkout Navigation (handles resilient /pricing navigation with retry)
    const navTask = new PricingToCheckoutNavigationTask('any');
    await navTask.performAs(page, testInfo);

    await page.close();
  });
});
