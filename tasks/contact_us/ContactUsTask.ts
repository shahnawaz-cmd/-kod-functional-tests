// tasks/contact_us/ContactUsTask.ts
import { Page, Locator, expect, TestInfo } from '@playwright/test';

export interface ContactFormData {
  name: string;
  email: string;
  concern: string;
  message: string;
}

export class ContactUsTask {
  /**
   * Smart Waiting: Wait for DOM readiness and primary interactive elements
   */
  static async waitForPageReady(page: Page, timeoutMs = 15000) {
    await page.waitForLoadState('domcontentloaded');

    await Promise.race([
      page.locator('h1, h2:has-text("Contact"), *:has-text("Have any questions")').first().waitFor({ state: 'visible', timeout: timeoutMs }),
      page.locator('form, button[type="submit"]').first().waitFor({ state: 'visible', timeout: timeoutMs })
    ]).catch(() => {
      console.warn('[ContactUsTask] Smart wait warning: Page load slow, proceeding with self-healing strategies...');
    });
  }

  /**
   * Self-Healing Locator: Full Name Input
   */
  static getFullNameInput(page: Page): Locator {
    const candidates = [
      'input[placeholder*="John" i]',
      'input[name*="name" i]',
      'input[id*="name" i]',
      'label:has-text("NAME") ~ input',
      'label:has-text("Full Name") ~ input',
      'form input[type="text"]'
    ];
    return page.locator(candidates.join(', ')).first();
  }

  /**
   * Self-Healing Locator: Email Input
   */
  static getEmailInput(page: Page): Locator {
    const candidates = [
      'input[type="email"]',
      'input[placeholder*="example.com" i]',
      'input[placeholder*="email" i]',
      'input[name*="email" i]',
      'label:has-text("EMAIL") ~ input'
    ];
    return page.locator(candidates.join(', ')).first();
  }

  /**
   * Self-Healing Locator: Concern Select Dropdown
   */
  static getConcernSelect(page: Page): Locator {
    const candidates = [
      'select',
      'select[name*="concern" i]',
      'select[id*="concern" i]',
      '[role="combobox"]',
      'select:has(option:has-text("Support"))'
    ];
    return page.locator(candidates.join(', ')).first();
  }

  /**
   * Self-Healing Locator: Message Textarea
   */
  static getMessageTextarea(page: Page): Locator {
    const candidates = [
      'textarea[placeholder*="Describe" i]',
      'textarea[placeholder*="question" i]',
      'textarea[name*="message" i]',
      'label:has-text("MESSAGE") ~ textarea',
      'textarea'
    ];
    return page.locator(candidates.join(', ')).first();
  }

  /**
   * Self-Healing Locator: Submit CTA
   */
  static getSubmitButton(page: Page): Locator {
    return page.locator('button[type="submit"].bg-\\[var\\(--acc\\)\\]').or(page.locator('button[type="submit"]:has-text("Submit")')).first();
  }

  /**
   * Verifies Reactive Inline Validation Errors upon Empty Submission
   * Directly clicks on the submit button and verifies error messages
   */
  static async verifyEmptySubmissionErrors(page: Page) {
    const submitBtn = this.getSubmitButton(page);
    await submitBtn.waitFor({ state: 'visible', timeout: 5000 });

    // Directly click the Submit button
    await submitBtn.click();

    // Verify all 4 inline validation errors appear
    const nameErr = page.locator('form').getByText('Please enter your name');
    const emailErr = page.locator('form').getByText('Please enter your email');
    const concernErr = page.locator('form').getByText('Please select a concern');
    const msgErr = page.locator('form').getByText('Please enter a message');

    await expect(nameErr, 'Name validation error should be visible').toBeVisible({ timeout: 5000 });
    await expect(emailErr, 'Email validation error should be visible').toBeVisible({ timeout: 5000 });
    await expect(concernErr, 'Concern validation error should be visible').toBeVisible({ timeout: 5000 });
    await expect(msgErr, 'Message validation error should be visible').toBeVisible({ timeout: 5000 });
  }

  /**
   * Smart Form Filling with actionability verification
   */
  static async fillForm(page: Page, data: ContactFormData) {
    const nameInput = this.getFullNameInput(page);
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.fill(data.name);

    const emailInput = this.getEmailInput(page);
    await emailInput.fill(data.email);

    const concernSelect = this.getConcernSelect(page);
    await concernSelect.selectOption({ label: data.concern }).catch(async () => {
      await concernSelect.selectOption(data.concern);
    });

    const msgTextarea = this.getMessageTextarea(page);
    await msgTextarea.fill(data.message);
  }

  /**
   * Verifies Brand Support Presence (Live Chat link or Help text)
   */
  static async verifyBrandSupportChannel(page: Page, testInfo: TestInfo) {
    const hasLiveChat = await page.locator('a[href*="direct.lc.chat"], a:has-text("Live Chat")').first().isVisible().catch(() => false);
    const hasHelpHeading = await page.locator('h1, h2:has-text("Contact"), *:has-text("Have any questions?")').first().isVisible().catch(() => false);

    expect(
      hasLiveChat || hasHelpHeading,
      'Support channel (Live Chat or Help Section) should be rendered on Contact page'
    ).toBeTruthy();
  }

  /**
   * AUDIT RECAPTCHA HEALTH: HARD FAILURE FLAG
   * Immediately flags as failure if reCAPTCHA key is misconfigured, not whitelisted, or fails to render
   */
  static async auditRecaptchaHealth(page: Page, testInfo: TestInfo) {
    console.log('[RecaptchaTask] Auditing Google reCAPTCHA frame and sitekey authorization...');

    // Smart Wait: Give reCAPTCHA scripts up to 8s to render their iframe
    let recaptchaFrame = null;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      recaptchaFrame = page.frames().find(f => f.url().includes('recaptcha/api2/anchor'));
      if (recaptchaFrame) break;
      await page.waitForTimeout(500);
    }

    // Check script presence if frame was not rendered
    const hasRecaptchaScript = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script')).map(s => s.src);
      return scripts.some(s => s.includes('google.com/recaptcha'));
    });

    // If script is present but frame never rendered, site key failed
    if (!recaptchaFrame && hasRecaptchaScript) {
      const domain = new URL(page.url()).hostname;
      const errorMsg = `🚨 reCAPTCHA FAILURE on ${domain}: Google reCAPTCHA script was loaded, but the captcha widget failed to initialize or render. Check site key and domain whitelist in Google reCAPTCHA console.`;
      
      testInfo.annotations.push({
        type: 'reCAPTCHA Misconfiguration',
        description: errorMsg
      });

      expect(recaptchaFrame, errorMsg).toBeTruthy();
      return;
    }

    expect(recaptchaFrame, 'reCAPTCHA anchor iframe must be present on page').toBeTruthy();

    if (recaptchaFrame) {
      const frameText = await recaptchaFrame.innerText('body').catch(() => '');
      const domain = new URL(page.url()).hostname;

      // HARD FAILURE: Check if Google rejected the domain
      if (frameText.includes('Invalid domain for site key') || frameText.includes('ERROR for site owner')) {
        const failureDetails = `🚨 reCAPTCHA KEY REJECTED: Google reCAPTCHA displayed "ERROR for site owner: Invalid domain for site key" on ${domain}. Domain is NOT whitelisted in reCAPTCHA Admin console!`;
        console.error(`\x1b[31m${failureDetails}\x1b[0m`);

        testInfo.annotations.push({
          type: 'reCAPTCHA Misconfiguration',
          description: failureDetails
        });

        // Hard assertion failure
        expect(
          frameText,
          failureDetails
        ).not.toContain('Invalid domain for site key');
      }

      // If valid, assert checkbox is visible and interactable
      const anchor = recaptchaFrame.locator('#recaptcha-anchor');
      await expect(anchor, 'reCAPTCHA interactive checkbox should be visible').toBeVisible({ timeout: 5000 });

      // Extract site key from iframe URL for verification audit
      const siteKeyMatch = recaptchaFrame.url().match(/[?&]k=([^&]+)/);
      const siteKey = siteKeyMatch ? siteKeyMatch[1] : 'Unknown';

      // Log clear stdout proof of working reCAPTCHA
      console.log(`\n======================================================`);
      console.log(`🛡️  [reCAPTCHA PROOF OF HEALTH]`);
      console.log(`   Domain       : ${domain}`);
      console.log(`   Site Key     : ${siteKey}`);
      console.log(`   Status       : ✅ AUTHORIZED & ACTIVE (NO Google domain rejection)`);
      console.log(`   Checkbox     : Visible & Interactable (#recaptcha-anchor)`);
      console.log(`   Frame URL    : ${recaptchaFrame.url().slice(0, 85)}...`);
      console.log(`======================================================\n`);
    }
  }

  /**
   * Verifies Reactive Inline Validation Errors upon Empty Submission
   * Directly clicks the Submit button and validates inline error messages
   */
  static async verifyEmptySubmissionErrors(page: Page) {
    const submitBtn = page.locator('button:has-text("Submit")').first();
    await submitBtn.waitFor({ state: 'visible', timeout: 5000 });

    // Directly click the submit button
    await submitBtn.click();

    // Validate all 4 error messages are rendered
    await expect(page.locator('text=Please enter your name'), 'Name validation error should be visible').toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Please enter your email'), 'Email validation error should be visible').toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Please select a concern'), 'Concern validation error should be visible').toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Please enter a message'), 'Message validation error should be visible').toBeVisible({ timeout: 5000 });
  }

  /**
   * Verifies Options in Concern Dropdown
   */
  static async verifyConcernOptions(page: Page) {
    const select = this.getConcernSelect(page);
    await select.waitFor({ state: 'visible', timeout: 5000 });

    const options = await select.locator('option').allInnerTexts();
    const cleanOptions = options.map(o => o.trim()).filter(Boolean);

    const expectedConcerns = ['Support', 'Decode Error', 'Marketing', 'Business', 'Others'];
    for (const expected of expectedConcerns) {
      expect(cleanOptions, `Dropdown should contain option "${expected}"`).toContain(expected);
    }
  }
}
