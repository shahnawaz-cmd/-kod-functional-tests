import { expect } from '@playwright/test';
import { Actor } from '../actors/Actor';

export class DoubleClickSubmitPreventionTask {
  async performAs(actor: Actor) {
    const page = actor.getPage();

    console.log('[Form Resilience Task] Testing Rapid Double-Click Submit Prevention...');

    const vinInput = page.locator('input[name*="vin" i]')
      .or(page.locator('input[placeholder*="VIN" i]'))
      .locator('visible=true')
      .first();

    const searchBtn = page.locator('form button[type="submit"]')
      .or(page.locator('button:has-text("Search")'))
      .or(page.locator('button:has-text("Get Window Sticker")'))
      .locator('visible=true')
      .first();

    await vinInput.waitFor({ state: 'visible', timeout: 5000 });
    await vinInput.fill('1C4RJHBG0PC533410');

    let decodeApiCallCount = 0;

    // Track decode API requests triggered on submit
    page.on('request', (request) => {
      const url = request.url();
      if (/.*(api\/.*decode|api\/.*search|check-vin|vhr\/preview).*/i.test(url)) {
        decodeApiCallCount++;
        console.log(`[Network Monitor] Captured API Request #${decodeApiCallCount}: ${url}`);
      }
    });

    await searchBtn.waitFor({ state: 'visible', timeout: 5000 });

    // Perform rapid double-click on search submit button
    await Promise.all([
      searchBtn.dblclick({ force: true }),
      page.waitForTimeout(2000)
    ]);

    // Ensure button becomes disabled or duplicate requests are prevented
    const isButtonDisabled = await searchBtn.isDisabled().catch(() => false);
    console.log(`[Form Resilience] Submit button disabled status on double click: ${isButtonDisabled}`);
    console.log(`[Form Resilience] Total API calls triggered: ${decodeApiCallCount}`);

    // Expect at most 1 API request call triggered by double click
    expect(decodeApiCallCount, 'Duplicate API calls triggered on rapid double-click').toBeLessThanOrEqual(1);

    console.log('✅ [Form Resilience Task] Passed! Duplicate submit calls prevented.');
  }
}
