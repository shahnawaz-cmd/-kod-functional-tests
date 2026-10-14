import { test, expect } from '@playwright/test';
import { Actor } from '../actors/Actor';
import { fastInputWithHealing, clickWithHealing, locateElementWithHealing } from '../utils/selfHealingLocator';

export class LPcases {
  async performAs(actor: Actor) {
    const page = actor.getPage();
    const timeout = process.env.CI ? 90000 : 60000;

    let isTabPresentAndClickable = false;
    try {
      const activeTabLocator = await locateElementWithHealing(
        page,
        'License Plate Tab',
        [
          'button:has-text("By License Plate")',
          'button:has-text("By U.S License Plate")',
          'button:has-text("License Plate")',
          '[role="tab"]:has-text("License Plate")',
          'text=By License Plate'
        ],
        { timeout: timeout / 2 }
      );

      await activeTabLocator.waitFor({ state: 'visible', timeout: timeout / 4 });
      console.log('LP Tab Found and visible in Website');
      await activeTabLocator.click({ force: true, timeout: 5000 });
      isTabPresentAndClickable = true;
    } catch (error: any) {
      console.log(`LP Tab not found or not interactable within timeout: ${error.message}`);
    }

    if (isTabPresentAndClickable) {
      console.log('Proceeding with License Plate decode steps.');

      // 1. Input license plate number
      await fastInputWithHealing(
        page,
        'License Plate Input Field',
        'HBL1216',
        [
          '.hero-search-panel[aria-hidden="false"] input[name="plate"]',
          'input[name*="plate" i]',
          'input[placeholder*="plate" i]',
          'input[aria-label*="plate" i]',
          '[data-testid*="plate"]',
        ],
        { timeout }
      );

      // 2. Select State inside the active in-page search form
      const selectElement = page.locator('select[name*="state" i]').first();
      const isNativeSelect = await selectElement.isVisible().catch(() => false);

      if (isNativeSelect) {
        await selectElement.selectOption({ label: 'Texas' }).catch(() => selectElement.selectOption('TX'));
      } else {
        const stateDropdown = page.locator('.hero-search-panel[aria-hidden="false"] input[role="combobox"]')
          .or(page.getByRole('combobox', { name: /State|Select/i }))
          .or(page.locator('input[aria-label*="State" i]'))
          .or(page.locator('[role="combobox"]'))
          .first();

        await stateDropdown.waitFor({ state: 'visible', timeout });
        await stateDropdown.click({ force: true, timeout: 5000 });
        await stateDropdown.fill('Texas').catch(() => {});

        // Target option strictly inside the listbox dropdown popup
        const texasOption = page.locator('[role="listbox"] [role="option"]:has-text("Texas")')
          .or(page.locator('[role="listbox"] li:has-text("Texas")'))
          .or(page.getByRole('option', { name: 'Texas', exact: true }))
          .first();

        if (await texasOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await texasOption.click({ force: true, timeout: 5000 });
        } else {
          await page.keyboard.press('Enter').catch(() => {});
        }
      }

      // 3. Click Search Button in the active form
      await clickWithHealing(
        page,
        'Search License Plate Button',
        [
          '.hero-search-panel[aria-hidden="false"] button[type="submit"]',
          'button:has-text("Search License Plate")',
          'button:has-text("Get Window Sticker")',
          'button[type="submit"]',
          'button:has-text("Search")',
          '[data-testid*="search-button"]'
        ]
      );

      // 4. Wait for navigation to preview page
      await page.waitForURL(/.*(license-preview|preview|sticker|report|checkout|payment).*/i, {
        timeout,
        waitUntil: 'domcontentloaded'
      });
      await page.waitForLoadState('domcontentloaded');

      // 5. Complete pre-VIN check / goal prompt steps until the actual Preview page is loaded
      for (let i = 0; i < 5; i++) {
        const isActualPreviewVisible = await page.locator('text=Unlock the history')
          .or(page.locator('button:has-text("Access Records")'))
          .or(page.locator('button:has-text("Reveal Records")'))
          .first()
          .isVisible({ timeout: 1500 })
          .catch(() => false);

        if (isActualPreviewVisible) {
          break;
        }

        const goalBtn = page.locator('button:has-text("Just checking"), button:has-text("I\'m a buyer"), button:has-text("I\'m a seller"), button:has-text("Continue"), button:has-text("Next")')
          .locator('visible=true')
          .first();

        if (await goalBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
          console.log(`Advancing pre-VIN check step (${await goalBtn.innerText()})...`);
          await goalBtn.click({ force: true }).catch(() => {});
          await page.waitForTimeout(1000);
        } else {
          break;
        }
      }

      // 6. Wait for the actual Preview Page containing vehicle YMM details, packages & access CTAs
      const actualPreviewLocator = page.locator('text=Unlock the history')
        .or(page.locator('button:has-text("Access Records")'))
        .or(page.locator('button:has-text("Reveal Records")'))
        .or(page.locator('text=Vehicle Specifications'))
        .or(page.getByText('Records found for', { exact: false }))
        .or(page.getByText('Success! We found detailed', { exact: false }))
        .or(page.locator('h1:has-text("Success!")'))
        .or(page.locator('text=5 Reports'))
        .or(page.locator('text=1 Report'))
        .or(page.locator('[data-testid*="preview"]'));

      await actualPreviewLocator.first().waitFor({ state: 'visible', timeout });
      await page.waitForTimeout(2000); // Allow full vehicle specs, YMM heading, and pricing packages to render
      console.log(`✅ Landed on actual Preview Page (${page.url()})`);

      // 7. Capture and attach screenshot of the actual Preview page
      try {
        const screenshotBuffer = await page.screenshot({ fullPage: false });
        await test.info().attach('Actual_Preview_Page_Screenshot', {
          body: screenshotBuffer,
          contentType: 'image/png'
        });
        console.log('📸 [Screenshot] Attached actual Preview Page screenshot to Playwright report.');
      } catch (e: any) {
        console.log(`[Screenshot] Info attach skipped: ${e.message}`);
      }
    } else {
      console.log('Skipping License Plate decode flow as the tab was not found or interactable.');
    }
  }
}
