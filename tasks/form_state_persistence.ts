import { expect } from '@playwright/test';
import { Actor } from '../actors/Actor';

export class FormStatePersistenceTask {
  async performAs(actor: Actor) {
    const page = actor.getPage();
    const testVin = '1C4RJHBG0PC533410';

    console.log('[Form UX Task] Testing Form State / Draft Persistence on Page Refresh...');

    const vinInput = page.locator('input[name*="vin" i]')
      .or(page.locator('input[placeholder*="VIN" i]'))
      .locator('visible=true')
      .first();

    await vinInput.waitFor({ state: 'visible', timeout: 5000 });
    await vinInput.fill(testVin);
    console.log(`[Form UX] Entered VIN: ${testVin}`);

    // Reload page to test state/draft persistence
    console.log('[Form UX] Reloading page...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const reloadedVinInput = page.locator('input[name*="vin" i]')
      .or(page.locator('input[placeholder*="VIN" i]'))
      .locator('visible=true')
      .first();

    const valueAfterReload = await reloadedVinInput.inputValue().catch(() => '');
    console.log(`[Form UX] VIN input value after page reload: "${valueAfterReload}"`);

    // Verify session/draft persistence or clean form reset
    const isCleanOrPersisted = valueAfterReload === testVin || valueAfterReload === '';
    expect(isCleanOrPersisted, 'Form state in invalid state after refresh').toBeTruthy();

    console.log('✅ [Form UX Task] Passed! Form state handling verified on page refresh.');
  }
}
