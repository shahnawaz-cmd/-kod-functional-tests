// detect-flow.js
const { chromium } = require('@playwright/test');
require('dotenv').config();

let ALL_DOMAINS = [
  { name: 'ToyotaWindowSticker', url: 'https://toyotawindowsticker.com/' },
  { name: 'DodgeWindowSticker', url: 'https://dodgewindowsticker.com/' },
  { name: 'AudiWindowSticker', url: 'https://audiwindowsticker.com/' }
];
try {
  const sites = require('../sites.json');
  if (Array.isArray(sites) && sites.length > 0) {
    ALL_DOMAINS = sites.map(s => ({ name: s.name, url: s.url }));
  }
} catch (e) {}

async function detectSingleDomain(name, url) {
  console.log(`\n🔍 [Flow Detection] Checking ${name} (${url})...`);
  const fs = require('fs');
  const path = require('path');
  let dnsRules = '';
  try {
    const rulesFile = path.resolve(__dirname, '..', 'dns-rules.json');
    if (!fs.existsSync(rulesFile)) {
      try {
        await require('../global-setup.js')();
      } catch (e) {}
    }
    if (fs.existsSync(rulesFile)) {
      dnsRules = JSON.parse(fs.readFileSync(rulesFile, 'utf-8')).rules || '';
    }
  } catch (e) {}

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--dns-result-order=ipv4first',
      ...(dnsRules ? [`--host-resolver-rules=${dnsRules}`] : [])
    ]
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  let flowType = null;
  let errorMsg = null;

  try {
    // Clear all browser cache, cookies, and local storage to guarantee fresh state
    await context.clearCookies();
    const cdp = await context.newCDPSession(page).catch(() => null);
    if (cdp) {
      await cdp.send('Network.clearBrowserCache').catch(() => {});
      await cdp.send('Network.clearBrowserCookies').catch(() => {});
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true }).catch(() => {});
    }
    // Append cache-buster query parameter to bypass Cloudflare edge cache (CF-Cache-Status: HIT)
    const freshUrl = url.includes('?') ? `${url}&_t=${Date.now()}` : `${url}${url.endsWith('/') ? '' : '/'}?_t=${Date.now()}`;

    for (let navAttempt = 1; navAttempt <= 4; navAttempt++) {
      try {
        await page.goto(freshUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
        break;
      } catch (navError) {
        console.warn(`  ⚠️ Navigation attempt ${navAttempt} failed (${navError.message}). Retrying...`);
        if (navAttempt === 4) throw navError;
        await page.waitForTimeout(3000 * navAttempt);
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
