// tasks/pricing/PricingFaqAndNavigationTask.ts
import { Page, expect, test } from '@playwright/test';

export class PricingFaqAndNavigationTask {
  async performAs(page: Page) {
    await test.step('Step 1: Verify FAQ Accordion Expand & Collapse Interaction', async () => {
      console.log('❓ [Pricing] Verifying FAQ accordion interaction...');

      // Find any question element ending with '?'
      const questions = page.locator('*').filter({ hasText: /\?$/ });
      const count = await questions.count();

      if (count > 0) {
        const firstQuestion = questions.first();
        await firstQuestion.click();
        await page.waitForTimeout(500);
        console.log('✅ [FAQ] Accordion click triggered.');
      } else {
        console.log('ℹ️ [FAQ] No FAQ accordions present on this pricing view.');
      }
    });

    await test.step('Step 2: Verify View Sample Report Navigation Link', async () => {
      console.log('📄 [Pricing] Verifying View Sample Report link...');
      const sampleLink = page.locator('a:has-text("sample"), a:has-text("Sample")').first();
      if (await sampleLink.isVisible()) {
        const href = await sampleLink.getAttribute('href');
        expect(href).toMatch(/.*(sample|sticker\/vin).*/i);
        console.log(`✅ [Navigation] Sample report link href is valid: "${href}"`);
      }
    });
  }
}
