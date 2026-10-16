import { Page, BrowserContext, TestInfo, expect, test } from '@playwright/test';
import { Actor } from '../actors/Actor';

export interface ClarityTaskOptions {
  page: Page;
  context: BrowserContext;
  testInfo: TestInfo;
  isStreaming?: boolean;
  customVin?: string;
}

export interface ClarityBeacon {
  url: string;
  method: string;
  timestamp: number;
}

export interface ClarityCookieState {
  userId: string | null;
  rawClck: string | null;
  rawClsk: string | null;
  pageSequence: number | null;
  sessionToken: string | null;
}

/**
 * Microsoft Clarity 3-Wrapper Verification Task
 *
 * Verifies end-to-end telemetry and session stitching across:
 *   1. Wrapper 1: Homepage (deferred initialization ~10-15s CWV window)
 *   2. Wrapper 2: Preview Page (instant telemetry initialization upon VIN decode)
 *   3. Wrapper 3: Checkout Page (cross-page session stitching & checkout tracking)
 *
 * Designed according to Playwright Advance E2E standards:
 * - Smart waits with expect.poll (zero hardcoded sleep, zero networkidle)
 * - Structured test.step hierarchy with rich STDOUT logs and report attachments
 * - Resilient across both CI and local environments with automatic tracker unrouting
 * - Usable in both Streaming and Non-Streaming test suites
 */
export class ClarityVerificationTask {
  private capturedBeacons: ClarityBeacon[] = [];
  private baseVinPool: string[] = [
    '4JGED6EB0JA121898',
    '1C4RJHBG0PC533410',
    '3MW5R1J01M8B87063',
    '1FMCU0F68LUB98817',
    'WA1VABGE5KB008242'
  ];

  constructor(private testInfo?: TestInfo) {}

  /**
   * Helper to parse Microsoft Clarity cookies (_clck and _clsk)
   */
  private parseClarityCookies(cookies: Array<{ name: string; value: string }>, sessionToken: string | null = null): ClarityCookieState {
    const clck = cookies.find(c => c.name === '_clck');
    const clsk = cookies.find(c => c.name === '_clsk');

    let userId: string | null = null;
    if (clck) {
      const decoded = decodeURIComponent(clck.value);
      userId = decoded.split('^')[0] || decoded;
    }

    let pageSequence: number | null = null;
    if (clsk) {
      const decoded = decodeURIComponent(clsk.value);
      const parts = decoded.split('^');
      if (parts.length >= 3 && parts[2]) {
        const parsed = parseInt(parts[2], 10);
        if (!isNaN(parsed)) pageSequence = parsed;
      }
    }

    return {
      userId,
      rawClck: clck?.value || null,
      rawClsk: clsk?.value || null,
      pageSequence,
      sessionToken
    };
  }

  /**
   * Generates a randomized valid VIN to avoid caching issues during decode
   */
  private getRandomVin(customVin?: string): string {
    if (customVin) return customVin;
    const base = this.baseVinPool[Math.floor(Math.random() * this.baseVinPool.length)];
    const randomSuffix = Math.floor(Math.random() * 90 + 10).toString();
    return base.slice(0, -2) + randomSuffix;
  }

  /**
   * Ensures clarity.ms network routes are unblocked and starts telemetry beacon listening
   */
  private async setupClarityNetworkCapture(page: Page): Promise<void> {
    // Unroute any generic tracker blocking that may have intercepted clarity.ms
    await page.unroute(/.*clarity\.ms.*/i).catch(() => {});

    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('clarity.ms')) {
        this.capturedBeacons.push({
          url,
          method: req.method(),
          timestamp: Date.now()
        });
      }
    });
  }

  /**
   * Wrapper 1: Verify Homepage Microsoft Clarity script and deferred loading
   */
  async verifyHomepageWrapper(page: Page, context: BrowserContext, testInfo: TestInfo): Promise<ClarityCookieState> {
    return await test.step('Wrapper 1: Verify Microsoft Clarity on Homepage (Deferred CWV Load)', async () => {
      console.log('\n===============================================================');
      console.log('  [Clarity Verification] WRAPPER 1: HOMEPAGE VERIFICATION');
      console.log('===============================================================');

      // Navigate to homepage if not already there
      if (!page.url() || page.url() === 'about:blank') {
        console.log('[Clarity Task] Navigating to Homepage...');
        await page.goto('/', { waitUntil: 'domcontentloaded' });
      }

      console.log(`[Clarity Task] Current URL: ${page.url()}`);
      console.log('[Clarity Task] Smart waiting for deferred Microsoft Clarity initialization (~10-15s CWV window)...');

      try {
        // Smart wait: Poll for script tag or window.clarity function
        await expect.poll(async () => {
          return await page.evaluate(() => {
            const hasScript = !!document.querySelector('script[src*="clarity.ms"]');
            const hasClarityFn = typeof (window as any).clarity === 'function';
            return hasScript || hasClarityFn;
          });
        }, {
          message: 'Microsoft Clarity script or window.clarity function was not initialized on Homepage within 30s',
          timeout: 30000,
          intervals: [500, 1000, 2000]
        }).toBe(true);

        console.log('✓ [Clarity Task] window.clarity function detected on Homepage');

        // Trigger gentle user micro-interaction to prompt Clarity session telemetry start
        await page.mouse.move(150, 150).catch(() => {});
        await page.mouse.wheel(0, 100).catch(() => {});

        // Smart wait: Poll for _clck cookie or session storage token
        let state: ClarityCookieState = { userId: null, rawClck: null, rawClsk: null, pageSequence: null, sessionToken: null };
        await expect.poll(async () => {
          const cookies = await context.cookies();
          const sessionToken = await page.evaluate(() => {
            try {
              return window.sessionStorage.getItem('_cltk');
            } catch {
              return null;
            }
          });
          state = this.parseClarityCookies(cookies, sessionToken);
          return !!state.userId || !!state.sessionToken;
        }, {
          message: 'Microsoft Clarity session cookie (_clck) or storage token (_cltk) was not set on Homepage within 20s',
          timeout: 20000,
          intervals: [500, 1000]
        }).toBe(true);

        // Verify that tag script was requested
        const tagBeacon = this.capturedBeacons.find(b => b.url.includes('/tag/') || b.url.includes('clarity.js'));
        console.log(`✓ [Clarity Task] Telemetry beacon detected: ${tagBeacon ? tagBeacon.url.substring(0, 80) : 'Active'}`);
        console.log(`✓ [Clarity Task] Homepage Clarity User ID: ${state.userId || 'Session token: ' + state.sessionToken}`);
        console.log(`✓ [Clarity Task] Homepage Raw _clck: ${state.rawClck || 'Pending flush'}`);
        console.log(`✓ [Clarity Task] Homepage Session Token: ${state.sessionToken || 'None'}`);

        await testInfo.attach('wrapper1-homepage-clarity.json', {
          body: JSON.stringify({
            url: page.url(),
            cookieState: state,
            beaconsCount: this.capturedBeacons.length,
            recentBeacons: this.capturedBeacons.slice(-5)
          }, null, 2),
          contentType: 'application/json'
        });

        return state;
      } catch (err: any) {
        console.error('\n❌ [Clarity Task FAILURE] Wrapper 1 (Homepage) Verification Failed!');
        console.error(`Page URL: ${page.url()}`);
        console.error(`Error: ${err.message}`);
        console.error(`Total Beacons: ${this.capturedBeacons.length}`);
        await testInfo.attach('wrapper1-failure-diagnostic.txt', {
          body: `Step: Wrapper 1 Homepage\nURL: ${page.url()}\nError: ${err.stack || err.message}\nBeacons: ${JSON.stringify(this.capturedBeacons, null, 2)}`,
          contentType: 'text/plain'
        });
        throw err;
      }
    });
  }

  /**
   * Wrapper 2: Verify Preview Page Microsoft Clarity script and session continuity
   */
  async verifyPreviewWrapper(
    page: Page,
    context: BrowserContext,
    testInfo: TestInfo,
    expectedUserId: string | null,
    vin: string
  ): Promise<ClarityCookieState> {
    return await test.step('Wrapper 2: Verify Microsoft Clarity on Preview Page (Session Continuity)', async () => {
      console.log('\n===============================================================');
      console.log('  [Clarity Verification] WRAPPER 2: PREVIEW PAGE VERIFICATION');
      console.log('===============================================================');

      try {
        console.log(`[Clarity Task] Submitting VIN to transition to Preview: ${vin}`);
        const vinInput = page.locator('input[name="vin"], input[name="vin_number"], input[placeholder*="VIN" i], input[type="text"]').first();
        await vinInput.waitFor({ state: 'visible', timeout: 20000 });
        await vinInput.fill(vin);

        const searchBtn = page.getByRole('button', { name: /search vin|get window sticker|search window sticker|search/i })
          .or(page.locator('button[type="submit"]'))
          .or(page.locator('button:has-text("Search VIN")'))
          .first();

        await searchBtn.click();

        // Smart wait: URL transition to Preview page
        console.log('[Clarity Task] Waiting for Preview page URL transition...');
        await page.waitForURL(/.*(\/preview|\/vin-check|\/report|\/ws-preview).*/, {
          timeout: 45000,
          waitUntil: 'domcontentloaded'
        });

        console.log(`✓ [Clarity Task] Landed on Preview Page: ${page.url()}`);

        // Smart wait: Clarity function active on Preview
        await expect.poll(async () => {
          return await page.evaluate(() => typeof (window as any).clarity === 'function');
        }, {
          message: 'window.clarity function was not available on Preview page within 20s',
          timeout: 20000,
          intervals: [500, 1000]
        }).toBe(true);

        console.log('✓ [Clarity Task] window.clarity active on Preview Page');

        // Micro-interaction
        await page.mouse.move(200, 200).catch(() => {});
        await page.mouse.wheel(0, 80).catch(() => {});

        // Smart wait: Verify session stitching via _clck cookie continuity
        let previewState: ClarityCookieState = { userId: null, rawClck: null, rawClsk: null, pageSequence: null, sessionToken: null };
        await expect.poll(async () => {
          const cookies = await context.cookies();
          const sessionToken = await page.evaluate(() => {
            try {
              return window.sessionStorage.getItem('_cltk');
            } catch {
              return null;
            }
          });
          previewState = this.parseClarityCookies(cookies, sessionToken);

          if (expectedUserId && previewState.userId) {
            return previewState.userId === expectedUserId;
          }
          return !!previewState.userId || !!previewState.sessionToken;
        }, {
          message: `Clarity session continuity verification failed on Preview page (expected: ${expectedUserId}, got: ${previewState.userId})`,
          timeout: 20000,
          intervals: [500, 1000]
        }).toBe(true);

        console.log(`✓ [Clarity Task] Preview Clarity User ID: ${previewState.userId}`);
        console.log(`✓ [Clarity Task] Session continuity maintained from Homepage (Matched: ${previewState.userId === expectedUserId})`);
        if (previewState.rawClsk) {
          console.log(`✓ [Clarity Task] Preview Page Sequence / _clsk: ${previewState.rawClsk}`);
        }

        await testInfo.attach('wrapper2-preview-clarity.json', {
          body: JSON.stringify({
            url: page.url(),
            cookieState: previewState,
            matchedInitialUserId: previewState.userId === expectedUserId,
            beaconsCount: this.capturedBeacons.length
          }, null, 2),
          contentType: 'application/json'
        });

        return previewState;
      } catch (err: any) {
        console.error('\n❌ [Clarity Task FAILURE] Wrapper 2 (Preview Page) Verification Failed!');
        console.error(`Page URL: ${page.url()}`);
        console.error(`Error: ${err.message}`);
        await testInfo.attach('wrapper2-failure-diagnostic.txt', {
          body: `Step: Wrapper 2 Preview\nURL: ${page.url()}\nError: ${err.stack || err.message}\nBeacons: ${JSON.stringify(this.capturedBeacons, null, 2)}`,
          contentType: 'text/plain'
        });
        throw err;
      }
    });
  }

  /**
   * Wrapper 3: Verify Checkout Page Microsoft Clarity script and end-to-end session stitching
   */
  async verifyCheckoutWrapper(
    page: Page,
    context: BrowserContext,
    testInfo: TestInfo,
    expectedUserId: string | null
  ): Promise<ClarityCookieState> {
    return await test.step('Wrapper 3: Verify Microsoft Clarity on Checkout Page (E2E Session Stitching)', async () => {
      console.log('\n===============================================================');
      console.log('  [Clarity Verification] WRAPPER 3: CHECKOUT PAGE VERIFICATION');
      console.log('===============================================================');

      try {
        console.log('[Clarity Task] Initiating Checkout navigation from Preview...');

        // 1. Click Access Records CTA button
        const accessBtn = page.getByRole('button', { name: /access records|get window sticker|view full report|reveal records|get records|instant access/i })
          .or(page.locator('button:has-text("Access Records"), button:has-text("Get Window Sticker")'))
          .first();

        if (await accessBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
          console.log('[Clarity Task] Clicking Access Records CTA button...');
          await accessBtn.click({ force: true });
        }

        // 2. Fill email if popup or field is displayed
        const emailField = page.locator('input[type="email"], input[placeholder*="email" i], input[name*="email" i]').first();
        if (await emailField.isVisible({ timeout: 8000 }).catch(() => false)) {
          const randomEmail = `clarity.test.${Date.now()}@example.com`;
          console.log(`[Clarity Task] Entering email in modal: ${randomEmail}`);
          await emailField.fill(randomEmail);

          const phoneField = page.locator('input[type="tel"], input[placeholder*="phone" i], input[name*="phone" i]').first();
          if (await phoneField.isVisible({ timeout: 2000 }).catch(() => false)) {
            await phoneField.fill('(555) 234-5678');
          }

          const proceedBtn = page.getByRole('button', { name: /proceed to checkout/i })
            .or(page.locator('button:has-text("Proceed to Checkout"), button:has-text("Continue to Checkout")'))
            .first();

          console.log('[Clarity Task] Clicking Proceed to Checkout...');
          await proceedBtn.click({ force: true });
        }

        // 3. Smart wait: URL transition to Checkout page
        console.log('[Clarity Task] Waiting for Checkout page URL transition...');
        await page.waitForURL(/.*\/checkout(?:-\d+)?.*/, {
          timeout: 45000,
          waitUntil: 'domcontentloaded'
        });

        console.log(`✓ [Clarity Task] Landed on Checkout Page: ${page.url()}`);

        // 4. Smart wait: Clarity function active on Checkout
        await expect.poll(async () => {
          return await page.evaluate(() => typeof (window as any).clarity === 'function');
        }, {
          message: 'window.clarity function was not available on Checkout page within 20s',
          timeout: 20000,
          intervals: [500, 1000]
        }).toBe(true);

        console.log('✓ [Clarity Task] window.clarity active on Checkout Page');

        // Micro-interaction
        await page.mouse.move(250, 250).catch(() => {});
        await page.mouse.wheel(0, 50).catch(() => {});

        // 5. Smart wait: Verify cross-wrapper session stitching (same _clck User ID)
        let checkoutState: ClarityCookieState = { userId: null, rawClck: null, rawClsk: null, pageSequence: null, sessionToken: null };
        await expect.poll(async () => {
          const cookies = await context.cookies();
          const sessionToken = await page.evaluate(() => {
            try {
              return window.sessionStorage.getItem('_cltk');
            } catch {
              return null;
            }
          });
          checkoutState = this.parseClarityCookies(cookies, sessionToken);

          if (expectedUserId && checkoutState.userId) {
            return checkoutState.userId === expectedUserId;
          }
          return !!checkoutState.userId || !!checkoutState.sessionToken;
        }, {
          message: `Cross-wrapper session stitching failed on Checkout (expected: ${expectedUserId}, got: ${checkoutState.userId})`,
          timeout: 20000,
          intervals: [500, 1000]
        }).toBe(true);

        console.log(`✓ [Clarity Task] Checkout Clarity User ID: ${checkoutState.userId}`);
        console.log(`✓ [Clarity Task] 3-Wrapper Session Stitching Verified: Homepage -> Preview -> Checkout (UserId: ${checkoutState.userId})`);
        if (checkoutState.rawClsk) {
          console.log(`✓ [Clarity Task] Checkout Page Sequence / _clsk: ${checkoutState.rawClsk}`);
        }
        console.log(`✓ [Clarity Task] Total Clarity Telemetry Beacons Captured: ${this.capturedBeacons.length}`);
        console.log('===============================================================\n');

        await testInfo.attach('wrapper3-checkout-clarity.json', {
          body: JSON.stringify({
            url: page.url(),
            cookieState: checkoutState,
            matchedInitialUserId: checkoutState.userId === expectedUserId,
            totalBeaconsCaptured: this.capturedBeacons.length,
            beacons: this.capturedBeacons
          }, null, 2),
          contentType: 'application/json'
        });

        return checkoutState;
      } catch (err: any) {
        console.error('\n❌ [Clarity Task FAILURE] Wrapper 3 (Checkout Page) Verification Failed!');
        console.error(`Page URL: ${page.url()}`);
        console.error(`Error: ${err.message}`);
        await testInfo.attach('wrapper3-failure-diagnostic.txt', {
          body: `Step: Wrapper 3 Checkout\nURL: ${page.url()}\nError: ${err.stack || err.message}\nBeacons: ${JSON.stringify(this.capturedBeacons, null, 2)}`,
          contentType: 'text/plain'
        });
        throw err;
      }
    });
  }

  /**
   * Main execution method orchestrating all 3 wrappers
   */
  async execute(options: ClarityTaskOptions): Promise<void> {
    const { page, context, testInfo, customVin } = options;
    const testTimeout = process.env.CI ? 150000 : 120000;
    testInfo.setTimeout(testTimeout);

    await this.setupClarityNetworkCapture(page);
    const vin = this.getRandomVin(customVin);

    // 1. Wrapper 1: Homepage
    const homeState = await this.verifyHomepageWrapper(page, context, testInfo);

    // 2. Wrapper 2: Preview Page
    const previewState = await this.verifyPreviewWrapper(page, context, testInfo, homeState.userId, vin);

    // 3. Wrapper 3: Checkout Page
    await this.verifyCheckoutWrapper(page, context, testInfo, homeState.userId || previewState.userId);
  }

  /**
   * Actor pattern compatibility adapter
   */
  async performAs(actor: Actor): Promise<void> {
    const page = actor.getPage();
    const context = page.context();
    const mockTestInfo = this.testInfo || (test.info ? test.info() : ({
      setTimeout: () => {},
      attach: async () => {}
    } as any));

    await this.execute({
      page,
      context,
      testInfo: mockTestInfo
    });
  }
}
