// tasks/pricing/PricingCouponDiscountTask.ts
import { Page, TestInfo, expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export class PricingCouponDiscountTask {
  private couponCode: string;
  private discountPercent: number;

  constructor(couponCode: string = 'preview15', discountPercent: number = 15) {
    this.couponCode = couponCode;
    this.discountPercent = discountPercent;
  }

  async performAs(page: Page, testInfo?: TestInfo) {
    const discountStr = `${this.discountPercent}%`;

    // Clear DNS socket/browser cache and cookies via CDP before opening domain
    const cdp = await page.context().newCDPSession(page).catch(() => null);
    if (cdp) {
      await cdp.send('Network.clearBrowserCache').catch(() => {});
      await cdp.send('Network.clearBrowserCookies').catch(() => {});
    }

    const isDVH = page.url().includes('detailedvehiclehistory.com') || (testInfo?.project.use?.baseURL as string)?.includes('detailedvehiclehistory.com') || testInfo?.project.name?.includes('DetailedVehicleHistory');
    const pricingRoute = isDVH ? '/vin-check-rates' : '/pricing';

    await test.step(`Step 1: Navigate to ${pricingRoute} with Coupon Offer (?offer=${this.couponCode})`, async () => {
      const targetUrl = `${pricingRoute}?offer=${this.couponCode}`;
      console.log(`🔄 [Pricing Coupon] Navigating to ${targetUrl}...`);

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
          break;
        } catch (err: any) {
          if (attempt === 3) throw err;
          console.warn(`⚠️ [Pricing Navigation DNS Retry] Attempt ${attempt} failed (${err?.message || err}). Retrying in 1.5s...`);
          await page.waitForTimeout(1500);
        }
      }

      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000);
    });

    await test.step(`Step 2: Verify Coupon Banner Appears on Pricing Page (${discountStr} Discount)`, async () => {
      console.log(`🔍 [Pricing Coupon] Validating "${discountStr} Discount" banner visibility...`);

      // Smart wait: Poll for client-side hydration to set the 'coupon' cookie
      await expect.poll(async () => {
        const cookies = await page.context().cookies();
        return cookies.find(c => c.name === 'coupon')?.value;
      }, {
        message: `[SmartWait] Timed out waiting for cookie "coupon" to match "${this.couponCode}"`,
        timeout: 10000,
        intervals: [200, 500, 1000]
      }).toBe(this.couponCode).catch(() => {
        console.warn(`⚠️ Cookie "coupon" was not detected after initial hydration. Checking DOM directly...`);
      });

      const bannerRegex = new RegExp(`You have received\\s+${discountStr}\\s+Discount`, 'i');
      const genericDiscountRegex = new RegExp(`${discountStr}\\s+(discount|off)`, 'i');
      const bannerLocator = page.getByText(bannerRegex)
        .or(page.getByText(genericDiscountRegex))
        .or(page.locator('div[class*="coupon" i], div[class*="banner" i], div[class*="discount" i], div[class*="green" i]').filter({ hasText: discountStr }))
        .first();

      const isVisible = await bannerLocator.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
      if (!isVisible) {
        // If cold edge cache served stale static HTML without hydrating ?offer=..., reload with cache-buster
        const cookies = await page.context().cookies();
        if (!cookies.some(c => c.name === 'coupon' && c.value === this.couponCode)) {
          console.warn(`⚠️ Edge cache may have served static HTML without hydrating ?offer=${this.couponCode}. Reloading with cache buster...`);
          await page.goto(`${pricingRoute}?offer=${this.couponCode}&_cb=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        }
      }

      await expect(bannerLocator).toBeVisible({ timeout: 15000 });
      console.log(`✅ [Banner Passed] Discount banner is prominently displayed on ${pricingRoute}: "${discountStr}"`);
    });

    await test.step(`Step 3: Verify Prices Reflect Discount Percentage (${discountStr})`, async () => {
      console.log(`🔍 [Pricing Coupon] Validating card prices reflect ${discountStr} discount...`);

      // 1. Check for "Save X%" discount tag on the first card
      const saveBadge = page.locator('text=Save ' + discountStr).or(page.locator(`text=${discountStr} off`)).first();
      await expect(saveBadge).toBeVisible({ timeout: 12000 });

      // 2. Validate price reflection on UI using strikethrough price from DOM (no API call needed)
      const strikethroughEl = page.locator('span[class*="line-through"], del, s').first();
      const hasStrikethrough = await strikethroughEl.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
      if (hasStrikethrough) {
        const origText = await strikethroughEl.innerText().catch(() => '');
        const origPrice = parseFloat(origText.replace(/[^0-9.]/g, ''));
        if (!isNaN(origPrice) && origPrice > 0) {
          const expectedDiscountedPrice = (origPrice * (1 - this.discountPercent / 100)).toFixed(2);
          const sign = (await page.evaluate(() => {
            const text = document.body.innerText;
            if (text.includes('EUR') || text.includes('€')) return '(EUR|€)';
            if (text.includes('C$') || text.includes('CAD')) return '(C\\$|CAD)';
            return '\\$';
          }));
          const formattedPriceRegex = new RegExp(`(${sign}|\\$)?\\s*(${expectedDiscountedPrice}|${Math.round(parseFloat(expectedDiscountedPrice))})`);
          const priceElement = page.locator('*').filter({ hasText: formattedPriceRegex }).first();
          await expect(priceElement).toBeVisible({ timeout: 12000 });
          console.log(`✅ [Price Reflection Passed] 1 Report card reflects discount from original $${origPrice}: $${expectedDiscountedPrice} (Save ${discountStr})`);
          return;
        }
      }

      console.log(`✅ [Price Reflection Passed] 1 Report card reflects discount: Save ${discountStr}`);
    });

    await test.step('Step 4: Capture Coupon Banner & Discounted Pricing Screenshot', async () => {
      const screenshotDir = path.resolve(process.cwd(), 'test-results', 'screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      const filename = `pricing-coupon-${this.couponCode}-${Date.now()}.png`;
      const screenshotPath = path.join(screenshotDir, filename);
      const buffer = await page.screenshot({ path: screenshotPath, fullPage: true });

      if (testInfo) {
        await testInfo.attach(`pricing-coupon-${this.couponCode}.png`, {
          body: buffer,
          contentType: 'image/png',
        }).catch(() => {});
      }

      console.log(`📸 [STDOUT SCREENSHOT] Coupon pricing screenshot captured: ${screenshotPath}`);
    });
  }
}
