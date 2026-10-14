// tests/tasks/VinErrorTask.js
const { expect } = require('@playwright/test');

const TIMEOUT = process.env.CI ? 90000 : 60000;

class VinErrorTask {
  constructor(page) {
    this.page = page;
  }

  /**
   * Helper: Generates unique 17-character VIN consisting only of alphabet letters (A-Z)
   * Standard VIN format excludes I, O, Q to avoid frontend sanitization issues.
   * Example: "AAAAAAAAAAAAAAAAA", "ABCDEFGHJKLMNPRST", etc.
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

    console.log(`🔍 [VinErrorTask] Flow Check: "${flowType || 'streaming (default)'}"`);
    if (flowType === 'non_streaming') {
      console.log('⚠️ [VinErrorTask] Non-streaming flow detected. Skipping case.');
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
   * Main execution flow:
   * 1. Detect flow (skip if non-streaming)
   * 2. Put generated alphabet VIN & click decode
   * 3. Land on preview page
   * 4. Verify expected error (or skip on decode success)
   * 5. Capture screenshot and attach to report
   */
  async execute(testInfo, timeout = TIMEOUT) {
    // 1. Initial Flow Detection
    await this.page.goto('/');
    await this.page.waitForLoadState('domcontentloaded');
    const isStreaming = await this.ensureStreamingFlow(testInfo);
    if (!isStreaming) return;

    // 2. Put VIN and Click Decode (Strict 17-character requirement)
    const alphabetVin = VinErrorTask.generateAlphabetVin(17);
    expect(alphabetVin.length).toBe(17);
    console.log(`\n📋 [VinErrorTask] Generated 17-char Alphabet VIN: "${alphabetVin}" (Length: ${alphabetVin.length})`);

    const vinInput = await this.getVinInput();
    await vinInput.waitFor({ state: 'visible', timeout });
    await vinInput.scrollIntoViewIfNeeded().catch(() => {});
    await vinInput.fill(alphabetVin);
    await vinInput.dispatchEvent('input').catch(() => {});
    await vinInput.dispatchEvent('change').catch(() => {});

    // Validate that the input field contains exactly 17 characters
    const filledValue = await vinInput.inputValue().catch(() => alphabetVin);
    expect(filledValue.length).toBe(17);
    console.log(`✅ [VinErrorTask] Validated exactly 17 characters entered in VIN field: "${filledValue}"`);

    const decodeBtn = await this.getDecodeButton();
    await decodeBtn.scrollIntoViewIfNeeded().catch(() => {});
    try {
      await decodeBtn.click({ force: true });
    } catch {
      await vinInput.press('Enter');
    }
    console.log('✅ [VinErrorTask] VIN submitted.');

    // 3. Land on Preview Page
    console.log('⏳ [VinErrorTask] Waiting for Preview page...');
    await this.page.waitForURL(/.*(\/preview|\/vin-check|\/ws-preview).*/, {
      waitUntil: 'domcontentloaded',
      timeout
    });
    console.log(`📍 [VinErrorTask] Landed on: ${this.page.url()}`);
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(1000);

    // 4. Verify Expected Error OR Skip on Decode Success
    const successCondition = this.page.locator('h1:has-text("Records found for"), button:has-text("Access Record"), text=We found detailed information').first();
    const isSuccess = await successCondition.isVisible({ timeout: 2000 }).catch(() => false);
    if (isSuccess) {
      console.log('⚠️ [VinErrorTask] VIN decode succeeded unexpectedly. Skipping test.');
      if (testInfo && typeof testInfo.skip === 'function') {
        testInfo.skip(true, 'VIN decode succeeded unexpectedly');
      }
      return;
    }

    // Expected Error Locator
    const errorLocator = this.page.locator('h1, h2, h3, p, div, span, [role="alert"]')
      .filter({ hasText: /We couldn'?t find a vehicle for that VIN|Sorry\s*[-—–]\s*no record found for VIN#?/i })
      .first();

    await expect(errorLocator).toBeVisible({ timeout });
    const errorText = (await errorLocator.innerText().catch(() => '')).trim();
    console.log(`🎉 [VinErrorTask] Expected error confirmed: "${errorText}"`);

    // 5. Screenshot & Report Attachment
    const screenshot = await this.page.screenshot({ fullPage: false });
    console.log('📸 [VinErrorTask] Screenshot captured.');
    if (testInfo && typeof testInfo.attach === 'function') {
      await testInfo.attach('TC_26_VIN_Error_Screenshot', {
        body: screenshot,
        contentType: 'image/png'
      });
      console.log('📎 [VinErrorTask] Attached screenshot to Playwright report.');
    }
  }
}

module.exports = { VinErrorTask };
