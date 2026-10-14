// tasks/ui_ux/FloatingWidgetOverlapTask.ts
import { Page, expect, test } from '@playwright/test';
import { Actor } from '../../actors/Actor';

/**
 * Floating widget collision audit:
 * Detects fixed widgets (chat launchers, bottom banners) colliding with or covering primary CTA buttons.
 */
export class FloatingWidgetOverlapTask {
  async performAs(target: Actor | Page) {
    const page = target instanceof Actor ? target.getPage() : target;

    await test.step('UI/UX: Verify Floating Widgets Do Not Obscure CTAs', async () => {
      console.log('🔍 [FloatingWidgetOverlapTask] Scanning for fixed widgets covering primary CTA buttons...');

      const collision = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('*'));
        const fixedWidgets = allElements.filter(el => {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          if (el.clientWidth < 20 || el.clientHeight < 20) return false;

          if (style.position === 'fixed') {
            if (el.closest('header, nav, [role="banner"], [data-content-toc]')) return false;
            const rect = el.getBoundingClientRect();
            if (rect.top <= 5 && rect.width >= window.innerWidth * 0.8) return false;
            return true;
          }
          return false;
        });

        if (fixedWidgets.length === 0) return null;

        const ctaButtons = Array.from(document.querySelectorAll('button, a[role="button"], a.btn, .btn, input[type="submit"]')).filter(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && el.clientWidth > 0;
        });

        for (const widget of fixedWidgets) {
          const wRect = widget.getBoundingClientRect();

          for (const btn of ctaButtons) {
            if (widget.contains(btn) || btn.contains(widget)) continue;

            const bRect = btn.getBoundingClientRect();
            if (bRect.bottom < 0 || bRect.top > window.innerHeight || bRect.right < 0 || bRect.left > window.innerWidth) {
              continue;
            }

            const hasOverlap = !(
              wRect.right < bRect.left ||
              wRect.left > bRect.right ||
              wRect.bottom < bRect.top ||
              wRect.top > bRect.bottom
            );

            if (hasOverlap) {
              const btnText = btn.textContent?.trim().slice(0, 30) || 'CTA Button';
              const widgetTag = widget.tagName.toLowerCase();
              return { hasCollision: true, btnText, widgetTag };
            }
          }
        }
        return null;
      });

      if (collision && collision.hasCollision) {
        console.warn(`⚠️ [FloatingWidgetOverlapTask] Collision detected between fixed <${collision.widgetTag}> and CTA "${collision.btnText}"`);
      } else {
        console.log('✅ [FloatingWidgetOverlapTask] No collisions between floating widgets and primary CTAs.');
      }

      expect.soft(
        collision ? collision.hasCollision : false,
        `Fixed widget <${collision?.widgetTag}> overlaps primary CTA button "${collision?.btnText}"`
      ).toBe(false);
    });
  }
}

export default FloatingWidgetOverlapTask;
