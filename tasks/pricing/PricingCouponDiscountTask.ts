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
    let baselinePrice = 0;
    let expectedDiscountedPrice = '';

    await test.step('Step 1: Fetch Baseline Pricing Before Coupon', async () => {
      console.log('📡 [Pricing Coupon] Fetching baseline 1 Report price...');
      const response = await page.request.get('/api/pricing?sticker=0&dealer=1');
      expect(response.status()).toBe(200);

      const data = await response.json();
      const plan = data.reportUser?.credit_plans?.[0];
      expect(plan).toBeDefined();

      baselinePrice = parseFloat(plan.price);
      // Calculate expected price: baseline * (1 - discount% / 100)
      const discountedVal = baselinePrice * (1 - this.discountPercent / 100);
      expectedDiscountedPrice = discountedVal.toFixed(2);

      console.log(`💵 [Baseline] Original 1 Report price: $${baselinePrice.toFixed(2)}`);
      console.log(`🎯 [Calculated] Expected price after ${discountStr} discount: $${expectedDiscountedPrice}`);
    });

    const isDVH = page.url().includes('detailedvehiclehistory.com') || (testInfo?.project.use?.baseURL as string)?.includes('detailedvehiclehistory.com') || testInfo?.project.name?.includes('DetailedVehicleHistory');
    const pricingRoute = isDVH ? '/vin-check-rates' : '/pricing';

    await test.step(`Step 2: Navigate to ${pricingRoute} with Coupon Offer (?offer=${this.couponCode})`, async () => {
      console.log(`🔄 [Pricing Coupon] Navigating to ${pricingRoute}?offer=${this.couponCode}...`);
      await page.goto(`${pricingRoute}?offer=${this.couponCode}`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1000);
    });

    await test.step(`Step 3: Verify Coupon Banner Appears on Pricing Page (${discountStr} Discount)`, async () => {
      console.log(`🔍 [Pricing Coupon] Validating "${discountStr} Discount" banner visibility...`);
      const bannerRegex = new RegExp(`You have received\\s+${discountStr}\\s+Discount`, 'i');
      const bannerLocator = page.getByText(bannerRegex)
        .or(page.locator('text=' + bannerRegex))
        .or(page.locator('div[class*="coupon" i], div[class*="banner" i], div[class*="discount" i]').filter({ hasText: discountStr }))
        .first();

      await expect(bannerLocator).toBeVisible({ timeout: 15000 });
      console.log(`✅ [Banner Passed] Discount banner is prominently displayed on /pricing: "${discountStr}"`);
    });

    await test.step(`Step 4: Verify Prices Reflect Discount Percentage (${discountStr})`, async () => {
      console.log(`🔍 [Pricing Coupon] Validating card prices reflect ${discountStr} discount...`);

      // 1. Check for "Save X%" discount tag on the first card
      const saveBadge = page.locator('text=Save ' + discountStr).first();
      await expect(saveBadge).toBeVisible({ timeout: 10000 });

      // 2. Check for discounted price on UI
      // Allow for either strict 2 decimal places ($16.99 / EUR8.48) or integer formatting ($51 or $85)
      const sign = (await page.evaluate(() => {
        const text = document.body.innerText;
        if (text.includes('EUR') || text.includes('€')) return '(EUR|€)';
        if (text.includes('C$') || text.includes('CAD')) return '(C\\$|CAD)';
        return '\\$';
      }));
      const formattedPriceRegex = new RegExp(`(${sign}|\\$)?\\s*(${expectedDiscountedPrice}|${Math.round(parseFloat(expectedDiscountedPrice))})`);
      const priceElement = page.locator('*').filter({ hasText: formattedPriceRegex }).first();
      await expect(priceElement).toBeVisible({ timeout: 10000 });

      console.log(`✅ [Price Reflection Passed] 1 Report card reflects discount: ${expectedDiscountedPrice} (Save ${discountStr})`);
    });

    await test.step('Step 5: Capture Coupon Banner & Discounted Pricing Screenshot', async () => {
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
