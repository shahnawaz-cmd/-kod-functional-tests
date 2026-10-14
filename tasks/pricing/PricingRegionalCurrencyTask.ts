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

      const domain = new URL(page.url()).hostname;
      const cleanHost = domain.replace(/^\./, '');
      const rootDomain = cleanHost.includes('.') ? `.${cleanHost.split('.').slice(-2).join('.')}` : `.${cleanHost}`;

      // Clear existing geo cookies to avoid collisions
      await context.clearCookies({ name: 'cwa_ip' }).catch(() => {});
      await context.clearCookies({ name: 'cwa_country' }).catch(() => {});

      const cookies = [
        { name: 'cwa_ip', value: ip, domain: cleanHost, path: '/', secure: true, httpOnly: false, sameSite: 'Lax' as const },
        { name: 'cwa_country', value: country, domain: cleanHost, path: '/', secure: true, httpOnly: false, sameSite: 'Lax' as const },
        { name: 'cwa_ip', value: ip, domain: rootDomain, path: '/', secure: true, httpOnly: false, sameSite: 'Lax' as const },
        { name: 'cwa_country', value: country, domain: rootDomain, path: '/', secure: true, httpOnly: false, sameSite: 'Lax' as const }
      ];

      await context.addCookies(cookies);
    });

    const isDVH = page.url().includes('detailedvehiclehistory.com') || (testInfo?.project.use?.baseURL as string)?.includes('detailedvehiclehistory.com') || testInfo?.project.name?.includes('DetailedVehicleHistory');
    const pricingRoute = isDVH ? '/vin-check-rates' : '/pricing';

    await test.step(`Step 2: Reload Pricing Page (${pricingRoute}) with Regional Context`, async () => {
      console.log(`🔄 [Pricing] Reloading ${pricingRoute} to activate regional session context...`);
      await page.goto(pricingRoute, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000);
    });

    await test.step(`Step 3: Validate Pricing Currency Matches Expected Code (${expectedCurrency})`, async () => {
      // 1. Backend validation via relative /api/pricing with session stabilization and edge retry
      let response = await page.request.get('/api/pricing?sticker=1&dealer=1').catch(() => null);
      
      // If edge returns 502, 503 or network hiccup, retry up to 2 times with backoff
      for (let attempt = 1; attempt <= 2 && (!response || response.status() !== 200); attempt++) {
        console.warn(`⚠️ [/api/pricing] Attempt ${attempt} failed with status ${response?.status()}, retrying in 2s...`);
        await page.waitForTimeout(2000);
        response = await page.request.get('/api/pricing?sticker=1&dealer=1').catch(() => null);
      }

      expect(response).not.toBeNull();
      expect(response?.status()).toBe(200);

      let data = await response?.json();
      let firstPlan = data?.stickerUser?.credit_plans?.[0] || data?.reportUser?.credit_plans?.[0];
      if (firstPlan && firstPlan.currency_code === 'USD' && expectedCurrency !== 'USD') {
        // Wait and re-fetch once to allow server session to sync with injected geo cookies
        await page.waitForTimeout(2000);
        response = await page.request.get('/api/pricing?sticker=1&dealer=1');
        data = await response.json();
        firstPlan = data?.stickerUser?.credit_plans?.[0] || data?.reportUser?.credit_plans?.[0];
      }
      expect(firstPlan).toBeDefined();

      const apiCurrencyCode = firstPlan.currency_code;
      const apiCurrencySign = firstPlan.currency_sign;

      console.log(`📡 [API Response] Currency Code: "${apiCurrencyCode}" | Sign: "${apiCurrencySign}" | Price: ${firstPlan.price}`);
      expect(
        apiCurrencyCode,
        `[CURRENCY MISMATCH] Expected currency code "${expectedCurrency}", but API returned "${apiCurrencyCode}"`
      ).toBe(expectedCurrency);

      // 2. UI validation: Check that price on UI contains the regional currency code/sign
      const pageText = await page.evaluate(() => document.body.innerText);
      const isCurrencyRenderedOnUI = pageText.includes(expectedCurrency) || pageText.includes(apiCurrencySign);

      console.log(`🖥️ [UI Render] Regional Currency "${expectedCurrency}" / "${apiCurrencySign}" visible on page: ${isCurrencyRenderedOnUI ? '✅ YES' : '❌ NO'}`);
      expect(
        isCurrencyRenderedOnUI,
        `[UI FAILURE] Neither currency code "${expectedCurrency}" nor sign "${apiCurrencySign}" appeared on the pricing cards!`
      ).toBe(true);

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
