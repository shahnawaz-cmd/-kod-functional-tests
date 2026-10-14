// streaming Task/tasks/PurchaseFlow.js
class PurchaseFlow {
  static DefaultCard = {
    cardNum: '4782780016594346',
    expiry: '12/28',
    cvc: '123',
    zip: '10001',
    countryCode: 'US',
    name: 'Test User'
  };

  constructor(cardData = {}, isSlowNetwork = false) {
    this.cardData = { ...PurchaseFlow.DefaultCard, ...cardData };
    this.isSlowNetwork = isSlowNetwork;
  }

  async performAs(actorOrPage, testInfo) {
    const page = (actorOrPage && typeof actorOrPage.getPage === 'function')
      ? actorOrPage.getPage()
      : (actorOrPage?.page || actorOrPage);
    const timeout = this.isSlowNetwork ? 60000 : 30000;

    console.log("Determining checkout page layout/strategy dynamically...");

    // Click Card payment option first if visible
    const cardTabButton = page.getByRole('button', { name: 'Card' });
    try {
      if (await cardTabButton.isVisible({ timeout: 5000 })) {
        await cardTabButton.click();
        console.log("Selected Card tab option.");
      }
    } catch (e) {}

    // Precise selectors for the multi-frame elements (ignoring background helper Stripe frames)
    const multiFrameSelector = 'iframe[src*="componentName=cardNumber"], iframe[title*="Secure card number input frame" i]';
    // Precise selectors for the single-frame elements
    const singleFrameSelector = 'iframe[title*="payment" i], iframe[title*="Payment" i], iframe[src*="elements-inner-card"]';

    // Wait for at least one layout elements to attach/load
    await Promise.race([
      page.waitForSelector(multiFrameSelector, { state: 'attached', timeout: timeout }).catch(() => {}),
      page.waitForSelector(singleFrameSelector, { state: 'attached', timeout: timeout }).catch(() => {}),
    ]);

    // Check which design is rendered active
    const isSingleFrame = await page.locator(singleFrameSelector).first().isVisible().catch(() => false);
    const isMultiFrame = await page.locator(multiFrameSelector).first().isVisible().catch(() => false);

    console.log(`Active Stripe Layout Status -> SingleFrame: ${isSingleFrame}, MultiFrame: ${isMultiFrame}`);

    if (isMultiFrame) {
      console.log("Proceeding with Multi-Frame Checkout Strategy.");
      await this.performMultiFrameCheckout(page, timeout);
    } else {
      console.log("Defaulting to Single-Frame Checkout Strategy.");
      await this.performSingleFrameCheckout(page, timeout);
    }

    console.log("Purchase flow completed.");
  }

  async performSingleFrameCheckout(page, timeout) {
    const frame = page.frameLocator('iframe[title*="payment" i], iframe[title*="Payment" i], iframe[src*="elements-inner-card"]').first();

    const number = this.cardData.cardNum || '4782780016594346';
    let exp = this.cardData.expiry || '12/28';
    if (exp.length === 4 && !exp.includes('/')) {
      exp = `${exp.substring(0, 2)}/${exp.substring(2, 4)}`;
    }
    const cvc = this.cardData.cvc || '123';
    const zip = this.cardData.zip || '10001';
    const countryCode = this.cardData.countryCode || 'US';

    const cardInput = frame.getByRole('textbox', { name: /Card number/i }).or(frame.getByPlaceholder(/1234/i)).first();
    await cardInput.waitFor({ state: 'visible', timeout: timeout });
    await cardInput.fill(number);

    const expInput = frame.getByRole('textbox', { name: /Expiration/i }).or(frame.getByPlaceholder(/MM\s*\/\s*YY/i)).first();
    await expInput.waitFor({ state: 'visible', timeout: timeout });
    await expInput.fill(exp);

    const cvcInput = frame.getByRole('textbox', { name: /Security code|CVC|CVV/i }).or(frame.getByPlaceholder(/CVC/i)).first();
    await cvcInput.waitFor({ state: 'visible', timeout: timeout });
    await cvcInput.fill(cvc);

    try {
      const countryField = frame.getByRole('combobox', { name: /Country/i }).or(frame.getByLabel(/Country/i)).first();
      if (await countryField.isVisible({ timeout: 3000 })) {
        await countryField.selectOption({ label: 'United States' }).catch(() => countryField.selectOption(countryCode));
      }
    } catch (e) {}

    try {
      const zipField = frame.getByRole('textbox', { name: /ZIP|Postal/i }).or(frame.getByPlaceholder(/ZIP/i)).first();
      if (await zipField.isVisible({ timeout: 3000 })) {
        await zipField.fill(zip);
      }
    } catch (e) {}

    // Flow control: wait for payment-update API response
    const paymentUpdatePromise = page.waitForResponse(
      res => res.url().includes('payment-update'),
      { timeout: this.isSlowNetwork ? 180000 : 120000 }
    ).catch(() => null);

    const payButton = page.locator('button[type="submit"]')
      .or(page.getByRole('button', { name: /Pay\s*(&|and)?\s*Subscribe|^Pay\s+\$|Subscribe Now|^Pay\b(?!\s*pal)/i }))
      .or(page.locator('button:has-text("Pay & Subscribe"), button:has-text("Pay and Subscribe"), button:has-text("Pay Now"), button:has-text("Subscribe")'))
      .filter({ hasNotText: /paypal/i })
      .first();

    await payButton.waitFor({ state: 'visible', timeout: timeout });
    await payButton.click({ force: true });

    const paymentRes = await paymentUpdatePromise;
    if (paymentRes) {
      console.log(`📥 payment-update API resolved with status: ${paymentRes.status()}`);
    }
  }

  async performMultiFrameCheckout(page, timeout) {
    const nameInput = page.locator('input[placeholder="Enter your name"]');
    try {
      if (await nameInput.isVisible({ timeout: 5000 })) {
        await nameInput.fill(this.cardData.name || 'Test User');
      }
    } catch (e) {}

    const cardFrame = page.frameLocator('iframe[src*="componentName=cardNumber"], iframe[title*="Secure card number input frame" i]').first();
    const expiryFrame = page.frameLocator('iframe[src*="componentName=cardExpiry"], iframe[title*="Secure expiration date input frame" i]').first();
    const cvcFrame = page.frameLocator('iframe[src*="componentName=cardCvc"], iframe[title*="Secure CVC input frame" i]').first();

    const number = this.cardData.cardNum || '4782780016594346';
    const exp = (this.cardData.expiry || '1228').replace(/\D/g, '');
    const cvc = this.cardData.cvc || '123';
    const zip = this.cardData.zip || '10001';

    await cardFrame.locator('[name="cardnumber"]').fill(number);
    await expiryFrame.locator('[name="exp-date"]').fill(exp);
    await cvcFrame.locator('[name="cvc"]').fill(cvc);

    try {
      const zipLocator = page.locator('input[name="postal-code"], input#postal-code, [placeholder*="ZIP" i]');
      if (await zipLocator.first().isVisible({ timeout: 5000 })) {
        await zipLocator.first().fill(zip);
      }
    } catch (e) {}

    // Flow control: wait for payment-update API response
    const paymentUpdatePromise = page.waitForResponse(
      res => res.url().includes('payment-update'),
      { timeout: this.isSlowNetwork ? 180000 : 120000 }
    ).catch(() => null);

    const payButton = page.locator('button[type="submit"]')
      .or(page.getByRole('button', { name: /Pay\s*(&|and)?\s*Subscribe|^Pay\s+\$|Subscribe Now|^Pay\b(?!\s*pal)/i }))
      .or(page.locator('button:has-text("Pay & Subscribe"), button:has-text("Pay and Subscribe"), button:has-text("Pay Now"), button:has-text("Subscribe")'))
      .filter({ hasNotText: /paypal/i })
      .first();

    await payButton.waitFor({ state: 'visible', timeout: timeout });
    await payButton.click({ force: true });

    const paymentRes = await paymentUpdatePromise;
    if (paymentRes) {
      console.log(`📥 payment-update API resolved with status: ${paymentRes.status()}`);
    }
  }
}

module.exports = PurchaseFlow;
module.exports.PurchaseFlow = PurchaseFlow;
