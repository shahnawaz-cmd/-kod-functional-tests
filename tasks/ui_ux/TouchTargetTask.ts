// tasks/ui_ux/TouchTargetTask.ts
import { Page, expect, test } from '@playwright/test';
import { Actor } from '../../actors/Actor';

/**
 * Mobile touch target evaluation (WCAG 2.5.5 / 2.5.8)
 * Checks that standalone buttons and interactive elements have minimum 28px tap targets (under 28px is critical).
 */
export class TouchTargetTask {
  async performAs(target: Actor | Page) {
    const page = target instanceof Actor ? target.getPage() : target;

    await test.step('UI/UX: Verify Mobile Touch Target Sizes', async () => {
      const viewport = page.viewportSize() || { width: 1280, height: 720 };
      const isMobile = viewport.width < 768;

      if (!isMobile) {
        console.log('ℹ️ [TouchTargetTask] Viewport is desktop/tablet. Touch target check is informational.');
      }

      const criticalSmallButtons = await page.evaluate((mobile) => {
        const results: { selector: string; text: string; width: number; height: number }[] = [];
        const clickables = Array.from(document.querySelectorAll('button, a[role="button"], input[type="button"], input[type="submit"]'));

        for (const el of clickables) {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);

          if (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 0 &&
            rect.height > 0
          ) {
            // Standalone buttons under 28px in either dimension are difficult to tap accurately on mobile,
            // unless they are wide text links/buttons (e.g. width >= 48px) with sufficient horizontal surface area.
            const isWideTextAction = rect.width >= 48 && rect.height >= 20;
            if (mobile && !isWideTextAction && (rect.width < 28 || rect.height < 28)) {
              const text = (el.textContent?.trim() || el.getAttribute('aria-label') || el.tagName.toLowerCase()).slice(0, 30);
              const selector = el.id ? `#${el.id}` : el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/)[0]}` : el.tagName.toLowerCase();
              results.push({ selector, text, width: Math.round(rect.width), height: Math.round(rect.height) });
            }
          }
        }
        return results;
      }, isMobile);

      if (criticalSmallButtons.length > 0) {
        console.warn(`⚠️ [TouchTargetTask] Found ${criticalSmallButtons.length} critically small touch targets:`, criticalSmallButtons);
      } else {
        console.log('✅ [TouchTargetTask] All evaluated interactive buttons meet touch target size standards.');
      }

      if (isMobile) {
        expect.soft(
          criticalSmallButtons.length,
          `Found ${criticalSmallButtons.length} buttons under 28px minimum touch target size on mobile`
        ).toBe(0);
      }
    });
  }
}

export default TouchTargetTask;
