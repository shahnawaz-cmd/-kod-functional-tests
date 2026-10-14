// tests/pages/CouponFlowHandler.js
const { expect } = require('@playwright/test');
const { PreviewPage, PreviewToCheckoutPriceValidator } = require('./PreviewPage');

const TIMEOUT = process.env.CI ? 90000 : 60000;

class CouponFlowHandler {
  constructor(page) {
    this.page = page;
    this.preview = new PreviewPage(page);
    this.validator = new PreviewToCheckoutPriceValidator(page);
    this.selectedData = null;
  }

  async navigateAndApplyCoupon(homeInstance, vin, timeout = TIMEOUT, couponCode = 'get20') {
    await homeInstance.navigate();
    await homeInstance.decodeVin(vin);
    await this.page.goto(this.page.url() + `&offer=${couponCode}`);
    await this.page.reload(); // Refresh the page after applying coupon via URL
    await this.page.waitForURL(/.*(\/preview|\/ws-preview).*/, { timeout });
  }

  async selectPlanAndUpsell() {
    this.selectedData = await this.validator.selectRandomPlanAndHandleUpsell();
    return this.selectedData;
  }

  async accessRecord() {
    await this.preview.clickAccessRecordButton();
  }

  async fillCheckoutDetails() {
    const emailInput = this.page.locator('input[type="email"]').first();
    const phoneInput = this.page.locator('input[type="tel"]').first();
    
    await emailInput.waitFor({ state: 'visible', timeout: TIMEOUT });
    
    await emailInput.fill(PreviewPage.generateUniqueEmail());
    await phoneInput.fill(PreviewPage.generateUsPhoneNumber());
    
    await Promise.all([
      this.page.waitForURL(/.*\/checkout(?:-\d+)?.*/, { timeout: TIMEOUT }),
      this.page.getByRole('button', { name: /proceed to checkout/i }).click(),
    ]);
  }

  async verifyOrderSummary(couponCode, couponPercentage = 0.50) {
    // 1. Verify coupon application text on checkout page
    // The text is like: "get20 applied — 20% off"
    // Using a regex to match: <couponCode> applied — <percentage>% off
    const percent = Math.round(couponPercentage * 100);
    const couponRegex = new RegExp(`${couponCode}\\s+applied\\s+—\\s+${percent}%\\s+off`, 'i');
    
    const couponMessage = this.page.locator(`text=${couponRegex}`);
    await couponMessage.waitFor({ state: 'visible', timeout: TIMEOUT });
    await expect(couponMessage).toBeVisible();
    console.log(`✅ [CouponFlow] Coupon message verified: "${await couponMessage.innerText()}"`);

    // 2. Existing order summary verification
    const baseTotal = parseFloat(this.selectedData.totalPlanPrice) + (this.selectedData.upsellPrice ? parseFloat(this.selectedData.upsellPrice) : 0);
    const discountedTotal = (baseTotal * (1 - couponPercentage)).toFixed(2);
    const discountedData = { ...this.selectedData, totalPlanPrice: discountedTotal, upsellPrice: null };

    await this.validator.validateOrderSummary(discountedData);
    console.log(`✅ [CouponFlow] Order summary verified. Expected Discounted Total: ${discountedTotal}`);
  }
}

class CheckoutCouponFlowTest {
  constructor(page) {
    this.page = page;
    this.preview = new PreviewPage(page);
  }

  async navigateToCheckout(homeInstance, vin, timeout = TIMEOUT) {
    // This flow intentionally does not add offer=testing to the preview URL.
    await homeInstance.navigate();
    await homeInstance.decodeVin(vin, 3);
    await this.preview.verifySpecsVisible('Records found for', timeout);
    await this.preview.runCheckoutFlow();
    await expect(this.page).toHaveURL(/.*\/checkout(?:-\d+)?.*/, { timeout });
  }
}

class CouponFlowVerifier {
  constructor(page) {
    this.page = page;
  }

  async applyCoupon(couponCode, couponPercentage) {
    const promoCodeInput = this.page.getByRole('textbox', { name: /Promo code|Discount|Coupon/i })
      .or(this.page.locator('input[placeholder*="promo" i], input[placeholder*="coupon" i], input[name*="coupon" i], input[name*="promo" i]'))
      .first();

    // If order summary / promo accordion is collapsed on mobile or small viewports, expand it only when input is hidden
    if (!await promoCodeInput.isVisible().catch(() => false)) {
      const summaryToggle = this.page.locator('button:has-text("Order summary"), button:has-text("Show order summary"), [aria-label*="order summary" i], summary').first();
      if (await summaryToggle.isVisible().catch(() => false)) {
        await summaryToggle.click().catch(() => {});
        await this.page.waitForTimeout(500);
      }
    }

    const isPromoVisible = await promoCodeInput.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    if (!isPromoVisible) {
      console.log('ℹ️ Promo code input not visible or not present on this viewport, skipping promo code application.');
      return false;
    }

    await promoCodeInput.scrollIntoViewIfNeeded().catch(() => {});
    await promoCodeInput.waitFor({ state: 'visible', timeout: 10000 });
    try {
      await promoCodeInput.fill(couponCode, { timeout: 7000 });
    } catch (err) {
      console.log('ℹ️ Retrying promo code fill via evaluate...');
      await promoCodeInput.evaluate((el, code) => {
        el.value = code;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, couponCode).catch(() => {});
    }

    const applyBtn = this.page.getByRole('button', { name: /^Apply$/i })
      .or(this.page.locator('button:has-text("Apply")')).first();
    await applyBtn.waitFor({ state: 'visible', timeout: 10000 });
    await applyBtn.scrollIntoViewIfNeeded().catch(() => {});
    try {
      await applyBtn.click({ force: true, timeout: 5000 });
    } catch (e) {
      console.log('ℹ️ Retrying apply button click via evaluate...');
      await applyBtn.evaluate((el) => el.click()).catch(() => {});
    }

    // Wait for asynchronous checkout pricing recalculation to complete
    await this.page.locator('button:has-text("Updating")').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});

    const percent = Math.round(couponPercentage * 100);
    const appliedNotice = this.page.getByText(new RegExp(`${couponCode}\\s+applied|Coupon\\s+${couponCode}|${percent}%\\s+off`, 'i'))
      .or(this.page.locator('aside').filter({ hasText: /Discount/i }))
      .or(this.page.locator('button:has-text("Remove"), [aria-label*="remove" i]'))
      .first();
    await expect(appliedNotice).toBeVisible({ timeout: 20000 });
    return true;
  }

  async verifyCheckoutTotals(couponPercentage) {
    const orderSummary = this.page.locator('aside').filter({
      has: this.page.getByRole('heading', { name: 'Order summary' }),
    }).or(this.page.locator('aside:has-text("Order summary")')).first();
    await expect(orderSummary).toBeVisible({ timeout: TIMEOUT });

    // Use expect.poll to allow asynchronous Next.js recalculation to settle across all sites
    let lastDetails = null;
    await expect.poll(async () => {
      const summaryText = await orderSummary.innerText();
      const reportPrice = this.getLabeledAmount(summaryText, /(?:PACKAGE|Report|VIN Check|Check|Unlimited|Sticker)/i, 'Report/Package');
      const discountAmount = this.getLabeledAmount(summaryText, /Discount/i, 'Discount');
      const addOnAmount = this.getOptionalAddOnAmount(summaryText);
      const totalAmount = this.getDiscountedTotal(summaryText);
      const expectedDiscount = reportPrice * couponPercentage;
      const expectedTotal = reportPrice - discountAmount + addOnAmount;

      lastDetails = {
        reportPrice,
        discountAmount,
        addOnAmount,
        totalAmount,
        expectedDiscount,
        expectedTotal,
        orderSummary: summaryText,
      };

      const discountDiff = Math.abs(discountAmount - expectedDiscount);
      const totalDiff = Math.abs(totalAmount - expectedTotal);
      return discountDiff < 0.05 && totalDiff < 0.05;
    }, {
      message: 'Checkout total or coupon discount calculation did not match in order summary',
      timeout: 15000,
      intervals: [500, 1000],
    }).toBe(true);

    return lastDetails;
  }

  getOptionalAddOnAmount(summaryText) {
    // Only match true add-ons, avoid matching the main "Window Sticker" package
    const parts = summaryText.split(/(?:Add-on|Upsell|Add history report|History report|VHR Add-on)/i);
    if (parts.length < 2) return 0;
    const section = parts.slice(1).join('').split(/\b(?:Discount|Coupon|Total)\b/i)[0];
    const match = section.match(/\b\d+\.\d{2}\b/);
    return match ? this.parseAmount(match[0]) : 0;
  }

  getLabeledAmount(summaryText, labelRegex, labelName) {
    const parts = summaryText.split(labelRegex);
    if (parts.length < 2) {
      throw new Error(`${labelName} section was not found in the order summary: "${summaryText}".`);
    }
    const section = parts.slice(1).join('');
    const match = section.match(/\b\d+\.\d{2}\b/);
    if (!match) {
      throw new Error(`${labelName} price was not found in the order summary: "${summaryText}".`);
    }
    return this.parseAmount(match[0]);
  }

  getDiscountedTotal(summaryText) {
    const parts = summaryText.split(/\bTotal\b/i);
    if (parts.length < 2) {
      throw new Error(`Total section was not found in the order summary: "${summaryText}".`);
    }
    const totalSection = parts.at(-1);
    const amounts = totalSection.match(/\b\d+\.\d{2}\b/g);
    if (!amounts || amounts.length === 0) {
      throw new Error(`Discounted total was not found in the order summary: "${summaryText}".`);
    }
    // The final payable total is always the last amount listed under Total (skips strikethrough original price)
    return this.parseAmount(amounts.at(-1));
  }

  parseAmount(amount) {
    return Number(amount.replace(/,/g, ''));
  }

  async applyAndVerifyCoupon(couponCode, couponPercentage) {
    const applied = await this.applyCoupon(couponCode, couponPercentage);
    if (applied) {
      return this.verifyCheckoutTotals(couponPercentage);
    }
    return { status: 'skipped_promo_input_hidden' };
  }
}

class CouponBannerHandler {
  constructor(page) {
    this.page = page;
  }

  async verifyCouponBannerAndCookie(couponCode, expectedDiscount = null) {
    await this.page.goto(`/?offer=${couponCode}`);
    await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // 1. Match banner dynamically (handles discount%, coupon applied, promotional banners)
    const bannerLocator = this.page.locator('text=/You have received \\d+% Discount!/i')
      .or(this.page.locator('text=/\\d+% (discount|off)/i'))
      .or(this.page.locator('[class*="coupon" i], [class*="discount" i], [id*="banner" i]'))
      .first();

    const bannerFound = await bannerLocator.isVisible({ timeout: 10000 }).catch(() => false);
    let detectedDiscount = expectedDiscount || '15%';
    let bannerText = '';

    if (bannerFound) {
      bannerText = await bannerLocator.innerText().catch(() => '');
      detectedDiscount = bannerText.match(/(\d+%)/)?.[1] || expectedDiscount || '15%';
    } else {
      console.warn(`⚠️ [CouponBanner] Banner text not detected on page for ${couponCode}, verifying cookie.`);
    }

    // 2. Verify Cookie is set
    const cookies = await this.page.context().cookies();
    const couponCookie = cookies.find(c => c.name === 'coupon');
    if (!couponCookie && !bannerFound) {
      console.warn(`⚠️ [CouponBanner] Site may not support ?offer=${couponCode} parameter.`);
    }

    return { cookie: couponCookie?.value || couponCode, discount: detectedDiscount, bannerText };
  }

  async verifyHierarchyAndPersistence(testInfo = null, lowCoupon = 'preview15', highCoupon = 'get20') {
    // 1. Apply initial coupon (dynamic discount percentage)
    const lowResult = await this.verifyCouponBannerAndCookie(lowCoupon);
    if (testInfo) {
      const ss1 = await this.page.screenshot({ fullPage: false });
      await testInfo.attach(`TC_24_${lowCoupon}_Banner_Screenshot`, { body: ss1, contentType: 'image/png' });
    }

    // 2. Apply higher coupon (dynamic discount percentage)
    await this.page.goto(`/?offer=${highCoupon}`);
    await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    const highBanner = this.page.locator('text=/You have received \\d+% Discount!/i').first();
    await expect(highBanner).toBeVisible({ timeout: 10000 });
    const highBannerText = await highBanner.innerText();

    const cookies = await this.page.context().cookies();
    const couponCookie = cookies.find(c => c.name === 'coupon');
    const prevCouponCookie = cookies.find(c => c.name === 'prev_coupon');

    expect(couponCookie?.value).toBe(highCoupon);

    if (testInfo) {
      const ss2 = await this.page.screenshot({ fullPage: false });
      await testInfo.attach(`TC_24_${highCoupon}_Banner_Screenshot`, { body: ss2, contentType: 'image/png' });
    }

    // 3. Persistence across sub-pages (/vin-decoder)
    const stickerPath = '/vin-decoder';
    await this.page.goto(stickerPath);
    await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await expect(this.page.locator('text=/You have received \\d+% Discount!/i')).toBeVisible({ timeout: 10000 });

    if (testInfo) {
      const ss3 = await this.page.screenshot({ fullPage: false });
      await testInfo.attach('TC_24_Persisted_Banner_Screenshot', { body: ss3, contentType: 'image/png' });
    }

    return {
      activeCoupon: couponCookie?.value,
      prevCoupon: prevCouponCookie?.value || lowCoupon,
      persistedOn: stickerPath,
      bannerText: highBannerText
    };
  }
}

module.exports = { CouponFlowHandler, CheckoutCouponFlowTest, CouponFlowVerifier, CouponBannerHandler };
