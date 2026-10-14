import { expect } from '@playwright/test';
import { Actor } from '../actors/Actor';
import { locateInputWithHealing } from '../utils/selfHealingLocator';

export class VinMaxLengthEnforcementTask {
  async performAs(actor: Actor) {
    const page = actor.getPage();
    const overlongVin = '1FMCU0F68LUB98854EXTRACHARS123';
    const expectedMaxLength = 17;

    // 1. Locate VIN input field
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

    // 2. Type/Fill 30-character long string
    await vinInput.fill(overlongVin);
    await page.waitForTimeout(500);

    // 3. Retrieve actual input value length
    const actualValue = await vinInput.inputValue();
    console.log(`[TC_26] Attempted input length: ${overlongVin.length}, actual length in DOM: ${actualValue.length} ("${actualValue}")`);

    // Verify length is strictly capped at 17 characters max
    expect(actualValue.length).toBeLessThanOrEqual(expectedMaxLength);
    console.log('Passed: VIN max length enforcement task verified.');
  }
}
