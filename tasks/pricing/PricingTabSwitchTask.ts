// tasks/pricing/PricingTabSwitchTask.ts
import { Page, expect, test } from '@playwright/test';

export class PricingTabSwitchTask {
  async performAs(page: Page) {
    await test.step('Step 1: Switch to Business Tab and Verify Business Plans Render', async () => {
      const businessBtn = page.getByRole('button', { name: /Business/i }).first();
      const hasBusinessTab = await businessBtn.isVisible().catch(() => false);
      if (!hasBusinessTab) {
        console.log('ℹ️ [Pricing] No Business tab present on this site (e.g. VHREU). Skipping tab switch.');
        return;
      }

      console.log('🔄 [Pricing] Clicking Business tab...');
      await businessBtn.click();

      // Verify Business volume plan cards render dynamically in the DOM
      const businessTiers = page.locator('h3, [class*="card"], [class*="plan"]')
        .filter({ hasText: /\b(25|50|100|Dealer|Bulk|Business)\b/i });
      await expect(businessTiers.first()).toBeVisible({ timeout: 10000 });

      const ctaButtons = page.getByRole('button', { name: /Get.*(Report|Sticker)/i });
      await expect(ctaButtons.first()).toBeVisible({ timeout: 10000 });
      const count = await ctaButtons.count();
      expect(count).toBeGreaterThan(0);

      console.log(`✅ [Business Plan] Verified ${count} Business plan CTA button(s) rendered.`);
    });

    await test.step('Step 2: Switch Back to Personal Tab and Verify Plan Restoration', async () => {
      const personalBtn = page.getByRole('button', { name: /Personal/i }).first();
      if (await personalBtn.isVisible().catch(() => false)) {
        console.log('🔄 [Pricing] Clicking Personal tab...');
        await personalBtn.click();

        // Verify Personal cards (1 Sticker / 1 Report) are restored
        const personalCard = page.locator('h3, [class*="card"], [class*="plan"]')
          .filter({ hasText: /\b1\s*(Sticker|Report)\b/i }).first();
        await expect(personalCard).toBeVisible({ timeout: 10000 });

        const ctaButtons = page.getByRole('button', { name: /Get.*(Report|Sticker)/i });
        await expect(ctaButtons.first()).toBeVisible({ timeout: 10000 });
        expect(await ctaButtons.count()).toBeGreaterThan(0);

        console.log('✅ [Personal Plan] Personal plan cards successfully restored.');
      }
    });
  }
}
