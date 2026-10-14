// tests/tasks/StreamingRevisitBannerTask.js
const { expect } = require('@playwright/test');

class StreamingRevisitBannerTask {
  async perform(page, previewPage, type = 'vhr') {
    const expectedText = type === 'sticker' ? 'Window sticker found for' : 'Records found for';
    console.log(`🔄 [StreamingRevisitBannerTask] Verifying preview specs visible for text: "${expectedText}"...`);

    // 1. Ensure landing on preview URL
    await page.waitForURL(/.*(preview|vin-check).*/, { timeout: 30000 }).catch(() => {});
    await page.waitForLoadState('load').catch(() => {});

    // 2. Verify preview success condition met
    if (previewPage && typeof previewPage.verifySpecsVisible === 'function') {
      await previewPage.verifySpecsVisible(expectedText);
    } else {
      await page.waitForLoadState('domcontentloaded');
    }

    // 3. Wait for preview page to settle
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    console.log('🔄 [StreamingRevisitBannerTask] Navigating back to base URL using browser back button...');
    
    // 4. Navigate back to base URL using browser back with BFCache fallback
    const isVSR = page.url().includes('vehiclesreport.com');
    const stickerPath = isVSR ? '/window-stickers' : '/window-sticker';
    const targetFallback = type === 'sticker' ? stickerPath : '/';

    try {
      await page.goBack();
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    } catch {
      await page.goto(targetFallback, { waitUntil: 'domcontentloaded' });
    }

    const timeout = process.env.CI ? 90000 : 60000;
    
    // 5. Locate dynamic 'Grab it for' or 'Grab it now' button
    const grabItButton = page.locator('button:has-text("Grab it now")')
      .or(page.locator('button:has-text("Grab it for")'))
      .or(page.getByRole('button', { name: /Grab it/i }))
      .or(page.locator('.revisit-banner button, [class*="revisit"] button'));
    
    try {
      console.log(`[StreamingRevisitBannerTask] Waiting for Revisit Grab It button on: ${page.url()}`);
      
      // If back navigation cached in BFCache without mounting revisit banner, fallback reload
      let isVisible = await grabItButton.first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
      if (!isVisible) {
        console.log('⚠️ [StreamingRevisitBannerTask] Revisit button not visible after goBack. Triggering direct fallback navigation...');
        await page.goto(targetFallback, { waitUntil: 'domcontentloaded' });
        await grabItButton.first().waitFor({ state: 'visible', timeout: timeout });
      }
      
      console.log('[StreamingRevisitBannerTask] Revisit button visible - clicking immediately');
      
      const isSafari = page.context().browser()?.browserType().name() === 'webkit';
      if (isSafari) {
        await SafariRevisitBannerHelper.clickGrabItButton(page, grabItButton);
      } else {
        await grabItButton.first().click({ force: true });
      }
    } catch (e) {
      console.error('[StreamingRevisitBannerTask] Grab it button issue:', e.message);
      throw e;
    }

    // 6. Verify navigation to preview page with specific type pattern
    const urlPattern = type === 'sticker' ? /.*(type=sticker|preview).*/ : /.*(type=vhr|preview).*/;
    await page.waitForURL(urlPattern, { waitUntil: 'domcontentloaded', timeout: timeout });
    await expect(page).toHaveURL(urlPattern);
    
    console.log('✅ [StreamingRevisitBannerTask] Passed: Revisit banner flow verified.');
  }
}

class SafariRevisitBannerHelper {
  static async clickGrabItButton(page, grabItButtonLocator) {
    console.log('🍏 [SafariRevisitBannerHelper] Executing Safari-specific revisit banner click helper...');
    
    const button = grabItButtonLocator.first();
    await button.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    
    // 1. Try Playwright tap / click first
    try {
      await button.tap({ timeout: 3000 });
    } catch (e) {
      await button.click({ force: true }).catch(() => {});
    }

    // 2. Dispatch native DOM click + touch events on WebKit
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('button, a')).find(b => /grab it/i.test(b.innerText || b.textContent || '')) 
        || document.querySelector('.revisit-banner button, [class*="revisit"] button, [class*="revisit"] a');
      if (el) {
        if (typeof el.click === 'function') el.click();
        el.dispatchEvent(new Event('touchstart', { bubbles: true }));
        el.dispatchEvent(new Event('touchend', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    });

    await page.waitForTimeout(1000);
  }
}

module.exports = { StreamingRevisitBannerTask, SafariRevisitBannerHelper };
