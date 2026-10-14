// tasks/referral_test.ts
import { Page, expect } from '@playwright/test';
import { Actor } from '../actors/Actor';

export const REFERRAL_QUERY = '?ref=TESTREF&utm_source=google&utm_campaign=x';

/**
 * Reusable helper function for both streaming and non-streaming flows:
 * Opens the site with referral/UTM query parameters and validates that cookies are saved.
 */
export async function applyReferralAndVerifyCookies(page: Page, queryParams: string = REFERRAL_QUERY): Promise<boolean> {
  let targetUrl: string;
  const currentUrl = page.url() && page.url() !== 'about:blank' ? page.url() : '';

  if (!currentUrl) {
    targetUrl = `/?${queryParams.replace(/^\?/, '')}`;
  } else {
    try {
      const urlObj = new URL(currentUrl);
      const params = new URLSearchParams(queryParams.replace(/^\?/, ''));
      params.forEach((v, k) => urlObj.searchParams.set(k, v));
      targetUrl = urlObj.toString();
    } catch {
      targetUrl = `/?${queryParams.replace(/^\?/, '')}`;
    }
  }

  console.log(`🚀 [ReferralTest] Navigating to URL with referral parameters: ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Poll for cookie persistence
  let refCookie = null;
  let cookies: any[] = [];
  for (let attempt = 0; attempt < 5; attempt++) {
    cookies = await page.context().cookies();
    refCookie = cookies.find((c) => c.name.toLowerCase() === 'ref' || (c.value && c.value.includes('TESTREF')));
    if (refCookie) break;
    await page.waitForTimeout(500);
  }

  console.log(`📋 [ReferralTest] Total cookies found: ${cookies.length}`);
  expect(refCookie, 'Referral cookie "ref" must be saved in cookies').toBeDefined();
  expect(refCookie?.value).toBe('TESTREF');
  console.log(`✅ [ReferralTest] Verified "ref" cookie saved: "${refCookie?.name}=${refCookie?.value}"`);

  const utmCookie = cookies.find((c) => c.name.toLowerCase().includes('utm') || c.name.toLowerCase() === 'traffic_source');
  if (utmCookie) {
    console.log(`✅ [ReferralTest] Verified UTM/traffic_source cookie saved: "${utmCookie.name}=${utmCookie.value}"`);
  }

  return true;
}

/**
 * Task implementation for Screenplay pattern (non-streaming flow)
 */
export class ReferralTestTask {
  async performAs(actor: Actor): Promise<void> {
    const page = actor.getPage();
    await applyReferralAndVerifyCookies(page);
  }
}

// User-specified alias for exact naming compatibility
export const refferaltest = ReferralTestTask;
export type refferaltest = ReferralTestTask;
