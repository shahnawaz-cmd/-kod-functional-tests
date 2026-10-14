// tasks/ui_ux/CardStackingTask.ts
import { Page, expect, test } from '@playwright/test';
import { Actor } from '../../actors/Actor';

/**
 * Mobile Card Stacking & Multi-column Grid audit:
 * Catches multi-column grid layouts forced side-by-side on mobile viewports (< 110px per card).
 */
export class CardStackingTask {
  async performAs(target: Actor | Page) {
    const page = target instanceof Actor ? target.getPage() : target;

    await test.step('UI/UX: Verify Mobile Card & Column Stacking', async () => {
      const viewport = page.viewportSize() || { width: 1280, height: 720 };
      const isMobile = viewport.width < 500;

      if (!isMobile) {
        console.log('ℹ️ [CardStackingTask] Skipping mobile card squish check on desktop viewport.');
        return;
      }

      const stackingData = await page.evaluate(() => {
        const containers = Array.from(document.querySelectorAll<HTMLElement>(
          '[class*="grid"], [class*="cards"], [class*="pricing"], [class*="features"]'
        ));

        for (const container of containers) {
          const children = Array.from(container.children).filter(c => {
            const r = c.getBoundingClientRect();
            return r.width > 0 && r.height > 60 && window.getComputedStyle(c).display !== 'none';
          }) as HTMLElement[];

          if (children.length >= 2) {
            const r0 = children[0].getBoundingClientRect();
            const r1 = children[1].getBoundingClientRect();

            const isSideBySide = Math.abs(r0.top - r1.top) < 20;

            // True squishing occurs when 3+ items are forced side-by-side (< 110px) or items are cramped (< 110px).
            const isSeverelySquished = (children.length >= 3 && (r0.width < 110 || r1.width < 110)) ||
                                       (r0.width < 110 || r1.width < 110);

            if (isSideBySide && isSeverelySquished) {
              const name = children[0].textContent?.trim().slice(0, 30) || 'Card Column';
              return { squished: true, cardWidth: Math.round(r0.width), name };
            }
          }
        }
        return { squished: false, cardWidth: 0, name: '' };
      });

      if (stackingData.squished) {
        console.warn(`⚠️ [CardStackingTask] Cards cramped side-by-side on mobile: "${stackingData.name}" (${stackingData.cardWidth}px width)`);
      } else {
        console.log('✅ [CardStackingTask] Mobile card grids are properly responsive/stacked.');
      }

      expect.soft(
        stackingData.squished,
        `Mobile cards "${stackingData.name}" are severely cramped side-by-side (${stackingData.cardWidth}px width < 110px)`
      ).toBe(false);
    });
  }
}

export default CardStackingTask;
