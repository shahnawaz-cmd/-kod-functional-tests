// tasks/pricing/PricingRegionalCurrencyTask.ts
import { BrowserContext, Page, TestInfo, expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { gotoWithResilience } from '../../utils/resilientNavigation';

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

    // Resolve target base URL cleanly
    let targetURL = (testInfo?.project.use?.baseURL as string) || (page.url() !== 'about:blank' ? page.url() : '');
    if (!targetURL || targetURL.includes('github.io')) {
      try {
        const sites = require('../../sites.json');
        const matched = sites.find((s: any) => testInfo?.project?.name && (testInfo.project.name.includes(s.name) || s.name.includes(testInfo.project.name)));
        targetURL = matched ? matched.url : 'https://toyotawindowsticker.com/';
      } catch {
        targetURL = 'https://toyotawindowsticker.com/';
      }
    }
    if (!targetURL.endsWith('/')) targetURL += '/';

    let hostname = 'toyotawindowsticker.com';
    try {
      hostname = new URL(targetURL).hostname;
    } catch {}
    const cleanHost = hostname.startsWith('.') ? hostname.slice(1) : hostname;
    const parts = cleanHost.split('.');
    const rootDomain = parts.length > 2 ? `.${parts.slice(-2).join('.')}` : `.${cleanHost}`;
    const isSecure = targetURL.startsWith('https:');

    const isDVH = targetURL.includes('detailedvehiclehistory.com') || (testInfo?.project?.name || '').includes('DetailedVehicleHistory');
    const pricingRoute = isDVH ? '/vin-check-rates' : '/pricing';
    const fullPricingUrl = new URL(pricingRoute.replace(/^\//, ''), targetURL).toString();

    let capturedApiResponse: any = null;

    await test.step(`Step 1: Inject Regional IP (${ip}) and Country (${country}) into Session Cookies`, async () => {
      console.log('\n' + '─'.repeat(70));
      console.log(`💉 [GEO INJECTOR] Selected Region: ${name} (Country: ${country}, IP: ${ip})`);
      console.log(`🎯 [GEO INJECTOR] Target Currency Code: "${expectedCurrency}"`);
      console.log(`🌐 [GEO INJECTOR] Host: ${cleanHost} | Root: ${rootDomain}`);
      console.log('─'.repeat(70));

      // Clear only pre-existing geo cookies to prevent collision without wiping checkout_flow
      await context.clearCookies({ name: 'cwa_ip' }).catch(() => {});
      await context.clearCookies({ name: 'cwa_country' }).catch(() => {});

      // Inject cookies across host, root domain, and target URL to guarantee edge + client visibility
      const cookies = [
        {
          name: 'cwa_ip',
          value: ip,
          domain: cleanHost,
          path: '/',
          secure: isSecure,
          httpOnly: false,
          sameSite: 'Lax' as const
        },
        {
          name: 'cwa_country',
          value: country,
          domain: cleanHost,
          path: '/',
          secure: isSecure,
          httpOnly: false,
          sameSite: 'Lax' as const
        },
        {
          name: 'cwa_ip',
          value: ip,
          domain: rootDomain,
          path: '/',
          secure: isSecure,
          httpOnly: false,
          sameSite: 'Lax' as const
        },
        {
          name: 'cwa_country',
          value: country,
          domain: rootDomain,
          path: '/',
          secure: isSecure,
          httpOnly: false,
          sameSite: 'Lax' as const
        },
        {
          name: 'cwa_ip',
          value: ip,
          url: targetURL,
          sameSite: 'Lax' as const
        },
        {
          name: 'cwa_country',
          value: country,
          url: targetURL,
          sameSite: 'Lax' as const
        }
      ];

      await context.addCookies(cookies);

      // Set extra HTTP headers so all browser and API requests carry regional geo context
      await context.setExtraHTTPHeaders({
        'cwa_country': country,
        'cwa_ip': ip,
        'X-Forwarded-For': ip,
        'CF-IPCountry': country
      }).catch(() => {});
    });

    await test.step(`Step 2: Reload Pricing Page (${fullPricingUrl}) with Regional Context`, async () => {
      console.log(`🔄 [Pricing] Navigating to ${fullPricingUrl} with regional session context...`);

      // Set up network interception to capture the page's natural /api/pricing request during load
      const apiWaitPromise = page.waitForResponse(
        (res) => res.url().includes('/api/pricing') && res.status() === 200,
        { timeout: 12000 }
      ).then(async (res) => {
        try {
          const json = await res.json();
          if (json && (json.stickerUser || json.reportUser)) {
            capturedApiResponse = json;
          }
        } catch {}
      }).catch(() => {});

      await gotoWithResilience(page, fullPricingUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
        maxRetries: 3
      });

      // Await natural API response if in flight
      await apiWaitPromise;
      await page.waitForTimeout(500);
    });

    await test.step(`Step 3: Validate Pricing Currency Matches Expected Code (${expectedCurrency})`, async () => {
      let apiCurrencyCode = '';
      let apiCurrencySign = '';
      let firstPlan: any = null;
      let lastObservedCode = '';
      let lastAttemptStatus = 200;

      // Extract first plan helper
      const extractPlan = (data: any) => {
        return data?.stickerUser?.credit_plans?.[0] || data?.reportUser?.credit_plans?.[0] || null;
      };

      if (capturedApiResponse) {
        firstPlan = extractPlan(capturedApiResponse);
        if (firstPlan?.currency_code) {
          lastObservedCode = firstPlan.currency_code;
        }
      }

      // If intercepted response already matches, we proceed directly without spamming fetches
      if (lastObservedCode !== expectedCurrency) {
        await expect.poll(async () => {
          let data = capturedApiResponse;

          // 1. Try in-browser fetch if not yet matching
          if (!data || extractPlan(data)?.currency_code !== expectedCurrency) {
            try {
              data = await page.evaluate(async () => {
                const res = await fetch('/api/pricing?sticker=1&dealer=1');
                if (!res.ok) return null;
                return await res.json();
              });
            } catch {}
          }

          // 2. Fallback to page.request if in-browser fetch didn't return expected currency
          if (!data || extractPlan(data)?.currency_code !== expectedCurrency) {
            try {
              const response = await page.request.get(new URL('api/pricing?sticker=1&dealer=1', targetURL).toString(), {
                headers: {
                  'Cookie': `cwa_ip=${ip}; cwa_country=${country}`,
                  'cwa_country': country,
                  'cwa_ip': ip,
                  'X-Forwarded-For': ip,
                  'CF-IPCountry': country
                }
              });
              lastAttemptStatus = response.status();
              if (response.ok()) {
                data = await response.json().catch(() => null);
              }
            } catch (reqErr: any) {
              lastAttemptStatus = 0;
            }
          }

          firstPlan = extractPlan(data);
          lastObservedCode = firstPlan?.currency_code || '';
          return lastObservedCode;
        }, {
          message: `[CURRENCY MISMATCH] Expected currency code "${expectedCurrency}" for region ${name} (${country}), but API returned currency: "${lastObservedCode || 'UNKNOWN'}" (HTTP ${lastAttemptStatus})`,
          timeout: 15000,
          intervals: [1000, 2000]
        }).toBe(expectedCurrency);
      }

      apiCurrencyCode = firstPlan?.currency_code || lastObservedCode;
      apiCurrencySign = firstPlan?.currency_sign || '';

      console.log(`📡 [API Response] Currency Code: "${apiCurrencyCode}" | Sign: "${apiCurrencySign}" | Price: ${firstPlan?.price}`);

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
      if (testInfo) {
        const buffer = await page.screenshot({ fullPage: true });
        await testInfo.attach(`pricing-${country.toLowerCase()}-${expectedCurrency.toLowerCase()}`, {
          body: buffer,
          contentType: 'image/png',
        }).catch(() => {});
      }
    });
  }
}
