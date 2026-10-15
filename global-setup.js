// global-setup.js
const dns = require('dns');
const sites = require('./sites.json');

async function globalSetup() {
  console.log('🌐 [Global DNS Pre-warm] Pre-resolving production domains before workers launch...');

  // Configure high-performance redundant DNS resolvers (Cloudflare, Google, Quad9)
  const resolver = new dns.promises.Resolver();
  resolver.setServers(['1.1.1.1', '8.8.8.8', '9.9.9.9']);

  const hosts = sites.map(s => {
    try {
      return new URL(s.url).hostname;
    } catch {
      return s.url.replace(/https?:\/\//, '').replace(/\/.*$/, '');
    }
  });

  const uniqueHosts = Array.from(new Set(hosts));

  const results = await Promise.allSettled(
    uniqueHosts.map(async (host) => {
      try {
        const addresses = await resolver.resolve4(host);
        console.log(`   ✓ [DNS Warm] ${host} -> [${addresses.join(', ')}]`);
        return { host, addresses };
      } catch (err) {
        console.warn(`   ⚠️ [DNS Warm Warning] Could not resolve ${host}: ${err.message}`);
        throw err;
      }
    })
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  console.log(`✅ [Global DNS Pre-warm] Pre-warmed ${succeeded}/${uniqueHosts.length} domains in OS DNS cache.\n`);

  // Build and write host-resolver-rules map for Chromium to eliminate DNS drops in CI
  const fs = require('fs');
  const path = require('path');
  const hostRules = [];
  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value?.addresses?.length) {
      hostRules.push(`MAP ${r.value.host} ${r.value.addresses[0]}`);
    }
  });

  if (hostRules.length > 0) {
    const rulesPath = path.resolve(__dirname, 'dns-rules.json');
    fs.writeFileSync(rulesPath, JSON.stringify({ rules: hostRules.join(',') }), 'utf-8');
    console.log(`🛡️ [DNS Resolver] Saved ${hostRules.length} Chromium host mapping rules to dns-rules.json`);
  }
}

module.exports = globalSetup;
