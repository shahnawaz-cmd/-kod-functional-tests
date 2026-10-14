import { Page } from '@playwright/test';
import { Actor } from '../actors/Actor';
import { DecodeVinTask } from './DecodeVinTask';
import { fastInputWithHealing, clickWithHealing, locateElementWithHealing } from '../utils/selfHealingLocator';
import { applyReferralAndVerifyCookies } from './referral_test';

export class PreviewToCheckoutRedirection {
  private timeout: number;

  constructor() {
    this.timeout = process.env.CI ? 90000 : 45000;
  }

  private async fillEmailAndProceed(page: Page) {
    const popupTimeout = process.env.CI ? 25000 : 15000;

    // Check if email input is already visible in DOM
    const emailField = page.locator('input[type="email"], input[placeholder*="email" i], input[name*="email" i]').first();
    const isEmailAlreadyVisible = await emailField.isVisible({ timeout: 2000 }).catch(() => false);

    if (!isEmailAlreadyVisible) {
      console.log('[Preview Redirection] Locating and clicking Access Records CTA...');
      // Multi-strategy access button locators
      const accessButtonSelectors = [
        'button:has-text("Access Records")',
        'button:has-text("Get Window Sticker")',
        'button:has-text("View Full Report")',
        'button:has-text("Get Records")',
        'button:has-text("View Report")',
        'button:has-text("Get My Report")',
        'button:has-text("Unlock Report")',
        'button:has-text("Instant Access")',
        'a:has-text("Access Records")',
        'a:has-text("Get Window Sticker")',
        'button[type="submit"]'
      ];

      try {
        await clickWithHealing(
          page,
          'Access Records',
          accessButtonSelectors,
          { timeout: popupTimeout, force: true }
        );
      } catch (e) {
        console.log(`[Preview Redirection] Direct click failed, trying first visible button matching report CTA: ${e.message}`);
        const fallbackBtn = page.locator('button, a').filter({ hasText: /(Access Records|Window Sticker|Full Report|Get Records|View Report)/i }).first();
        if (await fallbackBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await fallbackBtn.scrollIntoViewIfNeeded().catch(() => {});
          await fallbackBtn.click({ force: true }).catch(() => {});
        }
      }
    }

    // Self-healing Email Input
    const suffix = Math.random().toString(36).substring(2, 5);
    const emailAddress = `rolex.rolls12+${suffix}@gmail.com`;
    console.log(`[Preview Redirection] Filling email: ${emailAddress}`);

    await fastInputWithHealing(
      page,
      'Email',
      emailAddress,
      [
        'input[type="email"]',
        'input[placeholder*="email" i]',
        'input[name*="email" i]',
        'input[aria-label*="email" i]'
      ],
      { timeout: popupTimeout, force: true }
    );

    await page.waitForTimeout(500);

    // Self-healing Checkout/Proceed button click
    console.log('[Preview Redirection] Clicking Proceed to Checkout CTA...');
    await clickWithHealing(
      page,
      'Proceed to Checkout',
      [
        'button:has-text("Proceed to checkout")',
        'button:has-text("Proceed to Checkout")',
        'button:has-text("Pay Now")',
        'button:has-text("Complete Order")',
        'button:has-text("Access Records")',
        'button:has-text("Get Report")',
        'button:has-text("Continue")',
        'button[type="submit"]'
      ],
      { timeout: popupTimeout, force: true }
    );
  }

  async performAs(actor: Actor) {
    const page = actor.getPage();
    
    // Initial Referral & Cookie validation
    await applyReferralAndVerifyCookies(page);

    // Land on preview page with shouldClose = false, skipSuccessClick = true, useEuVin = false (always US VIN)
    await actor.attemptsTo(new DecodeVinTask(false, true, false));
    await page.waitForTimeout(1000);

    await this.fillEmailAndProceed(page);

    // Wait for URL redirection to checkout page (domcontentloaded for fast resolution without stalling on payment SDKs)
    await page.waitForURL(
      /.*(checkout|payment|billing|order|purchase|confirmation|summary|subscribe).*/i,
      { timeout: this.timeout, waitUntil: 'domcontentloaded' }
    );
    console.log(`✅ Successfully redirected to checkout URL: ${page.url()}`);
  }
}