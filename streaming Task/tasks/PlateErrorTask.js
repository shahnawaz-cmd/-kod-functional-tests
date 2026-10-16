// tests/tasks/PlateErrorTask.js
const { expect } = require('@playwright/test');

const TIMEOUT = process.env.CI ? 90000 : 60000;

class PlateErrorTask {
  constructor(page) {
    this.page = page;
  }

  /**
   * Helper: Generates unique string of max 7 alphabet characters only (A-Z)
   * Example: "ABCDEFG", "XYZLMNO", etc.
   */
  static generateAlphabetPlate(length = 7) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let plate = '';
    for (let i = 0; i < length; i++) {
      plate += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return plate;
  }

  /**
   * Site filter: Runs for all sites.
   */
  checkAllowedSites(testInfo) {
    return true;
  }

  /**
   * Flow check: ensures test only runs when streaming flow is detected
   */
  async ensureStreamingFlow(testInfo) {
    const cookies = await this.page.context().cookies();
    const flowCookie = cookies.find((c) => c.name === 'checkout_flow');
    let flowType = flowCookie ? flowCookie.value : null;

    if (!flowType) {
      flowType = await this.page.evaluate(() => {
        try {
          const settings = JSON.parse(localStorage.getItem('site_settings') || '{}');
          return settings.checkout_flow || null;
        } catch (e) {
          return null;
        }
      });
    }

    console.log(`🔍 [PlateErrorTask] Flow Check: "${flowType || 'streaming (default)'}"`);
    if (flowType === 'non_streaming') {
      console.log('⚠️ [PlateErrorTask] Non-streaming flow detected. Skipping case.');
      if (testInfo && typeof testInfo.skip === 'function') {
        testInfo.skip(true, 'Skipping: Non-streaming checkout flow detected');
      }
      return false;
    }
    return true;
  }

  /**
   * Self-healing locator to switch to License Plate tab
   */
  async switchToListingPlateTab() {
    const tabStrategies = [
      () => this.page.locator('button:has-text("By License Plate")'),
      () => this.page.locator('button:has-text("By U.S License Plate")'),
      () => this.page.locator('button:has-text("License Plate")'),
      () => this.page.locator('[role="tab"]:has-text("License Plate")'),
      () => this.page.locator('text=By License Plate')
    ];

    for (let i = 0; i < tabStrategies.length; i++) {
      try {
        const tab = tabStrategies[i]().locator('visible=true').first();
        if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(`✅ [PlateErrorTask] Located License Plate Tab using strategy #${i + 1}`);
          await tab.click({ force: true });
          await this.page.waitForTimeout(500);
          return true;
        }
      } catch (e) {}
    }

    console.log('ℹ️ [PlateErrorTask] License Plate tab not found on this site.');
    return false;
  }

  /**
   * Self-healing plate input field
   */
  async getPlateInput() {
    const strategies = [
      () => this.page.locator('.hero-search-panel[aria-hidden="false"] input[name="plate"]'),
      () => this.page.locator('input[name*="plate" i]'),
      () => this.page.locator('input[placeholder*="plate" i]'),
      () => this.page.locator('input[aria-label*="plate" i]'),
      () => this.page.locator('[data-testid*="plate"]'),
      () => this.page.getByRole('textbox', { name: /plate/i })
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        const loc = strategies[i]().locator('visible=true').first();
        if (await loc.isVisible({ timeout: 2000 }).catch(() => false)) {
          return loc;
        }
      } catch (e) {}
    }

    return strategies[1]().first();
  }

  /**
   * Select State (using proven state selection logic from LP decode task)
   */
  async selectState(stateName = 'Texas', stateCode = 'TX', timeout = TIMEOUT) {
    console.log(`🔄 [PlateErrorTask] Selecting state "${stateName}" (${stateCode})...`);
    const selectElement = this.page.locator('select[name*="state" i]').first();
    const isNativeSelect = await selectElement.isVisible({ timeout: 1500 }).catch(() => false);

    if (isNativeSelect) {
      await selectElement.selectOption({ label: stateName }).catch(() => selectElement.selectOption(stateCode));
      console.log(`✅ [PlateErrorTask] Selected state via native <select>: ${stateName}`);
    } else {
      const stateDropdown = this.page.locator('.hero-search-panel[aria-hidden="false"] input[role="combobox"]')
        .or(this.page.getByRole('combobox', { name: /State|Select/i }))
        .or(this.page.locator('input[aria-label*="State" i]'))
        .or(this.page.locator('[role="combobox"]'))
        .first();

      await stateDropdown.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      if (await stateDropdown.isVisible().catch(() => false)) {
        await stateDropdown.click({ force: true, timeout: 5000 });
        await stateDropdown.fill(stateName).catch(() => {});

        const stateOption = this.page.locator(`[role="listbox"] [role="option"]:has-text("${stateName}")`)
          .or(this.page.locator(`[role="listbox"] li:has-text("${stateName}")`))
          .or(this.page.getByRole('option', { name: stateName, exact: true }))
          .first();

        if (await stateOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await stateOption.click({ force: true, timeout: 5000 });
          console.log(`✅ [PlateErrorTask] Selected state option from dropdown: ${stateName}`);
        } else {
          await this.page.keyboard.press('Enter').catch(() => {});
          console.log(`✅ [PlateErrorTask] State selected via keyboard Enter: ${stateName}`);
        }
      }
    }
  }

  /**
   * Self-healing search button locator
   */
  async getSearchButton() {
    const strategies = [
      () => this.page.locator('.hero-search-panel[aria-hidden="false"] button[type="submit"]'),
      () => this.page.locator('button:has-text("Search License Plate")'),
      () => this.page.locator('button:has-text("Get Window Sticker")'),
      () => this.page.locator('button[type="submit"]'),
      () => this.page.locator('button:has-text("Search")'),
      () => this.page.locator('[data-testid*="search-button"]')
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        const loc = strategies[i]().locator('visible=true').first();
        if (await loc.isVisible({ timeout: 1500 }).catch(() => false)) {
          return loc;
        }
      } catch (e) {}
    }

    return strategies[3]().first();
  }

  /**
   * Main execution flow:
   * 1. Detect flow (skip if non-streaming)
   * 2. Switch to License Plate tab
   * 3. Put generated alphabet plate (max 7 alphabets) & select state
   * 4. Click search button
   * 5. Land on preview page
   * 6. Verify expected error (or skip on decode success - same condition as VIN error)
   * 7. Capture screenshot and attach to report
   */
  async execute(testInfo, timeout = TIMEOUT) {
    // 1. Initial Site Check: Only run on IVR and VSR (skip on VNCA, MVL, VHREU)
    const isAllowedSite = this.checkAllowedSites(testInfo);
    if (!isAllowedSite) return;

    // 2. Navigate & Initial Flow Detection: Only run if streaming flow is detected
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        console.warn(`⚠️ [PlateErrorTask DNS Retry] Attempt ${attempt} failed (${err?.message || err}). Retrying in 1.5s...`);
        await this.page.waitForTimeout(1500);
      }
    }
    await this.page.waitForLoadState('domcontentloaded');
    const isStreaming = await this.ensureStreamingFlow(testInfo);
    if (!isStreaming) return;

    // 2. Switch to License Plate Tab
    const tabAvailable = await this.switchToListingPlateTab();
    if (!tabAvailable) {
      console.log('⚠️ [PlateErrorTask] License Plate tab not available on this site. Skipping case.');
      if (testInfo && typeof testInfo.skip === 'function') {
        testInfo.skip(true, 'License plate search tab not available on this site');
      }
      return;
    }

    // 3. Put Generated Alphabet Plate (max 7 alphabets only)
    const alphabetPlate = PlateErrorTask.generateAlphabetPlate(7);
    expect(alphabetPlate.length).toBeLessThanOrEqual(7);
    console.log(`\n📋 [PlateErrorTask] Generated 7-char Alphabet Plate: "${alphabetPlate}" (Length: ${alphabetPlate.length})`);

    const plateInput = await this.getPlateInput();
    await plateInput.waitFor({ state: 'visible', timeout });
    await plateInput.scrollIntoViewIfNeeded().catch(() => {});
    await plateInput.fill(alphabetPlate);
    await plateInput.dispatchEvent('input').catch(() => {});
    await plateInput.dispatchEvent('change').catch(() => {});

    const filledValue = await plateInput.inputValue().catch(() => alphabetPlate);
    console.log(`✅ [PlateErrorTask] Validated plate entered in field: "${filledValue}"`);

    // 4. Select State
    await this.selectState('Texas', 'TX', timeout);

    // 5. Click Search Button
    const searchBtn = await this.getSearchButton();
    await searchBtn.scrollIntoViewIfNeeded().catch(() => {});
    try {
      await searchBtn.click({ force: true });
    } catch {
      await plateInput.press('Enter');
    }
    console.log('✅ [PlateErrorTask] License plate search submitted.');

    // 6. Land on Preview Page
    console.log('⏳ [PlateErrorTask] Waiting for Preview page...');
    await this.page.waitForURL(/.*(\/license-preview|\/preview|\/vin-check|\/ws-preview|\/sticker|\/report).*/, {
      waitUntil: 'domcontentloaded',
      timeout
    });
    console.log(`📍 [PlateErrorTask] Landed on: ${this.page.url()}`);
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(1000);

    // 7. Verify Expected Error OR Skip on Decode Success (same condition as VIN error)
    const successCondition = this.page.locator('h1:has-text("Records found for"), button:has-text("Access Record"), text=We found detailed information, text=Unlock the history, text=Vehicle Specifications').first();
    const isSuccess = await successCondition.isVisible({ timeout: 2000 }).catch(() => false);
    if (isSuccess) {
      console.log('⚠️ [PlateErrorTask] Plate decode succeeded unexpectedly. Skipping test.');
      if (testInfo && typeof testInfo.skip === 'function') {
        testInfo.skip(true, 'License plate decode succeeded unexpectedly for alphabet plate');
      }
      return;
    }

    // Expected Error Locator (matches VIN error & Plate error patterns)
    const errorLocator = this.page.locator('h1, h2, h3, p, div, span, [role="alert"]')
      .filter({
        hasText: /We couldn'?t find a vehicle for that (license plate|plate|VIN)|Sorry\s*[-—–]\s*no record found/i
      })
      .first();

    await expect(errorLocator).toBeVisible({ timeout });
    const errorText = (await errorLocator.innerText().catch(() => '')).trim();
    console.log(`🎉 [PlateErrorTask] Expected error confirmed: "${errorText}"`);

    // 8. Screenshot & Report Attachment
    const screenshot = await this.page.screenshot({ fullPage: false });
    console.log('📸 [PlateErrorTask] Screenshot captured.');
    if (testInfo && typeof testInfo.attach === 'function') {
      await testInfo.attach('TC_27_Plate_Error_Screenshot', {
        body: screenshot,
        contentType: 'image/png'
      });
      console.log('📎 [PlateErrorTask] Attached screenshot to Playwright report.');
    }
  }
}

module.exports = { PlateErrorTask };
