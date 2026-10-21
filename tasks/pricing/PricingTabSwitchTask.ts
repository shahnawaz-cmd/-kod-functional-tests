// tasks/pricing/PricingTabSwitchTask.ts
import { Page, TestInfo, expect, test } from '@playwright/test';

export class PricingTabSwitchTask {
  async performAs(page: Page, testInfo?: TestInfo) {
    await test.step('Step 1: Switch to Business Tab and Verify Business Plans Render', async () => {
      const businessBtn = page.getByRole('button', { name: /Business/i }).first();
      const hasBusinessTab = await businessBtn.isVisible().catch(() => false);
      if (!hasBusinessTab) {
        console.log('ℹ️ [Pricing] No Business tab present on this site (e.g. VHREU). Skipping tab switch.');
        if (testInfo) {
          testInfo.annotations.push({
            type: 'Business Tab Notice',
            description: 'No Business tab present on this domain'
          });
        }
        return;
      }

      console.log('🔄 [Pricing] Clicking Business tab...');
      await businessBtn.click();

      // Verify Business volume plan cards render dynamically in the DOM
      const businessTiers = page.locator('h3, [class*="card"], [class*="plan"], div[class*="border"]')
        .filter({ hasText: /\b(25|50|100|Dealer|Bulk|Business)\b/i });
      await expect(businessTiers.first()).toBeVisible({ timeout: 10000 });

      const ctaButtons = page.getByRole('button', { name: /Get.*(Report|Sticker)/i });
      await expect(ctaButtons.first()).toBeVisible({ timeout: 10000 });
      const count = await ctaButtons.count();
      expect(count).toBeGreaterThan(0);

      const buttonTexts = await ctaButtons.allInnerTexts().catch(() => []);
      const tierSummaries = await businessTiers.allInnerTexts().catch(() => []);

      console.log(`✅ [Business Plan] Verified ${count} Business plan CTA button(s) rendered.`);

      // Attach structured evidence directly to test report
      if (testInfo) {
        testInfo.annotations.push({
          type: 'Business Plans Verified',
          description: `Rendered ${count} Business CTA buttons (${buttonTexts.map(t => t.trim()).join(', ')})`
        });

        await testInfo.attach('business-plans-actual-result.json', {
          body: JSON.stringify({
            status: 'SUCCESS',
            tab: 'Business',
            url: page.url(),
            buttonCount: count,
            buttons: buttonTexts.map(t => t.trim()),
            renderedTiers: tierSummaries.map(t => t.replace(/\n+/g, ' | ').trim()),
            timestamp: new Date().toISOString()
          }, null, 2),
          contentType: 'application/json'
        });

        await testInfo.attach('business-tab-rendered.png', {
          body: await page.screenshot({ fullPage: false }),
          contentType: 'image/png'
        });
      }
    });

    await test.step('Step 2: Switch Back to Personal Tab and Verify Plan Restoration', async () => {
      const personalBtn = page.getByRole('button', { name: /Personal/i }).first();
      if (await personalBtn.isVisible().catch(() => false)) {
        console.log('🔄 [Pricing] Clicking Personal tab...');
        await personalBtn.click();

        // Verify Personal cards (1 Sticker / 1 Report) are restored
        const personalCard = page.locator('h3, [class*="card"], [class*="plan"], div[class*="border"]')
          .filter({ hasText: /\b1\s*(Sticker|Report)\b/i });
        await expect(personalCard.first()).toBeVisible({ timeout: 10000 });

        const ctaButtons = page.getByRole('button', { name: /Get.*(Report|Sticker)/i });
        await expect(ctaButtons.first()).toBeVisible({ timeout: 10000 });
        const count = await ctaButtons.count();
        expect(count).toBeGreaterThan(0);

        const cardText = await personalCard.first().innerText().catch(() => '');
        const buttonTexts = await ctaButtons.allInnerTexts().catch(() => []);

        console.log('✅ [Personal Plan] Personal plan cards successfully restored.');

        // Attach structured evidence directly to test report
        if (testInfo) {
          testInfo.annotations.push({
            type: 'Personal Plans Restored',
            description: `Restored ${count} Personal CTA buttons; primary card: ${cardText.split('\n')[0]}`
          });

          await testInfo.attach('personal-plans-actual-result.json', {
            body: JSON.stringify({
              status: 'SUCCESS',
              tab: 'Personal',
              url: page.url(),
              buttonCount: count,
              buttons: buttonTexts.map(t => t.trim()),
              primaryCardSummary: cardText.replace(/\n+/g, ' | ').trim(),
              timestamp: new Date().toISOString()
            }, null, 2),
            contentType: 'application/json'
          });

          await testInfo.attach('personal-tab-rendered.png', {
            body: await page.screenshot({ fullPage: false }),
            contentType: 'image/png'
          });
        }
      }
    });
  }
}
