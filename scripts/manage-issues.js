const fs = require('fs');
const { Octokit } = require('@octokit/rest');

async function manageGitHubIssues() {
  const token = process.env.GITHUB_TOKEN;
  const repoFull = process.env.GITHUB_REPO; // e.g. "shahnawaz-cmd/-automotive-sites-automation"

  if (!token || !repoFull) {
    console.log('⚠️ GITHUB_TOKEN or GITHUB_REPO missing. Skipping issue management.');
    return;
  }

  const [owner, repo] = repoFull.split('/');
  const octokit = new Octokit({ auth: token });
  const labelName = 'e2e-failure';

  // Ensure issue label exists
  try {
    await octokit.rest.issues.getLabel({ owner, repo, name: labelName });
  } catch (e) {
    await octokit.rest.issues
      .createLabel({
        owner,
        repo,
        name: labelName,
        color: 'd73a4a',
        description: 'Automated E2E Test Failure'
      })
      .catch(() => {});
  }

  let failedSpecs = [];
  let passedCount = 0;
  let failedCount = 0;

  const resultPaths = ['playwright-report/results.json', 'results.json'];
  let resultsData = null;

  for (const p of resultPaths) {
    if (fs.existsSync(p)) {
      try {
        resultsData = JSON.parse(fs.readFileSync(p, 'utf8'));
        break;
      } catch (e) {}
    }
  }

  if (resultsData) {
    try {
      const getAllSpecs = (suite) => {
        let specs = [];
        if (suite.specs) specs.push(...suite.specs);
        if (suite.suites) {
          for (const sub of suite.suites) {
            specs.push(...getAllSpecs(sub));
          }
        }
        return specs;
      };

      const allSpecs = [];
      if (resultsData.suites) {
        for (const suite of resultsData.suites) {
          allSpecs.push(...getAllSpecs(suite));
        }
      }

      allSpecs.forEach((spec) => {
        if (!spec.tests || spec.tests.length === 0) return;
        for (const testInst of spec.tests) {
          const attempts = testInst.results || [];
          if (attempts.length === 0) continue;
          const hasFailures = attempts.some((r) => r.status === 'failed' || r.status === 'timedOut');
          const hasPass = attempts.some((r) => r.status === 'passed');
          const isSkipped = attempts.every((r) => r.status === 'skipped');

          if (hasPass || isSkipped) {
            passedCount++;
          } else if (hasFailures) {
            failedCount++;
            const lastFailure = attempts.reverse().find((r) => r.status === 'failed' || r.status === 'timedOut');
            let errorMsg = lastFailure?.error?.message
              ? lastFailure.error.message.split('\n')[0].substring(0, 150)
              : 'Unknown error';
            failedSpecs.push({
              title: spec.title,
              browser: testInst.projectName || 'unknown',
              error: errorMsg
            });
          }
        }
      });
    } catch (err) {
      console.error('Error reading results.json:', err);
    }
  }

  const runUrl = `${process.env.GITHUB_SERVER || 'https://github.com'}/${process.env.GITHUB_REPO}/actions/runs/${process.env.GITHUB_RUN || ''}`;

  // Fetch open failure issues
  const { data: openIssues } = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    state: 'open',
    labels: [labelName]
  });

  if (failedCount > 0) {
    console.log(`🚨 Failures detected (${failedCount}). Managing issue creation...`);

    const issueTitle = `🔴 [Automated] Global NextJS Sites Production Monitoring Test Failure`;
    const issueBody = `### 🚨 Production Monitoring Failure Detected

**Scope:** Global NextJS Sites (\`VSR, MotorcycleVINLookup, VehicleHistoryEU, VINNumberCA, InstantVinReports, DetailedVehicleHistory\`)
**Workflow Run:** [View Workflow Run](${runUrl})
**Triggered By:** \`${process.env.GITHUB_ACTOR || 'N/A'}\` via \`${process.env.GITHUB_EVENT || 'N/A'}\`

#### ❌ Failing Test Cases (${failedSpecs.length}):
${failedSpecs.map((s) => `- **${s.title}** (_${s.browser}_)\n  > \`${s.error}\``).join('\n')}

---
*This issue was automatically created by the Global NextJS Site Production Stability Monitor.*`;

    if (openIssues.length === 0) {
      const newIssue = await octokit.rest.issues.create({
        owner,
        repo,
        title: issueTitle,
        body: issueBody,
        labels: [labelName]
      });
      console.log(`✅ Created GitHub Issue #${newIssue.data.number}`);
    } else {
      console.log(`ℹ️ Open issue #${openIssues[0].number} already exists. Updating comment...`);
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: openIssues[0].number,
        body: `🔄 **Update from Run [${process.env.GITHUB_RUN || 'Latest'}](${runUrl}):** Test failure persists.\n\n${issueBody}`
      });
    }
  } else {
    console.log('🟢 All tests passed cleanly!');
    if (openIssues.length > 0) {
      for (const issue of openIssues) {
        console.log(`🎉 Closing issue #${issue.number} because test suite passed!`);
        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: issue.number,
          body: `✅ **Resolved:** All Production Monitoring tests passed cleanly in workflow run [${process.env.GITHUB_RUN || 'Latest'}](${runUrl}). Auto-closing issue.`
        });
        await octokit.rest.issues.update({
          owner,
          repo,
          issue_number: issue.number,
          state: 'closed',
          state_reason: 'completed'
        });
      }
    }
  }
}

manageGitHubIssues().catch(console.error);
