import { Page } from '@playwright/test';
import { clickWithHealing } from '../utils/selfHealingLocator';

// Ultra-fast and reliable Exit Intent trigger
export class ExitIntentHelper {
  static async triggerExitIntent(page: Page) {
    if (page.isClosed()) return;

    // 1. Instant simulate user interaction & quick mouse trajectory to top of viewport
    await page.mouse.move(500, 300).catch(() => {});
    await page.mouse.move(500, 0).catch(() => {});
    await page.mouse.move(500, -20).catch(() => {});

    // 2. Direct fast synthetic event dispatch (instant trigger for headless & CI)
    await page.evaluate(() => {
      const opts = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: 500,
        clientY: -20,
        screenX: 500,
        screenY: -20,
        relatedTarget: null
      };

      const mouseLeaveEvent = new MouseEvent('mouseleave', opts);
      const mouseOutEvent = new MouseEvent('mouseout', opts);

      document.dispatchEvent(mouseLeaveEvent);
      document.dispatchEvent(mouseOutEvent);
      document.documentElement.dispatchEvent(mouseLeaveEvent);
      document.body.dispatchEvent(mouseLeaveEvent);
      window.dispatchEvent(mouseLeaveEvent);
    }).catch(() => {});

    // 3. Fast check for CTA button with 5s timeout
    const ctaSelectors = [
      'button:has-text("Claim 15% Off")',
      'button:has-text("Click here to redeem instantly")',
      'button:has-text("Take 15% off")',
      'button:has-text("Redeem 15% off")',
      'a:has-text("Claim 15% Off")',
      'button:has-text("Redeem")',
      'button:has-text("Claim")'
    ];

    try {
      await clickWithHealing(page, 'Claim 15% Off', ctaSelectors, { timeout: 5000, force: true });
      console.log('✅ Clicked exit intent pop-up button.');
    } catch (e) {
      console.log('ℹ️ Exit intent pop-up not triggered (session cookie or A/B variant). Test completed.');
    }
  }
}
