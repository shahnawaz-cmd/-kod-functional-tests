// tasks/exit_popup_behaviour.ts
import { Page, BrowserContext, expect, test } from '@playwright/test';
import { Actor } from '../actors/Actor';

/**
 * Task: ExitPopupBehaviour
 * Encapsulates business logic to verify that clicking sample links
 * (e.g., View Sample Report, View Sample Window Sticker) opens them in a new tab,
 * and upon returning to the preview page, the exit intent pop-up does NOT trigger.
 *
 * Rule:
 * - If exit intent popup triggers -> Fail the case.
 * - If exit intent popup does NOT trigger -> Pass the case.
 */
export class ExitPopupBehaviour {
  private timeout: number;

  constructor(timeout: number = 15000) {
    this.timeout = timeout;
  }

  async performAs(actorOrPage: Actor | Page | any, context?: BrowserContext): Promise<void> {
    const page: Page = (actorOrPage && typeof actorOrPage.getPage === 'function')
      ? actorOrPage.getPage()
      : (actorOrPage?.page || actorOrPage);

    const ctx: BrowserContext = context || page.context();

    await test.step('Step 1: Locate and verify sample links on preview page', async () => {
      console.log('🔍 [ExitPopupBehaviour] Looking for sample links on preview page...');

      // Smart wait for preview page content to be stable
      await page.waitForLoadState('domcontentloaded');

      const sampleReportLink = page.locator(
        'a:has-text("View Sample Report"), ' +
        'a:has-text("Sample Report"), ' +
        'a[href*="/report/vin/"], ' +
        'a[href*="/report/"]'
      ).first();

      const sampleStickerLink = page.locator(
        'a:has-text("View Sample Window Sticker"), ' +
        'a:has-text("View sample sticker"), ' +
        'a:has-text("Sample Window Sticker"), ' +
        'a[href*="/sticker/vin/"], ' +
        'a[href*="/sticker/"]'
      ).first();

      // Ensure at least one sample link is visible using Playwright native smart wait
      await Promise.race([
        sampleReportLink.waitFor({ state: 'visible', timeout: this.timeout }).catch(() => null),
        sampleStickerLink.waitFor({ state: 'visible', timeout: this.timeout }).catch(() => null)
      ]);

      const isReportLinkVisible = await sampleReportLink.isVisible().catch(() => false);
      const isStickerLinkVisible = await sampleStickerLink.isVisible().catch(() => false);

      expect(
        isReportLinkVisible || isStickerLinkVisible,
        'Expected at least one sample link (Sample Report or Sample Sticker) to be visible on the preview page'
      ).toBe(true);

      console.log(`ℹ️ [ExitPopupBehaviour] Sample Report Link visible: ${isReportLinkVisible}, Sample Sticker Link visible: ${isStickerLinkVisible}`);
    });

    await test.step('Step 2: Click sample link and verify it opens in a new tab', async () => {
      const sampleReportLink = page.locator(
        'a:has-text("View Sample Report"), ' +
        'a:has-text("Sample Report"), ' +
        'a[href*="/report/vin/"], ' +
        'a[href*="/report/"]'
      ).first();

      const sampleStickerLink = page.locator(
        'a:has-text("View Sample Window Sticker"), ' +
        'a:has-text("View sample sticker"), ' +
        'a:has-text("Sample Window Sticker"), ' +
        'a[href*="/sticker/vin/"], ' +
        'a[href*="/sticker/"]'
      ).first();

      const targetLink = (await sampleReportLink.isVisible().catch(() => false))
        ? sampleReportLink
        : sampleStickerLink;

      // Scroll link into view
      await targetLink.scrollIntoViewIfNeeded().catch(() => {});

      console.log('🔗 [ExitPopupBehaviour] Clicking sample link and waiting for new page event...');

      // Playwright native smart wait for new tab/window event
      const [newPage] = await Promise.all([
        ctx.waitForEvent('page', { timeout: this.timeout }),
        targetLink.click({ force: true })
      ]);

      expect(newPage, 'Sample link must open in a new Tab').toBeDefined();

      // Wait for new tab DOM to be loaded
      await newPage.waitForLoadState('domcontentloaded');
      const newPageUrl = newPage.url();
      console.log(`✅ [ExitPopupBehaviour] Sample link successfully opened in new Tab: ${newPageUrl}`);

      // Verify the URL represents a sample report or sticker
      expect(newPageUrl).toMatch(/.*(report|sticker|sample).*/i);

      // Close the sample tab
      await newPage.close();
      console.log('🔒 [ExitPopupBehaviour] Sample tab closed successfully.');
    });

    await test.step('Step 3: Return to preview page and verify exit intent pop-up does NOT trigger', async () => {
      // Bring original preview page back to front
      await page.bringToFront();
      console.log('🔄 [ExitPopupBehaviour] Back on preview page. Verifying exit pop-up does NOT trigger...');

      // Playwright native smart wait check: Exit popup must NOT be visible
      const exitPopupLocators = page.locator(
        'button:has-text("Redeem 15% off"), ' +
        'button:has-text("Claim 15% Off"), ' +
        'button:has-text("Click here to redeem instantly"), ' +
        'button:has-text("Take 15% off"), ' +
        '[role="dialog"]:has-text("15%"), ' +
        '[role="dialog"]:has-text("Redeem"), ' +
        '[role="dialog"]:has-text("Claim")'
      );

      let isPopupTriggered = false;
      try {
        // Wait up to 3 seconds using native smart wait to ensure no popup appears upon returning
        await exitPopupLocators.first().waitFor({ state: 'visible', timeout: 3000 });
        isPopupTriggered = true;
      } catch (e) {
        // Timeout reached -> popup did NOT trigger (expected!)
        isPopupTriggered = false;
      }

      // Assert business logic rule:
      // If triggered -> Fail the case.
      // If NOT triggered -> Pass the case.
      expect(
        isPopupTriggered,
        'Exit intent pop-up MUST NOT be triggered upon returning to preview page after sample links!'
      ).toBe(false);

      console.log('✅ [ExitPopupBehaviour PASSED] Exit intent pop-up did NOT trigger upon returning to preview. Case verified.');
    });
  }
}

// Aliases for flexible imports
export const ExitPopupBehaviourTask = ExitPopupBehaviour;
export default ExitPopupBehaviour;
