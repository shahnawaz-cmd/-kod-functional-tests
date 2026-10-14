// tasks/pricing/PricingTabSwitchTask.ts
import { Page, expect, test } from '@playwright/test';

export class PricingTabSwitchTask {
  async performAs(page: Page) {
    let dealerPlans: any[] = [];

    await test.step('Step 1: Fetch Dealer Plans from Backend', async () => {
      const response = await page.request.get('/api/pricing?sticker=1&dealer=1');
      if (response.status() === 200) {
        const data = await response.json();
        const isWindowStickerSite = page.url().includes('windowsticker') || (page.context()?._options?.baseURL || '').includes('windowsticker');
        dealerPlans = isWindowStickerSite && data.stickerDealer?.credit_plans?.length
          ? data.stickerDealer.credit_plans
          : (data.reportDealer?.credit_plans || []);
      }
    });

    await test.step('Step 2: Switch to Business Tab and Verify Business Plans Render', async () => {
      const businessBtn = page.getByRole('button', { name: /Business/i }).first();
      const hasBusinessTab = await businessBtn.isVisible().catch(() => false);
      if (!hasBusinessTab) {
        console.log('ℹ️ [Pricing] No Business tab present on this site (e.g. VHREU). Skipping tab switch.');
        return;
      }

      console.log('🔄 [Pricing] Clicking Business tab...');
      await businessBtn.click();
      await page.waitForTimeout(500);

      // Verify at least one business/dealer plan renders
      if (dealerPlans.length > 0) {
        const firstPlan = dealerPlans[0];
        const reportsLabel = `${firstPlan.nos}\\s*(Reports|Stickers)`;
        console.log(`   • Checking Business plan: ${firstPlan.nos} at $${firstPlan.price}`);
        const cardLocator = page.locator('*').filter({ hasText: new RegExp(reportsLabel, 'i') }).first();
        await expect(cardLocator).toBeVisible({ timeout: 10000 });
      }

      const ctaButtons = page.getByRole('button', { name: /Get.*(Report|Sticker)/i });
      expect(await ctaButtons.count()).toBeGreaterThan(0);
      console.log('✅ [Business Plan] Business plan cards displayed successfully.');
    });

    await test.step('Step 3: Switch Back to Personal Tab and Verify Plan Restoration', async () => {
      const personalBtn = page.getByRole('button', { name: /Personal/i }).first();
      if (await personalBtn.isVisible().catch(() => false)) {
        console.log('🔄 [Pricing] Clicking Personal tab...');
        await personalBtn.click();
        await page.waitForTimeout(500);

        const ctaButtons = page.getByRole('button', { name: /Get.*(Report|Sticker)/i });
        expect(await ctaButtons.count()).toBeGreaterThan(0);
        console.log('✅ [Personal Plan] Personal plan cards successfully restored.');
      }
    });
  }
}
