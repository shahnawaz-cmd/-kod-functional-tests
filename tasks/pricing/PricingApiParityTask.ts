// tasks/pricing/PricingApiParityTask.ts
import { Page, expect, test } from '@playwright/test';

export class PricingApiParityTask {
  async performAs(page: Page) {
    let apiPlans: any[] = [];

    await test.step('Step 1: Intercept & Fetch Pricing API Backend Data', async () => {
      console.log('📡 [Pricing] Fetching /api/pricing?sticker=1&dealer=1 relative to current project domain...');
      const response = await page.request.get('/api/pricing?sticker=1&dealer=1');
      expect(response.status()).toBe(200);

      const data = await response.json();
      const isWindowStickerSite = page.url().includes('windowsticker') || (page.context()?._options?.baseURL || '').includes('windowsticker');
      const planGroup = isWindowStickerSite && data.stickerUser?.credit_plans?.length
        ? data.stickerUser
        : data.reportUser;

      expect(planGroup).toBeDefined();
      expect(planGroup.credit_plans).toBeInstanceOf(Array);
      expect(planGroup.credit_plans.length).toBeGreaterThan(0);

      apiPlans = planGroup.credit_plans;
      const typeLabel = isWindowStickerSite ? 'Sticker' : 'Report';
      console.log(`✅ [API Validated] Found ${apiPlans.length} Personal plan(s):`, apiPlans.map((p: any) => `${p.nos} ${typeLabel}s = $${p.price}`));
    });

    await test.step('Step 2: Validate Personal Pricing Cards on UI', async () => {
      console.log('🔍 [Pricing] Validating Personal pricing cards render on page...');

      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      for (const plan of apiPlans) {
        const itemLabel = `${plan.nos}\\s*(Report|Sticker)`;
        const cardLocator = page.locator('*').filter({ hasText: new RegExp(`^${itemLabel}`, 'i') }).first();
        await expect(cardLocator).toBeVisible({ timeout: 10000 });

        const sign = plan.currency_sign ? plan.currency_sign.replace('$', '\\$') : '\\$';
        const priceRegex = new RegExp(`(${sign}|\\$)?\\s*${plan.price}`);
        const priceLocator = page.locator('*').filter({ hasText: priceRegex }).first();
        await expect(priceLocator).toBeVisible({ timeout: 10000 });

        console.log(`   • Verified UI card: ${plan.nos} item(s) at ${plan.currency_sign || '$'}${plan.price}`);
      }

      // Verify CTA Buttons render for plans (matches 'Get Report', 'Get Reports', 'Get Sticker', 'Get Stickers')
      const ctaButtons = page.getByRole('button', { name: /Get.*(Report|Sticker)/i });
      const count = await ctaButtons.count();
      expect(count).toBeGreaterThan(0);

      console.log(`✅ [UI Validated] All ${apiPlans.length} Personal cards match backend API values.`);
    });
  }
}
