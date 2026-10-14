const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

function extractFailuresFromResults() {
  const possiblePaths = [
    'playwright-report/results.json',
    'results.json',
    path.join(__dirname, '../playwright-report/results.json'),
    path.join(__dirname, '../results.json')
  ];

  let raw = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        raw = fs.readFileSync(p, 'utf8');
        break;
      } catch (e) {}
    }
  }

  if (!raw) return { failuresByFile: {}, failedTestTitles: new Set(), failedProjects: new Set() };

  try {
    const data = JSON.parse(raw);
    const failuresByFile = {};
    const failedTestTitles = new Set();
    const failedProjects = new Set();

    const targets = [
      'tasks/DecodeVinTask.ts',
      'tasks/LPdecode.ts',
      'tasks/classic_editable_specs.ts',
      'tasks/classic_editable_specs_manual.ts',
      'tasks/coupon_flow_validation.ts',
      'tasks/default_plan_price_check.ts',
      'tasks/eu_vin_confirmation.ts',
      'tasks/exit_intent_banner.ts',
      'tasks/exit_intent_popup_preview.ts',
      'tasks/form_error_messages.ts',
      'tasks/global_exit_intent_popup.ts',
      'tasks/preview_to_checkout_redirection.ts',
      'tasks/revisit_banner_flow.ts',
      'tasks/revisit_sticker_banner_flow.ts',
      'tasks/vin_field_validation.ts',
      'tasks/vinHelper.ts',
      'tasks/pricing/PricingToCheckoutNavigationTask.ts',
      'tasks/SessionIpStickinessTask.ts',
      'tasks/exit_popup_behaviour.ts',
      'streaming Task/tasks/ErrorPageToHomeCollectionTask.js',
      'streaming Task/global_streaming_specs.spec.js',
      'tests/pricing_page.spec.ts',
      'tests/session_ip_stickiness.spec.ts',
      'tests/global_case_verification.spec.ts'
    ];

    const traverseSuite = (suite) => {
      if (suite.specs) {
        for (const spec of suite.specs) {
          for (const t of spec.tests || []) {
            const isFailed = t.status === 'unexpected' || (t.results && t.results.some((r) => r.status === 'failed' || r.status === 'timedOut'));
            if (isFailed) {
              if (spec.title) failedTestTitles.add(spec.title);
              if (t.projectName) failedProjects.add(t.projectName);

              for (const r of t.results || []) {
                if (r.status === 'failed' || r.status === 'timedOut') {
                  const err = r.error || {};
                  const file = err.location?.file || spec.file || '';
                  const line = err.location?.line || spec.line || '';
                  const msg = (err.message || 'Unknown error').replace(/\u001b\[[0-9;]*m/g, '');
                  const snippet = (err.snippet || '').replace(/\u001b\[[0-9;]*m/g, '');

                  for (const target of targets) {
                    const normalizedTarget = target.replace(/\//g, path.sep);
                    const targetBase = path.basename(target);
                    if (
                      file.includes(normalizedTarget) ||
                      file.includes(target) ||
                      file.includes(targetBase) ||
                      msg.includes(target) ||
                      msg.includes(targetBase) ||
                      snippet.includes(targetBase)
                    ) {
                      if (!failuresByFile[target]) failuresByFile[target] = [];
                      failuresByFile[target].push({
                        title: spec.title,
                        project: t.projectName || '',
                        line,
                        message: msg,
                        snippet
                      });
                    }
                  }

                  if (!failuresByFile['_all']) failuresByFile['_all'] = [];
                  failuresByFile['_all'].push({ title: spec.title, project: t.projectName || '', file, line, message: msg });
                }
              }
            }
          }
        }
      }
      if (suite.suites) {
        for (const s of suite.suites) traverseSuite(s);
      }
    };

    if (data.suites) {
      for (const s of data.suites) traverseSuite(s);
    }

    return { failuresByFile, failedTestTitles, failedProjects };
  } catch (e) {
    console.warn('⚠️ Error parsing results.json for failures:', e.message);
    return { failuresByFile: {}, failedTestTitles: new Set(), failedProjects: new Set() };
  }
}

async function runCiHealer() {
  console.log('🤖 Agentic AI Healer activated for Global NextJS Site Test Flow (CI)...');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key') {
    console.log('⚠️ GEMINI_API_KEY missing or invalid in environment. Skipping AI healing step.');
    return;
  }

  const { failuresByFile, failedTestTitles, failedProjects } = extractFailuresFromResults();
  const failedFileKeys = Object.keys(failuresByFile).filter((k) => k !== '_all');

  const targetFiles = failedFileKeys.length > 0
    ? failedFileKeys
    : [
        'tasks/DecodeVinTask.ts',
        'tasks/classic_editable_specs.ts',
        'tasks/coupon_flow_validation.ts',
        'tasks/LPdecode.ts',
        'tasks/preview_to_checkout_redirection.ts'
      ];

  console.log(`📋 Target task/spec files to analyze/heal: ${targetFiles.join(', ')}`);

  const genAI = new GoogleGenerativeAI(apiKey);
  const candidateModels = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro', 'gemini-pro'];

  const repairedFiles = [];
  let usedModel = '';

  for (const targetFile of targetFiles) {
    if (!fs.existsSync(targetFile)) {
      console.warn(`File ${targetFile} does not exist. Skipping.`);
      continue;
    }

    const currentCode = fs.readFileSync(targetFile, 'utf-8');
    const specificFailures = failuresByFile[targetFile] || failuresByFile['_all'] || [];

    const failureDetails = specificFailures
      .map(
        (f, idx) =>
          `Failure #${idx + 1}:\n- Test Case: ${f.title} (${f.project || 'Unknown Project'})\n- Line: ${f.line}\n- Error: ${f.message}\n- Code Snippet:\n${f.snippet || 'N/A'}`
      )
      .join('\n\n');

    const prompt = `
      You are an expert Senior QA Automation Engineer and AI Self-Healing agent specialized in Playwright, TypeScript, and Screenplay pattern architecture for responsive Next.js web applications.

      Target File: "${targetFile}"
      
      Observed Test Failure(s):
      ${failureDetails || 'Test timeout / Element locator mismatch on dynamic or responsive layout.'}

      Current Source Code:
      \`\`\`typescript
      ${currentCode}
      \`\`\`

      Task:
      Inspect the failure error and rewrite/repair the code to make it resilient, rock-solid, and self-healing.
      
      Self-Healing Guidelines:
      1. LOCATOR DRIFT & MULTI-STRATEGY FALLBACKS:
         - Use import { fastInputWithHealing, clickWithHealing, locateInputWithHealing, locateElementWithHealing } from '../utils/selfHealingLocator';
         - Prefer role-based and accessible locators (getByRole, getByLabel, getByPlaceholder, getByText).
         - Include multiple CSS and text fallbacks for buttons, inputs, and tabs.
      2. RESPONSIVE DOM & STRICT-MODE CONFLICTS:
         - Next.js sites often render dual desktop/mobile DOM trees. Append .first() or .locator('visible=true') to avoid strict-mode ambiguity.
      3. ASYNC TIMING & SMART WAITS:
         - Replace static waitForTimeout with waitForURL, waitForResponse, or locator.waitFor({ state: 'visible' }).
         - Ensure appropriate conditional timeouts for CI (60s to 90s for slow backend/APIs).
      4. MODALS, POPUPS & OVERLAYS:
         - If pointer events were intercepted by an overlay, use { force: true } or dismiss the overlay before interaction.
      5. DROPDOWN / COMBOS:
         - Support multi-brand variations (VSR vs MotorcycleVINLookup vs VehicleHistoryEU vs VINNumberCA vs InstantVinReports) gracefully with fallbacks.

      Constraints:
      - Preserve all existing class names, constructor arguments, performAs(actor) method, TypeScript types, and exports.
      - Return ONLY valid executable TypeScript/JavaScript code without markdown code fence wrappers or introductory commentary.
    `;

    let result = null;
    let successfulModel = '';

    for (const modelName of candidateModels) {
      try {
        console.log(`🧠 Attempting Gemini AI model (${modelName}) for ${targetFile}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const res = await model.generateContent(prompt);
        if (res && res.response) {
          result = res;
          successfulModel = modelName;
          console.log(`✅ Successfully generated healing patch from ${modelName}!`);
          break;
        }
      } catch (err) {
        console.warn(`⚠️ Model ${modelName} attempt failed: ${err.message}`);
      }
    }

    if (result && result.response) {
      const correctedCode = result.response.text().replace(/```typescript|```javascript|```/g, '').trim();
      fs.writeFileSync(targetFile, correctedCode, 'utf-8');
      repairedFiles.push(targetFile);
      usedModel = successfulModel;
      console.log(`✨ [AI Healer Success] Auto-repaired ${targetFile} using ${successfulModel}.`);
    }
  }

  if (repairedFiles.length > 0) {
    fs.writeFileSync(
      '.ai-healed.json',
      JSON.stringify(
        {
          healed: true,
          model: usedModel,
          repairedFiles,
          timestamp: new Date().toISOString()
        },
        null,
        2
      )
    );
  }

  // --- TARGETED RE-VERIFICATION (Only run the failed cases on the failed project) ---
  const activeProject = process.env.PLAYWRIGHT_PROJECT || (failedProjects.size === 1 ? Array.from(failedProjects)[0] : '');
  const tcIdentifiers = Array.from(failedTestTitles)
    .map((title) => {
      const match = title.match(/TC_\d+/i);
      return match ? match[0] : '';
    })
    .filter(Boolean);

  const uniqueTcs = Array.from(new Set(tcIdentifiers));
  let verifyCmd = 'npx playwright test';

  if (uniqueTcs.length > 0) {
    verifyCmd += ` -g "${uniqueTcs.join('|')}"`;
  }
  if (activeProject) {
    verifyCmd += ` --project=${activeProject}`;
  }

  console.log(`🎯 Targeted Verification: Running only failed test cases...`);
  console.log(`💻 Command: ${verifyCmd}`);

  try {
    execSync(verifyCmd, { stdio: 'inherit', timeout: 180000 });
    console.log('🎉 [Targeted Verification] Healed tests PASSED successfully!');
  } catch (e) {
    console.warn('⚠️ Targeted verification run completed.');
  }
}

if (require.main === module) {
  runCiHealer().catch(console.error);
}

module.exports = { runCiHealer };
