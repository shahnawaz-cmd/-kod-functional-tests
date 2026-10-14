import { expect } from '@playwright/test';
import { Actor } from '../actors/Actor';

export class SpecialCharacterInjectionTask {
  private payloads: string[] = [
    "<script>alert('xss')</script>",
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "\"><svg onload=alert(1)>",
    "../../../../etc/passwd"
  ];

  async performAs(actor: Actor) {
    const page = actor.getPage();

    console.log('[Security Injection Task] Testing XSS/SQL Injection payloads on search input...');

    let dialogFired = false;

    // Listen for unexpected alert/dialog popups triggered by XSS payload execution
    page.on('dialog', async (dialog) => {
      console.error(`🚨 [XSS Vulnerability Triggered!] Browser dialog detected: "${dialog.message()}"`);
      dialogFired = true;
      await dialog.dismiss().catch(() => {});
    });

    for (const payload of this.payloads) {
      console.log(`[Security Injection] Testing payload: ${payload}`);

      // Ensure we start at page root for each payload test
      if (new URL(page.url()).pathname !== '/') {
        await page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});
      }

      const vinInput = page.locator('input[name*="vin" i]')
        .or(page.locator('input[placeholder*="VIN" i]'))
        .locator('visible=true')
        .first();

      const searchBtn = page.locator('form button[type="submit"]')
        .or(page.locator('button:has-text("Search")'))
        .or(page.locator('button:has-text("Get Window Sticker")'))
        .locator('visible=true')
        .first();

      // Ensure input is enabled and editable before fill
      if (await vinInput.isDisabled().catch(() => false)) {
        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.waitForTimeout(500);
      }

      await vinInput.waitFor({ state: 'visible', timeout: 5000 });
      await vinInput.click({ force: true }).catch(() => {});
      await vinInput.fill('').catch(() => {});
      await vinInput.fill(payload).catch(async () => {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await vinInput.fill(payload);
      });

      await searchBtn.waitFor({ state: 'visible', timeout: 5000 });
      await searchBtn.click({ force: true });

      await page.waitForTimeout(1500);

      // Verify no unhandled XSS script execution occurred
      expect(dialogFired, `XSS payload triggered an unhandled browser alert: ${payload}`).toBeFalsy();

      // Verify application sanitized input or displayed standard validation error message
      const errorMsgLocator = page.getByText("Please enter a valid VIN", { exact: false })
        .or(page.getByText("Please enter a VIN number", { exact: false }))
        .or(page.getByText("VIN must be 5-17 characters", { exact: false }))
        .or(page.locator('.text-red-500, .error-message, [role="alert"]'));

      const isErrorVisible = await errorMsgLocator.first().isVisible().catch(() => false);
      const isStillOnPage = page.url().endsWith('/') || page.url().includes('/vin-decoder');

      expect(isErrorVisible || isStillOnPage, `Payload executed or bypassed form validation: ${payload}`).toBeTruthy();
    }

    console.log('✅ [Security Injection Task] Passed! All payloads sanitized, no XSS/SQL Injection triggered.');
  }
}
