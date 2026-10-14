import { expect } from '@playwright/test';
import { Actor } from '../actors/Actor';
import { locateInputWithHealing, clickWithHealing } from '../utils/selfHealingLocator';

export class FieldValidation {
  async performAs(actor: Actor) {
    const page = actor.getPage();

    // Self-healing VIN input locator
    const vinInput = await locateInputWithHealing(
      page,
      'VIN',
      [
        'input[name="vin"]',
        'input[placeholder*="VIN" i]',
        'input[aria-label*="VIN" i]',
        'input[type="text"]'
      ],
      { timeout: 15000 }
    );

    const searchButton = vinInput.locator('xpath=../..').getByRole('button').first();

    // 1. Validate 17-character limit (prevent exceeding)
    const longVin = 'A'.repeat(18);
    await vinInput.fill(longVin);
    
    // Check if the input only accepted 17 characters
    const actualValue = await vinInput.inputValue();
    
    const currentUrl = page.url();
    if (actualValue.length > 17) {
      throw new Error(`Failed: Input allowed more than 17 characters. Actual: ${actualValue.length}`);
    } else {
      console.log('Passed: Field restricts input to 17 characters.');
    }

    // 2. Validate error message for < 5 characters
    {
      await vinInput.fill('ABCD');
      if (await searchButton.isVisible().catch(() => false)) {
        await searchButton.click();
      } else {
        await clickWithHealing(page, 'Search', ['button[type="submit"]', 'button:has-text("Search")']);
      }
      
      const errorLocator = page.locator('.error, .alert, [role="alert"]');
      
      try {
        await expect(errorLocator).toBeVisible({ timeout: 5000 });
        console.log('Passed: Error message appeared for short VIN.');
      } catch (e) {
        console.log('Error message element not found. Dumping page text...');
        console.log(await page.innerText('body'));
        throw e;
      }
    }
  }
}
