// tasks/pricing/PricingToCheckoutNavigationTask.ts
import { Page, TestInfo, expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {
  clickWithHealing,
  fastInputWithHealing,
  locateElementWithHealing,
  locateInputWithHealing
} from '../../utils/selfHealingLocator';

export type PricingPlanType = 'report' | 'sticker' | 'any';

/**
 * Self-healing Email Generator
 * Always derives unique emails from the base email alias (e.g. rolex.rolls12+<unique>@gmail.com).
 */
export function generateEmail(baseEmail: string = 'rolex.rolls12@gmail.com'): string {
  const [username, domain] = baseEmail.split('@');
  const uniqueSuffix = Math.random().toString(36).substring(2, 6) + Date.now().toString(36).slice(-3);
  return `${username}+${uniqueSuffix}@${domain || 'gmail.com'}`;
}

export class PricingToCheckoutNavigationTask {
  private planType: PricingPlanType;
  private baseEmail: string;
  private timeout: number;

  constructor(planType: PricingPlanType = 'any', baseEmail: string = 'rolex.rolls12@gmail.com') {
    this.planType = planType;
    this.baseEmail = baseEmail;
    this.timeout = process.env.CI ? 60000 : 45000;
  }

  async performAs(actorOrPage: any, testInfo?: TestInfo): Promise<string> {
    const page: Page = typeof actorOrPage.getPage === 'function' ? actorOrPage.getPage() : actorOrPage;
    let checkoutUrl = '';
    const generatedEmail = generateEmail(this.baseEmail);

    const isDVH = page.url().includes('detailedvehiclehistory.com');
    const pricingPath = isDVH ? '/vin-check-rates' : '/pricing';

    await test.step(`Step 1: Ensure ${pricingPath} Page is Loaded`, async () => {
      console.log('🌐 [Pricing to Checkout] Checking current URL...');
      if (!page.url().includes(pricingPath)) {
        console.log(`🔄 [Pricing to Checkout] Navigating to ${pricingPath}...`);
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await page.goto(pricingPath, { waitUntil: 'domcontentloaded', timeout: 30000 });
            break;
          } catch (e: any) {
            console.warn(`⚠️ [Pricing to Checkout] Navigation attempt ${attempt} failed (${e.message}). Retrying...`);
            if (attempt === 3) throw e;
            await page.waitForTimeout(2000);
          }
        }
      }
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
    });

    const effectivePlan = this.planType === 'any' ? (Math.random() > 0.5 ? 'sticker' : 'report') : this.planType;

    await test.step(`Step 2: Select Plan Type & Click CTA with Self-Healing (${effectivePlan})`, async () => {
      // 1. If planType is sticker, toggle Window Sticker view
      if (effectivePlan === 'sticker') {
        console.log('🏷️ [Pricing to Checkout] Switching to Window Sticker tab...');
        const stickerTabSelectors = [
          'button:has-text("Window Sticker")',
          'button[role="tab"]:has-text("Window Sticker")',
          'button:has-text("Sticker")',
          'text="Window Sticker"'
        ];
        await clickWithHealing(page, 'Window Sticker', stickerTabSelectors, { strategyTimeout: 2000 }).catch(async () => {
          const tab = page.getByRole('button', { name: /Window Sticker/i }).first();
          if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
            await tab.click({ force: true });
          }
        });
        await page.waitForTimeout(1000);
      } else if (effectivePlan === 'report') {
        console.log('📄 [Pricing to Checkout] Ensuring Vehicle History Report tab is active...');
        const reportTab = page.getByRole('button', { name: /Vehicle History Report/i }).first();
        if (await reportTab.isVisible({ timeout: 1500 }).catch(() => false)) {
          await reportTab.click({ force: true }).catch(() => {});
        }
        await page.waitForTimeout(500);
      }

      // Check if email input is ALREADY visible (e.g. if previous action or direct render)
      const existingEmailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
      const isEmailAlreadyVisible = await existingEmailInput.isVisible({ timeout: 1500 }).catch(() => false);

      if (!isEmailAlreadyVisible) {
        console.log('🎯 [Pricing to Checkout] Locating Plan CTA button with self-healing strategies...');

        const planCtaSelectors = [
          'button:has-text("Get Report")',
          'button:has-text("Get Reports")',
          'button:has-text("Get Sticker")',
          'button:has-text("Get Stickers")',
          'button:has-text("Get window sticker")',
          'button:has-text("Subscribe Now")',
          'button:has-text("Buy Now")',
          'button:has-text("Select")',
          'button[type="submit"]',
          'a:has-text("Get Report")',
          'a:has-text("Get Sticker")'
        ];

        // Specific CTA search based on plan preference
        let preferredLabel = 'Get Report';
        if (effectivePlan === 'sticker') {
          preferredLabel = 'Get Sticker';
        }

        try {
          await clickWithHealing(page, preferredLabel, planCtaSelectors, { strategyTimeout: 2500, timeout: 10000 });
        } catch (e) {
          console.log(`⚠️ [Self-Healing Fallback] Primary click failed, trying regex fallback: ${e.message}`);
          const fallbackBtn = page.locator('button, a').filter({
            hasText: /(Get Report|Get Reports|Get Sticker|Get Stickers|Get Window Sticker|Subscribe Now|Buy Now)/i
          }).first();
          await fallbackBtn.scrollIntoViewIfNeeded().catch(() => {});
          await fallbackBtn.click({ force: true });
        }
      }
    });

    await test.step(`Step 3: Input Generated Email via Self-Healing (${generatedEmail})`, async () => {
      console.log(`✉️ [Pricing to Checkout] Filling self-healing email field with: ${generatedEmail}`);

      const emailSelectors = [
        'input[type="email"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="you@example.com" i]',
        'input[name*="email" i]',
        'input[aria-label*="email" i]',
        'input[id*="email" i]'
      ];

      await fastInputWithHealing(
        page,
        'Email',
        generatedEmail,
        emailSelectors,
        { timeout: 15000, strategyTimeout: 2500 }
      );

      await page.waitForTimeout(500);
    });

    await test.step('Step 4: Click Proceed to Checkout CTA via Self-Healing', async () => {
      console.log('🚀 [Pricing to Checkout] Clicking Proceed to Checkout CTA...');

      const proceedSelectors = [
        'button:has-text("Proceed to Checkout")',
        'button:has-text("Proceed to checkout")',
        'button:has-text("Proceed")',
        'button[type="submit"]:has-text("Proceed")',
        'button[type="submit"]',
        'button:has-text("Continue")',
        'button:has-text("Pay Now")'
      ];

      await clickWithHealing(
        page,
        'Proceed to Checkout',
        proceedSelectors,
        { timeout: 15000, strategyTimeout: 2500 }
      );
    });

    await test.step('Step 5: Wait Until Document Loads & Capture Checkout URL and Screenshot', async () => {
      console.log('⏳ [Pricing to Checkout] Waiting for checkout redirection & document load...');

      // Wait for URL redirection to checkout page
      await page.waitForURL(
        /.*(checkout|payment|billing|order|purchase|confirmation|summary|subscribe).*/i,
        { timeout: this.timeout, waitUntil: 'domcontentloaded' }
      );

      // Wait until document fully loads
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);

      checkoutUrl = page.url();
      console.log(`🔗 [Checkout URL Captured]: ${checkoutUrl}`);

      // Ensure screenshots directory exists
      const screenshotDir = path.resolve(process.cwd(), 'test-results', 'screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      const timestamp = Date.now();
      const filename = `pricing-to-checkout-${effectivePlan}-${timestamp}.png`;
      const screenshotPath = path.join(screenshotDir, filename);

      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Print mandatory log in STDOUT
      console.log('\n' + '='.repeat(80));
      console.log('✅ [PRICING TO CHECKOUT NAVIGATION PASSED]');
      console.log(`📧 User Email:    ${generatedEmail}`);
      console.log(`🎯 Plan Type:     ${effectivePlan}`);
      console.log(`🔗 Checkout URL:  ${checkoutUrl}`);
      console.log(`📸 Screenshot:    ${screenshotPath}`);
      console.log('='.repeat(80) + '\n');

      // Attach screenshot to Playwright / Allure report if testInfo provided
      if (testInfo) {
        await testInfo.attach('Pricing To Checkout Navigation', {
          path: screenshotPath,
          contentType: 'image/png'
        });
      }

      // Assert checkout URL validity
      expect(checkoutUrl).toMatch(/.*(checkout|payment|billing|order|purchase|summary).*/i);
    });

    return checkoutUrl;
  }
}
