// tests/session_ip_stickiness.spec.ts
import { test } from '@playwright/test';
import { SessionIpStickinessTask, IP_POOL } from '../tasks/SessionIpStickinessTask';

test.describe('Session IP Stickiness & Persistence Suite', () => {
  // Use clean isolated session state
  test.use({ storageState: { cookies: [], origins: [] } });

  test('TC_IP_01 — Verify CWA IP stickiness, multi-tab persistence, and reload integrity', async ({ page }, testInfo) => {
    // Only run in Desktop Chrome; skip on mobile or non-chromium browsers
    const isMobile = Boolean(
      testInfo.project.use?.isMobile ||
      testInfo.project.name.includes('Mobile')
    );
    const isDesktopChrome = !isMobile && (testInfo.project.use?.browserName === 'chromium' || !testInfo.project.use?.browserName);

    test.skip(!isDesktopChrome, 'This test only runs on Desktop Chrome; skipping on mobile or non-desktop browsers');

    // Skip for VehicleHistoryEU and VINNumberCA as requested
    const projectName = testInfo.project.name;
    const isSkippedSite = ['VehicleHistoryEU', 'VINNumberCA'].some(site => projectName.includes(site));
    test.skip(isSkippedSite, `IP stickiness case is disabled for ${projectName} (VHREU & VNCA)`);

    testInfo.setTimeout(process.env.CI ? 120000 : 90000);

    // Navigate to target site root URL
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Execute stickiness check & VIN decode flow (picks a random IP from IP_POOL on every run)
    // Handles: cookie capture, random IP injection, reload checks, multi-tab validation, report attachment, VIN decode, preview navigation, screenshot, and page close
    const stickinessTask = new SessionIpStickinessTask();
    await stickinessTask.executeStickinessCheck(page, undefined, 2, testInfo);
  });
});
