// scripts/slack-notify.js
const fs = require('fs');
const https = require('https');
const url = require('url');
const path = require('path');

const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
const githubServer = process.env.GITHUB_SERVER || 'https://github.com';
const githubRepo = process.env.GITHUB_REPO || 'owner/repo';
const githubRun = process.env.GITHUB_RUN || '0';
const githubActor = process.env.GITHUB_ACTOR || 'system';
const githubRef = process.env.GITHUB_REF || 'main';
const githubSha = (process.env.GITHUB_SHA_VAL || '').substring(0, 7) || 'HEAD';
const githubEvent = process.env.GITHUB_EVENT || 'workflow_dispatch';

// 1. Locate results file
let resultsPath = process.env.TEST_RESULTS_FILE
  ? path.resolve(process.cwd(), process.env.TEST_RESULTS_FILE)
  : (fs.existsSync(path.resolve(process.cwd(), 'playwright-report', 'results.json'))
      ? path.resolve(process.cwd(), 'playwright-report', 'results.json')
      : path.resolve(process.cwd(), 'results.json'));

let stats = { expected: 0, unexpected: 0, flaky: 0, skipped: 0 };
let failedSpecs = [];
let flakySpecs = [];

if (fs.existsSync(resultsPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    if (data.stats) {
      stats = data.stats;
    }

    // Traverse suites to collect failed and flaky test names and project
    function extractTests(suite) {
      if (suite.specs) {
        for (const spec of suite.specs) {
          const title = spec.title;
          for (const test of (spec.tests || [])) {
            const projectName = test.projectName || 'Default';
            const results = test.results || [];
            const isFailed = results.some(r => r.status === 'unexpected' || r.status === 'failure');
            const isFlaky = test.status === 'flaky' || results.some(r => r.status === 'flaky');

            if (isFailed) {
              const err = results.find(r => r.error)?.error?.message?.split('\n')[0] || '';
              failedSpecs.push(`• *[${projectName}]* ${title}${err ? `\n   ↳ _${err.substring(0, 120)}_` : ''}`);
            } else if (isFlaky) {
              flakySpecs.push(`• *[${projectName}]* ${title}`);
            }
          }
        }
      }
      if (suite.suites) {
        for (const sub of suite.suites) {
          extractTests(sub);
        }
      }
    }

    if (data.suites) {
      for (const s of data.suites) {
        extractTests(s);
      }
    }
  } catch (e) {
    console.error('Failed to parse results.json:', e.message);
  }
}

const passedTests = stats.expected || 0;
const failedTests = stats.unexpected || 0;
const flakyTests = stats.flaky || 0;
const skippedTests = stats.skipped || 0;
const totalTests = passedTests + failedTests + flakyTests + skippedTests;
const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

const isFailureAlertMode = process.argv.includes('--mode=failure') || process.env.ALERT_MODE === 'site-failure';
const currentSiteName = process.env.SITE_NAME || process.env.PLAYWRIGHT_PROJECT || '';
const currentSiteUrl = process.env.SITE_URL || process.env.BASE_URL || '';

const isPassing = failedTests === 0 && totalTests > 0;
const statusColor = isPassing ? '#2eb886' : '#e01e5a';

const titleText = isPassing
  ? `✅ KOD Window Sticker Suite — All Passed (${passRate}%)`
  : `🚨 KOD Window Sticker Suite — ${failedTests} Failed (${passRate}% Pass Rate)`;

// Count active sites from sites.json
let siteCount = 5;
try {
  const sitesPath = path.resolve(process.cwd(), 'sites.json');
  if (fs.existsSync(sitesPath)) {
    const sites = JSON.parse(fs.readFileSync(sitesPath, 'utf8'));
    siteCount = sites.length;
  }
} catch (e) {}

const runTime = new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC';

// GitHub Pages URL (derived from owner/repo)
const [owner, repoName] = githubRepo.split('/');
const pagesUrl = owner && repoName ? `https://${owner}.github.io/${repoName}` : '';

const blocks = [
  {
    type: 'header',
    text: {
      type: 'plain_text',
      text: titleText,
      emoji: true
    }
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: [
        `*Status:* ${isPassing ? '🟢 All Tests Passing' : `🔴 *${failedTests} Failing* (${passedTests} Passed)`}`,
        `*Pass Rate:* 📊 *${passRate}%* (${totalTests} total tests executed)`,
        `*Target Scope:* 🚗 *${siteCount} Domains* (Desktop & Mobile)`,
        `*Execution:* ⚙️ Branch \`${githubRef}\` • Trigger: \`${githubEvent}\``
      ].join('\n')
    }
  },
  {
    type: 'divider'
  }
];

// Add Top Failures section if any failed
if (failedSpecs.length > 0) {
  const failureList = failedSpecs.slice(0, 5).join('\n');
  const overflow = failedSpecs.length > 5 ? `\n_...and ${failedSpecs.length - 5} more failure(s)_` : '';
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*🚨 Top Failures:*\n${failureList}${overflow}`
    }
  });
  blocks.push({
    type: 'divider'
  });
}

// Add Action Buttons
const actionElements = [];

if (pagesUrl) {
  actionElements.push({
    type: 'button',
    text: {
      type: 'plain_text',
      text: '📊 Allure Report',
      emoji: true
    },
    url: pagesUrl,
    style: 'primary'
  });

  actionElements.push({
    type: 'button',
    text: {
      type: 'plain_text',
      text: '🎭 Playwright HTML',
      emoji: true
    },
    url: `${pagesUrl}/playwright/`
  });
}

actionElements.push({
  type: 'button',
  text: {
    type: 'plain_text',
    text: '⚙️ GitHub Action Run',
    emoji: true
  },
  url: `${githubServer}/${githubRepo}/actions/runs/${githubRun}`
});

blocks.push({
  type: 'actions',
  elements: actionElements
});

// Clean Footer Context
blocks.push({
  type: 'context',
  elements: [
    {
      type: 'mrkdwn',
      text: `Commit \`${githubSha}\` by *${githubActor}* • ${runTime}`
    }
  ]
});

const payload = {
  attachments: [
    {
      color: statusColor,
      blocks: blocks
    }
  ]
};

const payloadString = JSON.stringify(payload, null, 2);

if (!slackWebhookUrl || slackWebhookUrl === 'local') {
  console.log('📢 [Dry-Run] Slack Notification Payload:\n', payloadString);
  process.exit(0);
}

const webhook = new url.URL(slackWebhookUrl);
const options = {
  hostname: webhook.hostname,
  port: 443,
  path: webhook.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payloadString)
  }
};

const req = https.request(options, (res) => {
  console.log(`📡 [Slack Notify] Status: ${res.statusCode}`);
  res.on('data', d => process.stdout.write(d));
});

req.on('error', (e) => {
  console.error('❌ [Slack Notify] Error:', e.message);
});

req.write(payloadString);
req.end();
