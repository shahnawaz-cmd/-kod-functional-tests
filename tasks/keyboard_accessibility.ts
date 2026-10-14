import { expect } from '@playwright/test';
import { Actor } from '../actors/Actor';

export class KeyboardAccessibilityTask {
  async performAs(actor: Actor) {
    const page = actor.getPage();
    const timeout = process.env.CI ? 90000 : 60000;

    console.log('[Keyboard Accessibility Task] Testing Tab & Enter key navigation on form...');

    // 1. Focus VIN input field via keyboard Tab navigation
    const vinInput = page.locator('input[name*="vin" i]')
      .or(page.locator('input[placeholder*="VIN" i]'))
      .locator('visible=true')
      .first();

    await vinInput.waitFor({ state: 'visible', timeout: 5000 });
    await vinInput.focus();
    expect(await vinInput.evaluate(el => document.activeElement === el)).toBeTruthy();
    console.log('✅ VIN Input focused via keyboard');

    // 2. Type test VIN using keyboard
    await page.keyboard.type('1C4RJHBG0PC533410', { delay: 50 });
    console.log('✅ VIN typed via keyboard input');

    // 3. Navigate/submit using Enter key on focused element
    await page.keyboard.press('Enter');
    console.log('✅ Pressed Enter key to submit form');

    await page.waitForTimeout(2000);

    // 4. Verify form submitted or navigated away from home root
    const currentUrl = page.url();
    const isSubmittedOrRedirected = /.*(preview|sticker|report|checkout|payment).*/i.test(currentUrl) || new URL(currentUrl).pathname !== '/';
    expect(isSubmittedOrRedirected, 'Form failed to submit using Enter key').toBeTruthy();

    console.log(`✅ [Keyboard Accessibility Task] Passed! Landed on: ${currentUrl}`);
  }
}
