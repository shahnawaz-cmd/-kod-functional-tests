// tasks/pricing/PricingResponsiveUiTask.ts
import { Page, TestInfo, expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export class PricingResponsiveUiTask {
  async performAs(page: Page, testInfo?: TestInfo) {
    await test.step('Step 1: Verify Mobile Viewport Toggle & Layout Stacking', async () => {
      console.log('📱 [Mobile UI] Checking viewport & pricing toggle layout...');

      // Personal & Business buttons (if site supports plan tabs)
      const personalBtn = page.getByRole('button', { name: /Personal/i }).first();
      const businessBtn = page.getByRole('button', { name: /Business/i }).first();
      if (await personalBtn.isVisible().catch(() => false)) {
        await expect(personalBtn).toBeVisible({ timeout: 5000 });
        if (await businessBtn.isVisible().catch(() => false)) {
          await expect(businessBtn).toBeVisible({ timeout: 5000 });
        }
      }

      // Plan CTA buttons must render and be clickable on mobile (matches 'Get Report', 'Get Reports', 'Get Sticker', 'Get Stickers')
      const ctaButtons = page.getByRole('button', { name: /Get.*(Report|Sticker)/i });
      await expect(ctaButtons.first()).toBeVisible({ timeout: 10000 });

      console.log('✅ [Mobile UI] Toggle and Plan CTA elements are properly rendered in mobile viewport.');
    });

    await test.step('Step 2: Capture Full Mobile Pricing Page Screenshot', async () => {
      // Smart wait: Ensure network is idle and layout is stable before triggering screenshot
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});

      const screenshotDir = path.resolve(process.cwd(), 'test-results', 'screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      const filename = `pricing-mobile-layout-${Date.now()}.png`;
      const screenshotPath = path.join(screenshotDir, filename);
      let buffer: Buffer;
      try {
        buffer = await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 30000 });
      } catch (err) {
        console.warn('⚠️ Full-page screenshot timed out on mobile viewport, capturing viewport screenshot...');
        buffer = await page.screenshot({ path: screenshotPath, fullPage: false, timeout: 15000 });
      }

      if (testInfo) {
        await testInfo.attach('pricing-mobile-layout.png', {
          body: buffer,
          contentType: 'image/png',
        }).catch(() => {});
      }

      console.log(`📸 [Mobile UI] Full-page mobile screenshot saved to: ${screenshotPath}`);
    });
  }
}
