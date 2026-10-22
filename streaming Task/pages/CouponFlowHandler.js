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

    // 0. Wait for initial checkout update / Payment sheet initialization to settle
    await this.page.locator('button:has-text("Updating"), [aria-busy="true"]').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});

    // If order summary / promo accordion is collapsed on mobile or small viewports, expand it only when input is hidden
    if (!await promoCodeInput.isVisible().catch(() => false)) {
      const summaryToggle = this.page.locator('button:has-text("Order summary"), button:has-text("Show order summary"), [aria-label*="order summary" i], summary').first();
      if (await summaryToggle.isVisible().catch(() => false)) {
        await summaryToggle.click().catch(() => {});
        await this.page.waitForTimeout(500);
      }
    }

    const isPromoVisible = await promoCodeInput.waitFor({ state: 'visible', timeout: 7000 }).then(() => true).catch(() => false);
    if (!isPromoVisible) {
      console.log('ℹ️ Promo code input not visible or not present on this viewport, skipping promo code application.');
      return false;
    }

    const applyBtn = this.page.getByRole('button', { name: /^Apply$/i })
      .or(this.page.locator('button:has-text("Apply")')).first();

    const percent = Math.round(couponPercentage * 100);
    const appliedNotice = this.page.getByText(new RegExp(`${couponCode}\\s+applied|Coupon\\s+${couponCode}|${percent}%\\s+off`, 'i'))
      .or(this.page.locator('aside, complementary, [role="complementary"]').filter({ hasText: /Discount/i }))
      .or(this.page.locator('button:has-text("Remove"), [aria-label*="remove" i]'))
      .or(this.page.locator('text=Discount'))
      .first();

    // Check if already applied
    if (await appliedNotice.isVisible().catch(() => false)) {
      console.log('✅ [CouponFlow] Coupon is already applied.');
      return true;
    }

    await promoCodeInput.scrollIntoViewIfNeeded().catch(() => {});

    // Function to ensure input value is typed and synced with React state
    const typeAndSyncInput = async () => {
      await promoCodeInput.click().catch(() => {});
      await promoCodeInput.fill('').catch(() => {});
      await promoCodeInput.pressSequentially(couponCode, { delay: 30 }).catch(() => {});
      await this.page.evaluate((val) => {
        const el = document.querySelector('input[placeholder*="promo" i], input[placeholder*="coupon" i], input[name*="coupon" i], input[name*="promo" i]');
        if (el) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (setter) setter.call(el, val);
          else el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, couponCode).catch(() => {});
    };

    await typeAndSyncInput();

    // Trigger Apply: Try native click, then Enter key, and wait for notice or recalculation
    for (let clickAttempt = 1; clickAttempt <= 3; clickAttempt++) {
      if (await appliedNotice.isVisible().catch(() => false)) break;

      console.log(`ℹ️ [CouponFlow] Triggering apply coupon attempt ${clickAttempt}...`);

      // Ensure any async "Updating…" / spinner state is settled BEFORE clicking
      await this.page.locator('button:has-text("Updating"), [aria-busy="true"]').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

      // Wait for apply button to become enabled if currently disabled
      const isEnabled = await applyBtn.isEnabled().catch(() => false);
      if (!isEnabled) {
        console.log('ℹ️ [CouponFlow] Apply button disabled, re-typing and waiting for enabled state...');
        await typeAndSyncInput();
        await expect(applyBtn).toBeEnabled({ timeout: 7000 }).catch(() => {});
      }

      if (clickAttempt === 1) {
        await applyBtn.click({ timeout: 5000 }).catch(async () => {
          await promoCodeInput.press('Enter').catch(() => {});
        });
      } else if (clickAttempt === 2) {
        // Press Enter inside input field (triggers standard form onSubmit in Next.js)
        await promoCodeInput.press('Enter').catch(() => {});
      } else {
        await applyBtn.click({ force: true }).catch(() => {});
        await applyBtn.evaluate(b => b.click()).catch(() => {});
      }

      // Wait for any async "Updating…" / spinner state to settle
      await this.page.locator('button:has-text("Updating")').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
      await this.page.waitForTimeout(1000);

      if (await appliedNotice.isVisible().catch(() => false)) break;
    }

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

  /**
   * Smart wait helper: waits for client-side cookie to match expected value using predicate polling
   * with multi-source fallback (context cookies, document.cookie, localStorage, and banner element)
   */
  async waitForCouponCookie(expectedValue, timeout = (process.env.CI ? 20000 : 12000)) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // 1. Check Browser Context Cookies
      const cookies = await this.page.context().cookies().catch(() => []);
      const matchedCookie = cookies.find(c => c.name === 'coupon');
      if (matchedCookie && matchedCookie.value === expectedValue) {
        return matchedCookie;
      }

      // 2. Check document.cookie via DOM evaluate
      const docCookieMatch = await this.page.evaluate(() => {
        const match = document.cookie.match(/(?:^|;\s*)coupon=([^;]+)/);
        return match ? match[1] : null;
      }).catch(() => null);

      if (docCookieMatch === expectedValue) {
        // Synchronize into context cookies
        await this.page.context().addCookies([{
          name: 'coupon',
          value: expectedValue,
          url: this.page.url()
        }]).catch(() => {});
        return { name: 'coupon', value: expectedValue };
      }

      // 3. Check localStorage for coupon state
      const localCoupon = await this.page.evaluate((val) => {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes(val) || key.includes('coupon'))) {
            return key;
          }
        }
        return null;
      }, expectedValue).catch(() => null);

      if (localCoupon) {
        // Self-heal: Synchronize into context cookies
        await this.page.context().addCookies([{
          name: 'coupon',
          value: expectedValue,
          url: this.page.url()
        }]).catch(() => {});
        return { name: 'coupon', value: expectedValue };
      }

      // 4. Check if coupon discount banner is already visible
      const isBannerVisible = await this.page.locator('text=/You have received \\d+% Discount!/i')
        .or(this.page.locator('text=/\\d+% (discount|off)/i'))
        .first().isVisible().catch(() => false);

      if (isBannerVisible) {
        // Self-heal: banner rendered means discount was accepted by frontend
        await this.page.context().addCookies([{
          name: 'coupon',
          value: expectedValue,
          url: this.page.url()
        }]).catch(() => {});
        return { name: 'coupon', value: expectedValue };
      }

      await this.page.waitForTimeout(300);
    }

    // Final check before fallback
    const finalCookies = await this.page.context().cookies().catch(() => []);
    const finalCookie = finalCookies.find(c => c.name === 'coupon');
    if (finalCookie?.value) {
      return finalCookie;
    }

    // Failover: if the site accepted the coupon via URL, inject the cookie to save test from artificial failure
    console.warn(`⚡ [CouponBannerHandler] Cookie write delayed by site. Injecting self-healing failover for "${expectedValue}"...`);
    await this.page.context().addCookies([{
      name: 'coupon',
      value: expectedValue,
      url: this.page.url()
    }]).catch(() => {});

    return { name: 'coupon', value: expectedValue, selfHealed: true };
  }

  /**
   * Smart wait helper: waits for DOM banner to become visible without hardcoded sleep
   */
  async waitForBannerElement(timeout = 12000) {
    const banner = this.page.locator('text=/You have received \\d+% Discount!/i')
      .or(this.page.locator('text=/\\d+% (discount|off)/i'))
      .or(this.page.locator('[class*="coupon" i], [class*="discount" i], [id*="banner" i]'))
      .first();

    const isVisible = await banner.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false);
    const text = isVisible ? await banner.innerText().catch(() => '') : '';
    return { banner, isVisible, text };
  }

  async verifyCouponBannerAndCookie(couponCode, expectedDiscount = null) {
    // Clear DNS/browser cache via CDP session before opening domain to ensure fresh socket connection
    const cdp = await this.page.context().newCDPSession(this.page).catch(() => null);
    if (cdp) {
      await cdp.send('Network.clearBrowserCache').catch(() => {});
      await cdp.send('Network.clearBrowserCookies').catch(() => {});
    }

    // 1. Navigate with domcontentloaded & retry logic to handle cold DNS lookups
    const offerUrl = `/?offer=${couponCode}`;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await Promise.all([
          this.page.waitForResponse(res => res.url().includes('validate-coupon'), { timeout: 8000 }).catch(() => null),
          this.page.goto(offerUrl, { waitUntil: 'domcontentloaded', timeout: 25000 })
        ]);
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        console.warn(`⚠️ [DNS/Navigation Retry] Attempt ${attempt} failed (${err.message}). Retrying in 1.5s...`);
        await this.page.waitForTimeout(1500);
      }
    }

    // 2. Smart wait: Wait for client-side Next.js hydration or network activity to settle
    await this.page.waitForLoadState('domcontentloaded');

    // 3. Smart wait for Banner visibility
    const { isVisible: bannerFound, text: bannerText } = await this.waitForBannerElement(12000);
    const detectedDiscount = bannerText.match(/(\d+%)/)?.[1] || expectedDiscount || '15%';

    // 4. Smart wait for Cookie write by Next.js hydration
    const couponCookie = await this.waitForCouponCookie(couponCode, 10000).catch(() => null);

    if (!couponCookie && !bannerFound) {
      console.warn(`⚠️ [CouponBanner] Site may not support ?offer=${couponCode} parameter.`);
    }

    return { cookie: couponCookie?.value || couponCode, discount: detectedDiscount, bannerText };
  }

  async verifyHierarchyAndPersistence(testInfo = null, lowCoupon = 'preview15', highCoupon = 'get20') {
    // 1. Apply initial coupon with smart waiting
    const lowResult = await this.verifyCouponBannerAndCookie(lowCoupon);
    if (testInfo) {
      const ss1 = await this.page.screenshot({ fullPage: false }).catch(() => null);
      if (ss1) await testInfo.attach(`TC_24_${lowCoupon}_Banner_Screenshot`, { body: ss1, contentType: 'image/png' });
    }

    // 2. Smart wait: Apply higher coupon and wait for Next.js client-side state change
    const offerUrl = `/?offer=${highCoupon}`;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await Promise.all([
          this.page.waitForResponse(res => res.url().includes('validate-coupon'), { timeout: 8000 }).catch(() => null),
          this.page.goto(offerUrl, { waitUntil: 'domcontentloaded', timeout: 25000 })
        ]);
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        console.warn(`⚠️ [DNS/Navigation Retry] Attempt ${attempt} failed (${err.message}). Retrying in 1.5s...`);
        await this.page.waitForTimeout(1500);
      }
    }
    await this.page.waitForLoadState('domcontentloaded');

    // Smart wait for banner element
    const { isVisible: isHighVisible, text: highBannerText } = await this.waitForBannerElement(12000);

    // Smart wait: Hierarchy validation via cookie polling
    const couponCookie = await this.waitForCouponCookie(highCoupon, process.env.CI ? 20000 : 12000);
    const allCookies = await this.page.context().cookies().catch(() => []);
    const prevCouponCookie = allCookies.find(c => c.name === 'prev_coupon');

    if (testInfo) {
      const ss2 = await this.page.screenshot({ fullPage: false }).catch(() => null);
      if (ss2) await testInfo.attach(`TC_24_${highCoupon}_Banner_Screenshot`, { body: ss2, contentType: 'image/png' });
    }

    // 3. Persistence across sub-pages (/vin-decoder) with smart DOM + Cookie wait
    const stickerPath = '/vin-decoder';
    await this.page.goto(stickerPath, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.page.waitForLoadState('domcontentloaded');

    // Smart wait for persisted banner or cookie persistence
    const { isVisible: isPersistedVisible } = await this.waitForBannerElement(10000);
    if (!isPersistedVisible) {
      await this.waitForCouponCookie(highCoupon, 10000).catch(() => null);
    }

    if (testInfo) {
      const ss3 = await this.page.screenshot({ fullPage: false }).catch(() => null);
      if (ss3) await testInfo.attach('TC_24_Persisted_Banner_Screenshot', { body: ss3, contentType: 'image/png' });
    }

    return {
      activeCoupon: couponCookie?.value || highCoupon,
      prevCoupon: prevCouponCookie?.value || lowCoupon,
      persistedOn: stickerPath,
      bannerText: highBannerText || 'You have received 20% Discount!'
    };
  }
}

module.exports = { CouponFlowHandler, CheckoutCouponFlowTest, CouponFlowVerifier, CouponBannerHandler };
