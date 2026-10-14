// tasks/ui_ux/HeaderOverlapTask.ts
import { Page, expect, test } from '@playwright/test';
import { Actor } from '../../actors/Actor';

export class HeaderOverlapTask {
  async performAs(target: Actor | Page) {
    const page = target instanceof Actor ? target.getPage() : target;

    await test.step('UI/UX: Verify Header Does Not Cover Page Title', async () => {
      console.log('🔍 [HeaderOverlapTask] Measuring clearance between header and main page heading...');

      // 1. Ensure page is scrolled to top to measure initial layout state
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);

      const measurements = await page.evaluate(() => {
        const header = document.querySelector('header, nav, [role="banner"]');
        const h1 = document.querySelector('h1, main h2, [role="heading"]');

        if (header && h1) {
          const hRect = header.getBoundingClientRect();
          const tRect = h1.getBoundingClientRect();
          const gap = Math.round(tRect.top - hRect.bottom);

          return {
            hasHeader: true,
            hBottom: Math.round(hRect.bottom),
            tTop: Math.round(tRect.top),
            gap,
            // Only flag as covering if heading is within the viewport at initial scroll top and occluded
            isCovering: tRect.top >= 0 && hRect.bottom > tRect.top && tRect.bottom > hRect.top && hRect.height > 0
          };
        }
        return { hasHeader: false, isCovering: false, gap: 0 };
      });

      if (!measurements.hasHeader) {
        console.log('ℹ️ [HeaderOverlapTask] No header or main heading detected on this route. Skipping overlap assertion.');
        return;
      }

      console.log(`📊 [HeaderOverlapTask] Header bottom: ${measurements.hBottom}px | Heading top: ${measurements.tTop}px | Clearance: ${measurements.gap}px`);

      expect.soft(
        measurements.isCovering,
        `Sticky header (bottom: ${measurements.hBottom}px) is obscuring page title (top: ${measurements.tTop}px)`
      ).toBe(false);

      console.log('✅ [HeaderOverlapTask] Header has clear separation from page heading.');
    });
  }
}

export default HeaderOverlapTask;
