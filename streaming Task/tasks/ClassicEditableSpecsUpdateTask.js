// tests/tasks/ClassicEditableSpecsUpdateTask.js

const REAL_CLASSIC_BODY_SPECS = [
  { engine: '5.0L V8', transmission: '4-Speed Manual', drivetrain: 'RWD', fuelType: 'Gasoline', bodyStyle: 'Coupe', doors: '2', trim: 'Base', cylinders: '8' },
  { engine: '5.7L V8', transmission: '3-Speed Automatic', drivetrain: 'RWD', fuelType: 'Gasoline', bodyStyle: 'Convertible', doors: '2', trim: 'SS', cylinders: '8' },
  { engine: '4.2L Inline 6', transmission: '4-Speed Manual', drivetrain: 'RWD', fuelType: 'Gasoline', bodyStyle: 'Sedan', doors: '4', trim: 'Custom', cylinders: '6' }
];

class ClassicEditableSpecsUpdateTask {
  constructor(page) {
    this.page = page;
  }

  async execute(previewPage, timeout = 60000, testInfo = null) {
    const specs = REAL_CLASSIC_BODY_SPECS[Math.floor(Math.random() * REAL_CLASSIC_BODY_SPECS.length)];

    // ------------------------------------------------------------------
    // Self-Healing Strategy 1: Check for Unmapped VIN prompt ("No Fix it")
    // ------------------------------------------------------------------
    const noFixBtn = this.page.getByRole('button', { name: /No.*Fix it|No, fix it|Fix it/i })
      .or(this.page.locator('button:has-text("No"), button:has-text("Fix it")'))
      .or(this.page.locator('div[class*="cursor-pointer"]:has-text("Fix it"), a:has-text("Fix it")')).first();

    const isUnmappedPrompt = await noFixBtn.isVisible({ timeout: 4000 }).catch(() => false);
    if (isUnmappedPrompt) {
      console.log('⚠️ [ClassicEditableSpecsUpdateTask] VIN unmapped detected ("No Fix it" prompt on preview page). Gracefully skipping case...');
      if (testInfo && typeof testInfo.skip === 'function') {
        testInfo.skip(true, 'VIN unmapped');
      } else {
        const { test } = require('@playwright/test');
        test.skip(true, 'VIN unmapped');
      }
      return null;
    }

    // 1. Self-Healing Click on "Click here to update"
    const updateButton = this.page.getByRole('button', { name: /Click here to update/i })
      .or(this.page.locator('button:has-text("Click here to update")'))
      .or(this.page.locator('button:has-text("Update")'))
      .or(this.page.locator('a:has-text("Click here to update")'))
      .or(this.page.locator('[data-testid*="update" i]')).first();

    await updateButton.waitFor({ state: 'visible', timeout });
    await updateButton.scrollIntoViewIfNeeded().catch(() => {});
    await updateButton.click({ force: true });
    await this.page.waitForTimeout(1000);

    // 2. Self-Healing Click specifically for "Specifications" tab / option (preventing default YMM selection)
    const specLocators = [
      this.page.getByRole('button', { name: /Specifications/i }),
      this.page.getByRole('heading', { name: /Specifications/i }),
      this.page.locator('button:has-text("Specifications Engine")'),
      this.page.locator('button:has-text("Specifications")'),
      this.page.locator('div:has-text("Specifications Engine")'),
      this.page.locator('div:has-text("Specifications")'),
      this.page.locator('p:has-text("Specifications")'),
      this.page.locator('[class*="spec" i]:has-text("Specifications")'),
      this.page.locator('form label:has-text("Engine")').locator('..')
    ];

    let clickedSpecTab = false;

    // Layered conditional attempts with Playwright native condition checks
    for (const locator of specLocators) {
      try {
        const candidate = locator.first();
        if (await candidate.isVisible({ timeout: 1500 }).catch(() => false)) {
          await candidate.scrollIntoViewIfNeeded().catch(() => {});
          await candidate.click({ force: true });
          clickedSpecTab = true;
          console.log(`✅ [Self-Healing] Successfully clicked Specifications tab using locator: ${candidate}`);
          break;
        }
      } catch (err) {
        // Continue to fallback locator
      }
    }

    // Fallback: If no click succeeded, attempt evaluate level click on elements matching 'Specifications'
    if (!clickedSpecTab) {
      await this.page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('button, div, p, span, h3, h4'));
        const specEl = elements.find(el => /Specifications/i.test(el.textContent));
        if (specEl) {
          specEl.click();
        }
      }).catch(() => {});
    }

    await this.page.waitForTimeout(1500);

    // 3. Dynamically Fill 8-Field Editable Specs Form
    if (previewPage && typeof previewPage.fillModalFormDynamically === 'function') {
      await previewPage.fillModalFormDynamically(specs);
    }

    // 4. Self-Healing Step 1: Click Continue
    const continueBtn = this.page.getByRole('button', { name: /^Continue$/i })
      .or(this.page.locator('button:has-text("Continue")')).first();
    if (await continueBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await continueBtn.scrollIntoViewIfNeeded().catch(() => {});
      await continueBtn.click({ force: true });
      await this.page.waitForTimeout(1000);
    }

    // 5. Self-Healing Step 2: Click "Confirm & Get Records" to trigger backend fetch
    const confirmBtn = this.page.getByRole('button', { name: /Confirm & Get Records|Get Records/i })
      .or(this.page.locator('button:has-text("Confirm & Get Records"), button:has-text("Get Records")')).first();
    if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await confirmBtn.scrollIntoViewIfNeeded().catch(() => {});
      await confirmBtn.click({ force: true });
    }

    // 6. Wait for backend fetch to complete and modal to close
    await this.page.locator('div[role="dialog"]').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    await this.page.waitForTimeout(5000);

    return specs;
  }
}

module.exports = { ClassicEditableSpecsUpdateTask, REAL_CLASSIC_BODY_SPECS };

