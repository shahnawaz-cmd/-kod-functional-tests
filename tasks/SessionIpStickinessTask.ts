// tasks/SessionIpStickinessTask.ts
import { Page, BrowserContext, TestInfo, expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { Actor } from '../actors/Actor';
import { DecodeVinTask } from './DecodeVinTask';

export const IP_POOL = {
  KOREA: '79.110.55.34',             // South Korea (KR) - KRW (₩)
  US: '162.251.62.82',                // United States (US) - USD ($)
  UK: '172.99.190.215',               // United Kingdom (GB) - GBP (£)
  GERMANY: '85.214.132.117',          // Germany (DE) - EUR (€)
  CANADA: '192.206.151.131',          // Canada (CA) - CAD ($)
  COSTA_RICA: '138.59.135.94',        // Costa Rica (CR) - CRC (₡)
  CHILE: '45.250.252.51',             // Chile (CL) - CLP ($)
  SAUDI_ARABIA: '146.70.167.70',      // Saudi Arabia (SA) - SAR (﷼)
  NEW_ZEALAND: '180.149.231.71',      // New Zealand (NZ) - NZD ($)
  PANAMA: '190.97.167.149',           // Panama (PA) - PAB (B/.)
  SOUTH_AFRICA: '129.232.237.178',    // South Africa (ZA) - ZAR (R)
  TAIWAN: '185.189.161.137',          // Taiwan (TW) - TWD (NT$)
};

export const IP_COUNTRY_MAP: Record<string, string> = {
  '79.110.55.34': 'KR',
  '162.251.62.82': 'US',
  '172.99.190.215': 'GB',
  '85.214.132.117': 'DE',
  '192.206.151.131': 'CA',
  '138.59.135.94': 'CR',
  '45.250.252.51': 'CL',
  '146.70.167.70': 'SA',
  '180.149.231.71': 'NZ',
  '190.97.167.149': 'PA',
  '129.232.237.178': 'ZA',
  '185.189.161.137': 'TW',
};

/**
 * Returns a random IP entry from the IP_POOL with its regional name.
 */
export function getRandomIp(): { region: string; ip: string } {
  const entries = Object.entries(IP_POOL);
  const randomIndex = Math.floor(Math.random() * entries.length);
  const [region, ip] = entries[randomIndex];
  return { region, ip };
}

export interface ReloadResult {
  reloadIndex: number;
  ipValue: string;
  isMatched: boolean;
}

export interface StickinessReport {
  targetUrl: string;
  targetIp: string;
  region?: string;
  refreshes: ReloadResult[];
  newTabIp: string;
  isMultiTabMatched: boolean;
  status: 'VERIFIED_SESSION_STICKY' | 'MISMATCH';
}

export class SessionIpStickinessTask {
  private targetIp?: string;
  private reloadCount: number;

  constructor(targetIp?: string, reloadCount: number = 2) {
    this.targetIp = targetIp;
    this.reloadCount = reloadCount;
  }

  /**
   * Screenplay Pattern Actor Execution
   */
  async performAs(actor: Actor, testInfo?: TestInfo): Promise<StickinessReport> {
    const page = actor.getPage();
    return await this.executeStickinessCheck(page, this.targetIp, this.reloadCount, testInfo);
  }

  /**
   * Captures and logs all cookies currently in browser context, optionally saving to disk/report
   */
  async captureAllCookies(
    context: BrowserContext,
    options: { log?: boolean; attachToReport?: boolean; testInfo?: TestInfo; filename?: string } = {}
  ) {
    const cookies = await context.cookies();

    if (options.log !== false) {
      console.log('\n' + '═'.repeat(70));
      console.log(`🍪 [COOKIE HELPER - ALL COOKIES CAPTURED] Total: ${cookies.length}`);
      console.log('═'.repeat(70));
      if (cookies.length === 0) {
        console.log('   (No cookies found in context)');
      } else {
        cookies.forEach((c, idx) => {
          console.log(`   [${idx + 1}] ${c.name} = "${c.value}"`);
          console.log(`       Domain: ${c.domain} | Path: ${c.path} | Secure: ${c.secure} | HttpOnly: ${c.httpOnly} | SameSite: ${c.sameSite}`);
        });
      }
      console.log('═'.repeat(70) + '\n');
    }

    const formattedJson = JSON.stringify(cookies, null, 2);

    try {
      const dir = path.resolve(process.cwd(), 'test-results', 'cookies');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const filename = options.filename || `cookies-${Date.now()}.json`;
      fs.writeFileSync(path.join(dir, filename), formattedJson, 'utf-8');
    } catch (err) {
      console.error('[COOKIE HELPER] Could not write cookies to disk:', err);
    }

    if (options.attachToReport !== false && options.testInfo) {
      await options.testInfo
        .attach(options.filename || 'captured-all-cookies.json', {
          body: formattedJson,
          contentType: 'application/json',
        })
        .catch(() => {});
    }

    return cookies;
  }

  /**
   * Reads the current 'cwa_ip' cookie value from context
   */
  async getCwaIpValue(context: BrowserContext): Promise<string | undefined> {
    const cookies = await context.cookies();
    const cookie = cookies.find((c) => c.name === 'cwa_ip');
    return cookie ? cookie.value : undefined;
  }

  /**
   * Injects 'cwa_ip' and 'cwa_country' into browser context for both host domain and root domain,
   * matching Member area monitoring's CookieIpInjector behavior.
   */
  async setCwaIpCookie(context: BrowserContext, targetUrl: string, ipAddress: string) {
    let hostname: string;
    try {
      hostname = new URL(targetUrl).hostname;
    } catch {
      hostname = 'toyotawindowsticker.com';
    }

    const cleanHost = hostname.startsWith('.') ? hostname.slice(1) : hostname;
    const parts = cleanHost.split('.');
    const rootDomain = parts.length > 2 ? `.${parts.slice(-2).join('.')}` : `.${cleanHost}`;
    const isSecure = targetUrl.startsWith('https:');
    const country = IP_COUNTRY_MAP[ipAddress] || 'US';

    // Clear any pre-existing cwa_ip and cwa_country cookies across all domains
    await context.clearCookies({ name: 'cwa_ip' }).catch(() => {});
    await context.clearCookies({ name: 'cwa_country' }).catch(() => {});

    const cookies = [
      {
        name: 'cwa_ip',
        value: ipAddress,
        domain: cleanHost,
        path: '/',
        secure: isSecure,
        httpOnly: true,
        sameSite: 'Lax' as const,
      },
      {
        name: 'cwa_country',
        value: country,
        domain: cleanHost,
        path: '/',
        secure: isSecure,
        httpOnly: false,
        sameSite: 'Lax' as const,
      },
      {
        name: 'cwa_ip',
        value: ipAddress,
        domain: rootDomain,
        path: '/',
        secure: isSecure,
        httpOnly: true,
        sameSite: 'Lax' as const,
      },
      {
        name: 'cwa_country',
        value: country,
        domain: rootDomain,
        path: '/',
        secure: isSecure,
        httpOnly: false,
        sameSite: 'Lax' as const,
      },
    ];

    await context.addCookies(cookies);

    console.log('\n' + '─'.repeat(70));
    console.log(`💉 [CWA IP INJECTOR] Injected 'cwa_ip': "${ipAddress}", 'cwa_country': "${country}" (Host: ${cleanHost}, Root: ${rootDomain})`);
    console.log('─'.repeat(70) + '\n');
  }

  /**
   * 1. Multiple Page Refreshes:
   * Reloads the page N times in the same tab and verifies cwa_ip stays locked on every refresh.
   */
  async verifyMultipleRefreshes(page: Page, expectedIp: string = this.targetIp, reloadCount: number = this.reloadCount): Promise<ReloadResult[]> {
    const context = page.context();
    const results: ReloadResult[] = [];

    console.log('\n' + '═'.repeat(70));
    console.log(`🔄 [SESSION STICKINESS] Testing ${reloadCount} consecutive page reload(s) in same browser`);
    console.log('═'.repeat(70));

    for (let i = 1; i <= reloadCount; i++) {
      console.log(`   ⏳ Performing Reload #${i}...`);
      await page.reload({ waitUntil: 'domcontentloaded' });

      // Auto-retry checking cookie with expect.poll to prevent timing flakiness in CI
      await expect.poll(async () => await this.getCwaIpValue(context), {
        message: `[FAILURE] 'cwa_ip' changed on reload #${i}! Expected "${expectedIp}"`,
        timeout: 10000,
        intervals: [200, 500, 1000],
      }).toBe(expectedIp);

      const currentIp = (await this.getCwaIpValue(context)) || '';
      const isMatched = currentIp === expectedIp;

      console.log(`   • [Reload #${i}] Current 'cwa_ip': "${currentIp}" | Expected: "${expectedIp}" ➡️ ${isMatched ? '✅ LOCKED' : '❌ CHANGED'}`);

      results.push({
        reloadIndex: i,
        ipValue: currentIp,
        isMatched,
      });
    }

    console.log(`✅ [SESSION STICKINESS] Successfully passed all ${reloadCount} page reload checks!`);
    console.log('═'.repeat(70) + '\n');

    return results;
  }

  /**
   * 2. Opening a New Tab in the Same Browser Window:
   * Opens a second tab in the same browser context and verifies cwa_ip is shared and unchanged.
   */
  async verifyNewTabPersistence(context: BrowserContext, targetUrl: string, expectedIp: string = this.targetIp) {
    console.log('\n' + '═'.repeat(70));
    console.log(`📑 [SESSION STICKINESS] Opening Tab 2 in the same browser window`);
    console.log('═'.repeat(70));

    // Open new tab in same browser context
    const tab2 = await context.newPage();
    await tab2.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    // Auto-retry checking cookie with expect.poll in secondary tab
    await expect.poll(async () => await this.getCwaIpValue(context), {
      message: `[FAILURE] Tab 2 'cwa_ip' does not match session IP! Expected "${expectedIp}"`,
      timeout: 10000,
      intervals: [200, 500, 1000],
    }).toBe(expectedIp);

    const tab2Ip = (await this.getCwaIpValue(context)) || '';
    const isMatched = tab2Ip === expectedIp;

    console.log(`   • [Tab 2 URL]    ${tab2.url()}`);
    console.log(`   • [Tab 2 cwa_ip] "${tab2Ip}" | Expected: "${expectedIp}" ➡️ ${isMatched ? '✅ SYNCED' : '❌ MISMATCH'}`);

    console.log(`✅ [SESSION STICKINESS] Tab 2 successfully inherited locked session IP!`);
    console.log('═'.repeat(70) + '\n');

    return {
      newTabPage: tab2,
      tabIp: tab2Ip,
      isMatched,
    };
  }

  /**
   * Comprehensive Execution:
   * Captures initial cookies, injects IP, verifies refreshes, verifies new tab, captures final cookies, attaches report.
   */
  async executeStickinessCheck(
    page: Page,
    targetIp?: string,
    reloadCount: number = this.reloadCount,
    testInfo: TestInfo | null = null
  ): Promise<StickinessReport> {
    const context = page.context();
    const currentUrl = page.url();
    const targetUrl = currentUrl && currentUrl !== 'about:blank' ? currentUrl : '/';

    // Pick random IP from pool if not explicitly specified
    let selectedIp = targetIp || this.targetIp;
    let selectedRegion = 'CUSTOM';

    if (!selectedIp) {
      const randomEntry = getRandomIp();
      selectedIp = randomEntry.ip;
      selectedRegion = randomEntry.region;
    } else {
      const match = Object.entries(IP_POOL).find(([_, ip]) => ip === selectedIp);
      if (match) selectedRegion = match[0];
    }

    await page.waitForLoadState('domcontentloaded');

    // 1. Initial Cookie Capture before injection
    await test.step('Step 1: Capture Pre-Injection Baseline Cookies', async () => {
      await this.captureAllCookies(context, {
        log: true,
        testInfo: testInfo || undefined,
        filename: 'before-injection-cookies.json',
      });
    });

    // 2. Set & Inject target regional IP into cwa_ip
    await test.step(`Step 2: Inject Target Regional IP [${selectedRegion}] (${selectedIp}) into Session Cookie`, async () => {
      await this.setCwaIpCookie(context, page.url(), selectedIp!);
      // Ensure page navigates with the newly injected session cookies active before reload checks
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    });

    // 3. Perform Multiple Refreshes in Tab 1
    let refreshResults: ReloadResult[] = [];
    await test.step(`Step 3: Verify IP Stickiness Across ${reloadCount} Consecutive Page Reloads`, async () => {
      refreshResults = await this.verifyMultipleRefreshes(page, selectedIp!, reloadCount);
    });

    // 4. Open Tab 2 in Same Browser & Verify Persistence
    let tab2Result: any;
    await test.step('Step 4: Verify IP Persistence Across Secondary Browser Tab', async () => {
      tab2Result = await this.verifyNewTabPersistence(context, targetUrl, selectedIp!);
      // Close secondary tab
      await tab2Result.newTabPage.close().catch(() => {});
    });

    // 5. Capture All Cookies after stickiness check and attach report
    const isAllRefreshesMatched = refreshResults.every((r) => r.isMatched);
    const status = isAllRefreshesMatched && tab2Result.isMatched ? 'VERIFIED_SESSION_STICKY' : 'MISMATCH';

    const report: StickinessReport = {
      targetUrl,
      targetIp: selectedIp!,
      region: selectedRegion,
      refreshes: refreshResults,
      newTabIp: tab2Result.tabIp,
      isMultiTabMatched: tab2Result.isMatched,
      status,
    };

    await test.step('Step 5: Capture Post-Stickiness Cookies and Validate Session Report', async () => {
      await this.captureAllCookies(context, {
        log: true,
        testInfo: testInfo || undefined,
        filename: 'after-stickiness-cookies.json',
      });

      if (testInfo) {
        await testInfo.attach('session-ip-stickiness-report.json', {
          body: JSON.stringify(report, null, 2),
          contentType: 'application/json',
        }).catch(() => {});
      }

      // Assert stickiness report integrity
      expect(report.status).toBe('VERIFIED_SESSION_STICKY');
      expect(report.isMultiTabMatched).toBe(true);
      expect(report.refreshes.every((r) => r.isMatched)).toBe(true);
    });

    // 6. Execute VIN Decode & Preview Navigation with Sticky Session
    await test.step('Step 6: Execute VIN Decode and Preview Navigation', async () => {
      console.log('\n' + '═'.repeat(70));
      console.log('🚗 [SESSION STICKINESS] Proceeding to VIN Decode flow with sticky session...');
      console.log('═'.repeat(70));

      const actor = new Actor('User', page);
      // shouldClose = false so we can capture screenshot of preview page after success condition
      await actor.attemptsTo(new DecodeVinTask(false), true);
    });

    // 7. Capture Preview Screenshot & Close Page
    await test.step('Step 7: Capture Preview Screenshot and Close Page', async () => {
      const screenshotDir = path.resolve(process.cwd(), 'test-results', 'screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      const screenshotFilename = `preview-sticky-session-${Date.now()}.png`;
      const screenshotPath = path.join(screenshotDir, screenshotFilename);
      const screenshotBuffer = await page.screenshot({ path: screenshotPath, fullPage: true });

      if (testInfo) {
        await testInfo.attach('preview-sticky-session.png', {
          body: screenshotBuffer,
          contentType: 'image/png',
        }).catch(() => {});
      }

      console.log(`📸 [SESSION STICKINESS] Preview screenshot captured and saved to: ${screenshotPath}`);
    });

    return report;
  }
}
