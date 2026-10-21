// scripts/detect-flow.js
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
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

async function getDnsRules() {
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
  return dnsRules;
}

async function detectSingleDomain(name, url, browserInstance = null) {
  let browser = browserInstance;
  let shouldCloseBrowser = false;
  let dnsRules = await getDnsRules();

  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--dns-result-order=ipv4first',
        ...(dnsRules ? [`--host-resolver-rules=${dnsRules}`] : [])
      ]
    });
    shouldCloseBrowser = true;
  }

  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  let flowType = null;
  let errorMsg = null;

  try {
    const freshUrl = url.includes('?') ? `${url}&_t=${Date.now()}` : `${url}${url.endsWith('/') ? '' : '/'}?_t=${Date.now()}`;
    await page.goto(freshUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(e => {
      errorMsg = e.message;
    });

    // Check for checkout_flow cookie or localStorage
    for (let attempt = 0; attempt < 10; attempt++) {
      await page.waitForTimeout(300);

      const cookies = await context.cookies().catch(() => []);
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
      }).catch(() => null);

      if (lsFlow) {
        flowType = lsFlow;
        break;
      }
    }
  } catch (err) {
    errorMsg = err.message;
  } finally {
    await context.close().catch(() => {});
    if (shouldCloseBrowser) {
      await browser.close().catch(() => {});
    }
  }

  const finalFlow = flowType && flowType !== 'UNKNOWN' ? flowType : 'streaming';
  return { name, url, flowType: finalFlow, error: errorMsg };
}

async function detectFlow(targetUrl) {
  try {
    const isAll = process.argv.includes('--all') || (!targetUrl && !process.env.BASE_URL);
    const isJson = process.argv.includes('--json');

    if (isAll) {
      console.log('==================================================');
      console.log('🚀 Running Fast Concurrent Flow Detection across All Domains');
      console.log('==================================================');

      const dnsRules = await getDnsRules();
      const browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--dns-result-order=ipv4first',
          ...(dnsRules ? [`--host-resolver-rules=${dnsRules}`] : [])
        ]
      });

      const results = [];
      const CONCURRENCY = 6;
      for (let i = 0; i < ALL_DOMAINS.length; i += CONCURRENCY) {
        const chunk = ALL_DOMAINS.slice(i, i + CONCURRENCY);
        const chunkResults = await Promise.all(chunk.map(d => detectSingleDomain(d.name, d.url, browser)));
        results.push(...chunkResults);
      }

      await browser.close().catch(() => {});

      const flowMap = {};
      results.forEach(r => {
        flowMap[r.name] = r.flowType;
        console.log(`  ✓ ${r.name.padEnd(28)} -> ${r.flowType}`);
      });

      // Write flow-detection.json for CI consumption
      const outputPath = path.resolve(process.cwd(), 'flow-detection.json');
      fs.writeFileSync(outputPath, JSON.stringify(flowMap, null, 2), 'utf-8');
      console.log(`\n💾 Saved flow detection map to ${outputPath}`);

      if (isJson) {
        console.log(JSON.stringify(flowMap));
      }

      return results;
    } else {
      const url = targetUrl || process.env.BASE_URL || ALL_DOMAINS[0].url;
      const res = await detectSingleDomain('TargetSite', url);
      const finalFlow = res.flowType && res.flowType !== 'UNKNOWN' ? res.flowType : 'streaming';
      console.log(`\nDetected Checkout Flow : ${finalFlow}`);
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
