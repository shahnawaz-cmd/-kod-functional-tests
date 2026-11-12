// tests/contact_us_verification.spec.ts
import { test, expect } from '../fixtures/contactUs.fixture';

test.describe('Contact Us & reCAPTCHA Verification Suite', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.describe.configure({ timeout: process.env.CI ? 60000 : 45000 });

  test('TC_CONTACT_01 — Verify brand support channels and contact navigation',
    { tag: ['@contact', '@desktop'] },
    async ({ contactUsPage, contactUsTask }, testInfo) => {
      await contactUsTask.verifyBrandSupportChannel(contactUsPage, testInfo);
    }
  );

  test('TC_CONTACT_02 — Verify Google reCAPTCHA key domain authorization & readiness',
    { tag: ['@contact', '@captcha', '@P0'] },
    async ({ contactUsPage, contactUsTask }, testInfo) => {
      // Hard failure if reCAPTCHA key is invalid or not whitelisted for the domain
      await contactUsTask.auditRecaptchaHealth(contactUsPage, testInfo);
    }
  );

  test('TC_CONTACT_03 — Verify empty form submission triggers self-healing inline validation errors',
    { tag: ['@contact', '@validation'] },
    async ({ contactUsPage, contactUsTask }) => {
      await contactUsTask.verifyEmptySubmissionErrors(contactUsPage);
    }
  );

  test('TC_CONTACT_04 — Verify Concern dropdown option parity and selectable states',
    { tag: ['@contact', '@dropdown'] },
    async ({ contactUsPage, contactUsTask }) => {
      await contactUsTask.verifyConcernOptions(contactUsPage);
    }
  );

  test('TC_CONTACT_05 — Verify self-healing form input typing and value retention',
    { tag: ['@contact', '@form-fill'] },
    async ({ contactUsPage, contactUsTask }) => {
      await contactUsTask.fillForm(contactUsPage, {
        name: 'QA Automation Engineer',
        email: 'qa.automation@empirepixel.com',
        concern: 'Support',
        message: 'Automated test verification of contact form input responsiveness.'
      });

      // Verify fields retain entered values
      await expect(contactUsTask.getFullNameInput(contactUsPage)).toHaveValue('QA Automation Engineer');
      await expect(contactUsTask.getEmailInput(contactUsPage)).toHaveValue('qa.automation@empirepixel.com');
      await expect(contactUsTask.getMessageTextarea(contactUsPage)).toHaveValue('Automated test verification of contact form input responsiveness.');
    }
  );
});
