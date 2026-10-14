import { Page } from '@playwright/test';
import { Actor } from '../actors/Actor';
import { generateClassicNumericVin } from './vinHelper';
import { fastInputWithHealing, clickWithHealing, locateInputWithHealing } from '../utils/selfHealingLocator';
import { waitForUpdateClassicDecodeResponse } from './classic_editable_specs';

/**
 * Class: ClassicManualSpecsDataGenerator
 * Dynamically generates unique random classic vehicle specifications on every run.
 */
export class ClassicManualSpecsDataGenerator {
  private static randomSuffix(): string {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  private static pickRandom<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  static generateUniqueData() {
    const suffix = this.randomSuffix();
    const years = ['1955', '1960', '1965', '1968', '1970', '1972', '1975', '1978'];
    const makes = ['Ford', 'Chevrolet', 'Dodge', 'Pontiac', 'Plymouth', 'Buick', 'Oldsmobile'];
    const models = ['Mustang', 'Corvette', 'Charger', 'Camaro', 'GTO', 'F-250', 'Bel Air', 'Impala'];
    const engines = ['V8 5.7L', 'V8 4.6L', 'V8 5.0L', 'Inline-6', 'V6 3.8L', 'Hemi 426'];
    const transmissions = ['Auto', 'Manual', '4-Speed Manual', '3-Speed Auto', '5-Speed Manual'];
    const doorsList = ['2', '4', '5'];
    const drives = ['RWD', 'AWD', '4WD'];

    return {
      year: this.pickRandom(years),
      make: `${this.pickRandom(makes)} ${suffix}`,
      model: `${this.pickRandom(models)} ${suffix}`,
      engine: `${this.pickRandom(engines)} ${suffix}`,
      transmission: this.pickRandom(transmissions),
      door: this.pickRandom(doorsList),
      drive: this.pickRandom(drives)
    };
  }
}

export class ClassicEditableSpecsManual {
  private timeout = process.env.CI ? 90000 : 45000;

  async runManualUpdate(page: Page) {
    // 1. Locate and click "Click here to update" with hydration wait & multi-tag fallback
    const updateTrigger = page.locator('button, a, [role="button"], span')
      .filter({ hasText: /(click here to update|update vehicle|edit specs)/i })
      .first();

    await updateTrigger.waitFor({ state: 'visible', timeout: this.timeout });
    await page.waitForTimeout(1000); // Allow React hydration to complete
    await updateTrigger.scrollIntoViewIfNeeded().catch(() => {});
    await updateTrigger.click({ force: true }).catch(async () => {
      await updateTrigger.evaluate((el: HTMLElement) => el.click()).catch(() => {});
    });

    // 2. Wait for modal animation and click "Update Year, Make and Model"
    const ymmButton = page.locator('button, a, [role="button"]')
      .filter({ hasText: /(update year, make|year, make & model|year, make and model)/i })
      .first();

    await ymmButton.waitFor({ state: 'visible', timeout: this.timeout });
    await page.waitForTimeout(500); // Modal transition delay
    await ymmButton.scrollIntoViewIfNeeded().catch(() => {});
    await ymmButton.click({ force: true }).catch(async () => {
      await ymmButton.evaluate((el: HTMLElement) => el.click()).catch(() => {});
    });

    // 3. Click 'Click here' (for manual inputs, excluding 'Click here to update')
    const manualTrigger = page.locator('button, a, [role="button"], span')
      .filter({ hasText: /click here/i })
      .filter({ hasNotText: /update/i })
      .first();

    await manualTrigger.waitFor({ state: 'visible', timeout: this.timeout });
    await page.waitForTimeout(500);
    await manualTrigger.scrollIntoViewIfNeeded().catch(() => {});
    await manualTrigger.click({ force: true }).catch(async () => {
      await manualTrigger.evaluate((el: HTMLElement) => el.click()).catch(() => {});
    });

    await page.waitForTimeout(500); // Allow manual input form fields to render

    // 4. Generate unique dynamic data and fill fields with multi-tier fallbacks
    const specsData = ClassicManualSpecsDataGenerator.generateUniqueData();
    console.log('[ClassicManualSpecsDataGenerator] Generated unique manual specifications:\n', JSON.stringify(specsData, null, 2));

    const fillManualField = async (keyword: string, value: string) => {
      const field = page.getByRole('textbox', { name: new RegExp(keyword, 'i') })
        .or(page.getByPlaceholder(new RegExp(keyword, 'i')))
        .or(page.getByLabel(new RegExp(keyword, 'i')))
        .or(page.locator(`input[placeholder*="${keyword}" i], input[name*="${keyword}" i], input[aria-label*="${keyword}" i]`))
        .first();
      await field.waitFor({ state: 'visible', timeout: 10000 });
      await field.scrollIntoViewIfNeeded().catch(() => {});
      await field.click({ force: true }).catch(() => {});
      await field.fill(value);
    };

    await fillManualField('year', specsData.year);
    await fillManualField('make', specsData.make);
    await fillManualField('model', specsData.model);
    await fillManualField('engine', specsData.engine);
    await fillManualField('transmission', specsData.transmission);
    await fillManualField('door', specsData.door);
    await fillManualField('drive', specsData.drive);

    // 5. Submit changes and capture update-classic-decode API response
    const continueBtn = page.getByRole('button', { name: 'Continue' })
      .or(page.locator('button:has-text("Continue")'));
    await continueBtn.first().waitFor({ state: 'visible', timeout: 10000 });
    await continueBtn.first().click({ force: true });

    const submitBtn = page.getByRole('button', { name: 'Submit' })
      .or(page.getByRole('button', { name: 'Confirm' }))
      .or(page.locator('button:has-text("Submit"), button:has-text("Confirm")'));
    await submitBtn.first().waitFor({ state: 'visible', timeout: 10000 });

    const apiPromise = waitForUpdateClassicDecodeResponse(page, this.timeout);
    await submitBtn.first().click({ force: true });
    await apiPromise;

    await page.waitForURL(/.*(cv=|preview|sticker|report).*/, { timeout: this.timeout });
    console.log('✅ Manual update successful');
  }

  async performAs(actor: Actor) {
    const page = actor.getPage();
    await page.context().clearCookies();
    await page.goto('/');
    await page.waitForTimeout(1000);

    const classicVin = generateClassicNumericVin();
    
    // Self-healing VIN input & search
    await fastInputWithHealing(page, 'VIN', classicVin, [
      'input[name="vin"]',
      'input[placeholder*="VIN" i]',
      'input[aria-label*="VIN" i]'
    ]);

    await clickWithHealing(page, 'Search', [
      'button[type="submit"]',
      'button:has-text("Search")',
      'button:has-text("Decode")',
      'button:has-text("Get Window Sticker")'
    ]);

    await page.waitForURL(/.*(preview|sticker|license-preview|ws-preview).*/, { timeout: this.timeout });
    await this.runManualUpdate(page);
  }
}
