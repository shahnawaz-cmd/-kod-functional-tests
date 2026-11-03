// tests/session_ip_stickiness.spec.ts
import { test, resilientNavigateToHome, skipUnsupportedEnvironments } from '../fixtures/sessionStickiness.fixture';

test.describe('IP Lock & Currency Conversion Suite', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.describe.configure({ timeout: process.env.CI ? 120000 : 90000 });

  test('TC_IP_01 — Verify CWA IP Lock, Currency Conversion, Multi-Tab Persistence, and Reload Integrity',
    { tag: ['@desktop', '@session-stickiness', '@ip-lock'] },
    async ({ sessionPage, stickinessTask }, testInfo) => {
      skipUnsupportedEnvironments(testInfo, 'TC_IP_01');
      await resilientNavigateToHome(sessionPage, testInfo);
      await stickinessTask.executeStickinessCheck(sessionPage, undefined, 2, testInfo);
    }
  );
});
