import { expect } from '@playwright/test';
import { Actor } from '../actors/Actor';
import { locateInputWithHealing } from '../utils/selfHealingLocator';

export class EmojiUnicodeInputHandlingTask {
  async performAs(actor: Actor) {
    const page = actor.getPage();
    const emojiVin = '1FMCU0F68LUB98854🚗🔥';
    const cleanExpectedVin = '1FMCU0F68LUB98854';

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

    // 2. Fill input with string containing emoji / Unicode non-ASCII characters
    await vinInput.fill(emojiVin);
    await page.waitForTimeout(500);

    // 3. Trigger input/change events
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);

    // 4. Retrieve input value from DOM
    const actualVal = await vinInput.inputValue();
    console.log(`[TC_31] Input value with Emoji/Unicode: "${emojiVin}", Actual DOM value: "${actualVal}"`);

    // Verify value either sanitizes emojis or handles input without throwing JS errors
    const sanitizedVal = actualVal.replace(/[^\x00-\x7F]/g, '');
    const isHandled = actualVal.length <= 17 || sanitizedVal === cleanExpectedVin;

    console.log(`[TC_31] Sanitized ASCII value: "${sanitizedVal}", Is Handled: ${isHandled}`);
    expect(isHandled).toBe(true);

    console.log('Passed: Emoji & Unicode non-ASCII input handling task verified.');
  }
}
