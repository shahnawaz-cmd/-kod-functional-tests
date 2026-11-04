// tests/ui_ux_verification.spec.ts
import { test, expect } from '../fixtures/uiUx.fixture';

test.describe('UI/UX & Responsiveness Quality Audit Suite', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.describe.configure({ timeout: process.env.CI ? 120000 : 90000 });

  // ─────────────────────────────────────────────────────────────
  // PAGE 1: MAIN HOMEPAGE (/)
  // ─────────────────────────────────────────────────────────────
  test('TC_UI_UX_01 — UI/UX and Responsiveness Audit on Main Page',
    { tag: ['@ui-ux', '@responsiveness', '@main-page'] },
    async ({ uiUxPage, uiUxAuditor }, testInfo) => {
      await uiUxAuditor.auditPage(uiUxPage, 'home', testInfo);
    }
  );

  // ─────────────────────────────────────────────────────────────
  // PAGE 2: VIN DECODER PAGE (/vin-decoder)
  // ─────────────────────────────────────────────────────────────
  test('TC_UI_UX_02 — UI/UX and Responsiveness Audit on VIN Decoder Page',
    { tag: ['@ui-ux', '@responsiveness', '@vin-decoder'] },
    async ({ uiUxPage, uiUxAuditor }, testInfo) => {
      await uiUxAuditor.auditPage(uiUxPage, 'vin-decoder', testInfo);
    }
  );
});
