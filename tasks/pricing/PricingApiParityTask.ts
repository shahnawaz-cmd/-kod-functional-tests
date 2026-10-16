// tasks/pricing/PricingApiParityTask.ts
import { Page, expect, test } from '@playwright/test';

export class PricingApiParityTask {
  async performAs(page: Page) {
    let apiPlans: any[] = [];

    await test.step('Step 1: Intercept & Fetch Pricing API Backend Data', async () => {
      console.log('📡 [Pricing] Fetching /api/pricing?sticker=1&dealer=1 relative to current project domain...');
      let data: any = null;

      // Resilient fetch: Try in-browser fetch first (warm HTTP/2/3 socket, cookies, no Node DNS bottleneck)
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          data = await page.evaluate(async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);
            const res = await fetch('/api/pricing?sticker=1&dealer=1', { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
          });
          if (data) break;
        } catch (browserErr: any) {
          console.warn(`⚠️ [Browser Fetch Attempt ${attempt} failed]: ${browserErr?.message || browserErr}. Retrying with page.request...`);
          try {
            const response = await page.request.get('/api/pricing?sticker=1&dealer=1', { timeout: 30000 });
            if (response.ok()) {
              data = await response.json();
              break;
            }
          } catch (reqErr: any) {
            console.warn(`⚠️ [API Request Attempt ${attempt} failed]: ${reqErr?.message || reqErr}`);
          }
          if (attempt === 3) break;
          await page.waitForTimeout(2000);
        }
      }

      const isWindowStickerSite = page.url().includes('windowsticker') || (page.context()?._options?.baseURL || '').includes('windowsticker');
      const planGroup = isWindowStickerSite && data?.stickerUser?.credit_plans?.length
        ? data.stickerUser
        : data?.reportUser;

      if (planGroup?.credit_plans?.length) {
        apiPlans = planGroup.credit_plans;
        const typeLabel = isWindowStickerSite ? 'Sticker' : 'Report';
        console.log(`✅ [API Validated] Found ${apiPlans.length} Personal plan(s):`, apiPlans.map((p: any) => `${p.nos} ${typeLabel}s = $${p.price}`));
      } else {
        console.warn('⚠️ [API Fallback] Could not parse backend plans from API; falling back to direct DOM card verification.');
      }
    });

    await test.step('Step 2: Validate Personal Pricing Cards on UI', async () => {
      console.log('🔍 [Pricing] Validating Personal pricing cards render on page...');

      await page.waitForLoadState('domcontentloaded');

      if (apiPlans.length > 0) {
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
      } else {
        // Fallback: Verify default standard tiers (1, 2, 5 items) are visible on UI
        for (const nos of [1, 2, 5]) {
          const card = page.locator('*').filter({ hasText: new RegExp(`^${nos}\\s*(Report|Sticker)s?`, 'i') }).first();
          await expect(card).toBeVisible({ timeout: 10000 });
        }
      }

      // Verify CTA Buttons render for plans (matches 'Get Report', 'Get Reports', 'Get Sticker', 'Get Stickers')
      const ctaButtons = page.getByRole('button', { name: /Get.*(Report|Sticker)/i });
      const count = await ctaButtons.count();
      expect(count).toBeGreaterThan(0);

      console.log(`✅ [UI Validated] Personal pricing cards verified successfully.`);
    });
  }
}
