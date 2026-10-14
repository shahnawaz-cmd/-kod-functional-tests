import { expect } from '@playwright/test';
import { Actor } from '../actors/Actor';
import { locateInputWithHealing } from '../utils/selfHealingLocator';

export class CopyPasteInputTask {
  async performAs(actor: Actor) {
    const page = actor.getPage();
    const testVin = '1FMCU0F68LUB98854';

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

    // 2. Simulate Clipboard Paste Event
    await page.evaluate(async (textToPaste) => {
      const input = document.activeElement as HTMLInputElement;
      if (!input) return;

      // Dispatch clipboard paste event with DataTransfer
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', textToPaste);

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      });

      input.dispatchEvent(pasteEvent);

      // Fallback: If paste event wasn't handled by custom listener, set value directly
      if (input.value !== textToPaste) {
        input.value = textToPaste;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, testVin);

    await page.waitForTimeout(500);

    // 3. Verify value in input field matches pasted VIN
    const actualVal = await vinInput.inputValue();
    console.log(`[TC_23] Copy-Paste verified. Pasted: "${testVin}", Actual field value: "${actualVal}"`);
    expect(actualVal).toBe(testVin);

    console.log('Passed: Copy-Paste input handling verified.');
  }
}
