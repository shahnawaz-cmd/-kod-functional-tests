// scripts/run-site-batch.js
const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Ensure artifact directories exist before test execution
['blob-report', 'allure-results', 'test-results'].forEach(dir => {
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
  console.log(`🚀 [Site Batch Runner] Starting batch for ${sites.length} site(s)`);
  console.log(`   Sites: ${sites.map(s => s.name).join(', ')}`);
  console.log(`============================================================\n`);

  let totalFailures = 0;
  const failureList = [];

  for (let i = 0; i < sites.length; i++) {
    const site = sites[i];
    console.log(`\n------------------------------------------------------------`);
    console.log(`📍 [${i + 1}/${sites.length}] Testing Brand: ${site.name} (${site.url})`);
    console.log(`------------------------------------------------------------`);

    const siteEnv = {
      BASE_URL: site.url,
      CI: 'true'
    };

    // 1. Run Checkout Funnel (Desktop & Mobile)
    const funnelCmd = `node scripts/run-flow.js --project="${site.name}" --project="${site.name}_MobileChrome"`;
    const funnelPassed = runCommand(funnelCmd, siteEnv);

    if (!funnelPassed) {
      totalFailures++;
      failureList.push(`${site.name} (Checkout Funnel)`);
      console.warn(`⚠️ [Funnel Failed] ${site.name} Checkout Funnel encountered test failure(s).`);

      // Trigger AI Healer if API key available
      if (process.env.GEMINI_API_KEY) {
        console.log(`🤖 Triggering AI Self-Healer for ${site.name}...`);
        runCommand(`npm run heal:prod`, { ...siteEnv, PLAYWRIGHT_PROJECT: site.name });
      }

      // Trigger Instant Slack Failure Alert if configured
      if (process.env.SLACK_WEBHOOK_URL) {
        runCommand(`node scripts/slack-notify.js --site-mode --failures-only`, {
          ...siteEnv,
          SITE_NAME: site.name,
          SITE_URL: site.url,
          BROWSER_NAME: 'Desktop & Mobile',
          SUITE_TYPE: 'Checkout Funnel',
          RUN_STATUS: 'failure'
        });
      }
    } else {
      console.log(`✅ [Funnel Passed] ${site.name} Checkout Funnel tests completed successfully.`);
    }

    // 2. Run Standalone Audits (Pricing, IP Stickiness, UI/UX for Desktop & Mobile)
    const auditCmd = `npx playwright test tests/pricing_page.spec.ts tests/session_ip_stickiness.spec.ts tests/ui_ux_verification.spec.ts --project="${site.name}" --project="${site.name}_MobileChrome"`;
    const auditPassed = runCommand(auditCmd, siteEnv);

    if (!auditPassed) {
      totalFailures++;
      failureList.push(`${site.name} (Standalone Audits)`);
      console.warn(`⚠️ [Audits Failed] ${site.name} Standalone Audits encountered test failure(s).`);

      if (process.env.SLACK_WEBHOOK_URL) {
        runCommand(`node scripts/slack-notify.js --site-mode --failures-only`, {
          ...siteEnv,
          SITE_NAME: site.name,
          SITE_URL: site.url,
          BROWSER_NAME: 'Desktop & Mobile',
          SUITE_TYPE: 'Standalone Audits',
          RUN_STATUS: 'failure'
        });
      }
    } else {
      console.log(`✅ [Audits Passed] ${site.name} Standalone Audits completed successfully.`);
    }
  }

  console.log(`\n============================================================`);
  console.log(`🏁 [Site Batch Runner] Batch complete.`);
  console.log(`   Total Sites Tested: ${sites.length}`);
  console.log(`   Failures Detected : ${totalFailures}`);
  if (failureList.length > 0) {
    console.log(`   Failed Suites     :\n     • ${failureList.join('\n     • ')}`);
  }
  console.log(`============================================================\n`);

  if (totalFailures > 0) {
    process.exit(1);
  }
}

main();
