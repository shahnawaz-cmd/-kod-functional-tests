import { expect } from '@playwright/test';
import { Actor } from '../actors/Actor';
import { DecodeVinTask } from './DecodeVinTask';
import { clickWithHealing } from '../utils/selfHealingLocator';

export class RevisitStickerBannerFlow {
  async performAs(actor: Actor) {
    const page = actor.getPage();
    const timeout = process.env.CI ? 90000 : 60000;

    // 1. Navigate to /window-sticker
    const stickerPath = '/window-sticker';

    console.log(`[Revisit Sticker] Navigating to valid sticker path: ${stickerPath}`);
    await page.goto(stickerPath, { waitUntil: 'domcontentloaded' }).catch(async () => {
      await page.waitForTimeout(1000);
      await page.goto(stickerPath, { waitUntil: 'domcontentloaded' });
    });
    await page.waitForLoadState('domcontentloaded');

    // 2. Perform VIN Decode using US VIN and wait for success condition to be met
    await actor.attemptsTo(new DecodeVinTask(false, false, false));

    // 3. Return to sticker path using browser back
    await page.goBack();
    await page.waitForLoadState('domcontentloaded');

    // 4. Click dynamic 'Grab it for only' button with self-healing
    await clickWithHealing(
      page,
      'Grab it for',
      [
        'button:has-text("Grab it for")',
        'button:has-text("Grab it")',
        'button:has-text("Get Window Sticker")',
        'button:has-text("Get Sticker")'
      ],
      { timeout: timeout }
    );

    // 5. Verify navigation to sticker preview page with specific query parameters
    await page.waitForURL(/.*(preview|type=sticker|content=revisit).*/, { timeout: timeout, waitUntil: 'domcontentloaded' });
    
    // Check URL contains type=sticker AND content=revisit
    await expect(page).toHaveURL(/.*type=sticker.*/);
    await expect(page).toHaveURL(/.*content=revisit.*/);
    
    console.log('Passed: Revisit sticker banner flow verified.');
  }
}
