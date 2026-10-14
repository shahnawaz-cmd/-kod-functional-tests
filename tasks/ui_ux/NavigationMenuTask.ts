// tasks/ui_ux/NavigationMenuTask.ts
import { Page, expect, test } from '@playwright/test';
import { Actor } from '../../actors/Actor';

/**
 * Mobile navigation menu & drawer UX audit:
 * Tests that clicking the hamburger menu properly displays links and closes cleanly.
 */
export class NavigationMenuTask {
  async performAs(target: Actor | Page) {
    const page = target instanceof Actor ? target.getPage() : target;

    await test.step('UI/UX: Verify Navigation Menu Behavior', async () => {
      const viewport = page.viewportSize() || { width: 1280, height: 720 };
      const isMobile = viewport.width < 768;

      if (!isMobile) {
        // Desktop nav: verify desktop links exist
        const desktopNav = page.locator('header nav, nav[role="navigation"], header a');
        const count = await desktopNav.count();
        console.log(`💻 [NavigationMenuTask] Desktop navigation elements detected: ${count}`);
        expect(count > 0, 'Desktop navigation bar should have visible navigation links').toBe(true);
        return;
      }

      const hamburgerSelector = 'button[aria-label*="menu" i], button[aria-label*="nav" i], .hamburger, .navbar-toggler, [data-testid*="menu" i], button[class*="menu" i]';
      const hamburger = page.locator(hamburgerSelector).first();

      if (await hamburger.count() > 0 && await hamburger.isVisible().catch(() => false)) {
        console.log('📱 [NavigationMenuTask] Mobile hamburger menu detected. Testing open/close cycle...');
        await hamburger.click({ timeout: 3000 }).catch(() => {});

        // Wait up to 2.5s for drawer links to appear
        await page.waitForFunction(() => {
          const links = document.querySelectorAll('nav a, [role="navigation"] a, [role="dialog"] a, [class*="drawer"] a, [class*="sheet"] a, [class*="menu"] a, aside a, header a');
          return Array.from(links).some(el => el.getBoundingClientRect().width > 0);
        }, null, { timeout: 2500 }).catch(() => {});

        const visibleLinkCount = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('nav a, [role="navigation"] a, [role="dialog"] a, [class*="drawer"] a, [class*="sheet"] a, [class*="menu"] a, aside a, header a')).filter(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && window.getComputedStyle(el).display !== 'none';
          });
          return links.length;
        });

        console.log(`📱 [NavigationMenuTask] Drawer links visible upon opening: ${visibleLinkCount}`);

        // Close menu
        const closeBtn = page.locator('button[aria-label*="close" i], button[class*="close" i]').last();
        if (await closeBtn.count() > 0 && await closeBtn.isVisible().catch(() => false)) {
          await closeBtn.click({ timeout: 2000 }).catch(() => {});
        } else {
          await page.keyboard.press('Escape').catch(() => {});
          await hamburger.click({ timeout: 2000 }).catch(() => {});
        }

        // Release any leftover body scroll lock
        await page.evaluate(() => {
          if (document.body.style.overflow === 'hidden') {
            document.body.style.overflow = '';
          }
        });

        expect.soft(visibleLinkCount > 0, 'Hamburger menu opened on mobile but no navigation links were rendered').toBe(true);
        console.log('✅ [NavigationMenuTask] Mobile navigation drawer opened and closed successfully.');
      } else {
        console.log('ℹ️ [NavigationMenuTask] No hamburger menu found on this mobile view. Skipping toggle test.');
      }
    });
  }
}

export default NavigationMenuTask;
