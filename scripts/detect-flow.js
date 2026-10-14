// detect-flow.js
const { chromium } = require('@playwright/test');
require('dotenv').config();

const ALL_DOMAINS = [
  { name: 'ToyotaWindowSticker', url: 'https://toyotawindowsticker.com/' },
  { name: 'DodgeWindowSticker', url: 'https://dodgewindowsticker.com/' },
  { name: 'AudiWindowSticker', url: 'https://audiwindowsticker.com/' }
];

async function detectSingleDomain(name, url) {
  console.log(`\n🔍 [Flow Detection] Checking ${name} (${url})...`);
  const browser = await chromium.launch({
    headless: true,
    args: ['--dns-result-order=ipv4first']
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  let flowType = null;
  let errorMsg = null;

  try {
    for (let navAttempt = 1; navAttempt <= 3; navAttempt++) {
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 30000 });
        break;
      } catch (navError) {
        console.warn(`  ⚠️ Navigation attempt ${navAttempt} failed (${navError.message}). Retrying...`);
        if (navAttempt === 3) throw navError;
        await page.waitForTimeout(2000);
      }
    }

    // Poll up to 10 seconds for checkout_flow cookie or localStorage
    for (let attempt = 0; attempt < 20; attempt++) {
      await page.waitForTimeout(500);

      const cookies = await context.cookies();
      const flowCookie = cookies.find((c) => c.name === 'checkout_flow');
      if (flowCookie) {
        flowType = flowCookie.value;
        break;
      }

      const lsFlow = await page.evaluate(() => {
        try {
          const settings = JSON.parse(localStorage.getItem('site_settings') || '{}');
          return settings.checkout_flow || null;
        } catch (e) {
          return null;
        }
      });

      if (lsFlow) {
        flowType = lsFlow;
        break;
      }
    }
  } catch (err) {
    errorMsg = err.message;
  } finally {
    await browser.close().catch(() => {});
  }

  if (flowType) {
    console.log(`  ✅ ${name}: ${flowType}`);
  } else {
    console.log(`  ❌ ${name}: ${errorMsg ? `Failed (${errorMsg})` : 'Not Detected'}`);
  }

  return { name, url, flowType: flowType || 'UNKNOWN', error: errorMsg };
}

async function detectFlow(targetUrl) {
  try {
    const isAll = process.argv.includes('--all') || (!targetUrl && !process.env.BASE_URL);

    if (isAll) {
      console.log('==================================================');
      console.log('🚀 Running Flow Detection across Project Brand Domains');
      console.log('==================================================');

      const results = [];
      for (const domain of ALL_DOMAINS) {
        const res = await detectSingleDomain(domain.name, domain.url);
        results.push(res);
      }

      console.log('\n==================================================');
      console.log('📊 FLOW DETECTION SUMMARY TABLE');
      console.log('==================================================');
      console.table(results.map(r => ({
        Brand: r.name,
        URL: r.url,
        'Checkout Flow': r.flowType,
        Status: r.error ? 'Error / Unreachable' : 'Detected'
      })));

      return results;
    } else {
      const url = targetUrl || process.env.BASE_URL || ALL_DOMAINS[0].url;
      const res = await detectSingleDomain('TargetSite', url);
      const finalFlow = res.flowType && res.flowType !== 'UNKNOWN' ? res.flowType : 'streaming';
      console.log(`\nDetected Checkout Flow : ${finalFlow}`);

      if (!res.flowType || res.flowType === 'UNKNOWN') {
        if (require.main === module) process.exit(1);
      }
      return finalFlow;
    }
  } catch (err) {
    console.error('Flow detection error:', err);
    throw err;
  }
}

if (require.main === module) {
  const cliUrl = process.argv.slice(2).find(arg => !arg.startsWith('--'));
  detectFlow(cliUrl);
}

module.exports = { detectFlow, ALL_DOMAINS };
