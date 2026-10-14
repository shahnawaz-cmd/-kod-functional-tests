// tests/pages/CheckoutPage.js
const TIMEOUT = process.env.CI ? 90000 : 30000;

class PayPalHandler {
  constructor(page) {
    this.page = page;
  }

  async delay(ms, page = this.page) {
    await page.waitForTimeout(ms);
  }

  async selectPayPalOption() {
    await this.page.getByRole('button', { name: 'PayPal' }).click();
    await this.delay(2000);
  }

  async clickPayPalButton(context, timeout = TIMEOUT) {
    const paypalIframe = this.page.frameLocator('iframe[name*="__zoid__paypal_buttons__"]').first();
    const [popup] = await Promise.all([
      context.waitForEvent('page', { timeout }),
      paypalIframe.getByRole('link', { name: 'Pay with PayPal' }).click()
    ]);
    return popup;
  }

  async loginPayPal(popup, credentials, timeout = TIMEOUT) {
    await popup.waitForLoadState('domcontentloaded');
    
    // Put email directly
    await popup.getByRole('textbox', { name: 'Email or mobile number' }).fill(credentials.email);
    
    // Click next
    await popup.getByRole('button', { name: 'Next' }).click();

    // The password field should appear after clicking 'Next'.
    // We need to wait for the page to navigate or for the password field to appear.
    // Using a more robust locator approach for the password field.
    
    // 1. Use a more robust selector strategy that isn't just dependent on the label.
    // Try multiple possible locators and wait for visibility.
    const passwordLocators = [
      popup.getByRole('textbox', { name: 'Password' }),
      popup.locator('input[type="password"]'),
      popup.locator('#password')
    ];

    let passwordField;

    // Wait for at least one of these to be visible within the timeout
    for (const locator of passwordLocators) {
      try {
        await locator.waitFor({ state: 'visible', timeout: timeout / 2 });
        passwordField = locator;
        break;
      } catch (e) {
        // Try next locator
        continue;
      }
    }

    if (!passwordField) {
      throw new Error('Could not find password field using any strategy after waiting.');
    }

    // Password field visible: proceed
    await passwordField.click({ force: true });
    await passwordField.fill(credentials.password);
    
    // Robustly click 'Log In'
    const loginButton = popup.getByRole('button', { name: /Log In/i });
    await loginButton.waitFor({ state: 'visible', timeout: timeout / 2 });
    await loginButton.click({ force: true });
    }

  async approvePayPalPayment(popup, timeout = TIMEOUT) {
    // Robust selector approach: Match "Submit" or "Complete" first for standard, fallback to "Agree/Subscribe/Continue"
    const selector = 'button:has-text("Complete"), button:has-text("Submit"), button:has-text("Agree"), button:has-text("Subscribe"), button:has-text("Continue"), [data-test-id="continueButton"], #confirmButtonTop';
    
    let clicked = false;
    const startTime = Date.now();

    while (!clicked && (Date.now() - startTime < timeout)) {
      const frames = popup.frames();
      for (const f of frames) {
        try {
          // Attempt to find and click the specific 'Pay' button
          const payButton = f.getByRole('button', { name: 'Pay', exact: true });
          if (await payButton.isVisible()) {
            await this.delay(2000, popup); // 2s delay before click
            await payButton.click();
            clicked = true;
            break;
          }

          // Fallback to other selectors
          const el = f.locator(selector).first();
          if (el && await el.isVisible() && await el.isEnabled()) {
            await el.scrollIntoViewIfNeeded();
            await this.delay(1000, popup);
            await el.click();
            clicked = true;
            break;
          }
        } catch (e) {}
      }
      if (!clicked) await this.delay(1000, popup);
    }
    if (!clicked) throw new Error(`PayPal Approval failed after ${timeout}ms.`);
  }
}

class CheckoutPage {
  static TestCards = {
    visa_us: { 
      number: '4242424242424242', 
      expiry: '12/26', 
      cvc: '123', 
      zip: '10001', 
      country: 'United States',
      countryCode: 'US'
    },
    mastercard_pk: { 
      number: '5555555555555555', 
      expiry: '12/26', 
      cvc: '123', 
      zip: '', 
      country: 'Pakistan',
      countryCode: 'PK'
    },
    generic_decline: {
      number: '4000000000000002',
      expiry: '12/26',
      cvc: '123',
      zip: '10001',
      country: 'United States',
      countryCode: 'US'
    },
    stripe_3ds: {
      number: '4000000000003220',
      expiry: '12/26',
      cvc: '123',
      zip: '10001',
      country: 'United States',
      countryCode: 'US'
    }
  };

  constructor(page) {
    this.page = page;
    this.paypal = new PayPalHandler(page);
  }

  async applyCoupon(coupon) {
    const couponInput = this.page.locator('input[placeholder*="Coupon" i]');
    await couponInput.waitFor({ state: 'visible', timeout: TIMEOUT });
    await couponInput.fill(coupon);
    await this.page.getByRole('button', { name: /Apply/i }).click();
  }

  async completeCheckoutProcess(cardKey = 'visa_us') {
    const cardData = CheckoutPage.TestCards[cardKey] || CheckoutPage.TestCards.visa_us;
    await this.payWithStripe(cardData);
  }

  async payWithStripe(cardData) {
    // Click Card payment option first
    await this.page.getByRole('button', { name: 'Card' }).click();

    // Use the first matching frame, as multiple frames may have the same title
    const frame = this.page.frameLocator('iframe[title="Secure payment input frame"]').first();

    await frame.getByRole('textbox', { name: 'Card number' }).fill(cardData.number);
    await frame.getByRole('textbox', { name: 'Expiration date MM / YY' }).fill(cardData.expiry);
    await frame.getByRole('textbox', { name: 'Security code' }).fill(cardData.cvc);

    // Select Country
    if (cardData.countryCode) {
        await frame.getByLabel('Country').selectOption(cardData.countryCode);
    }

    // Conditional ZIP code handling: check if field exists before filling
    const zipField = frame.getByRole('textbox', { name: 'ZIP code' });
    if (await zipField.isVisible()) {
      await zipField.fill(cardData.zip || '12345');
    }

    // Click the dynamic submit button ("Pay NGN", "Pay USD", etc.) and skip the provider tabs.
    await this.page.getByRole('button', { name: /^Pay\b/i }).click();
  }

  async waitForPaymentFailureAndClose() {
    const failureMessage = this.page.getByText(/declin|error|failed/i).first();
    await failureMessage.waitFor({ state: 'visible', timeout: TIMEOUT });

    const closeButton = this.page.getByRole('button', { name: /^Close$/ }).first();
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();
    }
  }

  async complete3DSChallenge() {
    const deadline = Date.now() + 60000;
    console.log('🔄 Starting 3DS challenge completion (enhanced multi-strategy)...');

    while (Date.now() < deadline) {
      for (const frame of this.page.frames()) {
        try {
          const completeButton = frame.locator('#test-source-authorize-3ds').first();
          const fallbackButton = frame.getByRole('button', { name: /Complete/i }).first();
          
          let targetLocator = null;
          if (await completeButton.count() > 0 && await completeButton.isVisible()) {
            targetLocator = completeButton;
          } else if (await fallbackButton.count() > 0 && await fallbackButton.isVisible()) {
            targetLocator = fallbackButton;
          }

          if (targetLocator) {
            console.log('✅ Found 3DS challenge button, attempting click and JS click backup...');
            await frame.waitForTimeout(500); 
            
            // Try standard Playwright click with force: true
            try {
              await targetLocator.click({ force: true, timeout: 5000 });
              console.log('✅ 3DS button clicked via Playwright click.');
            } catch (clickErr) {
              console.warn('⚠️ Playwright click failed, trying JS evaluation click...', clickErr.message);
            }
            
            // Try JS click as backup
            try {
              await targetLocator.evaluate(el => el.click());
              console.log('✅ 3DS button clicked via JS evaluation.');
            } catch (evalErr) {
              console.warn('⚠️ JS evaluation click failed:', evalErr.message);
            }
            
            return;
          }
        } catch (error) {
          // Keep polling until the challenge frame is ready or the page navigates.
        }
      }
      await this.page.waitForTimeout(1000);
    }
    throw new Error('3DS challenge timed out.');
  }

  async payWithPaystack() {
    // Logic for Paystack payment
  }
}
module.exports = { CheckoutPage };
