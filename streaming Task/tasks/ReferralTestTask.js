// streaming Task/tasks/ReferralTestTask.js
const { expect } = require('@playwright/test');
const { HomePage } = require('../pages/HomePage');
const { PreviewPage } = require('../pages/PreviewPage');

const REFERRAL_QUERY = '?ref=TESTREF&utm_source=google&utm_campaign=x';
const TIMEOUT = process.env.CI ? 90000 : 60000;

/**
 * Reusable helper function for streaming flow:
 * Opens the site with referral/UTM query parameters and validates that cookies are saved.
 */
async function applyReferralAndVerifyCookies(page, queryParams = REFERRAL_QUERY) {
  let targetUrl;
  const currentUrl = page.url() && page.url() !== 'about:blank' ? page.url() : '';

  if (queryParams.startsWith('http://') || queryParams.startsWith('https://')) {
    targetUrl = queryParams;
  } else if (!currentUrl) {
    targetUrl = `/?${queryParams.replace(/^\?/, '')}`;
  } else {
    try {
      const urlObj = new URL(currentUrl);
      const params = new URLSearchParams(queryParams.replace(/^\?/, ''));
      params.forEach((v, k) => urlObj.searchParams.set(k, v));
      targetUrl = urlObj.toString();
    } catch (e) {
      targetUrl = `/?${queryParams.replace(/^\?/, '')}`;
    }
  }

  console.log(`🚀 [ReferralTest] Navigating to URL with referral parameters: ${targetUrl}`);
  
  // Clear DNS socket/browser cache via CDP session before opening domain to ensure fresh socket connection
  const cdp = await page.context().newCDPSession(page).catch(() => null);
  if (cdp) {
    await cdp.send('Network.clearBrowserCache').catch(() => {});
  }

  // Resilient navigation retry to handle cold DNS lookups
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      break;
    } catch (err) {
      if (attempt === 3) throw err;
      console.warn(`⚠️ [ReferralTest DNS Retry] Attempt ${attempt} failed (${err.message}). Retrying in 1.5s...`);
      await page.waitForTimeout(1500);
    }
  }
  await page.waitForTimeout(1500);

  // Poll for cookie persistence
  let refCookie = null;
  let cookies = [];
  for (let attempt = 0; attempt < 5; attempt++) {
    cookies = await page.context().cookies();
    refCookie = cookies.find((c) => c.name.toLowerCase() === 'ref' || (c.value && c.value.includes('TESTREF')));
    if (refCookie) break;
    await page.waitForTimeout(500);
  }

  console.log(`📋 [ReferralTest] Total cookies found: ${cookies.length}`);
  expect(refCookie, 'Referral cookie "ref" must be saved in cookies').toBeDefined();
  expect(refCookie.value).toBe('TESTREF');
  console.log(`✅ [ReferralTest] Verified "ref" cookie saved: "${refCookie.name}=${refCookie.value}"`);

  const utmCookie = cookies.find((c) => c.name.toLowerCase().includes('utm') || c.name.toLowerCase() === 'traffic_source');
  if (utmCookie) {
    console.log(`✅ [ReferralTest] Verified UTM/traffic_source cookie saved: "${utmCookie.name}=${utmCookie.value}"`);
  }

  return true;
}

class ReferralTestTask {
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

    console.log(`🔍 [ReferralTestTask] Flow Check: "${flowType || 'streaming (default)'}"`);
    if (flowType === 'non_streaming') {
      console.log('⚠️ [ReferralTestTask] Non-streaming flow detected. Skipping case.');
      if (testInfo && typeof testInfo.skip === 'function') {
        testInfo.skip(true, 'Skipping: Non-streaming checkout flow detected');
      }
      return false;
    }
    return true;
  }

  /**
   * Main execution:
   * 1. Initially call referral helper to apply params & verify cookies
   * 2. Decode VIN and navigate to Preview
   * 3. Verify Preview Specs
   * 4. Run Checkout flow and verify redirection to Checkout URL
   */
  async execute(testInfo, timeout = TIMEOUT, baseVin = '4JGED6EB0JA121898') {
    // 1. Initial Referral & Cookie Validation
    console.log('[ReferralTestTask] Calling referral helper initially...');
    await applyReferralAndVerifyCookies(this.page);

    const isStreaming = await this.ensureStreamingFlow(testInfo);
    if (!isStreaming) return;

    // 2. Decode VIN to land on Preview page
    console.log(`[ReferralTestTask] Decoding VIN: ${baseVin}`);
    await this.home.decodeVin(baseVin, 3);

    // 3. Verify Specs on Preview
    console.log('[ReferralTestTask] Verifying specs visibility...');
    await this.preview.verifySpecsVisible();

    // 4. Run Preview to Checkout flow (Access Record -> Fill Email/Phone -> Proceed to checkout)
    console.log('[ReferralTestTask] Running checkout flow to navigate to checkout...');
    await this.preview.runCheckoutFlow();

    // 5. Verify Checkout Navigation
    await expect(this.page).toHaveURL(/.*\/checkout(?:-\d+)?.*/, { timeout });
    console.log(`✅ [ReferralTestTask] Successfully reached checkout URL: ${this.page.url()}`);
  }
}

module.exports = {
  REFERRAL_QUERY,
  applyReferralAndVerifyCookies,
  ReferralTestTask,
  refferaltest: ReferralTestTask
};
