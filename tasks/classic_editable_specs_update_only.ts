import { Page } from '@playwright/test';
import { Actor } from '../actors/Actor';
import { generateClassicNumericVin } from './vinHelper';
import { waitForUpdateClassicDecodeResponse } from './classic_editable_specs';

/**
 * Class 1: Dynamic Vehicle Specifications Data Generator & Filler
 * Generates unique values and fills all rendered fields inside the Update Specifications modal.
 */
export class ClassicSpecsRandomDataFiller {
  async fillAndSubmit(page: Page, timeout: number = 30000): Promise<void> {
    const inputs = page.locator('.modal input:not([type="hidden"]):not([type="submit"]):not([type="button"]), [role="dialog"] input:not([type="hidden"]):not([type="submit"]):not([type="button"]), form input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
    await inputs.first().waitFor({ state: 'attached', timeout });

    const count = await inputs.count();
    console.log(`[ClassicSpecsRandomDataFiller] Found ${count} specification fields to populate.`);

    for (let i = 0; i < count; i++) {
      const field = inputs.nth(i);
      if (await field.isVisible().catch(() => false) || await field.isEditable().catch(() => false)) {
        const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const placeholder = await field.getAttribute('placeholder').catch(() => '') || '';
        
        let value = `Val_${suffix}`;
        if (/doors|passenger/i.test(placeholder)) {
          value = `${Math.floor(Math.random() * 4) + 2}`;
        } else if (/oil|fuel|length|width|height|wheelbase/i.test(placeholder)) {
          value = `${Math.floor(Math.random() * 50) + 10} ${suffix}`;
        }

        await field.evaluate((el: HTMLElement) => {
          el.scrollIntoView({ block: 'center', inline: 'nearest' });
          el.focus();
        }).catch(() => {});

        await field.fill(value).catch(() => {});
      }
    }

    // Submit update & capture API response
    const updateBtn = page.getByRole('button', { name: 'Update', exact: true })
      .or(page.locator('button').filter({ hasText: /^Update$/i }))
      .or(page.locator('button:has-text("Update"), button:has-text("Save")'))
      .first();

    await updateBtn.waitFor({ state: 'visible', timeout: 15000 });

    const apiPromise = waitForUpdateClassicDecodeResponse(page, 20000);
    await updateBtn.click({ force: true }).catch(async () => {
      await updateBtn.evaluate((el: HTMLElement) => el.click()).catch(() => {});
    });

    await apiPromise;
    console.log('✅ Vehicle specifications successfully updated.');
  }
}

/**
 * Class 2: Update Specifications Flow / Click Handler
 * Handles landing on preview, clicking "Click here to update" and "Update Specifications",
 * then calls Class 1 to populate unique values and submit.
 */
export class ClassicEditableSpecsUpdateOnly {
  async performAs(actor: Actor): Promise<void> {
    const page = actor.getPage();
    await page.context().clearCookies();
    await page.goto('/');
    await page.waitForTimeout(1000);

    const classicVin = generateClassicNumericVin();

    // 1. Enter Classic VIN & search
    const vinInput = page.locator('input[name="vin"], input[placeholder*="VIN" i]').first();
    await vinInput.waitFor({ state: 'visible', timeout: 30000 });
    await vinInput.fill(classicVin);

    const searchBtn = page.locator('button[type="submit"], button:has-text("Search"), button:has-text("Decode"), button:has-text("Get Window Sticker")').first();
    await searchBtn.waitFor({ state: 'visible', timeout: 30000 });
    await searchBtn.click({ force: true }).catch(async () => {
      await searchBtn.evaluate((el: HTMLElement) => el.click()).catch(() => {});
    });

    // 2. Wait for Preview page
    await page.waitForURL(/.*(preview|sticker|license-preview|ws-preview).*/, { timeout: 60000 });
    await page.waitForTimeout(1000); // React hydration

    // 3. Click 'Click here to update'
    const updateTrigger = page.locator('button, a, [role="button"], span')
      .filter({ hasText: /(click here to update|update vehicle|edit specs)/i })
      .first();
    await updateTrigger.waitFor({ state: 'visible', timeout: 30000 });
    await updateTrigger.scrollIntoViewIfNeeded().catch(() => {});
    await updateTrigger.click({ force: true }).catch(async () => {
      await updateTrigger.evaluate((el: HTMLElement) => el.click()).catch(() => {});
    });

    await page.waitForTimeout(500);

    // 4. Click 'Update Specifications'
    const updateSpecsBtn = page.locator('button, a, [role="button"]')
      .filter({ hasText: /(update specifications|specifications|update specs)/i })
      .first();
    await updateSpecsBtn.waitFor({ state: 'visible', timeout: 30000 });
    await updateSpecsBtn.scrollIntoViewIfNeeded().catch(() => {});
    await updateSpecsBtn.click({ force: true }).catch(async () => {
      await updateSpecsBtn.evaluate((el: HTMLElement) => el.click()).catch(() => {});
    });

    await page.waitForTimeout(500);

    // 5. Populate unique specifications & submit via Class 1
    const dataFiller = new ClassicSpecsRandomDataFiller();
    await dataFiller.fillAndSubmit(page);
  }
}
