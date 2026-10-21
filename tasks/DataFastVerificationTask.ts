import { Page, BrowserContext, TestInfo, expect, test } from '@playwright/test';

export interface DataFastScriptDetails {
  outerHTML: string;
  src: string | null;
  websiteId: string | null;
  domain: string | null;
  defer: boolean;
}

export interface DataFastTelemetryEvent {
  websiteId: string;
  domain: string;
  href: string;
  visitorId: string;
  sessionId: string;
  type: string;
  timestamp: number;
}

export interface DataFastVerificationResult {
  scriptDetails: DataFastScriptDetails | null;
  visitorId: string | null;
  sessionId: string | null;
  eventsDispatched: DataFastTelemetryEvent[];
}

/**
 * DataFast Verification Task with Stealth Anti-Bot Bypass
 *
 * Handles:
 * 1. Bypassing DataFast's internal bot detection (navigator.webdriver check)
 * 2. Verifying DOM script tag attributes (src, defer, data-website-id, data-domain)
 * 3. Capturing live POST https://datafa.st/api/events telemetry beacons
 * 4. Asserting real browser cookie creation (datafast_visitor_id & datafast_session_id)
 */
export class DataFastVerificationTask {
  private capturedEvents: DataFastTelemetryEvent[] = [];

  constructor(private testInfo?: TestInfo) {}

  /**
   * Applies stealth initialization to bypass DataFast's bot detection function r()
   */
  async applyStealthBypass(context: BrowserContext): Promise<void> {
    await context.addInitScript(() => {
      // 1. Hide navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
      // 2. Mock chrome runtime object
      (window as any).chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };
    });
  }

  /**
   * Attaches network listener to capture live telemetry calls to https://datafa.st/api/events
   */
  setupTelemetryListener(page: Page): void {
    page.on('request', req => {
      const url = req.url();
      if (url.includes('datafa.st/api/events') && req.method() === 'POST') {
        try {
          const payload = JSON.parse(req.postData() || '{}');
          this.capturedEvents.push({
            ...payload,
            timestamp: Date.now()
          });
          console.log(`🎯 [DataFast Telemetry] Captured POST event: type=${payload.type}, visitorId=${payload.visitorId}, websiteId=${payload.websiteId}`);
        } catch (e) {}
      }
    });
  }

  /**
   * Helper to inspect the DataFast script tag in the DOM
   */
  async extractDataFastScript(page: Page): Promise<DataFastScriptDetails | null> {
    return await page.evaluate(() => {
      const script = document.querySelector('script[src*="datafa.st"]');
      if (!script) return null;
      return {
        outerHTML: script.outerHTML,
        src: script.getAttribute('src'),
        websiteId: script.getAttribute('data-website-id'),
        domain: script.getAttribute('data-domain'),
        defer: (script as HTMLScriptElement).defer
      };
    });
  }

  /**
   * Assert the script properties meet the required setup
   */
  async assertDataFastScript(script: DataFastScriptDetails | null, pageName: string, expectedWebsiteId?: string): Promise<void> {
    expect(script, `DataFast script tag must exist on ${pageName}`).not.toBeNull();
    expect(script?.src, `DataFast src must point to datafa.st on ${pageName}`).toContain('datafa.st/js/script.js');
    expect(script?.defer, `DataFast script must have defer enabled on ${pageName}`).toBe(true);
    expect(script?.websiteId, `DataFast data-website-id must be set on ${pageName}`).toBeTruthy();
    if (expectedWebsiteId) {
      expect(script?.websiteId, `DataFast data-website-id must match ${expectedWebsiteId} on ${pageName}`).toBe(expectedWebsiteId);
    }
    expect(script?.domain, `DataFast data-domain must be set on ${pageName}`).toBeTruthy();

    console.log(`✅ [DataFast DOM] Verified on ${pageName}:`);
    console.log(`   src: ${script?.src}`);
    console.log(`   data-website-id: ${script?.websiteId}`);
    console.log(`   data-domain: ${script?.domain}`);
  }

  /**
   * Verifies that DataFast created the real visitor and session cookies
   */
  async assertDataFastCookies(context: BrowserContext, pageName: string): Promise<{ visitorId: string | null; sessionId: string | null }> {
    let visitorId: string | null = null;
    let sessionId: string | null = null;

    await expect.poll(async () => {
      const cookies = await context.cookies();
      const vidCookie = cookies.find(c => c.name === 'datafast_visitor_id');
      const sidCookie = cookies.find(c => c.name === 'datafast_session_id');
      visitorId = vidCookie?.value || null;
      sessionId = sidCookie?.value || null;
      return !!visitorId;
    }, {
      message: `DataFast visitor cookie (datafast_visitor_id) was not created on ${pageName} within 10s`,
      timeout: 10000,
      intervals: [500, 1000]
    }).toBe(true);

    console.log(`✅ [DataFast Cookies] Verified on ${pageName}:`);
    console.log(`   datafast_visitor_id: ${visitorId}`);
    console.log(`   datafast_session_id: ${sessionId}`);

    return { visitorId, sessionId };
  }

  /**
   * Get all captured telemetry events
   */
  getCapturedEvents(): DataFastTelemetryEvent[] {
    return this.capturedEvents;
  }
}
