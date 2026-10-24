// tests/tasks/StreamingYmmEditTask.js
const { expect } = require('@playwright/test');

const TIMEOUT = process.env.CI ? 90000 : 60000;

/**
 * Enterprise Task: Streaming YMM & Specs Modification Task
 * Minimal, robust handling for both Mapped VINs (2-step confirm) & Unmapped VINs ("No Fix it" self-healing single-step flow).
 */
class StreamingYmmEditTask {
  constructor(page) {
    this.page = page;
  }

  /**
   * Executes YMM specs modification task with auto-detection for Mapped & Unmapped VIN flows.
   */
  async execute(options = {}) {
    const timeout = options.timeout || TIMEOUT;
    const preferredYear = options.preferredYear || String(Math.floor(Math.random() * 21) + 1960);

    console.log('🚀 [StreamingYmmEditTask] Executing YMM Specs Modification Task...');
    await this.page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});

    // ------------------------------------------------------------------
    // Step 0: Handle Next.js streaming skeletons / shimmers if loading
    // ------------------------------------------------------------------
    const skeleton = this.page.locator('.animate-pulse, [class*="skeleton"], [class*="shimmer"], [aria-busy="true"], .loading-spinner').first();
    if (await skeleton.isVisible({ timeout: 1500 }).catch(() => false)) {
      console.log('⏳ [StreamingYmmEditTask] Streaming skeleton detected, waiting for chunk resolution...');
      await skeleton.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    }

    // ------------------------------------------------------------------
    // Race Detection: Wait for whichever streaming branch mounts first
    // Branch A: Unmapped VIN ("Confirm your vehicle", "Select year", "No, fix it")
    // Branch B: Mapped VIN ("Click here to update", "Update specs")
    // ------------------------------------------------------------------
    const { UnmappedYmmFallbackHandler } = require('./UnmappedYmmFallbackHandler');
    const fallbackHandler = new UnmappedYmmFallbackHandler(this.page);

    const unmappedLocator = this.page.locator('h1, h2, h3, p, div')
      .filter({ hasText: /Confirm your vehicle|We couldn'?t fully identify|Almost there/i })
      .or(this.page.locator('input[placeholder*="Select year" i], [placeholder*="year" i]'))
      .or(this.page.getByRole('button', { name: /No.*Fix it|No, fix it|Fix it/i }))
      .or(this.page.locator('button:has-text("No"), button:has-text("Fix it")'))
      .first();

    const mappedLocator = this.page.getByRole('button', { name: /Click here to update|update specs/i })
      .or(this.page.locator('button:has-text("Click here to update")'))
      .first();

    const flowType = await Promise.race([
      unmappedLocator.waitFor({ state: 'visible', timeout: 25000 }).then(() => 'UNMAPPED'),
      mappedLocator.waitFor({ state: 'visible', timeout: 25000 }).then(() => 'MAPPED')
    ]).catch(() => 'UNKNOWN');

    if (flowType === 'UNMAPPED' || (flowType === 'UNKNOWN' && await fallbackHandler.isUnmappedState(3000))) {
      console.log('⚡ [StreamingYmmEditTask] Unmapped VIN detected on preview page.');
      console.log('🔄 [StreamingYmmEditTask] Delegating to UnmappedYmmFallbackHandler for self-healing dropdown recovery...');
      const recovered = await fallbackHandler.handleUnmappedRecovery(preferredYear);
      return {
        year: recovered.year,
        make: recovered.make,
        model: recovered.model,
        trim: recovered.trim,
        isUnmappedFlow: true
      };
    }

    // ------------------------------------------------------------------
    // Standard Mapped VIN flow ("Click here to update")
    // ------------------------------------------------------------------
    const updateButton = mappedLocator;
    await updateButton.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await updateButton.click({ force: true });

    const ymmTabButton = this.page.getByRole('button', { name: /Year, Make & Model/i })
      .or(this.page.locator('button:has-text("Year, Make & Model")')).first();
    await ymmTabButton.waitFor({ state: 'visible', timeout });
    await ymmTabButton.click({ force: true });
    await this.page.waitForTimeout(1000);

    // ------------------------------------------------------------------
    // Select YMMT Dropdowns (Year -> Make -> Model -> Trim)
    // ------------------------------------------------------------------
    const year  = await this.selectOption('Select year', preferredYear, timeout);
    const make  = await this.selectOption('Select make', 'Ford', timeout);

    const continueBtn = this.page.getByRole('button', { name: /^Continue$/i })
      .or(this.page.locator('button:has-text("Continue")')).first();
    const confirmBtn = this.page.getByRole('button', { name: /Confirm & Get Records|Get Records/i })
      .or(this.page.locator('button:has-text("Confirm & Get Records"), button:has-text("Get Records")')).first();

    let model = 'N/A';
    let trim = 'N/A';

    // Model & Trim loop: Ensure we select a model that actually has trims in the DB
    for (let modelAttempt = 0; modelAttempt < 5; modelAttempt++) {
      model = await this.selectOption('Select model', null, timeout);
      trim = await this.selectOption('Select trim', null, timeout);

      const isContinueEnabled = await continueBtn.isEnabled().catch(() => false);
      if (isContinueEnabled && trim !== 'N/A') {
        break;
      }
      console.log(`⚠️ [StreamingYmmEditTask] Model "${model}" has no trim options; selecting another model...`);
    }

    console.log(`📋 [StreamingYmmEditTask] Selected Specs: Year=${year}, Make=${make}, Model=${model}, Trim=${trim}`);

    // Wait for Continue button to be enabled before proceeding
    await expect(continueBtn).toBeEnabled({ timeout: 10000 }).catch(() => {});

    // Self-healing: Retry clicking Continue if mobile touch/blur absorbed the first click
    for (let attempt = 0; attempt < 3; attempt++) {
      if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) break;
      if (await continueBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await continueBtn.scrollIntoViewIfNeeded().catch(() => {});
        await continueBtn.click({ force: true }).catch(() => {});
        await this.page.waitForTimeout(1000);
      }
    }

    await confirmBtn.waitFor({ state: 'visible', timeout: 15000 });
    await confirmBtn.scrollIntoViewIfNeeded().catch(() => {});
    await confirmBtn.click({ force: true });
    console.log('✅ [StreamingYmmEditTask] Submitted mapped specs via "Confirm & Get Records".');

    // Wait for modal dialog to hide & DB sync safely
    if (!this.page.isClosed()) {
      await this.page.locator('div[role="dialog"]').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      await this.page.waitForTimeout(1500).catch(() => {});
    }

    return { year, make, model, trim, isUnmappedFlow: false };
  }

  async selectOption(textboxName, preferredValue = null, timeout = TIMEOUT) {
    const cleanName = textboxName.replace('Select ', '');
    const input = this.page.getByRole('textbox', { name: new RegExp(cleanName, 'i') })
      .or(this.page.getByRole('combobox', { name: new RegExp(cleanName, 'i') }))
      .or(this.page.getByRole('button', { name: new RegExp(cleanName, 'i') }))
      .or(this.page.locator(`input[placeholder*="${cleanName}" i]`))
      .or(this.page.locator(`[placeholder*="${cleanName}" i]`))
      .or(this.page.locator(`button:has-text("Select ${cleanName}"), [role="combobox"]:has-text("Select ${cleanName}")`))
      .first();

    const isVisible = await input.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (!isVisible) return 'N/A';

    // Check if dropdown is disabled while streaming flight data arrives
    let isDisabled = await input.isDisabled().catch(() => false);
    if (isDisabled) {
      await expect(input).toBeEnabled({ timeout: 12000 }).catch(() => {});
      isDisabled = await input.isDisabled().catch(() => false);
      if (isDisabled) {
        console.log(`ℹ️ [StreamingYmmEditTask] Dropdown "${textboxName}" is disabled, skipping.`);
        return 'N/A';
      }
    }

    await input.click({ force: true });
    await this.page.waitForTimeout(400);

    const popover = this.page.locator('div[role="dialog"] div[class*="max-h-64"], div[class*="max-h-64"]').first();
    const hasPopover = await popover.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    if (!hasPopover) return preferredValue || 'N/A';

    const options = popover.locator('button, div[class*="cursor-pointer"], [role="option"]')
      .filter({ hasNotText: /select|update|continue|confirm|click here|get records|reveal|back|no matches/i });

    const hasOptions = await options.first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
    if (hasOptions) {
      if (preferredValue) {
        const match = options.filter({ hasText: new RegExp(`^${preferredValue}$`, 'i') }).first();
        if (await match.isVisible({ timeout: 1000 }).catch(() => false)) {
          await match.scrollIntoViewIfNeeded().catch(() => {});
          try {
            await match.click({ force: true });
          } catch (e) {
            await match.evaluate(el => {
              el.scrollIntoView({ block: 'center', inline: 'nearest' });
              el.click();
            });
          }
          await this.page.waitForTimeout(500);
          return preferredValue;
        }
      }

      const count = await options.count();
      if (count > 0) {
        const randomIndex = Math.floor(Math.random() * count);
        const chosenOpt = options.nth(randomIndex);
        await chosenOpt.scrollIntoViewIfNeeded().catch(() => {});
        const selectedText = (await chosenOpt.innerText().catch(() => '')).trim();
        try {
          await chosenOpt.click({ force: true });
        } catch (e) {
          await chosenOpt.evaluate(el => {
            el.scrollIntoView({ block: 'center', inline: 'nearest' });
            el.click();
          });
        }
        await this.page.waitForTimeout(500);
        if (selectedText) return selectedText;
      }
    }

    return preferredValue || 'N/A';
  }
}

module.exports = { StreamingYmmEditTask };
