// fixtures/contactUs.fixture.ts
import { test as base, Page, TestInfo } from '@playwright/test';
import { ContactUsTask } from '../tasks/contact_us/ContactUsTask';
import { gotoWithResilience } from '../utils/resilientNavigation';

type ContactUsFixtures = {
  contactUsPage: Page;
  contactUsTask: typeof ContactUsTask;
};

export const test = base.extend<ContactUsFixtures>({
  contactUsTask: async ({}, use) => {
    await use(ContactUsTask);
  },

  contactUsPage: async ({ page }, use, testInfo: TestInfo) => {
    // Navigate with smart resilience and wait until DOM and network settle
    await gotoWithResilience(page, '/contact-us', {
      timeout: 30000,
      waitUntil: 'load',
      maxRetries: 2,
      readySelector: 'form, button[type="submit"], h1, h2'
    });

    await ContactUsTask.waitForPageReady(page);
    // Ensure scripts/hydration are fully mounted before test execution
    await page.waitForLoadState('networkidle').catch(() => {});
    await use(page);
  }
});

export { expect } from '@playwright/test';
