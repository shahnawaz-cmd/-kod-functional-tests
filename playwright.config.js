const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  timeout: process.env.CI ? 150000 : 120000,
  expect: {
    timeout: 10000,
  },
  retries: 3,
  workers: process.env.CI ? 2 : 2,
  fullyParallel: true,
  use: {
    baseURL: process.env.BASE_URL || 'https://toyotawindowsticker.com/',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
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
        const siteProjects = [];
        for (const site of sites) {
          siteProjects.push({
            name: site.name,
            use: {
              ...devices['Desktop Chrome'],
              baseURL: site.url.endsWith('/') ? site.url : `${site.url}/`,
              headless: !!process.env.CI,
              ignoreHTTPSErrors: true,
              launchOptions: {
                args: ['--incognito', '--dns-result-order=ipv4first'],
              },
            },
          });
          siteProjects.push({
            name: `${site.name}_MobileChrome`,
            use: {
              ...devices['Pixel 5'],
              baseURL: site.url.endsWith('/') ? site.url : `${site.url}/`,
              headless: !!process.env.CI,
              ignoreHTTPSErrors: true,
              launchOptions: {
                args: ['--incognito', '--dns-result-order=ipv4first'],
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
    {
      name: 'Desktop',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.BASE_URL || 'https://toyotawindowsticker.com/',
        headless: !!process.env.CI,
        ignoreHTTPSErrors: true,
        launchOptions: {
          args: ['--incognito', '--dns-result-order=ipv4first'],
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
          args: ['--incognito', '--dns-result-order=ipv4first'],
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
          args: ['--incognito', '--dns-result-order=ipv4first'],
        },
      },
    },
  ],
});
