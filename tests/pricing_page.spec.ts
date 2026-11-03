// tests/pricing_page.spec.ts
import { test, resilientNavigateToPricing, skipMobile } from '../fixtures/pricing.fixture';

test.describe('Pricing Page Suite', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.describe.configure({ timeout: process.env.CI ? 120000 : 90000 });

  test('TC_PRICING_01 — Verify Personal pricing cards render and match /api/pricing backend parity',
    { tag: ['@desktop', '@pricing'] },
    async ({ pricingPage, apiParityTask }, testInfo) => {
      skipMobile(testInfo, 'TC_PRICING_01');
      await resilientNavigateToPricing(pricingPage, testInfo);
      await apiParityTask.performAs(pricingPage);
    }
  );

  test('TC_PRICING_02 — Verify Personal vs Business tab switching and dynamic plan rendering',
    { tag: ['@desktop', '@pricing'] },
    async ({ pricingPage, tabSwitchTask }, testInfo) => {
      skipMobile(testInfo, 'TC_PRICING_02');
      await resilientNavigateToPricing(pricingPage, testInfo);
      await tabSwitchTask.performAs(pricingPage, testInfo);
    }
  );

  test('TC_PRICING_03 — Verify FAQ accordion expand/collapse and external link integrity',
    { tag: ['@desktop', '@pricing'] },
    async ({ pricingPage, faqTask }, testInfo) => {
      skipMobile(testInfo, 'TC_PRICING_03');
      await resilientNavigateToPricing(pricingPage, testInfo);
      await faqTask.performAs(pricingPage);
    }
  );

  test('TC_PRICING_04 — Verify mobile layout stacking, toggle accessibility, and capture screenshot',
    { tag: ['@mobile', '@pricing'] },
    async ({ pricingPage, responsiveUiTask }, testInfo) => {
      await resilientNavigateToPricing(pricingPage, testInfo);
      await responsiveUiTask.performAs(pricingPage, testInfo);
    }
  );

  test('TC_PRICING_05 — Verify random regional IP & country cookie injection updates pricing to relevant currency code',
    { tag: ['@desktop', '@pricing', '@multi-currency'] },
    async ({ pricingPage, regionalCurrencyTask }, testInfo) => {
      skipMobile(testInfo, 'TC_PRICING_05');
      const isLocked = ['VehicleHistoryEU', 'VINNumberCA'].some(site => testInfo.project.name.includes(site));
      test.skip(isLocked, `Multi-currency disabled on ${testInfo.project.name}`);

      await regionalCurrencyTask.performAs(pricingPage, testInfo);
    }
  );

  test('TC_PRICING_06 — Verify coupon banner appearance and percentage price reflection on /pricing',
    { tag: ['@desktop', '@pricing', '@coupons'] },
    async ({ pricingPage, couponTask }, testInfo) => {
      skipMobile(testInfo, 'TC_PRICING_06');
      await resilientNavigateToPricing(pricingPage, testInfo);
      await couponTask.performAs(pricingPage, testInfo);
    }
  );

  test('TC_PRICING_07 — Verify plan selection and navigation to checkout',
    { tag: ['@desktop', '@pricing', '@checkout'] },
    async ({ pricingPage, checkoutNavTask }, testInfo) => {
      skipMobile(testInfo, 'TC_PRICING_07');
      await checkoutNavTask.performAs(pricingPage, testInfo);
    }
  );
});
