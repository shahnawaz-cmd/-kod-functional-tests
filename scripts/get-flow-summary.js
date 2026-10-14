// scripts/get-flow-summary.js
const fs = require('fs');

function getFlowSummary(resultsPath) {
  const p = resultsPath || (fs.existsSync('playwright-report/results.json') ? 'playwright-report/results.json' : 'results.json');
  if (!fs.existsSync(p)) return { flows: 'N/A', details: '' };

  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    const brandFlows = {};

    function walk(s) {
      const file = s.file || '';
      const flow = file.includes('streaming') ? 'streaming' : 'non_streaming';
      for (const spec of (s.specs || [])) {
        for (const test of (spec.tests || [])) {
          const brand = (test.projectName || '').split('_')[0];
          if (brand && !brandFlows[brand]) {
            brandFlows[brand] = flow;
          }
        }
      }
      for (const child of (s.suites || [])) {
        walk(child);
      }
    }
    walk(data);

    const uniqueFlows = [...new Set(Object.values(brandFlows))];
    const flowsStr = uniqueFlows.map(f => `\`${f}\``).join(' & ') || 'N/A';
    const details = Object.entries(brandFlows)
      .map(([brand, flow]) => `• ${brand}: \`${flow}\``)
      .join('\n');

    return { flows: flowsStr, details };
  } catch (e) {
    return { flows: 'N/A', details: '' };
  }
}

if (require.main === module) {
  const mode = process.argv[2] || 'flows';
  const filePath = process.argv[3];
  const res = getFlowSummary(filePath);

  if (mode === 'flows') {
    process.stdout.write(res.flows);
  } else if (mode === 'details') {
    process.stdout.write(res.details);
  } else {
    console.log(JSON.stringify(res));
  }
}

module.exports = { getFlowSummary };
