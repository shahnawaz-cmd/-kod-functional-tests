import { Page, Response } from '@playwright/test';
import { Actor } from '../actors/Actor';
import { generateClassicNumericVin } from './vinHelper';
import { fastInputWithHealing, clickWithHealing, locateInputWithHealing } from '../utils/selfHealingLocator';

/**
 * Helper to capture the 'api-cwa/update-classic-decode' API response
 * when classic vehicle data is modified and submitted.
 */
export const waitForUpdateClassicDecodeResponse = async (
  page: Page,
  timeoutMs: number = 20000
): Promise<any> => {
  console.log(`[CaptureUpdateClassicDecode] Waiting for 'update-classic-decode' API response (Timeout: ${timeoutMs / 1000}s)...`);
  try {
    const response: Response = await page.waitForResponse(
      (res) => (res.url().includes('update-classic-decode') || res.url().includes('update_classic_decode')) && (res.status() === 200 || res.status() === 201),
      { timeout: timeoutMs }
    );

    const status = response.status();
    const jsonBody = await response.json().catch(() => null);

    console.log(`\n🌐 [API Response] URL: ${response.url()} (Status: ${status})`);
    if (jsonBody) {
      console.log(`📦 [JSON Data]:\n${JSON.stringify(jsonBody, null, 2)}`);
    }
    return jsonBody;
  } catch (err) {
    console.log(`⚠️ [CaptureUpdateClassicDecode] update-classic-decode response wait ended: ${err.message}`);
    return null;
  }
};

export class ClassicEditableFeatureYMM {
  private timeout = process.env.CI ? 60000 : 90000;

  async run(page: Page) {
    const { StreamingYmmEditTask } = require('../streaming Task/tasks/StreamingYmmEditTask');
    const task = new StreamingYmmEditTask(page);
    await task.execute({ timeout: this.timeout });
  }
}

export class Case5VerifyClassicEditableFeature {
  private timeout = process.env.CI ? 60000 : 90000;

  async runDropdownUpdate(page: Page) {
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

    // 1. Select Year
    const yearInput = page.getByRole('textbox', { name: /year/i })
      .or(page.getByPlaceholder(/year/i))
      .or(page.getByLabel(/year/i))
      .or(page.locator('input[placeholder*="year" i], [aria-label*="year" i]'))
      .first();
    await yearInput.waitFor({ state: 'visible', timeout: this.timeout });
    await yearInput.click({ force: true });
    await page.waitForTimeout(300);

    const yearOption = page.getByRole('option', { name: '1961' })
      .or(page.getByText('1961', { exact: true }))
      .or(page.locator('[role="option"], [role="listbox"] li, .dropdown-menu li, ul li').filter({ hasText: /\d{4}/ }).first().locator('visible=true')); // Ensure option is visible
    await yearOption.first().waitFor({ state: 'visible', timeout: 10000 }); // Wait for the specific option to be visible
    // 2. Select Year and concurrently wait for get_classic_make API response
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('get_classic_make') && (res.status() === 200 || res.status() === 304),
        { timeout: 15000 }
      ).catch(() => null),
      yearOption.first().click({ force: true })
    ]);

    const makeInput = page.getByRole('textbox', { name: /make/i })
      .or(page.getByPlaceholder(/make/i))
      .or(page.getByLabel(/make/i))
      .or(page.locator('input[placeholder*="make" i], [aria-label*="make" i]'))
      .first();
    await makeInput.waitFor({ state: 'visible', timeout: this.timeout });
    await makeInput.click({ force: true });

    const ajsMake = page.getByRole('option', { name: 'AJS' }).or(page.getByText('AJS', { exact: true }));
    const firstMake = page.locator('[role="option"], [role="listbox"] li, .dropdown-menu li, ul li').filter({ hasText: /.+/ }).first().locator('visible=true');

    // 3. Select Make and concurrently wait for get_classic_model API response
    const selectMakeAction = async () => {
      if (await ajsMake.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await ajsMake.first().click({ force: true });
      } else {
        await firstMake.click({ force: true });
      }
    };

    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('get_classic_model') && (res.status() === 200 || res.status() === 304),
        { timeout: 15000 }
      ).catch(() => null),
      selectMakeAction()
    ]);

    const modelInput = page.getByRole('textbox', { name: /model/i })
      .or(page.getByPlaceholder(/model/i))
      .or(page.getByLabel(/model/i))
      .or(page.locator('input[placeholder*="model" i], [aria-label*="model" i]'))
      .first();
    await modelInput.waitFor({ state: 'visible', timeout: this.timeout });
    await modelInput.click({ force: true });

    const modelOption = page.getByRole('option', { name: 'Model 16 350ms' })
      .or(page.getByText('Model 16 350ms', { exact: true }))
      .or(page.locator('[role="option"], [role="listbox"] li, .dropdown-menu li, ul li').filter({ hasText: /.+/ }).first().locator('visible=true'));

    await modelOption.first().waitFor({ state: 'visible', timeout: 10000 });

    // 4. Select Model and concurrently wait for get_classic_series API response
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('get_classic_series') && (res.status() === 200 || res.status() === 304),
        { timeout: 10000 }
      ).catch(() => null),
      modelOption.first().click({ force: true })
    ]);

    const trimInput = page.getByRole('textbox', { name: /trim/i })
      .or(page.getByPlaceholder(/trim/i))
      .or(page.getByLabel(/trim/i))
      .or(page.locator('input[placeholder*="trim" i], [aria-label*="trim" i]'))
      .first();
    if (await trimInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await trimInput.click({ force: true });
      await page.waitForTimeout(300);

      const baseTrim = page.getByText('Base', { exact: true })
        .or(page.getByRole('option', { name: /base/i }))
        .or(page.locator('[role="option"], [role="listbox"] li, .dropdown-menu li, ul li').filter({ hasText: /.+/ }).first().locator('visible=true')); // Ensure option is visible

      if (await baseTrim.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await baseTrim.first().click({ force: true });
      }
    }

    // 5. Submit Changes
    const continueBtn = page.getByRole('button', { name: 'Continue' });
    await continueBtn.waitFor({ state: 'visible', timeout: this.timeout });
    await continueBtn.click({ force: true });

    const confirmBtn = page.getByRole('button', { name: 'Confirm & Get Records' })
      .or(page.locator('button:has-text("Confirm")'))
      .or(page.locator('button:has-text("Submit")'));
    await confirmBtn.first().waitFor({ state: 'visible', timeout: this.timeout });
    await confirmBtn.first().click({ force: true });

    await page.waitForURL(/.*(cv=|preview|sticker|report|ws-preview).*/, { timeout: this.timeout });
    console.log('✅ Dropdown update successful');
  }
}

export class ClassicEditableSpecs {
  private timeout = process.env.CI ? 60000 : 90000;

  async performAs(actor: Actor) {
    const page = actor.getPage();
    await page.context().clearCookies();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});

    const cookies = await page.context().cookies();
    const isStreaming = cookies.some((c) => c.name === 'checkout_flow' && c.value === 'streaming');

    const classicVin = generateClassicNumericVin();

    // Self-healing VIN Input
    await fastInputWithHealing(
      page,
      'VIN',
      classicVin,
      [
        'input[name="vin"]',
        'input[placeholder*="VIN" i]',
        'input[aria-label*="VIN" i]'
      ],
      { timeout: this.timeout / 3 }
    );

    // Self-healing Search Submit
    await clickWithHealing(
      page,
      'Search',
      [
        'button[type="submit"]',
        'button:has-text("Search")',
        'button:has-text("Decode")',
        'button:has-text("Get Window Sticker")'
      ]
    );

    // Support preview, sticker, ws-preview, and license-preview URLs
    await page.waitForURL(/.*(preview|sticker|license-preview|ws-preview).*/, { timeout: this.timeout });

    // Enable API network listener to capture relevant response URLs and payloads
    page.on('response', async (response) => {
      const url = response.url();

      if (url.includes('/logs') || url.includes('/telemetry')) {
        return;
      }

      const contentType = response.headers()['content-type'] || '';
      const resourceType = response.request().resourceType();

      if (resourceType === 'fetch' || resourceType === 'xhr' || contentType.includes('application/json')) {
        try {
          const status = response.status();
          const jsonBody = await response.json();
          console.log(`🌐 [API Response] URL: ${url} (Status: ${status})`);
          console.log(`📦 [JSON Data]:\n${JSON.stringify(jsonBody, null, 2)}`);
        } catch (e) {
          // Handled response payload that is not JSON or cannot be read
        }
      }
    });

    const previewCookies = await page.context().cookies();
    const isStreamingFlow = previewCookies.some((c) => c.name === 'checkout_flow' && c.value === 'streaming') ||
      page.url().includes('ws-preview') ||
      page.url().includes('preview');

    // On modern and streaming projects, run the resilient StreamingYmmEditTask
    try {
      await new ClassicEditableFeatureYMM().run(page);
    } catch (err) {
      if (!isStreamingFlow) {
        console.log(`⚠️ Modern YMM task failed, attempting legacy dropdown update fallback: ${err.message}`);
        await new Case5VerifyClassicEditableFeature().runDropdownUpdate(page);
      } else {
        throw err;
      }
    }
  }
}