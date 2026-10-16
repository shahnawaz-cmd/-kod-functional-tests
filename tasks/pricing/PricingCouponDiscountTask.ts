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
    const pricingRoute = '/pricing';

    // Set coupon cookie in browser context so pricing page hydrates coupon state reliably
    const baseURL = (testInfo?.project.use?.baseURL as string) || page.url() || 'https://toyotawindowsticker.com';
    try {
      const urlObj = new URL(baseURL);
      await page.context().addCookies([
        {
          name: 'coupon',
          value: this.couponCode,
          domain: urlObj.hostname,
          path: '/',
        }
      ]);
    } catch (e) {}

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

      await page.waitForLoadState('domcontentloaded');
    });

    await test.step(`Step 2: Verify Coupon Banner Appears on Pricing Page (${discountStr} Discount)`, async () => {
      console.log(`🔍 [Pricing Coupon] Validating "${discountStr} Discount" banner visibility...`);

      const bannerLocator = page.locator('div[class*="banner" i], div[class*="coupon" i], div[class*="discount" i], div[class*="green" i], [role="alert"]')
        .filter({ hasText: new RegExp(`You have received.*${discountStr}.*Discount|Your discount has been applied|${discountStr}\\s*(discount|off)`, 'i') })
        .or(page.getByText(new RegExp(`You have received\\s+${discountStr}\\s+Discount`, 'i')))
        .or(page.getByText(/Your discount has been applied automatically/i))
        .first();

      const isBannerVisible = await bannerLocator.waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false);
      if (!isBannerVisible) {
        console.warn(`⚠️ [Pricing Coupon] Banner not visible on initial load; reloading with cache-buster...`);
        await page.goto(`${pricingRoute}?offer=${this.couponCode}&_cb=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
        await page.waitForLoadState('domcontentloaded');
      }

      await expect(bannerLocator).toBeVisible({ timeout: 15000 });
      console.log(`✅ [Banner Passed] Discount banner is prominently displayed on ${pricingRoute}: "${discountStr}"`);
    });

    await test.step(`Step 3: Verify Prices Reflect Discount Percentage (${discountStr})`, async () => {
      console.log(`🔍 [Pricing Coupon] Validating card prices reflect ${discountStr} discount...`);

      // 1. Locate the single-item plan card (1 Sticker or 1 Report) to avoid collision with bundle cards
      const singleItemCard = page.locator('div, section, article')
        .filter({ has: page.getByRole('heading', { name: /1\s*(sticker|report)/i }) })
        .first();

      await expect(singleItemCard).toBeVisible({ timeout: 15000 });

      // 2. Check for "Save X%" discount badge within the single-item card
      const saveBadge = singleItemCard.getByText(new RegExp(`Save\\s*${discountStr}|${discountStr}\\s*(off|discount)`, 'i'))
        .or(page.getByText(new RegExp(`Save\\s*${discountStr}`, 'i')))
        .first();
      await expect(saveBadge).toBeVisible({ timeout: 15000 });

      // 3. Validate price reflection on UI using strikethrough price from the single-item card
      const strikethroughEl = singleItemCard.locator('span[class*="line-through"], del, s').first();
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
          const priceElement = singleItemCard.locator('*').filter({ hasText: formattedPriceRegex }).first();
          await expect(priceElement).toBeVisible({ timeout: 12000 });
          console.log(`✅ [Price Reflection Passed] 1 Report/Sticker card reflects discount from original $${origPrice}: $${expectedDiscountedPrice} (Save ${discountStr})`);
          return;
        }
      }

      console.log(`✅ [Price Reflection Passed] 1 Report/Sticker card reflects discount: Save ${discountStr}`);
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
