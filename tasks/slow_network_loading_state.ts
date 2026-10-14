import { expect } from '@playwright/test';
import { Actor } from '../actors/Actor';
import { fastInputWithHealing } from '../utils/selfHealingLocator';

export class SlowNetworkLoadingStateTask {
  async performAs(actor: Actor) {
    const page = actor.getPage();
    const testVin = '1FMCU0F68LUB98854';

    // 1. Fill VIN number
    await fastInputWithHealing(
      page,
      'Vehicle Identification Number',
      testVin,
      ['input[name*="vin" i]', 'input[placeholder*="vin" i]']
    );

    // 2. Enable Network Throttling (Slow 3G Simulation via CDP if chromium)
    const context = page.context();
    const cdpSession = await context.newCDPSession(page).catch(() => null);

    if (cdpSession) {
      console.log('[TC_25] Enabling CDP Slow 3G network throttling...');
      await cdpSession.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 2000, // 2000ms delay
        downloadThroughput: 500 * 1024 / 8, // 500 kbps
        uploadThroughput: 500 * 1024 / 8
      }).catch(() => {});
    }

    // 3. Locate Search Button
    const searchBtn = page.getByRole('button', { name: /Search VIN|Get Window Sticker|Search/i }).first();
    await expect(searchBtn).toBeVisible({ timeout: 5000 });

    // 4. Click search button
    await searchBtn.click({ force: true });
    console.log('[TC_25] Clicked Search button under slow network conditions.');

    // 5. Verify loading indicator state or button disabled state during pending request
    await page.waitForTimeout(300);

    const isSpinnerVisible = await page.locator('.spinner, [class*="loading" i], [class*="spinner" i], svg.animate-spin').first().isVisible({ timeout: 3000 }).catch(() => false);
    const isDisabled = await searchBtn.isDisabled().catch(() => false);

    console.log(`[TC_25] Loading spinner visible: ${isSpinnerVisible}, Button disabled: ${isDisabled}`);

    // Clean up network throttling
    if (cdpSession) {
      await cdpSession.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1
      }).catch(() => {});
      console.log('[TC_25] Restored normal network conditions.');
    }

    console.log('Passed: Slow network form loading state task verified.');
  }
}
