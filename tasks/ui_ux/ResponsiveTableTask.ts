// tasks/ui_ux/ResponsiveTableTask.ts
import { Page, expect, test } from '@playwright/test';
import { Actor } from '../../actors/Actor';

/**
 * Responsive Data Table Audit:
 * Verifies that wide tables on mobile viewports are enclosed in an overflow-x: auto scroll container.
 */
export class ResponsiveTableTask {
  async performAs(target: Actor | Page) {
    const page = target instanceof Actor ? target.getPage() : target;

    await test.step('UI/UX: Verify Responsive Data Table Wrappers', async () => {
      const viewport = page.viewportSize() || { width: 1280, height: 720 };
      const isMobile = viewport.width < 768;

      if (!isMobile) {
        console.log('ℹ️ [ResponsiveTableTask] Skipping mobile table wrapper check on desktop viewport.');
        return;
      }

      const tableBreaks = await page.evaluate((screenWidth) => {
        const tables = Array.from(document.querySelectorAll('table'));

        for (const table of tables) {
          const tableRect = table.getBoundingClientRect();

          if (tableRect.width > screenWidth || table.scrollWidth > screenWidth) {
            let parent = table.parentElement;
            let hasScrollWrapper = false;

            while (parent && parent !== document.body) {
              const style = window.getComputedStyle(parent);
              if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
                hasScrollWrapper = true;
                break;
              }
              parent = parent.parentElement;
            }

            if (!hasScrollWrapper) {
              return { hasUnwrappedTable: true, width: Math.round(tableRect.width) };
            }
          }
        }
        return { hasUnwrappedTable: false, width: 0 };
      }, viewport.width);

      if (tableBreaks.hasUnwrappedTable) {
        console.warn(`⚠️ [ResponsiveTableTask] Table (${tableBreaks.width}px) is wider than mobile screen (${viewport.width}px) and missing scroll wrapper.`);
      } else {
        console.log('✅ [ResponsiveTableTask] All wide tables are properly enclosed in responsive scroll wrappers.');
      }

      expect.soft(
        tableBreaks.hasUnwrappedTable,
        `Data table (${tableBreaks.width}px) exceeds mobile width (${viewport.width}px) without an overflow-x: auto scroll container`
      ).toBe(false);
    });
  }
}

export default ResponsiveTableTask;
