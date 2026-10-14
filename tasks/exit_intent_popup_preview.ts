import { Page } from '@playwright/test';
import { Actor } from '../actors/Actor';
import { clickWithHealing } from '../utils/selfHealingLocator';

export class StreamingExitIntentPopup {
  async performAs(actor: Actor) {
    const page = actor.getPage();
    if (page.isClosed()) return;

    try {
      // 1. Instant mouse positioning & boundary crossing
      await page.mouse.move(500, 300).catch(() => {});
      await page.mouse.move(500, 0).catch(() => {});
      await page.mouse.move(500, -20).catch(() => {});

      // 2. Direct fast synthetic event dispatch
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
        'button:has-text("Redeem 15% off")',
        'button:has-text("Claim 15% Off")',
        'button:has-text("Click here to redeem instantly")',
        'button:has-text("Take 15% off")',
        'a:has-text("Redeem 15% off")',
        'button:has-text("Redeem")'
      ];

      await clickWithHealing(
        page,
        'Redeem 15% off',
        ctaSelectors,
        { timeout: 5000, force: true }
      );
      console.log('✅ Clicked exit intent pop-up button (Streaming).');
    } catch (e) {
      console.log(`ℹ️ Streaming Exit intent pop-up completed: ${e.message}`);
    }
  }
}
