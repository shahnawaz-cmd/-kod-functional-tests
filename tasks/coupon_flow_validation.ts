import { expect } from '@playwright/test';
import { Actor } from '../actors/Actor';

export class CouponAndPrevCouponVerification {
  async performAs(actor: Actor) {
    await this.couponTest(actor, 'preview15', '15%');
  }

  async couponTest(actor: Actor, couponCode: string, expectedDiscount: string) {
    const page = actor.getPage();

    // 1. Apply coupon via URL
    await page.goto(`/?offer=${couponCode}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // 2. Verify Cookie (Key: 'coupon', Value is dynamic, but we just check presence)
    const cookies = await page.context().cookies();
    const couponCookie = cookies.find(c => c.name === 'coupon');
    if (!couponCookie) {
      throw new Error('Failed: Coupon cookie not found.');
    }
    console.log(`Passed: Cookie found. Name: ${couponCookie.name}, Value: ${couponCookie.value}`);

    // 3. Verify Banner with flexible case-insensitive regex
    const bannerRegex = new RegExp(`You have received\\s+${expectedDiscount}\\s+Discount`, 'i');
    const bannerLocator = page.getByText(bannerRegex)
      .or(page.locator('text=' + bannerRegex))
      .or(page.locator('div[class*="coupon" i], div[class*="banner" i], div[class*="discount" i]').filter({ hasText: expectedDiscount }))
      .first();
    
    await expect(bannerLocator).toBeVisible({ timeout: 15000 });
    console.log(`Passed: Banner appeared with discount: "${expectedDiscount}"`);
  }
}

export class LowToHighCouponFlow {
  async performAs(actor: Actor) {
    const page = actor.getPage();
    const verifier = new CouponAndPrevCouponVerification();

    // 1. Apply low discount coupon (preview15)
    console.log('--- Applying 1st Coupon: preview15 ---');
    await verifier.couponTest(actor, 'preview15', '15%');
    const firstCouponVal = (await page.context().cookies()).find(c => c.name === 'coupon')?.value;

    // 2. Apply high discount coupon (get20)
    console.log('--- Applying 2nd Coupon: get20 ---');
    await page.goto('/?offer=get20', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    
    // Verify cookies: coupon should be get20, prev_coupon should be preview15
    const cookies = await page.context().cookies();
    const couponCookie = cookies.find(c => c.name === 'coupon');
    const prevCouponCookie = cookies.find(c => c.name === 'prev_coupon');
    
    if (couponCookie?.value !== 'get20' || prevCouponCookie?.value !== firstCouponVal) {
      throw new Error(`Failed: Cookie verification failed. Coupon: ${couponCookie?.value}, Prev: ${prevCouponCookie?.value}`);
    }
    console.log('Passed: Cookie verification (coupon=get20, prev_coupon=preview15)');

    // 3. Verify Banner for high coupon (20%)
    const highBannerLocator = page.getByText(/You have received\s+20%\s+Discount/i)
      .or(page.locator('div[class*="coupon" i], div[class*="banner" i]').filter({ hasText: '20%' }))
      .first();
    await expect(highBannerLocator).toBeVisible({ timeout: 15000 });
    console.log('Passed: Banner showed 20% Discount.');

    // 4. Apply low coupon again (preview15) - High should remain active
    console.log('--- Applying 1st Coupon again to verify no override ---');
    await page.goto('/?offer=preview15', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // Expected: Banner should still show 20% (highest coupon not overridden)
    await expect(highBannerLocator).toBeVisible({ timeout: 10000 });
    console.log('Passed: Highest coupon (20%) was NOT overridden by lower coupon.');
  }
}

export class CouponBannerOnOtherPages {
  async performAs(actor: Actor) {
    const page = actor.getPage();
    const verifier = new CouponAndPrevCouponVerification();

    // 1. Apply coupon on base URL and verify
    await verifier.couponTest(actor, 'preview15', '15%');

    // 2. Navigate to /vin-decoder
    const validPath = '/vin-decoder';

    await page.goto(validPath, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    console.log(`Passed: Navigated to valid path: ${validPath}`);

    // 3. Verify banner is still visible using flexible regex
    const bannerRegex = /You have received\s+15%\s+Discount/i;
    const bannerLocator = page.getByText(bannerRegex)
      .or(page.locator('text=' + bannerRegex))
      .or(page.locator('div[class*="coupon" i], div[class*="banner" i]').filter({ hasText: '15%' }))
      .first();

    await expect(bannerLocator).toBeVisible({ timeout: 15000 });
    console.log('Passed: Banner persisted on the page: ' + validPath);
  }
}