// tasks/ui_ux/MobileKeyboardTask.ts
import { Page, expect, test } from '@playwright/test';
import { Actor } from '../../actors/Actor';

export class MobileKeyboardTask {
  async performAs(target: Actor | Page) {
    const page = target instanceof Actor ? target.getPage() : target;

    await test.step('UI/UX: Verify Mobile Soft-Keyboard Input Visibility', async () => {
      const viewport = page.viewportSize() || { width: 1280, height: 720 };
      const isMobile = viewport.width < 768;

      if (!isMobile) {
        console.log('ℹ️ [MobileKeyboardTask] Skipping soft-keyboard simulation on desktop viewport.');
        return;
      }

      const inputs = page.locator('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea');
      const inputCount = await inputs.count();

      if (inputCount === 0) {
        console.log('ℹ️ [MobileKeyboardTask] No interactive form inputs found on this page.');
        return;
      }

      const firstInput = inputs.first();
      if (await firstInput.isVisible().catch(() => false)) {
        const originalHeight = viewport.height;
        const keyboardHeight = Math.floor(originalHeight * 0.6); // 40% height reduction

        try {
          // 1. Scroll directly to the input first
          await firstInput.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});

          // 2. Simulate mobile soft-keyboard pop-up
          console.log(`📱 [MobileKeyboardTask] Simulating mobile keyboard pop-up (height ${originalHeight}px -> ${keyboardHeight}px)...`);
          await page.setViewportSize({ width: viewport.width, height: keyboardHeight });
          await firstInput.focus();

          // 3. Center the input precisely in the available viewport slot between the sticky header and keyboard
          await firstInput.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
          await firstInput.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const header = document.querySelector('header, nav, [role="banner"]');
            const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
            const targetY = Math.round(headerBottom + (window.innerHeight - headerBottom) / 2 - rect.height / 2);
            window.scrollBy(0, rect.top - targetY);
          });
          await page.waitForTimeout(300); // Allow browser paint frame to settle

          // 4. Validate input is within visible screen bounds
          const checkResult = await firstInput.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const header = document.querySelector('header, nav, [role="banner"]');
            const headerBottom = header ? header.getBoundingClientRect().bottom : 0;

            const isCoveredByHeader = rect.top < headerBottom;
            const isBelowScreen = rect.bottom > window.innerHeight;

            return {
              isVisible: !isCoveredByHeader && !isBelowScreen,
              top: Math.round(rect.top),
              bottom: Math.round(rect.bottom),
              headerBottom: Math.round(headerBottom),
              windowHeight: window.innerHeight,
            };
          });

          expect.soft(
            checkResult.isVisible,
            `Form input (Y: ${checkResult.top}px-${checkResult.bottom}px) is obscured by sticky header (${checkResult.headerBottom}px) or pushed below screen (${checkResult.windowHeight}px)`
          ).toBe(true);

          console.log(`✅ [MobileKeyboardTask] Input field (Y: ${checkResult.top}px-${checkResult.bottom}px) is clear of header (${checkResult.headerBottom}px) and keyboard (${checkResult.windowHeight}px).`);
        } finally {
          // 5. Always restore original viewport height and scroll to top
          await page.setViewportSize({ width: viewport.width, height: originalHeight });
          await page.evaluate(() => window.scrollTo(0, 0));
        }
      }
    });
  }
}

export default MobileKeyboardTask;
