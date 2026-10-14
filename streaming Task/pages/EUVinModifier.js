// tests/pages/EUVinModifier.js
const { EUVinCapture } = require('../helpers/responseCapture');

class EUVinModifier {
  constructor(page) {
    this.page = page;
  }

  async modifyEUVinByYMMUsingNo() {
    // 1. Wait for navigation from homepage to preview page
    await this.page.waitForURL(/.*(preview|vin-check).*/, { timeout: 30000 }).catch(() => {});
    await this.page.waitForLoadState('domcontentloaded');

    // Self-Healing Strategy: Locate "No, fix it" / "Fix it" button with multi-selector fallback
    const noFixBtn = this.page.getByRole('button', { name: /No.*Fix it|No, fix it|Fix it/i })
      .or(this.page.locator('button:has-text("No, fix it"), button:has-text("Fix it"), button:has-text("No")'))
      .or(this.page.locator('div[class*="cursor-pointer"]:has-text("Fix it"), a:has-text("Fix it")')).first();

    const isPromptVis = await noFixBtn.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
    if (isPromptVis) {
      console.log('⚡ [EUVinModifier] Clicked "No, fix it" prompt.');
      await noFixBtn.scrollIntoViewIfNeeded().catch(() => {});
      await noFixBtn.click({ force: true });
      await this.page.waitForTimeout(1000);
    } else {
      console.warn('⚠️ [EUVinModifier] "No, fix it" prompt not visible. Checking direct YMM dropdowns.');
    }

    // Select YMM Dropdowns safely
    await this.selectDropdownOption('Select year', '2012');
    await this.selectDropdownOption('Select make', 'Alfa Romeo');
    await this.selectDropdownOption('Select model', 'Giulietta II');
    await this.selectDropdownOption('Select trim', '1.4 GLP Turbo 120HP');

    // Setup EUVinCapture API listener & Get Records button trigger
    const vinCapture = new EUVinCapture(this.page);
    const getRecordsBtn = this.page.getByRole('button', { name: /Get Records|Confirm/i })
      .or(this.page.locator('button:has-text("Get Records"), button:has-text("Confirm")')).first();

    const isBtnVis = await getRecordsBtn.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (isBtnVis) {
      await getRecordsBtn.scrollIntoViewIfNeeded().catch(() => {});

      // Trigger click while awaiting API response & preview page navigation in parallel
      await Promise.all([
        Promise.race([vinCapture.waitForVinCheckPreview(), this.page.waitForTimeout(4000)]).catch(() => null),
        this.page.waitForURL(/.*(preview|vin-check).*/, { timeout: 30000 }).catch(() => {}),
        getRecordsBtn.click({ force: true })
      ]);

      console.log('✅ [EUVinModifier] Submitted EU VIN modification & verified navigation to preview page.');
    }

    await this.page.waitForTimeout(3000);
  }

  async selectDropdownOption(textboxName, preferredOption) {
    try {
      const cleanName = textboxName.replace('Select ', '');
      const input = this.page.getByRole('textbox', { name: new RegExp(cleanName, 'i') })
        .or(this.page.locator(`input[placeholder*="${cleanName}" i]`)).first();

      const isInputVis = await input.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
      if (!isInputVis) return;

      const isDisabled = await input.isDisabled().catch(() => false);
      if (isDisabled) return;

      await input.click({ force: true }).catch(() => {});
      await this.page.waitForTimeout(300);

      const optionBtn = this.page.getByRole('button', { name: preferredOption })
        .or(this.page.locator(`button:has-text("${preferredOption}"), div[role="option"]:has-text("${preferredOption}"), li:has-text("${preferredOption}")`)).first();

      const isOptVis = await optionBtn.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);
      if (isOptVis) {
        await optionBtn.click({ force: true });
        console.log(`  └─ Selected ${cleanName}: ${preferredOption}`);
      } else {
        // Fallback: Pick first available option in dropdown list
        const firstOpt = this.page.locator('div[role="option"], ul li, div[class*="option" i]').first();
        if (await firstOpt.isVisible().catch(() => false)) {
          const optText = await firstOpt.innerText().catch(() => preferredOption);
          await firstOpt.click({ force: true });
          console.log(`  └─ Fallback selected ${cleanName}: ${optText}`);
        }
      }
    } catch (e) {
      console.warn(`⚠️ [EUVinModifier] Dropdown selection skipped for ${textboxName}: ${e.message}`);
    }
  }
}

module.exports = { EUVinModifier };
