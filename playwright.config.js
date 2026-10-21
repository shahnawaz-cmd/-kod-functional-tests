const dns = require('dns');

// Prioritize IPv4 over IPv6 across all Node.js DNS lookups to prevent AAAA query hangs
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Increase Node.js DNS threadpool from default 4 to 64 to prevent EAI_AGAIN under concurrency
process.env.UV_THREADPOOL_SIZE = '64';

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  globalSetup: './global-setup.js',
  testDir: '.',
  timeout: process.env.CI ? 150000 : 120000,
  expect: {
    timeout: 10000,
  },
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 2,
  fullyParallel: true,
  outputDir: 'test-results',
  use: {
    baseURL: process.env.BASE_URL || 'https://toyotawindowsticker.com/',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  reporter: [
    ['line'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'results.json' }],
    ['allure-playwright', {
      outputFolder: 'allure-results',
      detail: true,
      suiteTitle: true,
      environmentInfo: {
        Environment: 'Development',
        Platform: process.platform,
      },
    }],
    ...(process.env.CI ? [['blob']] : [])
  ],
  projects: [
    // Dynamic projects loaded from sites.json (if present)
    ...(() => {
      try {
        const sites = require('./sites.json');
        const fs = require('fs');
        const path = require('path');
        let dnsRules = '';
        try {
          const rulesFile = path.resolve(__dirname, 'dns-rules.json');
          if (fs.existsSync(rulesFile)) {
            dnsRules = JSON.parse(fs.readFileSync(rulesFile, 'utf-8')).rules || '';
          }
        } catch (e) {}

        const commonArgs = [
          '--incognito',
          '--dns-result-order=ipv4first',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          ...(dnsRules ? [`--host-resolver-rules=${dnsRules}`] : [])
        ];

        let flowDetectionMap = {};
        try {
          const flowFile = path.resolve(__dirname, 'flow-detection.json');
          if (fs.existsSync(flowFile)) {
            flowDetectionMap = JSON.parse(fs.readFileSync(flowFile, 'utf-8'));
          }
        } catch (e) {}

        const siteProjects = [];
        for (const site of sites) {
          const funnelSpecs = ['**/streaming Task/global_streaming_specs.spec.js', '**/tests/global_case_verification.spec.ts'];
          const projectTestMatch = [...funnelSpecs, '**/tests/pricing_page.spec.ts', '**/tests/session_ip_stickiness.spec.ts', '**/tests/ui_ux_verification.spec.ts'];

          siteProjects.push({
            name: site.name,
            testMatch: projectTestMatch,
            use: {
              ...devices['Desktop Chrome'],
              baseURL: site.url.endsWith('/') ? site.url : `${site.url}/`,
              headless: !!process.env.CI,
              ignoreHTTPSErrors: true,
              launchOptions: {
                args: commonArgs,
              },
            },
          });
          siteProjects.push({
            name: `${site.name}_MobileChrome`,
            testMatch: projectTestMatch,
            use: {
              ...devices['Pixel 5'],
              baseURL: site.url.endsWith('/') ? site.url : `${site.url}/`,
              headless: !!process.env.CI,
              ignoreHTTPSErrors: true,
              launchOptions: {
                args: commonArgs,
              },
            },
          });
        }
        return siteProjects;
      } catch (e) {
        return [];
      }
    })(),
    // Fallback/Generic projects
    ...(() => {
      const fs = require('fs');
      const path = require('path');
      let dnsRules = '';
      try {
        const rulesFile = path.resolve(__dirname, 'dns-rules.json');
        if (fs.existsSync(rulesFile)) {
          dnsRules = JSON.parse(fs.readFileSync(rulesFile, 'utf-8')).rules || '';
        }
      } catch (e) {}

      const genericArgs = [
        '--incognito',
        '--dns-result-order=ipv4first',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        ...(dnsRules ? [`--host-resolver-rules=${dnsRules}`] : [])
      ];

      return [
        {
          name: 'Desktop',
          use: {
            ...devices['Desktop Chrome'],
            baseURL: process.env.BASE_URL || 'https://toyotawindowsticker.com/',
            headless: !!process.env.CI,
            ignoreHTTPSErrors: true,
            launchOptions: {
              args: genericArgs,
            },
          },
        },
        {
          name: 'MobileChrome',
          use: {
            ...devices['Pixel 5'],
            baseURL: process.env.BASE_URL || 'https://toyotawindowsticker.com/',
            headless: !!process.env.CI,
            ignoreHTTPSErrors: true,
            launchOptions: {
              args: genericArgs,
            },
          },
        },
        {
          name: 'chromium',
          use: {
            ...devices['Desktop Chrome'],
            baseURL: process.env.BASE_URL || 'https://toyotawindowsticker.com/',
            headless: !!process.env.CI,
            ignoreHTTPSErrors: true,
            launchOptions: {
              args: genericArgs,
            },
          },
        },
      ];
    })(),
  ],
});
