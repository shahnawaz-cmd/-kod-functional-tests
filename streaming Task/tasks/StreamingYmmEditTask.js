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
    await this.page.waitForLoadState('domcontentloaded');

    // ------------------------------------------------------------------
    // Self-Healing Strategy 1: Check for Unmapped VIN prompt ("No Fix it")
    // ------------------------------------------------------------------
    const noFixBtn = this.page.getByRole('button', { name: /No.*Fix it|No, fix it|Fix it/i })
      .or(this.page.locator('button:has-text("No"), button:has-text("Fix it")'))
      .or(this.page.locator('div[class*="cursor-pointer"]:has-text("Fix it"), a:has-text("Fix it")')).first();

    const isUnmappedPrompt = await noFixBtn.isVisible({ timeout: 4000 }).catch(() => false);
    let isUnmappedFlow = false;

    if (isUnmappedPrompt) {
      console.log('⚡ [StreamingYmmEditTask] Unmapped VIN prompt detected ("No Fix it"). Clicking button...');
      await noFixBtn.scrollIntoViewIfNeeded().catch(() => {});
      await noFixBtn.click({ force: true });
      await this.page.waitForTimeout(1000);
      isUnmappedFlow = true;
    } else {
      // Self-Healing Strategy 2: Standard Mapped VIN flow ("Click here to update")
      const updateButton = this.page.getByRole('button', { name: /Click here to update|update specs/i })
        .or(this.page.locator('button:has-text("Click here to update")')).first();

      await updateButton.waitFor({ state: 'visible', timeout });
      await updateButton.click({ force: true });

      const ymmTabButton = this.page.getByRole('button', { name: /Year, Make & Model/i })
        .or(this.page.locator('button:has-text("Year, Make & Model")')).first();
      await ymmTabButton.waitFor({ state: 'visible', timeout });
      await ymmTabButton.click({ force: true });
      await this.page.waitForTimeout(1000);
    }

    // ------------------------------------------------------------------
    // Select YMMT Dropdowns (Year -> Make -> Model -> Trim)
    // ------------------------------------------------------------------
    const year  = await this.selectOption('Select year', preferredYear, timeout);
    const make  = await this.selectOption('Select make', null, timeout);
    const model = await this.selectOption('Select model', null, timeout);
    const trim  = await this.selectOption('Select trim', null, timeout);

    console.log(`📋 [StreamingYmmEditTask] Selected Specs: Year=${year}, Make=${make}, Model=${model}, Trim=${trim}`);

    // ------------------------------------------------------------------
    // Submit Records Based on Flow Type
    // ------------------------------------------------------------------
    if (isUnmappedFlow) {
      // Unmapped Flow: Single-step "Get Records"
      const getRecordsBtn = this.page.getByRole('button', { name: /Get Records|Confirm/i })
        .or(this.page.locator('button:has-text("Get Records")')).first();
      await getRecordsBtn.waitFor({ state: 'visible', timeout: 15000 });
      await getRecordsBtn.scrollIntoViewIfNeeded().catch(() => {});
      await getRecordsBtn.click({ force: true });
      console.log('✅ [StreamingYmmEditTask] Submitted unmapped specs via "Get Records".');
    } else {
      // Mapped Flow: 2-step ("Continue" -> "Confirm & Get Records")
      const continueBtn = this.page.getByRole('button', { name: /^Continue$/i })
        .or(this.page.locator('button:has-text("Continue")')).first();
      await continueBtn.waitFor({ state: 'visible', timeout: 15000 });
      await continueBtn.scrollIntoViewIfNeeded().catch(() => {});
      await continueBtn.click({ force: true });
      await this.page.waitForTimeout(1000);

      const confirmBtn = this.page.getByRole('button', { name: /Confirm & Get Records|Get Records/i })
        .or(this.page.locator('button:has-text("Confirm & Get Records"), button:has-text("Get Records")')).first();
      await confirmBtn.waitFor({ state: 'visible', timeout: 15000 });
      await confirmBtn.scrollIntoViewIfNeeded().catch(() => {});
      await confirmBtn.click({ force: true });
      console.log('✅ [StreamingYmmEditTask] Submitted mapped specs via "Confirm & Get Records".');
    }

    // Wait for modal dialog to hide & DB sync safely
    if (!this.page.isClosed()) {
      await this.page.locator('div[role="dialog"]').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      await this.page.waitForTimeout(1500).catch(() => {});
    }

    return { year, make, model, trim, isUnmappedFlow };
  }

  async selectOption(textboxName, preferredValue = null, timeout = TIMEOUT) {
    const cleanName = textboxName.replace('Select ', '');
    const input = this.page.getByRole('textbox', { name: new RegExp(cleanName, 'i') })
      .or(this.page.locator(`input[placeholder*="${cleanName}" i]`)).first();

    const isVisible = await input.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (!isVisible) return 'N/A';

    // Check if dropdown is disabled in current DB state (e.g. no trims)
    let isDisabled = await input.isDisabled().catch(() => false);
    if (isDisabled) {
      await expect(input).toBeEnabled({ timeout: 4000 }).catch(() => {});
      isDisabled = await input.isDisabled().catch(() => false);
      if (isDisabled) {
        console.log(`ℹ️ [StreamingYmmEditTask] Dropdown "${textboxName}" is disabled, skipping.`);
        return 'N/A';
      }
    }

    await input.click({ force: true });
    await this.page.waitForTimeout(400);

    const popover = this.page.locator('div[role="dialog"] div[class*="max-h-64"], div[class*="max-h-64"]').first();
    const hasPopover = await popover.waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false);
    if (!hasPopover) return preferredValue || 'N/A';

    const options = popover.locator('button, div[class*="cursor-pointer"], [role="option"]')
      .filter({ hasNotText: /select|update|continue|confirm|click here|get records|reveal|back/i });

    const hasOptions = await options.first().waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);
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
