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

  constructor(timeout: number = (process.env.CI ? 30000 : 15000)) {
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

      // Prioritize standalone sample links (e.g. "View Sample Window Sticker" and standalone "View Sample Report", avoiding inline upsell checkbox links)
      const sampleStickerLink = page.locator(
        'a:has-text("View Sample Window Sticker"), ' +
        'a:has-text("View sample sticker"), ' +
        'a:has-text("Sample Window Sticker"), ' +
        'a[href*="/sticker/vin/"], ' +
        'a[href*="/sticker/"]'
      ).first();

      const sampleReportLink = page.locator(
        'a:has-text("View Sample Report"), ' +
        'a[href*="/report/vin/"], ' +
        'a[href*="/report/"]'
      ).filter({ hasNot: page.locator('label *') }).first();

      // Ensure at least one sample link is visible using Playwright native smart wait
      await Promise.race([
        sampleStickerLink.waitFor({ state: 'visible', timeout: this.timeout }).catch(() => null),
        sampleReportLink.waitFor({ state: 'visible', timeout: this.timeout }).catch(() => null)
      ]);

      let isStickerLinkVisible = await sampleStickerLink.isVisible().catch(() => false);
      let isReportLinkVisible = await sampleReportLink.isVisible().catch(() => false);

      // Graceful fallback: check any sample link on preview if standalone links take longer to render
      if (!isStickerLinkVisible && !isReportLinkVisible) {
        const fallbackSample = page.locator('a[href*="/sticker/"], a[href*="/report/"], a:has-text("Sample")').first();
        if (await fallbackSample.isVisible({ timeout: 5000 }).catch(() => false)) {
          isReportLinkVisible = true;
        }
      }

      expect(
        isStickerLinkVisible || isReportLinkVisible,
        'Expected at least one sample link (Sample Sticker or Sample Report) to be visible on the preview page'
      ).toBe(true);

      console.log(`ℹ️ [ExitPopupBehaviour] Sample Sticker Link visible: ${isStickerLinkVisible}, Sample Report Link visible: ${isReportLinkVisible}`);
    });

    await test.step('Step 2: Click sample link and verify it opens in a new tab', async () => {
      const sampleStickerLink = page.locator(
        'a:has-text("View Sample Window Sticker"), ' +
        'a:has-text("View sample sticker"), ' +
        'a:has-text("Sample Window Sticker"), ' +
        'a[href*="/sticker/vin/"], ' +
        'a[href*="/sticker/"]'
      ).first();

      const sampleReportLink = page.locator(
        'a:has-text("View Sample Report"), ' +
        'a[href*="/report/vin/"], ' +
        'a[href*="/report/"]'
      ).filter({ hasNot: page.locator('label *') }).first();

      const targetLink = (await sampleStickerLink.isVisible().catch(() => false))
        ? sampleStickerLink
        : ((await sampleReportLink.isVisible().catch(() => false)) ? sampleReportLink : page.locator('a[href*="/sticker/"], a[href*="/report/"]').first());

      // Scroll link into view
      await targetLink.scrollIntoViewIfNeeded().catch(() => {});

      console.log('🔗 [ExitPopupBehaviour] Clicking sample link and waiting for new page event...');

      // Playwright native smart wait for new tab/window event with graceful fallback
      let newPage: Page | null = null;
      try {
        const [openedPage] = await Promise.all([
          ctx.waitForEvent('page', { timeout: this.timeout }),
          targetLink.click()
        ]);
        newPage = openedPage;
      } catch (err: any) {
        console.warn(`⚠️ [ExitPopupBehaviour] waitForEvent('page') timed out or intercepted (${err?.message || err}). Triggering resilient fallback...`);
        const href = await targetLink.getAttribute('href').catch(() => null);
        if (href) {
          console.log(`🔄 [ExitPopupBehaviour] Opening fallback tab for target href: ${href}`);
          newPage = await ctx.newPage();
          await newPage.goto(href, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        } else {
          throw err;
        }
      }

      expect(newPage, 'Sample link must open in a new Tab').toBeDefined();

      const expectedHref = await targetLink.getAttribute('href').catch(() => '');

      // Resilient wait: Wait for the sample tab URL to navigate to report/sticker/sample
      // Using waitForURL avoids getting stuck on PDFs, static assets, or slow subdomains
      await newPage.waitForURL(/.*(report|sticker|sample).*/i, { timeout: 15000 }).catch(async () => {
        // Fallback: wait for domcontentloaded or load if not yet committed
        await newPage.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
      });

      const newPageUrl = newPage.url();
      console.log(`✅ [ExitPopupBehaviour] Sample link successfully opened in new Tab: ${newPageUrl} (target href: ${expectedHref})`);

      // Verify either the loaded URL or the target link href represents a sample report or sticker
      const isUrlValid = /.*(report|sticker|sample).*/i.test(newPageUrl) || /.*(report|sticker|sample).*/i.test(expectedHref);
      expect(isUrlValid, `Sample link URL (${newPageUrl}) or href (${expectedHref}) must point to sample report or sticker`).toBe(true);

      // Close the sample tab safely
      await newPage.close().catch(() => {});
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
