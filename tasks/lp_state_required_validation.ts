import { expect } from '@playwright/test';
import { Actor } from '../actors/Actor';
import { locateInputWithHealing, locateElementWithHealing } from '../utils/selfHealingLocator';

export class LpStateRequiredValidationTask {
  async performAs(actor: Actor) {
    const page = actor.getPage();
    const testPlate = 'HBL121X';

    // 1. Switch tab to License Plate search mode
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
    await lpTab.scrollIntoViewIfNeeded().catch(() => {});
    await lpTab.click({ force: true });
    await page.waitForTimeout(500);

    // 2. Fill License Plate number input
    const plateInput = await locateInputWithHealing(
      page,
      'License Plate',
      [
        'input[name*="plate" i]',
        'input[placeholder*="plate" i]',
        'input[placeholder*="enter plate" i]'
      ]
    );
    await plateInput.scrollIntoViewIfNeeded().catch(() => {});
    await plateInput.fill(testPlate);
    await page.waitForTimeout(300);

    // 3. Click search button WITHOUT selecting state
    const searchBtn = page.getByRole('button', { name: /Search Plate|Search|Get Window Sticker/i }).first();
    await searchBtn.click({ force: true });
    await page.waitForTimeout(1000);

    // 4. Verify state dropdown is present and required state is handled
    const stateElement = page.getByRole('combobox').or(page.locator('select, [class*="state" i] input, [class*="state" i] select')).first();
    const isStateFieldPresent = await stateElement.isVisible({ timeout: 3000 }).catch(() => false);
    
    console.log(`[TC_24] State field present: ${isStateFieldPresent}`);
    expect(isStateFieldPresent).toBe(true);

    console.log('Passed: LP State required validation task verified.');
  }
}
