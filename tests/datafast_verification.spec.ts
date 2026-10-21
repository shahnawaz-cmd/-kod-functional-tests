import { test, expect } from '@playwright/test';
import { DataFastVerificationTask } from '../tasks/DataFastVerificationTask';

interface DataFastSiteTarget {
  name: string;
  baseUrl: string;
  expectedWebsiteId: string;
  expectedDomain: string;
  previewPath: (vin: string) => string;
  checkoutPath: (vin: string) => string;
}

/*
test.describe('DataFast Stealth Telemetry & Cookie Verification Suite', () => {

  const TEST_VIN = '1HGCR2F83HA001234';

  const TARGET_SITES: DataFastSiteTarget[] = [
    {
      name: 'Detailed Vehicle History (DVH)',
      baseUrl: 'https://detailedvehiclehistory.com',
      expectedWebsiteId: 'dfid_Czs2Hy80SCi2wqeIdI6R7',
      expectedDomain: 'detailedvehiclehistory.com',
      previewPath: (vin) => `/vin-check/preview?vin=${vin}&type=vhr&wpPage=homepage`,
      checkoutPath: (vin) => `/checkout?data=eyJjb2RlIjoiRFZIMSIsInR5cGUiOiJyZXBvcnQiLCJ2aW4iOiIke3Zpbn0iLCJlbWFpbCI6ImRhdGFmYXN0LnFhQGV4YW1wbGUuY29tIiwibm9zIjoxLCJpdGVtTGFiZWwiOiJSZXBvcnQiLCJwcmljZSI6MTkuOTksImN1cnJlbmN5U2lnbiI6IiQiLCJjdXJyZW5jeSI6IlVTRCIsIndwUGFnZSI6ImhvbWVwYWdlIn0=`
    },
    {
      name: 'Instant VIN Reports (IVR)',
      baseUrl: 'https://instantvinreports.com',
      expectedWebsiteId: 'dfid_0YC7hCJWv3PiWtBxCoD4T',
      expectedDomain: 'instantvinreports.com',
      previewPath: (vin) => `/vin-check?vin=${vin}`,
      checkoutPath: (vin) => `/checkout?vin=${vin}`
    },
    {
      name: 'Classic Decoder (CD)',
      baseUrl: 'https://classicdecoder.com',
      expectedWebsiteId: 'dfid_Z9fxrnApPGPekguRWhukZ',
      expectedDomain: 'classicdecoder.com',
      previewPath: (vin) => `/history-report`,
      checkoutPath: (vin) => `/build-sheet`
    },
    {
      name: 'Premium VIN (PV)',
      baseUrl: 'https://premiumvin.com',
      expectedWebsiteId: 'dfid_pending', // to be updated once devs provide the ID
      expectedDomain: 'premiumvin.com',
      previewPath: (vin) => `/vin-check?vin=${vin}`,
      checkoutPath: (vin) => `/checkout?vin=${vin}`
    }
  ];

  for (const site of TARGET_SITES) {
    const testId = site.name.includes('DVH') ? 'DVH' : site.name.includes('IVR') ? 'IVR' : site.name.includes('Classic') ? 'CD' : 'PV';

    test(`TC_DATAFAST_STEALTH_${testId} — Verify DataFast Telemetry, Cookies, and Funnel Continuity on ${site.name}`, async ({ browser }, testInfo) => {
      testInfo.setTimeout(120000);

      // 1. Initialize browser context with stealth parameters (real UA and masked webdriver)
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 }
      });

      const dataFastTask = new DataFastVerificationTask(testInfo);
      await dataFastTask.applyStealthBypass(context);

      const page = await context.newPage();
      dataFastTask.setupTelemetryListener(page);

      console.log(`\n===============================================================`);
      console.log(`🚀 [Stealth Test] Starting Verification on ${site.name}`);
      console.log(`   Base URL: ${site.baseUrl}`);
      console.log(`   Expected Website ID: ${site.expectedWebsiteId}`);
      console.log(`===============================================================`);

      // ─────────────────────────────────────────────────────────────
      // 1. Step 1: Homepage Verification (DOM + Telemetry + Cookies)
      // ─────────────────────────────────────────────────────────────
      console.log(`\n🌐 [Step 1: Homepage] Navigating to ${site.baseUrl}/`);
      await page.goto(`${site.baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 35000 });

      // Check DOM script tag
      const homeScript = await dataFastTask.extractDataFastScript(page);
      await dataFastTask.assertDataFastScript(homeScript, `${site.name} Homepage`, site.expectedWebsiteId);

      // Check Real Cookie Creation
      const homeCookies = await dataFastTask.assertDataFastCookies(context, `${site.name} Homepage`);
      expect(homeCookies.visitorId).toBeTruthy();
      expect(homeCookies.sessionId).toBeTruthy();

      await testInfo.attach(`${site.name}_Homepage_Verification.json`, {
        body: JSON.stringify({
          script: homeScript,
          cookies: homeCookies
        }, null, 2),
        contentType: 'application/json'
      });

      // ─────────────────────────────────────────────────────────────
      // 2. Step 2: Preview Page Verification
      // ─────────────────────────────────────────────────────────────
      const previewUrl = `${site.baseUrl}${site.previewPath(TEST_VIN)}`;
      console.log(`\n🔍 [Step 2: Preview Page] Navigating to ${previewUrl}`);
      await page.goto(previewUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });

      const previewScript = await dataFastTask.extractDataFastScript(page);
      await dataFastTask.assertDataFastScript(previewScript, `${site.name} Preview Page`, site.expectedWebsiteId);

      // Verify cookies persist with same visitor ID across pages
      const previewCookies = await dataFastTask.assertDataFastCookies(context, `${site.name} Preview Page`);
      expect(previewCookies.visitorId, 'Visitor ID must persist from Homepage to Preview').toBe(homeCookies.visitorId);

      await testInfo.attach(`${site.name}_Preview_Verification.json`, {
        body: JSON.stringify({
          script: previewScript,
          cookies: previewCookies
        }, null, 2),
        contentType: 'application/json'
      });

      // ─────────────────────────────────────────────────────────────
      // 3. Step 3: Checkout Page Verification
      // ─────────────────────────────────────────────────────────────
      const checkoutUrl = `${site.baseUrl}${site.checkoutPath(TEST_VIN)}`;
      console.log(`\n🛒 [Step 3: Checkout Page] Navigating to ${checkoutUrl}`);
      await page.goto(checkoutUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });

      const checkoutScript = await dataFastTask.extractDataFastScript(page);
      await dataFastTask.assertDataFastScript(checkoutScript, `${site.name} Checkout Page`, site.expectedWebsiteId);

      // Verify cookies persist on Checkout (this visitor ID is what connects to Stripe)
      const checkoutCookies = await dataFastTask.assertDataFastCookies(context, `${site.name} Checkout Page`);
      expect(checkoutCookies.visitorId, 'Visitor ID must persist onto Checkout page for Stripe attribution').toBe(homeCookies.visitorId);

      await testInfo.attach(`${site.name}_Checkout_Verification.json`, {
        body: JSON.stringify({
          script: checkoutScript,
          cookies: checkoutCookies
        }, null, 2),
        contentType: 'application/json'
      });

      // ─────────────────────────────────────────────────────────────
      // 4. Verify Telemetry Beacons Captured
      // ─────────────────────────────────────────────────────────────
      const capturedEvents = dataFastTask.getCapturedEvents();
      console.log(`\n📡 Total DataFast Telemetry POST Events Captured: ${capturedEvents.length}`);
      expect(capturedEvents.length, 'At least one telemetry event must be sent to datafa.st/api/events').toBeGreaterThan(0);

      const latestEvent = capturedEvents[capturedEvents.length - 1];
      expect(latestEvent.websiteId).toBe(site.expectedWebsiteId);
      expect(latestEvent.visitorId).toBe(checkoutCookies.visitorId);

      await testInfo.attach(`${site.name}_Telemetry_Events.json`, {
        body: JSON.stringify(capturedEvents, null, 2),
        contentType: 'application/json'
      });

      console.log(`\n🎉 [${site.name}] COMPLETE: DataFast Telemetry & Stripe Visitor ID (${checkoutCookies.visitorId}) Verified!`);
      await context.close();
    });
  }

});
*/
