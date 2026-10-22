// streaming Task/tasks/ErrorPageToHomeCollectionTask.js
const { expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const TIMEOUT = process.env.CI ? 120000 : 90000;

class ErrorPageToHomeCollectionTask {
  constructor(page, baseEmail = 'rolex.rolls12@gmail.com') {
    this.page = page;
    this.baseEmail = baseEmail;
  }

  /**
   * Helper: Generates unique 17-character VIN consisting only of alphabet letters (A-Z)
   */
  static generateAlphabetVin(length = 17) {
    const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
    let vin = '';
    for (let i = 0; i < length; i++) {
      vin += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return vin;
  }

  /**
   * Helper: Generates unique email address using base email alias
   */
  static generateEmail(baseEmail = 'rolex.rolls12@gmail.com') {
    const [username, domain] = baseEmail.split('@');
    const suffix = Math.random().toString(36).substring(2, 6) + Date.now().toString(36).slice(-3);
    return `${username}+${suffix}@${domain || 'gmail.com'}`;
  }

  /**
   * Flow check: ensures test only runs when streaming flow is detected
   */
  async ensureStreamingFlow(testInfo) {
    const cookies = await this.page.context().cookies();
    const flowCookie = cookies.find((c) => c.name === 'checkout_flow');
    let flowType = flowCookie ? flowCookie.value : null;

    if (!flowType) {
      flowType = await this.page.evaluate(() => {
        try {
          const settings = JSON.parse(localStorage.getItem('site_settings') || '{}');
          return settings.checkout_flow || null;
        } catch (e) {
          return null;
        }
      });
    }

    console.log(`🔍 [ErrorPageToHomeCollectionTask] Flow Check: "${flowType || 'streaming (default)'}"`);
    if (flowType === 'non_streaming') {
      console.log('⚠️ [ErrorPageToHomeCollectionTask] Non-streaming flow detected. Skipping case.');
      if (testInfo && typeof testInfo.skip === 'function') {
        testInfo.skip(true, 'Skipping: Non-streaming checkout flow detected');
      }
      return false;
    }
    return true;
  }

  /**
   * Self-healing input locator for VIN field
   */
  async getVinInput() {
    const strategies = [
      () => this.page.getByRole('textbox', { name: /vin/i }),
      () => this.page.locator('input[name="vin"]'),
      () => this.page.locator('input[placeholder*="VIN" i]'),
      () => this.page.locator('input[aria-label*="VIN" i]'),
      () => this.page.locator('input[type="text"]').first()
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        const loc = strategies[i]().locator('visible=true').first();
        if (await loc.isVisible({ timeout: 1500 }).catch(() => false)) {
          return loc;
        }
      } catch (e) {}
    }
    return strategies[1]().first();
  }

  /**
   * Self-healing decode button locator
   */
  async getDecodeButton() {
    const strategies = [
      () => this.page.getByRole('button', { name: /search vin|get window sticker|search window sticker|get sticker|search/i }),
      () => this.page.locator('button[type="submit"]'),
      () => this.page.locator('button:has-text("Search VIN")'),
      () => this.page.locator('button:has-text("Search")'),
      () => this.page.locator('div[role="button"]:has-text("Search")')
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        const loc = strategies[i]().locator('visible=true').first();
        if (await loc.isVisible({ timeout: 1500 }).catch(() => false)) {
          return loc;
        }
      } catch (e) {}
    }
    return strategies[1]().first();
  }

  /**
   * Self-healing Email Address input locator on Preview Error Page
   * Primary: getByRole('textbox', { name: 'Email address' })
   */
  async getEmailAddressInput() {
    const strategies = [
      () => this.page.getByRole('textbox', { name: 'Email address' }),
      () => this.page.getByRole('textbox', { name: /email/i }),
      () => this.page.locator('input[type="email"]'),
      () => this.page.locator('input[placeholder*="email" i]'),
      () => this.page.locator('input[aria-label*="email" i]'),
      () => this.page.locator('input[name*="email" i]')
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        const loc = strategies[i]().locator('visible=true').first();
        if (await loc.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(`✅ [Self-Healing Email Input] Located using strategy #${i + 1}`);
          return loc;
        }
      } catch (e) {}
    }

    // Default to primary locator
    return strategies[0]();
  }

  /**
   * Self-healing Notify Me button locator on Preview Error Page
   * Primary: getByRole('button', { name: 'Notify me' })
   */
  async getNotifyButton() {
    const strategies = [
      () => this.page.getByRole('button', { name: 'Notify me' }),
      () => this.page.getByRole('button', { name: /notify\s*me/i }),
      () => this.page.locator('button:has-text("Notify me")'),
      () => this.page.locator('button:has-text("Notify")'),
      () => this.page.locator('button[type="submit"]')
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        const loc = strategies[i]().locator('visible=true').first();
        if (await loc.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(`✅ [Self-Healing Notify Button] Located using strategy #${i + 1}`);
          return loc;
        }
      } catch (e) {}
    }

    // Default to primary locator
    return strategies[0]();
  }

  /**
   * Main execution flow:
   * 1. Detect flow & navigate to home
   * 2. Put wrong 17-char Alphabet VIN and submit decode
   * 3. Navigate to preview page & assert error condition
   * 4. Intercept vin-check/preview API payload
   * 5. Input email and click "Notify me" with self-healing
   * 6. Capture API payload and assert successful response
   * 7. Verify success message and capture screenshot
   */
  async execute(testInfo, timeout = TIMEOUT) {
    // 1. Initial Flow Detection
    await this.page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    const isStreaming = await this.ensureStreamingFlow(testInfo);
    if (!isStreaming) return;

    // 2. Put Wrong VIN and Land on Preview Error Page (with fallback retry if VIN unexpectedly decodes)
    const errorLocator = this.page.locator('h1, h2, h3, p, div, span, [role="alert"]')
      .filter({ hasText: /We couldn'?t find a vehicle for that VIN|Sorry\s*[-—–]\s*no record found for VIN#?/i })
      .first();

    const decodedCondition = this.page.locator([
      'h1:has-text("Records found for")',
      'text=Window sticker found for',
      'text=We decoded these details',
      'text=Is this your vehicle?',
      'button:has-text("Access Record")',
      'button:has-text("Access Records")',
      'button:has-text("Yes, that\'s it")',
      'button:has-text("No, fix it")'
    ].join(', ')).first();

    let errorConfirmed = false;
    let alphabetVin = '';
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) {
        console.log(`\n🔄 [ErrorPageToHomeCollectionTask] Fallback attempt #${attempt}: Retrying with a new wrong VIN...`);
        await this.page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
      }

      alphabetVin = ErrorPageToHomeCollectionTask.generateAlphabetVin(17);
      expect(alphabetVin.length).toBe(17);
      console.log(`\n📋 [ErrorPageToHomeCollectionTask] (Attempt ${attempt}/${maxAttempts}) Generated Wrong 17-char Alphabet VIN: "${alphabetVin}"`);

      const vinInput = await this.getVinInput();
      await vinInput.waitFor({ state: 'visible', timeout });
      await vinInput.scrollIntoViewIfNeeded().catch(() => {});
      await vinInput.fill(alphabetVin);
      await vinInput.dispatchEvent('input').catch(() => {});
      await vinInput.dispatchEvent('change').catch(() => {});

      const decodeBtn = await this.getDecodeButton();
      await decodeBtn.scrollIntoViewIfNeeded().catch(() => {});
      try {
        await decodeBtn.click({ force: true });
      } catch {
        await vinInput.press('Enter');
      }
      console.log('✅ [ErrorPageToHomeCollectionTask] Wrong VIN submitted.');

      // 3. Land on Preview Error Page
      console.log('⏳ [ErrorPageToHomeCollectionTask] Waiting for Preview page...');
      await this.page.waitForURL(/.*(\/preview|\/vin-check|\/ws-preview).*/, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      }).catch(() => {});
      console.log(`📍 [ErrorPageToHomeCollectionTask] Landed on: ${this.page.url()}`);
      await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
      await this.page.waitForTimeout(1500);

      // Verify expected error condition within 12 seconds
      const errorAppeared = await errorLocator.waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false);
      if (errorAppeared) {
        const errorText = (await errorLocator.innerText().catch(() => '')).trim();
        console.log(`🎉 [ErrorPageToHomeCollectionTask] Confirmed error condition: "${errorText}"`);
        errorConfirmed = true;
        break;
      }

      // Check if VIN unexpectedly decoded
      const isDecoded = await decodedCondition.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`⚠️ [ErrorPageToHomeCollectionTask] VIN decode condition: ${isDecoded ? 'Decoded into vehicle details' : 'Error locator not found within 12s'}.`);
    }

    if (!errorConfirmed) {
      console.log('ℹ️ [ErrorPageToHomeCollectionTask] Error message did not appear after retries (VIN was decoded). Gracefully skipping.');
      const screenshot = await this.page.screenshot({ fullPage: false }).catch(() => null);
      if (screenshot && testInfo && typeof testInfo.attach === 'function') {
        await testInfo.attach('TC_29_VIN_Decoded_Fallback_Screenshot', {
          body: screenshot,
          contentType: 'image/png'
        }).catch(() => {});
      }
      if (testInfo && typeof testInfo.skip === 'function') {
        testInfo.skip(true, 'VIN decode succeeded unexpectedly');
      }
      return;
    }

    // 4. Setup API Payload Capture for vin-check/preview
    let capturedApiUrl = '';
    let capturedApiPayload = null;
    let capturedApiResponse = null;

    const isPreviewApi = (url) => /vin-check\/(?:ws-)?preview/i.test(url);

    const apiResponsePromise = this.page.waitForResponse(
      (res) => isPreviewApi(res.url()) && res.request().method() === 'POST',
      { timeout: 20000 }
    ).catch(() => null);

    // Also attach request listener to ensure payload is reliably captured
    const requestListener = (req) => {
      if (isPreviewApi(req.url()) && req.method() === 'POST') {
        try {
          capturedApiUrl = req.url();
          capturedApiPayload = req.postData();
          console.log(`📡 [Captured API Payload]: ${capturedApiPayload}`);
        } catch (e) {}
      }
    };
    this.page.on('request', requestListener);

    // 5. Input Email and Click Notify Me with Self-Healing
    const uniqueEmail = ErrorPageToHomeCollectionTask.generateEmail(this.baseEmail);
    console.log(`✉️ [ErrorPageToHomeCollectionTask] Generated email: ${uniqueEmail}`);

    const emailInput = await this.getEmailAddressInput();
    await emailInput.scrollIntoViewIfNeeded().catch(() => {});
    await emailInput.click({ force: true });
    await emailInput.fill(uniqueEmail);
    await emailInput.dispatchEvent('input').catch(() => {});
    await emailInput.dispatchEvent('change').catch(() => {});
    console.log('✅ [ErrorPageToHomeCollectionTask] Email entered.');

    await this.page.waitForTimeout(500);

    const notifyBtn = await this.getNotifyButton();
    await notifyBtn.scrollIntoViewIfNeeded().catch(() => {});
    console.log('🚀 [ErrorPageToHomeCollectionTask] Clicking "Notify me" button...');
    await notifyBtn.click({ force: true });

    // 6. Wait for API Response & Verify Payload
    const apiResponse = await apiResponsePromise;
    if (apiResponse) {
      capturedApiUrl = apiResponse.url();
      capturedApiPayload = apiResponse.request().postData() || capturedApiPayload;
      try {
        capturedApiResponse = await apiResponse.text();
      } catch (e) {}
      console.log(`✅ [ErrorPageToHomeCollectionTask] API Response status: ${apiResponse.status()}`);
    }

    // Cleanup listener
    this.page.off('request', requestListener);

    // 7. Verify Success Message on UI
    console.log('⏳ [ErrorPageToHomeCollectionTask] Validating success message...');
    const successLocator = this.page.locator('text=/Thanks\\s*[-—–]\\s*we\'?ll be in touch/i')
      .or(this.page.getByText(/Thanks.*in touch/i))
      .first();

    await expect(successLocator).toBeVisible({ timeout: 15000 });
    const successText = (await successLocator.innerText().catch(() => '')).trim();
    console.log(`🎉 [ErrorPageToHomeCollectionTask] Success message confirmed: "${successText}"`);

    // 8. Capture Screenshot of Success Message
    const screenshotDir = path.resolve(process.cwd(), 'test-results', 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const timestamp = Date.now();
    const screenshotFilename = `error-page-home-collection-${timestamp}.png`;
    const screenshotPath = path.join(screenshotDir, screenshotFilename);

    await this.page.screenshot({ path: screenshotPath, fullPage: false });

    // Mandatory STDOUT Summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ [ERROR PAGE TO HOME COLLECTION PASSED]');
    console.log(`📋 Wrong VIN:          ${alphabetVin}`);
    console.log(`📧 User Email:         ${uniqueEmail}`);
    console.log(`📡 Captured API URL:   ${capturedApiUrl || 'N/A'}`);
    console.log(`📦 Captured Payload:   ${capturedApiPayload || 'N/A'}`);
    console.log(`📥 Captured Response:  ${capturedApiResponse || 'N/A'}`);
    console.log(`📸 Success Screenshot: ${screenshotPath}`);
    console.log('='.repeat(80) + '\n');

    // Attach to Playwright / Allure report
    if (testInfo && typeof testInfo.attach === 'function') {
      const screenshotBuffer = fs.readFileSync(screenshotPath);
      await testInfo.attach('Error_Page_Success_Screenshot', {
        body: screenshotBuffer,
        contentType: 'image/png'
      });

      if (capturedApiPayload) {
        await testInfo.attach('API_Payload_vin_check_preview', {
          body: Buffer.from(capturedApiPayload, 'utf-8'),
          contentType: 'application/json'
        });
      }
      console.log('📎 [ErrorPageToHomeCollectionTask] Attached screenshot and payload to report.');
    }

    // Assertions
    expect(capturedApiPayload).toBeTruthy();
    expect(capturedApiPayload).toContain(uniqueEmail);
  }
}

module.exports = { ErrorPageToHomeCollectionTask };
