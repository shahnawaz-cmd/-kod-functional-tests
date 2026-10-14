# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/pricing_page.spec.ts >> Pricing Page Suite >> TC_PRICING_06 — Verify coupon banner appearance and percentage price reflection on /pricing
- Location: tests/pricing_page.spec.ts:120:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/You have received\s+15%\s+Discount/i).or(locator('text=/You have received\\s+15%\\s+Discount/i')).or(locator('div[class*="coupon" i], div[class*="banner" i], div[class*="discount" i]').filter({ hasText: '15%' })).first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByText(/You have received\s+15%\s+Discount/i).or(locator('text=/You have received\\s+15%\\s+Discount/i')).or(locator('div[class*="coupon" i], div[class*="banner" i], div[class*="discount" i]').filter({ hasText: '15%' })).first()

```

```yaml
- checkbox "Toggle menu"
- banner:
  - link "GMC Window Sticker logo":
    - /url: /
    - img "GMC Window Sticker logo"
  - navigation:
    - link "Build sheet":
      - /url: /build-sheet-by-vin
    - link "Paint Code by VIN":
      - /url: /paint-code-using-the-vin
    - link "Pricing":
      - /url: /pricing
    - group:
      - text: Tools
      - img
  - link "Login":
    - /url: /login
  - link "Sign Up":
    - /url: /signup
- main:
  - navigation "Breadcrumb":
    - list:
      - listitem:
        - link "Home":
          - /url: /
      - listitem:
        - img
        - text: GMC Window Sticker Pricing
  - text: Plans Built For Buyers
  - heading "GMC Window Sticker Pricing" [level=1]
  - paragraph: Looking for a GMC window sticker or report without the runaround? Choose a single report when you need one, subscribe for unlimited monthly access, or ask about bulk pricing built for your business.
  - text: Buy Credits, Use Anytime Factory Window Stickers MSRP, Options & Packages
  - heading "Flexible Plans. Honest Pricing. No Hidden Fees." [level=2]
  - paragraph: Looking for a GMC window sticker or report without the runaround? Choose a single report when you need one, subscribe for unlimited monthly access, or ask about bulk pricing built for your business.
  - button "Vehicle History Report"
  - button "Toggle product"
  - button "Window Sticker"
  - button "Personal"
  - button "Business Save 68%"
  - heading "1 Sticker" [level=3]
  - text: "$ 25 /sticker Total: $25 Full price"
  - paragraph: Buy now, use later!
  - list:
    - listitem: Instant digital delivery
    - listitem: Credits never expire
    - listitem: PDF download included
  - button "Get Sticker"
  - heading "2 Stickers" [level=3]
  - text: "Save 40% $ 14.99 /sticker Total: $50.00 $29.99"
  - paragraph: Buy now, use later!
  - list:
    - listitem: Instant digital delivery
    - listitem: Credits never expire
    - listitem: PDF download included
  - button "Get Stickers"
  - heading "5 Stickers" [level=3]
  - text: "Save 52% $ 12.00 /sticker Total: $125.00 $59.99"
  - paragraph: Buy now, use later!
  - list:
    - listitem: Instant digital delivery
    - listitem: Credits never expire
    - listitem: PDF download included
  - button "Get Stickers"
  - heading "10 Stickers" [level=3]
  - text: "Save 68% $ 8.00 /sticker Total: $250.00 $79.99"
  - paragraph: Buy now, use later!
  - list:
    - listitem: Instant digital delivery
    - listitem: Credits never expire
    - listitem: PDF download included
  - button "Get Stickers"
  - heading "Unlimited Window Stickers" [level=3]
  - text: Best Value!
  - paragraph: Monthly Subscription
  - paragraph: Discover the original window sticker and factory specifications along with options & packages for any vehicle with unlimited access to window sticker reports.
  - text: $39.99 /month
  - paragraph: Billed monthly • Cancel anytime!
  - button "Subscribe Now"
  - link "View sample":
    - /url: https://app.gmcwindowsticker.com/sticker/vin/1GTN1TEH8EZ382106-3D8A3D8A-5E5E-46BA-81E0-87ED93477701
  - heading "Why choose this plan?" [level=4]
  - list:
    - listitem: Unlimited access to window sticker reports
    - listitem: Free access to VIN decoding, recall checks, and vehicle maintenance insights
    - listitem: Exclusive dashboard to manage your window sticker reports
    - listitem: Priority access to new features and updates
    - listitem: Early access for upcoming features and more!
  - paragraph: Get 50% off full detailed reports when you subscribe.
  - paragraph: Our window sticker include original window sticker details, manufacturer's suggested retail price (MSRP), standard and optional equipment, exterior and interior features, fuel economy ratings, and warranty information.
  - heading "Every Package Includes Everything" [level=2]
  - paragraph: Every plan you pick comes loaded with these extras, no upgrades needed, no exceptions.
  - list:
    - listitem: Credits for Vehicle History Reports or Window Stickers
    - listitem: Free VIN decoding with detailed specifications
    - listitem: Unlimited access to your generated reports and stickers
    - listitem: Free recall and maintenance information
    - listitem: Free access to vehicle market value
    - listitem: Download your report or sticker as a PDF for offline use
    - listitem: Add and save vehicles to your own garage
    - listitem: 24/7 customer service and live chat support
  - heading "Take a Look at Real Samples First" [level=2]
  - paragraph: Before you commit, browse an actual GMC window sticker and a real vehicle history report so you know exactly what lands in your inbox.
  - link "Sample Window Sticker":
    - /url: https://app.gmcwindowsticker.com/sticker/vin/1GTN1TEH8EZ382106-3D8A3D8A-5E5E-46BA-81E0-87ED93477701
  - link "Sample Report":
    - /url: https://app.gmcwindowsticker.com/report/vin/1GTN2LEC5GZ139373
  - heading "Frequently Asked Questions" [level=2]
  - paragraph: Every report covers title status, accident records, past owners, service history, mileage checks, and open recalls, giving you the full picture before you buy or sell.
  - group:
    - heading "What is a GMC window sticker, and what does it include?" [level=3]
  - group:
    - heading "Are subscription plans available?" [level=3]
  - group:
    - heading "Can I get a discount for purchasing in bulk?" [level=3]
  - group:
    - heading "What if the standard plans don't meet my business requirements?" [level=3]
  - group:
    - heading "Do you offer enterprise-level packages?" [level=3]
  - group:
    - heading "Do you offer unlimited usage plans?" [level=3]
  - group:
    - heading "Are there hidden fees?" [level=3]
  - group:
    - heading "What payment methods do you accept?" [level=3]
  - group:
    - heading "Can I cancel my subscription anytime?" [level=3]
  - group:
    - heading "Do unused credits ever expire?" [level=3]
  - group:
    - heading "How secure is my payment information?" [level=3]
  - group:
    - heading "Do I need an account to order a report or sticker?" [level=3]
- contentinfo:
  - link "GMC Window Sticker logo (white)":
    - /url: /
    - img "GMC Window Sticker logo (white)"
  - paragraph: support@gmcwindowsticker.com
  - paragraph: About Company
  - list:
    - listitem:
      - link "About Us":
        - /url: /about-us
    - listitem:
      - link "Contact Us":
        - /url: /contact-us
    - listitem:
      - link "Blog":
        - /url: /blog
    - listitem:
      - link "Sample":
        - /url: https://app.gmcwindowsticker.com/sticker/vin/1GTN1TEH8EZ382106-3D8A3D8A-5E5E-46BA-81E0-87ED93477701
  - paragraph: Products
  - list:
    - listitem:
      - link "Get window sticker":
        - /url: /
    - listitem:
      - link "Build Sheet by VIN":
        - /url: /build-sheet-by-vin
    - listitem:
      - link "VIN Decoder":
        - /url: /vin-decoder
  - paragraph: Support
  - list:
    - listitem:
      - link "Privacy Policy":
        - /url: /privacy-policy
    - listitem:
      - link "Request a Refund":
        - /url: /request-a-refund
  - paragraph: © 2026 GMC Window Sticker. All rights reserved.
- alert
```

# Test source

```ts
  1   | // tasks/pricing/PricingCouponDiscountTask.ts
  2   | import { Page, TestInfo, expect, test } from '@playwright/test';
  3   | import * as fs from 'fs';
  4   | import * as path from 'path';
  5   | 
  6   | export class PricingCouponDiscountTask {
  7   |   private couponCode: string;
  8   |   private discountPercent: number;
  9   | 
  10  |   constructor(couponCode: string = 'preview15', discountPercent: number = 15) {
  11  |     this.couponCode = couponCode;
  12  |     this.discountPercent = discountPercent;
  13  |   }
  14  | 
  15  |   async performAs(page: Page, testInfo?: TestInfo) {
  16  |     const discountStr = `${this.discountPercent}%`;
  17  |     let baselinePrice = 0;
  18  |     let expectedDiscountedPrice = '';
  19  | 
  20  |     await test.step('Step 1: Fetch Baseline Pricing Before Coupon', async () => {
  21  |       console.log('📡 [Pricing Coupon] Fetching baseline 1 Report price...');
  22  |       const response = await page.request.get('/api/pricing?sticker=0&dealer=1');
  23  |       expect(response.status()).toBe(200);
  24  | 
  25  |       const data = await response.json();
  26  |       const plan = data.reportUser?.credit_plans?.[0];
  27  |       expect(plan).toBeDefined();
  28  | 
  29  |       baselinePrice = parseFloat(plan.price);
  30  |       // Calculate expected price: baseline * (1 - discount% / 100)
  31  |       const discountedVal = baselinePrice * (1 - this.discountPercent / 100);
  32  |       expectedDiscountedPrice = discountedVal.toFixed(2);
  33  | 
  34  |       console.log(`💵 [Baseline] Original 1 Report price: $${baselinePrice.toFixed(2)}`);
  35  |       console.log(`🎯 [Calculated] Expected price after ${discountStr} discount: $${expectedDiscountedPrice}`);
  36  |     });
  37  | 
  38  |     const isDVH = page.url().includes('detailedvehiclehistory.com') || (testInfo?.project.use?.baseURL as string)?.includes('detailedvehiclehistory.com') || testInfo?.project.name?.includes('DetailedVehicleHistory');
  39  |     const pricingRoute = isDVH ? '/vin-check-rates' : '/pricing';
  40  | 
  41  |     await test.step(`Step 2: Navigate to ${pricingRoute} with Coupon Offer (?offer=${this.couponCode})`, async () => {
  42  |       console.log(`🔄 [Pricing Coupon] Navigating to ${pricingRoute}?offer=${this.couponCode}...`);
  43  |       await page.goto(`${pricingRoute}?offer=${this.couponCode}`, { waitUntil: 'domcontentloaded' });
  44  |       await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  45  |       await page.waitForTimeout(1000);
  46  |     });
  47  | 
  48  |     await test.step(`Step 3: Verify Coupon Banner Appears on Pricing Page (${discountStr} Discount)`, async () => {
  49  |       console.log(`🔍 [Pricing Coupon] Validating "${discountStr} Discount" banner visibility...`);
  50  |       const bannerRegex = new RegExp(`You have received\\s+${discountStr}\\s+Discount`, 'i');
  51  |       const bannerLocator = page.getByText(bannerRegex)
  52  |         .or(page.locator('text=' + bannerRegex))
  53  |         .or(page.locator('div[class*="coupon" i], div[class*="banner" i], div[class*="discount" i]').filter({ hasText: discountStr }))
  54  |         .first();
  55  | 
> 56  |       await expect(bannerLocator).toBeVisible({ timeout: 15000 });
      |                                   ^ Error: expect(locator).toBeVisible() failed
  57  |       console.log(`✅ [Banner Passed] Discount banner is prominently displayed on /pricing: "${discountStr}"`);
  58  |     });
  59  | 
  60  |     await test.step(`Step 4: Verify Prices Reflect Discount Percentage (${discountStr})`, async () => {
  61  |       console.log(`🔍 [Pricing Coupon] Validating card prices reflect ${discountStr} discount...`);
  62  | 
  63  |       // 1. Check for "Save X%" discount tag on the first card
  64  |       const saveBadge = page.locator('text=Save ' + discountStr).first();
  65  |       await expect(saveBadge).toBeVisible({ timeout: 10000 });
  66  | 
  67  |       // 2. Check for discounted price on UI
  68  |       // Allow for either strict 2 decimal places ($16.99 / EUR8.48) or integer formatting ($51 or $85)
  69  |       const sign = (await page.evaluate(() => {
  70  |         const text = document.body.innerText;
  71  |         if (text.includes('EUR') || text.includes('€')) return '(EUR|€)';
  72  |         if (text.includes('C$') || text.includes('CAD')) return '(C\\$|CAD)';
  73  |         return '\\$';
  74  |       }));
  75  |       const formattedPriceRegex = new RegExp(`(${sign}|\\$)?\\s*(${expectedDiscountedPrice}|${Math.round(parseFloat(expectedDiscountedPrice))})`);
  76  |       const priceElement = page.locator('*').filter({ hasText: formattedPriceRegex }).first();
  77  |       await expect(priceElement).toBeVisible({ timeout: 10000 });
  78  | 
  79  |       console.log(`✅ [Price Reflection Passed] 1 Report card reflects discount: ${expectedDiscountedPrice} (Save ${discountStr})`);
  80  |     });
  81  | 
  82  |     await test.step('Step 5: Capture Coupon Banner & Discounted Pricing Screenshot', async () => {
  83  |       const screenshotDir = path.resolve(process.cwd(), 'test-results', 'screenshots');
  84  |       if (!fs.existsSync(screenshotDir)) {
  85  |         fs.mkdirSync(screenshotDir, { recursive: true });
  86  |       }
  87  | 
  88  |       const filename = `pricing-coupon-${this.couponCode}-${Date.now()}.png`;
  89  |       const screenshotPath = path.join(screenshotDir, filename);
  90  |       const buffer = await page.screenshot({ path: screenshotPath, fullPage: true });
  91  | 
  92  |       if (testInfo) {
  93  |         await testInfo.attach(`pricing-coupon-${this.couponCode}.png`, {
  94  |           body: buffer,
  95  |           contentType: 'image/png',
  96  |         }).catch(() => {});
  97  |       }
  98  | 
  99  |       console.log(`📸 [STDOUT SCREENSHOT] Coupon pricing screenshot captured: ${screenshotPath}`);
  100 |     });
  101 |   }
  102 | }
  103 | 
```