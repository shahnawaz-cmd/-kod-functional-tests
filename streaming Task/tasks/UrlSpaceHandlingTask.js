// tests/tasks/UrlSpaceHandlingTask.js
const { expect } = require('@playwright/test');
const { HomePage } = require('../pages/HomePage');
const { PreviewPage } = require('../pages/PreviewPage');
const { VinErrorTask } = require('./VinErrorTask');

const TIMEOUT = process.env.CI ? 90000 : 60000;

class UrlSpaceHandlingTask {
  constructor(page) {
    this.page = page;
    this.home = new HomePage(page);
    this.preview = new PreviewPage(page);
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

    console.log(`🔍 [UrlSpaceHandlingTask] Flow Check: "${flowType || 'streaming (default)'}"`);
    if (flowType === 'non_streaming') {
      console.log('⚠️ [UrlSpaceHandlingTask] Non-streaming flow detected. Skipping case.');
      if (testInfo && typeof testInfo.skip === 'function') {
        testInfo.skip(true, 'Skipping: Non-streaming checkout flow detected');
      }
      return false;
    }
    return true;
  }

  /**
   * Main execution flow:
   * 1. Navigate to home and decode a valid VIN
   * 2. Verify preview navigation done correctly
   * 3. Extract the VIN from URL, inject space into vin parameter, and reload/navigate to the spaced URL
   * 4. Verify same expected VIN error result appears
   * 5. Capture screenshot and attach to report
   */
  async execute(testInfo, timeout = TIMEOUT, baseVin = '4JGED6EB0JA121898') {
    // 1. Initial Flow Check & Home Navigation
    await this.home.navigate();
    const isStreaming = await this.ensureStreamingFlow(testInfo);
    if (!isStreaming) return;

    // 2. Decode valid VIN using HomePage helper
    console.log(`🚀 [UrlSpaceHandlingTask] Decoding base VIN: "${baseVin}"...`);
    const decodedVin = await this.home.decodeVin(baseVin, 2);
    console.log(`✅ [UrlSpaceHandlingTask] Submitted VIN: "${decodedVin}"`);

    // 3. Wait for Preview navigation to complete
    console.log('⏳ [UrlSpaceHandlingTask] Waiting for Preview page navigation...');
    await this.page.waitForURL(/.*(\/preview|\/vin-check|\/ws-preview).*/, {
      waitUntil: 'domcontentloaded',
      timeout
    });
    console.log(`📍 [UrlSpaceHandlingTask] Landed on Preview Page: ${this.page.url()}`);
    await this.preview.verifySpecsVisible('Records found for', timeout);

    // 4. Modify current URL: from VIN in URL remove 1 character and then put space
    const currentUrl = this.page.url();
    const vinMatch = currentUrl.match(/vin=([^&]+)/);
    const originalParamVin = vinMatch ? decodeURIComponent(vinMatch[1]) : decodedVin;
    
    // Remove 1 character and put space
    const spacedVin = originalParamVin.length > 1
      ? `${originalParamVin.slice(0, -1)} `
      : `${originalParamVin} `;

    const spacedUrl = currentUrl.replace(/vin=[^&]+/, `vin=${encodeURIComponent(spacedVin)}`);
    console.log(`🔄 [UrlSpaceHandlingTask] Removed 1 character from VIN and inserted space: "${spacedVin}"`);
    console.log(`🌐 [UrlSpaceHandlingTask] Navigating to spaced URL: ${spacedUrl}`);

    // Navigate to the URL containing space in VIN
    await this.page.goto(spacedUrl, { waitUntil: 'domcontentloaded', timeout });
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(1500);

    // 5. Verify same VIN Error expected result
    // "We couldn't find a vehicle for that VIN" OR "Sorry — no record found for VIN#"
    const errorLocator = this.page.locator('h1, h2, h3, p, div, span, [role="alert"]')
      .filter({ hasText: /We couldn'?t find a vehicle for that VIN|Sorry\s*[-—–]\s*no record found for VIN#?/i })
      .first();

    await expect(errorLocator).toBeVisible({ timeout });
    const errorText = (await errorLocator.innerText().catch(() => '')).trim();
    console.log(`🎉 [UrlSpaceHandlingTask] Confirmed expected VIN error message on spaced URL: "${errorText}"`);

    // 6. Screenshot & Report Attachment
    const screenshot = await this.page.screenshot({ fullPage: false });
    console.log('📸 [UrlSpaceHandlingTask] Screenshot captured.');
    if (testInfo && typeof testInfo.attach === 'function') {
      await testInfo.attach('TC_28_URL_Space_Handling_Screenshot', {
        body: screenshot,
        contentType: 'image/png'
      });
      console.log('📎 [UrlSpaceHandlingTask] Attached screenshot to Playwright report.');
    }
  }
}

module.exports = { UrlSpaceHandlingTask };
