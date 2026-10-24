// tasks/pricing/PricingRegionalCurrencyTask.ts
import { BrowserContext, Page, TestInfo, expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export interface RegionalConfig {
  country: string;
  ip: string;
  expectedCurrency: string;
  name: string;
}

/**
 * Regional IP & Country Pool excluding USD (US) and CAD (Canada).
 */
export const NON_US_CAD_POOL: RegionalConfig[] = [
  { country: 'KR', ip: '79.110.55.34', expectedCurrency: 'KRW', name: 'South Korea' },
  { country: 'GB', ip: '172.99.190.215', expectedCurrency: 'GBP', name: 'United Kingdom' },
  { country: 'DE', ip: '85.214.132.117', expectedCurrency: 'EUR', name: 'Germany' },
  { country: 'CR', ip: '138.59.135.94', expectedCurrency: 'CRC', name: 'Costa Rica' },
  { country: 'CL', ip: '45.250.252.51', expectedCurrency: 'CLP', name: 'Chile' },
  { country: 'SA', ip: '146.70.167.70', expectedCurrency: 'SAR', name: 'Saudi Arabia' },
  { country: 'NZ', ip: '180.149.231.71', expectedCurrency: 'NZD', name: 'New Zealand' },
  { country: 'PA', ip: '190.97.167.149', expectedCurrency: 'PAB', name: 'Panama' },
  { country: 'ZA', ip: '129.232.237.178', expectedCurrency: 'ZAR', name: 'South Africa' },
  { country: 'TW', ip: '185.189.161.137', expectedCurrency: 'TWD', name: 'Taiwan' },
];

/**
 * Returns a random non-USD/CAD regional configuration from the pool.
 */
export function getRandomRegionalConfig(): RegionalConfig {
  const index = Math.floor(Math.random() * NON_US_CAD_POOL.length);
  return NON_US_CAD_POOL[index];
}

export class PricingRegionalCurrencyTask {
  private config: RegionalConfig;

  constructor(customConfig?: RegionalConfig) {
    this.config = customConfig || getRandomRegionalConfig();
  }

  async performAs(page: Page, testInfo?: TestInfo) {
    const context = page.context();
    const { country, ip, expectedCurrency, name } = this.config;

    await test.step(`Step 1: Inject Regional IP (${ip}) and Country (${country}) into Session Cookies`, async () => {
      console.log('\n' + '─'.repeat(70));
      console.log(`💉 [GEO INJECTOR] Selected Region: ${name} (Country: ${country}, IP: ${ip})`);
      console.log(`🎯 [GEO INJECTOR] Target Currency Code: "${expectedCurrency}"`);
      console.log('─'.repeat(70));

      let targetURL = (testInfo?.project.use?.baseURL as string) || (page.url() !== 'about:blank' ? page.url() : '');
      if (!targetURL || targetURL.includes('github.io') || targetURL.includes('windowsticker.com')) {
        try {
          const sites = require('../../sites.json');
          const matched = sites.find((s: any) => testInfo?.project?.name?.includes(s.name));
          targetURL = matched ? matched.url : 'https://toyotawindowsticker.com/';
        } catch {
          targetURL = 'https://toyotawindowsticker.com/';
        }
      }
      if (!targetURL.endsWith('/')) targetURL += '/';

      // Clear existing cookies to avoid domain collisions
      await context.clearCookies().catch(() => {});

      // Inject clean single-origin cookies (avoids duplicate root vs host cookie header collisions)
      await context.addCookies([
        { name: 'cwa_ip', value: ip, url: targetURL, sameSite: 'Lax' as const },
        { name: 'cwa_country', value: country, url: targetURL, sameSite: 'Lax' as const }
      ]);

      // Set extra HTTP headers so all browser and API requests reliably carry regional geo context
      await context.setExtraHTTPHeaders({
        'cwa_country': country,
        'cwa_ip': ip,
        'X-Forwarded-For': ip
      }).catch(() => {});
    });

    let targetURL = (testInfo?.project.use?.baseURL as string) || (page.url() !== 'about:blank' ? page.url() : '');
    if (!targetURL || targetURL.includes('github.io') || targetURL.includes('windowsticker.com')) {
      try {
        const sites = require('../../sites.json');
        const matched = sites.find((s: any) => testInfo?.project?.name?.includes(s.name));
        targetURL = matched ? matched.url : 'https://toyotawindowsticker.com/';
      } catch {
        targetURL = 'https://toyotawindowsticker.com/';
      }
    }
    if (!targetURL.endsWith('/')) targetURL += '/';

    const isDVH = targetURL.includes('detailedvehiclehistory.com') || testInfo?.project?.name?.includes('DetailedVehicleHistory');
    const pricingRoute = isDVH ? '/vin-check-rates' : '/pricing';
    const fullPricingUrl = new URL(pricingRoute.replace(/^\//, ''), targetURL).toString();

    await test.step(`Step 2: Reload Pricing Page (${fullPricingUrl}) with Regional Context`, async () => {
      console.log(`🔄 [Pricing] Navigating to ${fullPricingUrl} with regional session context...`);
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await page.goto(fullPricingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
          break;
        } catch (err: any) {
          if (attempt === 3) throw err;
          console.warn(`⚠️ [Pricing Navigation Retry] Attempt ${attempt} failed (${err?.message || err}). Retrying in 1.5s...`);
          await page.waitForTimeout(1500);
        }
      }
      await page.waitForTimeout(500);
    });

    await test.step(`Step 3: Validate Pricing Currency Matches Expected Code (${expectedCurrency})`, async () => {
      // 1. Backend validation via relative /api/pricing with session stabilization and edge retry
      let apiCurrencyCode = '';
      let apiCurrencySign = '';
      let firstPlan: any = null;

      await expect.poll(async () => {
        let data: any = null;
        try {
          data = await page.evaluate(async () => {
            const res = await fetch('/api/pricing?sticker=1&dealer=1');
            return res.ok ? await res.json() : null;
          });
        } catch {}

        if (!data) {
          const response = await page.request.get(new URL('api/pricing?sticker=1&dealer=1', targetURL).toString(), {
            headers: {
              'Cookie': `cwa_ip=${ip}; cwa_country=${country}`,
              'cwa_country': country,
              'cwa_ip': ip,
              'X-Forwarded-For': ip
            }
          }).catch(() => null);

          if (response && response.status() === 200) {
            data = await response.json().catch(() => null);
          }
        }

        firstPlan = data?.stickerUser?.credit_plans?.[0] || data?.reportUser?.credit_plans?.[0];
        return firstPlan?.currency_code;
      }, {
        message: `[CURRENCY MISMATCH] Expected currency code "${expectedCurrency}", but API returned "${firstPlan?.currency_code}"`,
        timeout: 10000,
        intervals: [1000, 2000]
      }).toBe(expectedCurrency);

      apiCurrencyCode = firstPlan.currency_code;
      apiCurrencySign = firstPlan.currency_sign;

      console.log(`📡 [API Response] Currency Code: "${apiCurrencyCode}" | Sign: "${apiCurrencySign}" | Price: ${firstPlan.price}`);

      // Currency symbols dictionary for multi-region rendering
      const CURRENCY_SYMBOLS: Record<string, string[]> = {
        KRW: ['KRW', '₩'],
        GBP: ['GBP', '£'],
        EUR: ['EUR', '€'],
        CRC: ['CRC', '₡'],
        CLP: ['CLP', 'CLP$', '$'],
        SAR: ['SAR', '﷼', 'SR'],
        NZD: ['NZD', 'NZ$', '$'],
        PAB: ['PAB', 'B/.', '$'],
        ZAR: ['ZAR', 'R'],
        TWD: ['TWD', 'NT$', '$'],
      };

      const matchTokens = Array.from(new Set([
        expectedCurrency,
        apiCurrencySign,
        ...(CURRENCY_SYMBOLS[expectedCurrency] || [])
      ])).filter(Boolean);

      // 2. UI validation: Wait for client-side hydration to render regional currency code/sign
      console.log(`⏳ [UI Render] Waiting for tokens [${matchTokens.join(', ')}] to render on pricing cards...`);

      const hasMatchingToken = (pageText: string) => {
        return matchTokens.some(token => token && pageText.includes(token));
      };

      try {
        await expect.poll(async () => {
          const pageText = await page.evaluate(() => document.body.innerText).catch(() => '');
          return hasMatchingToken(pageText);
        }, {
          timeout: 6000,
          intervals: [300, 600, 1000]
        }).toBe(true);
      } catch {
        // If client hydration was delayed or initial HTML was served from static cache, reload once with cookies active
        console.warn(`⚠️ [UI Render] Currency not yet visible in DOM. Reloading to force rehydration...`);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});

        await expect.poll(async () => {
          const pageText = await page.evaluate(() => document.body.innerText).catch(() => '');
          return hasMatchingToken(pageText);
        }, {
          message: `[UI FAILURE] None of currency tokens [${matchTokens.join(', ')}] appeared on the pricing cards after rehydration!`,
          timeout: 15000,
          intervals: [500, 1000, 2000]
        }).toBe(true);
      }

      console.log(`🖥️ [UI Render] Regional Currency "${expectedCurrency}" / "${apiCurrencySign}" visible on page: ✅ YES`);
      console.log(`✅ [SUCCESS] Pricing successfully localized to ${name} (${expectedCurrency})!`);
    });

    await test.step('Step 4: Capture Regional Currency Pricing Screenshot', async () => {
      const screenshotDir = path.resolve(process.cwd(), 'test-results', 'screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      const filename = `pricing-${country.toLowerCase()}-${expectedCurrency.toLowerCase()}-${Date.now()}.png`;
      const screenshotPath = path.join(screenshotDir, filename);
      const buffer = await page.screenshot({ path: screenshotPath, fullPage: true });

      if (testInfo) {
        await testInfo.attach(`pricing-${country}-${expectedCurrency}.png`, {
          body: buffer,
          contentType: 'image/png',
        }).catch(() => {});
      }

      console.log(`📸 [STDOUT SCREENSHOT] Regional pricing screenshot captured: ${screenshotPath}`);
    });
  }
}
