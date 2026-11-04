// fixtures/uiUx.fixture.ts
import { test as base, Page, TestInfo } from '@playwright/test';
import {
  HorizontalOverflowTask,
  HeaderOverlapTask,
  NavigationMenuTask,
  ScrollFooterTask,
  FaqAccordionTask,
  FloatingWidgetOverlapTask,
  CardStackingTask,
  ResponsiveTableTask,
  BrokenAssetTask,
  TouchTargetTask,
  InputZoomGuardTask,
  MobileKeyboardTask
} from '../tasks/ui_ux';
import { gotoWithResilience, reloadWithResilience, isTransientNetworkError } from '../utils/resilientNavigation';

// ─────────────────────────────────────────────────────────────
// 1. INFRASTRUCTURE & NAVIGATION HELPERS
// ─────────────────────────────────────────────────────────────

export type AuditTargetPage = 'home' | 'vin-decoder';

/**
 * Resilient Navigation for UI/UX audits:
 * Handles brand-specific URL fallbacks and ensures DOM interactivity.
 */
export async function resilientNavigateToAuditPage(
  page: Page,
  target: AuditTargetPage,
  testInfo: TestInfo
): Promise<void> {
  if (target === 'home') {
    await gotoWithResilience(page, '/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
      maxRetries: 3,
      readySelector: 'header, main, nav, form, footer'
    });
    await page.waitForTimeout(1000);
    return;
  }

  // Target: VIN Decoder page with brand route fallbacks
  const brandPrefix = testInfo.project.name.toLowerCase().replace(/windowsticker.*|_mobile.*/g, '');
  const brandRoute = brandPrefix ? `/${brandPrefix}-vin-decoder` : '/vin-decoder';

  let response = await gotoWithResilience(page, '/vin-decoder', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
    maxRetries: 2
  }).catch(() => null);

  if (!response || response.status() === 404) {
    console.log(`ℹ️ [UI/UX Audit] /vin-decoder returned 404, falling back to ${brandRoute}...`);
    response = await gotoWithResilience(page, brandRoute, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
      maxRetries: 2
    }).catch(() => null);

    if (!response || response.status() === 404) {
      console.log('ℹ️ [UI/UX Audit] Falling back to /window-sticker...');
      await gotoWithResilience(page, '/window-sticker', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
        maxRetries: 2
      });
    }
  }

  await page.waitForTimeout(1000);
}

/**
 * Timeout & Network Shield:
 * Differentiates real UI/UX visual defects from transient network/infrastructure stalls.
 * Genuine layout and assertion defects fail immediately with full diagnostics.
 */
export async function executeShieldedUiUx<T>(
  actionName: string,
  page: Page,
  testInfo: TestInfo,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isFunctionalDefect =
      error?.name === 'AssertionError' ||
      error?.message?.includes('expect(') ||
      error?.message?.includes('expect.soft') ||
      error?.message?.includes('toBe(') ||
      error?.message?.includes('overflow') ||
      error?.message?.includes('hasPageHorizontalScroll') ||
      error?.message?.includes('broken') ||
      error?.message?.includes('[FAILURE]');

    // Fail immediately on genuine visual or functional defects
    if (isFunctionalDefect) {
      throw error;
    }

    if (!isTransientNetworkError(error)) {
      throw error;
    }

    console.warn(`🛡️ [UI/UX Timeout Shield] ${actionName} hit a transient infrastructure/network stall: ${error?.message}`);
    testInfo.annotations.push({
      type: 'warning',
      description: `[UI/UX Shield] Recovered transient stall during ${actionName}: ${error?.message?.slice(0, 150)}`
    });

    try {
      await reloadWithResilience(page, {
        waitUntil: 'domcontentloaded',
        timeout: 25000,
        readySelector: 'header, main, nav, form, footer'
      });
      await page.waitForTimeout(1000);
    } catch (reloadErr: any) {
      console.warn(`⚠️ [UI/UX Shield] Recovery reload had issue: ${reloadErr?.message}`);
    }

    // Re-execute task
    return await fn();
  }
}

// ─────────────────────────────────────────────────────────────
// 2. UI/UX AUDITOR MODULE (Layer 3: Business Logic Orchestrator)
// ─────────────────────────────────────────────────────────────

export class UiUxAuditorModule {
  async auditPage(page: Page, target: AuditTargetPage, testInfo: TestInfo) {
    const isMobile = Boolean(testInfo.project.use?.isMobile || testInfo.project.name.toLowerCase().includes('mobile'));
    if (isMobile) {
      console.log('📱 [UI/UX Audit] Applying standard 360px mobile viewport (360x740)...');
      await page.setViewportSize({ width: 360, height: 740 });
    }

    // Step 1: Resilient Navigation
    await base.step(`Step 1: Navigate to ${target === 'home' ? 'Main Homepage (/)' : 'VIN Decoder Page'}`, async () => {
      await resilientNavigateToAuditPage(page, target, testInfo);
    });

    // Step 2: Execute all 12 UI/UX inspection tasks with timeout shields
    await base.step(`Step 2: Execute Full 12-Rule UI/UX & Responsiveness Audit`, async () => {
      await executeShieldedUiUx('Horizontal Overflow Audit', page, testInfo, async () => {
        await new HorizontalOverflowTask().performAs(page, testInfo);
      });

      await executeShieldedUiUx('Header Overlap Audit', page, testInfo, async () => {
        await new HeaderOverlapTask().performAs(page);
      });

      await executeShieldedUiUx('Navigation Menu Audit', page, testInfo, async () => {
        await new NavigationMenuTask().performAs(page);
      });

      await executeShieldedUiUx('Scroll Footer Audit', page, testInfo, async () => {
        await new ScrollFooterTask().performAs(page);
      });

      await executeShieldedUiUx('FAQ Accordion Audit', page, testInfo, async () => {
        await new FaqAccordionTask().performAs(page);
      });

      await executeShieldedUiUx('Floating Widget Overlap Audit', page, testInfo, async () => {
        await new FloatingWidgetOverlapTask().performAs(page);
      });

      await executeShieldedUiUx('Card Stacking Audit', page, testInfo, async () => {
        await new CardStackingTask().performAs(page);
      });

      await executeShieldedUiUx('Responsive Table Audit', page, testInfo, async () => {
        await new ResponsiveTableTask().performAs(page);
      });

      await executeShieldedUiUx('Broken Asset Audit', page, testInfo, async () => {
        await new BrokenAssetTask().performAs(page);
      });

      await executeShieldedUiUx('Touch Target Audit', page, testInfo, async () => {
        await new TouchTargetTask().performAs(page);
      });

      await executeShieldedUiUx('Input Zoom Guard Audit', page, testInfo, async () => {
        await new InputZoomGuardTask().performAs(page);
      });

      await executeShieldedUiUx('Mobile Keyboard Audit', page, testInfo, async () => {
        await new MobileKeyboardTask().performAs(page);
      });
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 3. FIXTURE REGISTRATION (Layer 6: Custom Fixtures)
// ─────────────────────────────────────────────────────────────

export interface UiUxFixtures {
  uiUxPage: Page;
  uiUxAuditor: UiUxAuditorModule;
}

export const test = base.extend<UiUxFixtures>({
  uiUxPage: async ({ page, context }, use) => {
    // 1. Clear session and cookies
    await context.clearCookies();
    await context.clearPermissions();

    // 2. CDP cache clearing
    const client = await context.newCDPSession(page).catch(() => null);
    if (client) {
      await client.send('Network.clearBrowserCache').catch(() => {});
      await client.send('Network.setCacheDisabled', { cacheDisabled: true }).catch(() => {});
    }

    // 3. Anti-bot stealth init script
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    await use(page);
  },

  uiUxAuditor: async ({}, use) => {
    const auditor = new UiUxAuditorModule();
    await use(auditor);
  }
});

export { expect } from '@playwright/test';
