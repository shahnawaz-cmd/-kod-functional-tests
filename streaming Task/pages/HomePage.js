// tests/pages/HomePage.js
const TIMEOUT = process.env.CI ? 60000 : 30000;

class HomePage {
  constructor(page) {
    this.page = page;
    this.vinInput = page.locator('input[name="vin"], input[name="vin_number"], input[placeholder*="VIN" i], input[aria-label*="VIN" i], input[type="text"]').first();
    this.searchButton = page.getByRole('button', { name: /search vin|get window sticker|search window sticker|get sticker|search/i })
      .or(page.locator('button[type="submit"]'))
      .or(page.locator('button:has-text("Search VIN")'))
      .first();
  }

  randomizeVin(baseVin, numToReplace = 1) {
    const randomDigits = Math.floor(Math.random() * Math.pow(10, numToReplace)).toString().padStart(numToReplace, '0');
    return baseVin.slice(0, -numToReplace) + randomDigits;
  }

  async navigate() {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        console.warn(`⚠️ [HomePage DNS Retry] Attempt ${attempt} failed (${err?.message || err}). Retrying in 1.5s...`);
        await this.page.waitForTimeout(1500);
      }
    }
    await this.page.waitForTimeout(800);
  }

  async navigateWithOffer(offerCode) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.page.goto(`/?offer=${offerCode}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        console.warn(`⚠️ [HomePage DNS Retry] Attempt ${attempt} failed (${err?.message || err}). Retrying in 1.5s...`);
        await this.page.waitForTimeout(1500);
      }
    }
    await this.page.waitForTimeout(800);
  }

  async navigateWindowSticker() {
    const contextBaseURL = this.page.context()._options?.baseURL || process.env.BASE_URL || '';
    const currentUrl = this.page.url() || '';
    const isVSR = contextBaseURL.toLowerCase().includes('vehiclesreport') || currentUrl.toLowerCase().includes('vehiclesreport');
    const path = isVSR ? '/window-stickers' : '/window-sticker';
    console.log(`[HomePage] Navigating to window sticker path: ${path} (isVSR=${isVSR})`);
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(800);
  }

  async decodeVin(vin, numToReplace = 1) {
    await this.page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});

    const isSafari = this.page.context().browser()?.browserType().name() === 'webkit';

    const vinInput = this.page.locator('input[name="vin"], input[placeholder*="VIN" i], input[aria-label*="VIN" i]').first();
    await vinInput.waitFor({ state: 'visible', timeout: TIMEOUT });

    const randomVin = this.randomizeVin(vin, numToReplace);
    await vinInput.focus();
    await vinInput.fill(randomVin);

    if (isSafari) {
      await this.page.evaluate(() => {
        const input = document.querySelector('input[name="vin"], input[placeholder*="VIN" i]');
        const form = input ? input.closest('form') : null;
        if (form) {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        } else {
          const btn = document.querySelector('button[type="submit"]') || document.querySelector('button');
          if (btn) btn.click();
        }
      });
    } else {
      const btn = this.page.locator('button[type="submit"], button:has-text("Search VIN"), button:has-text("Search Window Sticker"), button:has-text("Get Window Sticker")').first();
      await btn.waitFor({ state: 'visible', timeout: TIMEOUT }).catch(() => {});
      await btn.click().catch(async () => {
        await vinInput.press('Enter');
      });
    }

    // Wait for preview/checkout navigation to resolve with domcontentloaded
    await this.page.waitForURL(/.*(\/preview|\/vin-check|\/report|\/checkout).*/, { waitUntil: 'domcontentloaded', timeout: TIMEOUT }).catch(() => {});

    return randomVin;
  }

}

class EUVinDecoder {
  constructor() {
    this.baseVins = [
      'VF3YC2MFB12G20874',
      'WBY1Z62030V719559',
      'WV1ZZZSYZL9025249',
      'SHHEU88701U002012',
      'WAUZZZ8V5DA002440'
    ];
  }

  generateEUVin() {
    const baseVin = this.baseVins[Math.floor(Math.random() * this.baseVins.length)];
    const randomDigit = Math.floor(Math.random() * 10).toString();
    return baseVin.slice(0, -1) + randomDigit;
  }
}

module.exports = { HomePage, EUVinDecoder };
