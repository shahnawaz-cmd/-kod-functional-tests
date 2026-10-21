const { defineConfig } = require('@playwright/test');

const outputFolder = process.env.PLAYWRIGHT_REPORT_DIR || 'playwright-report';

module.exports = defineConfig({
  reporter: [
    ['html', { outputFolder: outputFolder, open: 'never' }],
    ['json', { outputFile: `${outputFolder}/results.json` }]
  ],
});
