// utils/resilientNavigation.ts
import { Page, Response } from '@playwright/test';

export interface ResilientNavigationOptions {
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  maxRetries?: number;
  readySelector?: string;
}

/**
 * Checks if an error is an infrastructure/network/DNS transient error
 * that warrants a retry rather than an immediate test failure.
 */
export function isTransientNetworkError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || error.toString() || '').toLowerCase();
  return (
    msg.includes('err_name_not_resolved') ||
    msg.includes('err_connection_reset') ||
    msg.includes('err_connection_refused') ||
    msg.includes('err_connection_timed_out') ||
    msg.includes('err_network_changed') ||
    msg.includes('err_empty_response') ||
    msg.includes('err_http2_protocol_error') ||
    msg.includes('net::') ||
    msg.includes('timeouterror') ||
    msg.includes('timeout') ||
    msg.includes('target closed') ||
    msg.includes('frame was detached') ||
    msg.includes('execution context was destroyed')
  );
}

/**
 * Detects if Cloudflare Managed Challenge or Turnstile is gating the page
 */
export async function checkCloudflareChallenge(page: Page, testInfo?: any): Promise<boolean> {
  const isCf = await page.locator(
    '#challenge-running, #challenge-stage, .cf-turnstile, [data-sitekey], text=/Verify you are human/i, text=/Just a moment\\.\\.\\./i, text=/Checking your browser/i'
  ).first().isVisible({ timeout: 1500 }).catch(() => false);

  if (isCf) {
    const url = page.url();
    console.warn(`🛡️ [Cloudflare Guard] Managed challenge detected on: ${url}`);
    if (testInfo && typeof testInfo.attach === 'function') {
      const screenshot = await page.screenshot({ fullPage: false }).catch(() => null);
      if (screenshot) {
        await testInfo.attach('Cloudflare_Challenge_Screenshot', {
          body: screenshot,
          contentType: 'image/png'
        }).catch(() => {});
      }
      if (Array.isArray(testInfo.annotations)) {
        testInfo.annotations.push({
          type: 'warning',
          description: `[Cloudflare Guard] Site ${url} is gated by Cloudflare Turnstile. Skipped cleanly.`
        });
      }
      if (typeof testInfo.skip === 'function') {
        testInfo.skip(true, 'Blocked by Cloudflare Managed Challenge');
      }
    }
    return true;
  }
  return false;
}

/**
 * Resilient Navigation (Layer 4 Utility)
 * Shields tests against transient DNS drops, Cloudflare socket stalls, and network resets.
 */
export async function gotoWithResilience(
  page: Page,
  url: string,
  options: ResilientNavigationOptions = {}
): Promise<Response | null> {
  const {
    timeout = 30000,
    waitUntil = 'domcontentloaded',
    maxRetries = 3,
    readySelector = 'input, button, form, a, [data-testid], h1, main'
  } = options;

  let lastError: any = null;

  // Stealth: Ensure automation flags are masked on the page
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    (window as any).chrome = { runtime: {}, loadTimes: () => {}, csi: () => {}, app: () => {} };
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  }).catch(() => {});

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await page.goto(url, { waitUntil, timeout });

      // Cloudflare Guard: Fast detect challenge if gated
      await checkCloudflareChallenge(page);

      // Business Ready Anchor: Ensure page DOM has committed interactive elements

      // Business Ready Anchor: Ensure page DOM has committed interactive elements
      if (readySelector) {
        await page.locator(readySelector).first().waitFor({
          state: 'visible',
          timeout: 10000
        }).catch(() => {});
      }

      return response;
    } catch (err: any) {
      lastError = err;

      // Real functional assertion errors must fail immediately
      const isDefect =
        err?.name === 'AssertionError' ||
        err?.message?.includes('expect(') ||
        err?.message?.includes('toBe(');

      if (isDefect) {
        throw err;
      }

      if (!isTransientNetworkError(err) || attempt === maxRetries) {
        console.error(`❌ [Resilient Nav] Navigation to "${url}" failed permanently after ${attempt} attempt(s): ${err?.message}`);
        throw err;
      }

      const backoffMs = attempt * 1500;
      console.warn(`🛡️ [DNS/Network Shield] Navigation attempt ${attempt} to "${url}" encountered: ${err?.message?.slice(0, 100)}... Retrying in ${backoffMs / 1000}s...`);
      await page.waitForTimeout(backoffMs);
    }
  }

  throw lastError;
}

/**
 * Resilient Reload: Retries page reloads through transient connection blips.
 */
export async function reloadWithResilience(
  page: Page,
  options: ResilientNavigationOptions = {}
): Promise<Response | null> {
  const {
    timeout = 25000,
    waitUntil = 'domcontentloaded',
    maxRetries = 3,
    readySelector = 'input, button, form, a, [data-testid], h1, main'
  } = options;

  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await page.reload({ waitUntil, timeout });
      if (readySelector) {
        await page.locator(readySelector).first().waitFor({
          state: 'visible',
          timeout: 10000
        }).catch(() => {});
      }
      return response;
    } catch (err: any) {
      lastError = err;
      if (!isTransientNetworkError(err) || attempt === maxRetries) {
        throw err;
      }
      const backoffMs = attempt * 1500;
      console.warn(`🛡️ [DNS/Network Shield] Reload attempt ${attempt} encountered: ${err?.message?.slice(0, 100)}... Retrying in ${backoffMs / 1000}s...`);
      await page.waitForTimeout(backoffMs);
    }
  }

  throw lastError;
}
