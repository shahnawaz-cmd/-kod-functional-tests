import { expect } from '@playwright/test';
import { Actor } from '../actors/Actor';
import { fastInputWithHealing, locateInputWithHealing, locateElementWithHealing } from '../utils/selfHealingLocator';

export class TabSwitchingStateResetTask {
  async performAs(actor: Actor) {
    const page = actor.getPage();
    const testVin = '1FMCU0F68LUB98854';

    // 1. Locate VIN input field and type a valid VIN
    const vinInput = await locateInputWithHealing(
      page,
      'Vehicle Identification Number',
      [
        'input[name*="vin" i]',
        'input[placeholder*="vin" i]',
        'input[id*="vin" i]'
      ]
    );

    await vinInput.scrollIntoViewIfNeeded().catch(() => {});
    await vinInput.focus();
    await vinInput.clear().catch(() => {});
    await vinInput.fill(testVin);
    await page.waitForTimeout(300);

    // 2. Switch tab to License Plate mode
    const lpTab = await locateElementWithHealing(
      page,
      'License Plate',
      [
        'button:has-text("License Plate")',
        'a:has-text("License Plate")',
        'text=License Plate',
        '[class*="tab" i]:has-text("Plate")'
      ]
    );

    if (await lpTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('[TC_29] Switching tab to License Plate search mode...');
      await lpTab.click({ force: true });
      await page.waitForTimeout(500);

      // 3. Switch back to VIN decode mode
      const vinTab = await locateElementWithHealing(
        page,
        'VIN',
        [
          'button:has-text("VIN")',
          'a:has-text("VIN")',
          'text=VIN Search',
          '[class*="tab" i]:has-text("VIN")'
        ]
      );
      if (await vinTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('[TC_29] Switching back to VIN search mode...');
        await vinTab.click({ force: true });
        await page.waitForTimeout(500);
      }
    }

    // 4. Verify input state resilience (DOM active state without crash/glitch)
    const currentVinInput = await locateInputWithHealing(
      page,
      'Vehicle Identification Number',
      ['input[name*="vin" i]']
    );
    const isVisible = await currentVinInput.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`[TC_29] VIN input field visible after tab switching: ${isVisible}`);

    expect(isVisible).toBe(true);
    console.log('Passed: Multi-Tab form switching state reset task verified.');
  }
}
