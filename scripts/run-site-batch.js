// scripts/run-site-batch.js
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Ensure artifact directories exist before test execution
['blob-report', 'allure-results', 'test-results', 'playwright-report'].forEach(dir => {
  fs.mkdirSync(path.resolve(process.cwd(), dir), { recursive: true });
});

function parseSites() {
  const rawArgs = process.argv.slice(2);
  let sitesJson = process.env.SITES_JSON || null;

  const sitesArg = rawArgs.find(arg => arg.startsWith('--sites='));
  if (sitesArg) {
    sitesJson = sitesArg.substring('--sites='.length);
  } else {
    const sIndex = rawArgs.indexOf('--sites');
    if (sIndex !== -1 && rawArgs[sIndex + 1]) {
      sitesJson = rawArgs[sIndex + 1];
    }
  }

  if (!sitesJson) {
    console.error('❌ [Site Batch] No sites provided. Pass --sites=\'<json>\' or set SITES_JSON.');
    process.exit(1);
  }

  try {
    return JSON.parse(sitesJson);
  } catch (err) {
    console.error('❌ [Site Batch] Failed to parse sites JSON:', err.message);
    process.exit(1);
  }
}

function runCommand(command, envVars = {}) {
  console.log(`\n▶️ Executing: ${command}`);
  const result = spawnSync(command, {
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, ...envVars }
  });
  return result.status === 0;
}

function main() {
  const sites = parseSites();
  console.log(`\n============================================================`);
  console.log(`🚀 [Site Batch Runner - PARALLEL MODE] Running batch for ${sites.length} site(s)`);
  console.log(`   Sites: ${sites.map(s => s.name).join(', ')}`);
  console.log(`============================================================\n`);

  // Build project flags for both Desktop Chrome and Mobile Pixel 5
  const projectFlags = sites
    .flatMap(s => [`--project="${s.name}"`, `--project="${s.name}_MobileChrome"`])
    .join(' ');

  // Standard test suites: Streaming Funnel + Audits (Pricing, IP Stickiness, UI/UX)
  const isWin = process.platform === 'win32';
  const flowFile = isWin ? '"streaming Task/global_streaming_specs.spec.js"' : "'streaming Task/global_streaming_specs.spec.js'";
  const testFiles = `${flowFile} tests/pricing_page.spec.ts tests/session_ip_stickiness.spec.ts tests/ui_ux_verification.spec.ts`;

  // Number of parallel workers in CI (default 2 per runner)
  const workersArg = process.env.CI_WORKERS ? `--workers=${process.env.CI_WORKERS}` : `--workers=2`;

  const playwrightCmd = `npx playwright test ${testFiles} ${projectFlags} ${workersArg}`;

  const siteEnv = {
    CI: 'true'
  };

  const testsPassed = runCommand(playwrightCmd, siteEnv);

  if (!testsPassed) {
    console.warn(`\n⚠️ [Batch Failure] One or more tests in this batch failed.`);

    // Trigger AI Healer if API key available
    if (process.env.GEMINI_API_KEY) {
      console.log(`🤖 Triggering AI Self-Healer...`);
      runCommand(`npm run heal:prod`, siteEnv);
    }

    // Trigger Instant Slack Failure Alert if configured
    if (process.env.SLACK_WEBHOOK_URL) {
      console.log(`📣 Sending Slack failure alert...`);
      runCommand(`node scripts/slack-notify.js --failures-only`, siteEnv);
    }

    process.exit(1);
  }

  console.log(`\n============================================================`);
  console.log(`✅ [Batch Passed] All tests in batch completed successfully.`);
  console.log(`============================================================\n`);
}

main();
