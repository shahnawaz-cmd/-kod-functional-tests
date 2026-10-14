import { expect } from '@playwright/test';
import { Actor } from '../actors/Actor';

export class LpStateDropdownSearchTask {
  async performAs(actor: Actor) {
    const page = actor.getPage();
    const timeout = process.env.CI ? 90000 : 60000;

    console.log('[LP State Dropdown Task] Testing License Plate State Search & Selection...');

    // 1. Select License Plate Tab
    const lpTab = page.locator('button:has-text("License Plate")')
      .or(page.locator('button:has-text("By License Plate")'))
      .or(page.locator('button:has-text("By U.S License Plate")'))
      .first();

    await lpTab.waitFor({ state: 'visible', timeout: 10000 });
    await lpTab.click({ force: true });
    await page.waitForTimeout(500);

    // 2. Locate native select or custom combobox dropdown
    const selectElement = page.locator('select[name*="state" i]').first();
    const isNativeSelect = await selectElement.isVisible().catch(() => false);

    if (isNativeSelect) {
      console.log('[LP State Dropdown] Interacting with native <select> element...');
      await selectElement.selectOption({ label: 'California' }).catch(() => selectElement.selectOption('CA'));
      const selectedValue = await selectElement.inputValue();
      expect(selectedValue, 'State select option failed to set').toBeTruthy();
      console.log(`✅ Native select option verified (Value: ${selectedValue})`);
    } else {
      console.log('[LP State Dropdown] Interacting with custom Combobox dropdown...');
      const stateDropdown = page.locator('input[role="combobox"]')
        .or(page.getByRole('combobox', { name: /State|Select/i }))
        .locator('visible=true')
        .first();

      await stateDropdown.waitFor({ state: 'visible', timeout: 5000 });
      await stateDropdown.click({ force: true });
      await stateDropdown.fill('California');

      const caOption = page.locator('[role="listbox"] [role="option"]:has-text("California")')
        .or(page.locator('[role="listbox"] li:has-text("California")'))
        .or(page.getByRole('option', { name: 'California', exact: true }))
        .first();

      if (await caOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await caOption.click({ force: true });
        console.log('✅ Custom Combobox option "California" selected from popup list');
      } else {
        await page.keyboard.press('Enter');
        console.log('✅ Custom Combobox option "California" submitted via Keyboard Enter');
      }
    }
  }
}
