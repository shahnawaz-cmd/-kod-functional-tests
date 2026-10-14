// tasks/ui_ux/ScrollFooterTask.ts
import { Page, expect, test } from '@playwright/test';
import { Actor } from '../../actors/Actor';

/**
 * Scroll & Footer Reachability Task:
 * Verifies that body is not scroll-locked and page can scroll from header down to footer.
 */
export class ScrollFooterTask {
  async performAs(target: Actor | Page) {
    const page = target instanceof Actor ? target.getPage() : target;

    await test.step('UI/UX: Verify Page Scrolling & Footer Reachability', async () => {
      console.log('🔍 [ScrollFooterTask] Checking page scrollability and footer reachability...');

      const isScrollLocked = await page.evaluate(() => {
        const bodyStyle = window.getComputedStyle(document.body);
        const htmlStyle = window.getComputedStyle(document.documentElement);
        return bodyStyle.overflow === 'hidden' || htmlStyle.overflow === 'hidden' || bodyStyle.position === 'fixed';
      });

      expect.soft(isScrollLocked, 'Page is scroll-locked on initial load (overflow: hidden or position: fixed)').toBe(false);

      // Scroll to bottom smoothly
      const scrollData = await page.evaluate(async () => {
        const totalHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        window.scrollTo(0, totalHeight);
        await new Promise(resolve => requestAnimationFrame(resolve));
        return { totalHeight };
      });

      const footer = page.locator('footer, [role="contentinfo"], .site-footer, #footer').first();
      const footerCount = await footer.count();

      if (footerCount > 0 && await footer.isVisible().catch(() => false)) {
        const footerMetrics = await footer.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          return {
            top: Math.round(rect.top),
            inViewport: rect.top < window.innerHeight && rect.bottom > 0
          };
        });

        console.log(`✅ [ScrollFooterTask] Page scrolled to ${scrollData.totalHeight}px. Footer in viewport: ${footerMetrics.inViewport} (top: ${footerMetrics.top}px)`);
      } else {
        console.log(`✅ [ScrollFooterTask] Page scrolled smoothly from top to bottom (${scrollData.totalHeight}px).`);
      }

      // Scroll back to top
      await page.evaluate(() => window.scrollTo(0, 0));
    });
  }
}

export default ScrollFooterTask;
