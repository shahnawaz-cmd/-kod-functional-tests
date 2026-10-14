// tests/ui_ux_verification.spec.ts
import { test } from '@playwright/test';
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

async function gotoWithRetry(page: any, url: string, retries: number = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (err: any) {
      if (i === retries) throw err;
      console.warn(`⚠️ [UI/UX] goto("${url}") failed (${err.message}). Retrying in 1.5s...`);
      await page.waitForTimeout(1500);
    }
  }
}

test.describe('UI/UX & Responsiveness Quality Audit', () => {

  // ─────────────────────────────────────────────────────────────
  // PAGE 1: MAIN HOMEPAGE (/)
  // ─────────────────────────────────────────────────────────────
  test('TC_UI_UX_01 — UI/UX and Responsiveness Audit on Main Page', async ({ page }, testInfo) => {
    const timeout = process.env.CI ? 120000 : 90000;
    testInfo.setTimeout(timeout);

    console.log(`🚀 [UI/UX Audit] Starting audit on Main Homepage (/) for project: ${testInfo.project.name}`);

    const isMobile = Boolean(testInfo.project.use?.isMobile || testInfo.project.name.toLowerCase().includes('mobile'));
    if (isMobile) {
      console.log('📱 [UI/UX Audit] Applying standard 360px mobile viewport (360x740)...');
      await page.setViewportSize({ width: 360, height: 740 });
    }

    // 1. Navigate to Main Homepage
    await gotoWithRetry(page, '/');
    await page.waitForTimeout(1500);

    // 2. Execute all 12 UI/UX tasks
    await new HorizontalOverflowTask().performAs(page, testInfo);
    await new HeaderOverlapTask().performAs(page);
    await new NavigationMenuTask().performAs(page);
    await new ScrollFooterTask().performAs(page);
    await new FaqAccordionTask().performAs(page);
    await new FloatingWidgetOverlapTask().performAs(page);
    await new CardStackingTask().performAs(page);
    await new ResponsiveTableTask().performAs(page);
    await new BrokenAssetTask().performAs(page);
    await new TouchTargetTask().performAs(page);
    await new InputZoomGuardTask().performAs(page);
    await new MobileKeyboardTask().performAs(page);

    await page.close();
  });

  // ─────────────────────────────────────────────────────────────
  // PAGE 2: VIN DECODER PAGE (/vin-decoder)
  // ─────────────────────────────────────────────────────────────
  test('TC_UI_UX_02 — UI/UX and Responsiveness Audit on VIN Decoder Page', async ({ page }, testInfo) => {
    const timeout = process.env.CI ? 120000 : 90000;
    testInfo.setTimeout(timeout);

    console.log(`🚀 [UI/UX Audit] Starting audit on VIN Decoder Page for project: ${testInfo.project.name}`);

    const isMobile = Boolean(testInfo.project.use?.isMobile || testInfo.project.name.toLowerCase().includes('mobile'));
    if (isMobile) {
      console.log('📱 [UI/UX Audit] Applying standard 360px mobile viewport (360x740)...');
      await page.setViewportSize({ width: 360, height: 740 });
    }

    // 1. Navigate to VIN Decoder page (supports /vin-decoder, brand-specific /toyota-vin-decoder, /dodge-vin-decoder, etc.)
    const brandPrefix = testInfo.project.name.toLowerCase().replace(/windowsticker.*|_mobile.*/g, '');
    const brandRoute = brandPrefix ? `/${brandPrefix}-vin-decoder` : '/vin-decoder';

    let response = await gotoWithRetry(page, '/vin-decoder').catch(() => null);
    if (!response || response.status() === 404) {
      console.log(`ℹ️ [UI/UX Audit] /vin-decoder returned 404, falling back to ${brandRoute}...`);
      response = await gotoWithRetry(page, brandRoute).catch(() => null);
      if (!response || response.status() === 404) {
        console.log('ℹ️ [UI/UX Audit] Falling back to /window-sticker...');
        await gotoWithRetry(page, '/window-sticker');
      }
    }
    await page.waitForTimeout(1500);

    // 2. Execute all 12 UI/UX tasks
    await new HorizontalOverflowTask().performAs(page, testInfo);
    await new HeaderOverlapTask().performAs(page);
    await new NavigationMenuTask().performAs(page);
    await new ScrollFooterTask().performAs(page);
    await new FaqAccordionTask().performAs(page);
    await new FloatingWidgetOverlapTask().performAs(page);
    await new CardStackingTask().performAs(page);
    await new ResponsiveTableTask().performAs(page);
    await new BrokenAssetTask().performAs(page);
    await new TouchTargetTask().performAs(page);
    await new InputZoomGuardTask().performAs(page);
    await new MobileKeyboardTask().performAs(page);

    await page.close();
  });

});
