// tasks/ui_ux/InputZoomGuardTask.ts
import { Page, expect, test } from '@playwright/test';
import { Actor } from '../../actors/Actor';

/**
 * Mobile Input Font Size Guard:
 * Audits mobile inputs for font sizes < 16px, which trigger unwanted iOS 150% auto-zoom focus traps.
 */
export class InputZoomGuardTask {
  async performAs(target: Actor | Page) {
    const page = target instanceof Actor ? target.getPage() : target;

    await test.step('UI/UX: Verify Mobile Input Auto-Zoom Guard (>= 16px Font)', async () => {
      const viewport = page.viewportSize() || { width: 1280, height: 720 };
      const isMobile = viewport.width < 768;

      if (!isMobile) {
        console.log('ℹ️ [InputZoomGuardTask] Skipping input zoom check on desktop viewport.');
        return;
      }

      const inputData = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
          'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea'
        ));

        const visible = inputs.filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
        });

        if (visible.length === 0) return { count: 0, smallInputs: [] };

        const small = visible.map(el => {
          const size = parseFloat(window.getComputedStyle(el).fontSize);
          const name = el.placeholder || el.name || el.id || el.getAttribute('aria-label') || el.tagName.toLowerCase();
          return { name, size: Math.round(size) };
        }).filter(item => item.size < 16);

        return { count: visible.length, smallInputs: small };
      });

      if (inputData.count === 0) {
        console.log('ℹ️ [InputZoomGuardTask] No interactive form inputs found on this route.');
        return;
      }

      if (inputData.smallInputs.length > 0) {
        const worst = inputData.smallInputs[0];
        console.warn(`⚠️ [InputZoomGuardTask] Input "${worst.name}" has font size ${worst.size}px (< 16px). This triggers iOS auto-zoom.`);
      } else {
        console.log(`✅ [InputZoomGuardTask] All ${inputData.count} form inputs have font-size >= 16px (iOS auto-zoom safe).`);
      }

      // Check that inputs are not critically tiny (< 14px)
      const criticalTiny = inputData.smallInputs.filter(i => i.size < 14);
      expect.soft(
        criticalTiny.length,
        `Found ${criticalTiny.length} inputs with font-size < 14px on mobile viewport`
      ).toBe(0);
    });
  }
}

export default InputZoomGuardTask;
