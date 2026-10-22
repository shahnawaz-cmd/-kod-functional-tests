// run-flow.js
const { execSync } = require('child_process');
const path = require('path');

function runFlow() {
  console.log('🚀 Running Flow Detection...');
  let flowType = 'streaming';

  const rawArgs = process.argv.slice(2);
  let targetUrl = process.env.BASE_URL || null;

  // Extract --project argument if passed (e.g. --project=VehicleHistoryEU, -p VehicleHistoryEU, or --project=VSR_MobileChrome)
  let projectName = null;
  const projectArg = rawArgs.find(arg => arg.startsWith('--project='));
  if (projectArg) {
    projectName = projectArg.split('=')[1];
  } else {
    const pIndex = rawArgs.findIndex(arg => arg === '--project' || arg === '-p');
    if (pIndex !== -1 && rawArgs[pIndex + 1]) {
      projectName = rawArgs[pIndex + 1];
    }
  }

  if (projectName) {
    const baseBrand = projectName.split('_')[0];
    const detectScript = require('./detect-flow');
    const matchedDomain = detectScript.ALL_DOMAINS.find(d => d.name.toLowerCase() === baseBrand.toLowerCase());
    if (matchedDomain) {
      targetUrl = matchedDomain.url;
      console.log(`🎯 [Project Detected] Found baseURL for project "${projectName}" (brand: ${baseBrand}): ${targetUrl}`);
    } else {
      try {
        const config = require('../playwright.config.js');
        const proj = config.projects?.find(p => p.name.toLowerCase() === projectName.toLowerCase() || p.name.toLowerCase().startsWith(baseBrand.toLowerCase()));
        if (proj?.use?.baseURL) {
          targetUrl = proj.use.baseURL;
          console.log(`🎯 [Project Config Fallback] Found baseURL for project "${projectName}": ${targetUrl}`);
        }
      } catch (e) {}
    }
  } else if (!targetUrl) {
    targetUrl = 'https://toyotawindowsticker.com/';
  }

  if (targetUrl) {
    process.env.BASE_URL = targetUrl;
  }

  if (process.env.FLOW_TYPE) {
    flowType = process.env.FLOW_TYPE;
    console.log(`⚡ [Pre-detected Flow via ENV]: ${flowType}`);
  } else {
    let foundInCache = false;
    try {
      const flowFilePath = path.join(__dirname, '..', 'flow-detection.json');
      const fs = require('fs');
      if (fs.existsSync(flowFilePath)) {
        const flowMap = JSON.parse(fs.readFileSync(flowFilePath, 'utf8'));
        if (projectName) {
          const baseBrand = projectName.split('_')[0];
          const matched = Object.keys(flowMap).find(k => k.toLowerCase() === baseBrand.toLowerCase());
          if (matched && flowMap[matched]) {
            flowType = flowMap[matched];
            foundInCache = true;
            console.log(`⚡ [Pre-detected Flow via flow-detection.json for ${projectName}]: ${flowType}`);
          }
        }
      }
    } catch (e) {}

    if (!foundInCache) {
      try {
        const detectScriptPath = path.join(__dirname, 'detect-flow.js');
        const detectCmd = targetUrl ? `node "${detectScriptPath}" "${targetUrl}"` : `node "${detectScriptPath}"`;
        const output = execSync(detectCmd, { encoding: 'utf8' });
        console.log(output);
        if (output.includes('Detected Checkout Flow : non_streaming')) {
          flowType = 'non_streaming';
        } else if (output.includes('Detected Checkout Flow : streaming')) {
          flowType = 'streaming';
        }
      } catch (e) {
        console.error('❌ Flow Detection Failed. Stopping execution.');
        process.exit(1);
      }
    }
  }

  const isWin = process.platform === 'win32';
  const flowSpec = flowType === 'streaming'
    ? (isWin ? '"streaming Task/global_streaming_specs.spec.js"' : "'streaming Task/global_streaming_specs.spec.js'")
    : 'tests/global_case_verification.spec.ts';

  // Check if explicit spec files were already passed in arguments
  const hasCustomSpecArg = rawArgs.some(arg => arg.endsWith('.spec.js') || arg.endsWith('.spec.ts'));

  const targetSpecs = hasCustomSpecArg ? '' : flowSpec;

  const formattedArgs = rawArgs.map(arg => {
    if (arg.includes(' ') || arg.includes('(') || arg.includes(')') || arg.includes('|')) {
      return isWin ? `"${arg.replace(/"/g, '\\"')}"` : `'${arg.replace(/'/g, "'\\''")}'`;
    }
    return arg;
  }).join(' ');

  console.log(`🎯 [Flow Detected: ${flowType.toUpperCase()}]`);
  console.log(`   ↳ Active Flow File: ${flowSpec}`);
  console.log(`   ↳ Skipped Flow File: ${flowType === 'streaming' ? 'tests/global_case_verification.spec.ts' : 'streaming Task/global_streaming_specs.spec.js'}`);

  const cmd = targetSpecs
    ? `npx playwright test ${targetSpecs} ${formattedArgs}`.trim()
    : `npx playwright test ${formattedArgs}`.trim();

  console.log(`Executing command: ${cmd}`);

  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (err) {
    process.exit(err.status || 1);
  }
}

runFlow();
