# KOD Functional E2E Automation Framework 🚀

> Enterprise-grade, multi-domain Playwright E2E test automation framework with dynamic flow routing, AI-powered agentic self-healing, DNS pre-warming, and GitHub Actions CI/CD matrix orchestration.

---

## 📋 Table of Contents
- [Overview](#overview)
- [Architecture & Key Highlights](#architecture--key-highlights)
- [Supported Brand Domains](#supported-brand-domains)
- [Test Suites](#test-suites)
- [Prerequisites & Installation](#prerequisites--installation)
- [Running Tests Locally](#running-tests-locally)
- [Dynamic Flow Detection](#dynamic-flow-detection)
- [AI Agentic Self-Healing](#ai-agentic-self-healing)
- [DNS Pre-Warming & Network Hardening](#dns-pre-warming--network-hardening)
- [CI/CD Pipeline (GitHub Actions)](#cicd-pipeline-github-actions)
- [Reporting & Notifications](#reporting--notifications)
- [Project Structure](#project-structure)

---

## 🌟 Overview

This repository houses the automated end-to-end (E2E) testing suite for **Window Sticker & Vehicle History** brand domains. The framework dynamically adapts to distinct checkout architectures (`streaming` vs `non_streaming`), supports 24 active brand domains across desktop and mobile devices (48 dynamic Playwright projects), and incorporates autonomous failure recovery using Google Gemini.

---

## 🏗 Architecture & Key Highlights

- **Dynamic Flow Routing**: Automatically interrogates the target domain’s checkout cookie/localStorage state (`checkout_flow`) and dispatches the corresponding test suite without manual configuration.
- **AI Agentic Self-Healing**: Leverages Google Gemini to autonomously analyze test logs, inspect DOM snapshots, and heal brittle locators upon failure in CI.
- **Global DNS Pre-Warming**: Pre-resolves production domains across Cloudflare (`1.1.1.1`), Google (`8.8.8.8`), and Quad9 (`9.9.9.9`) to generate Chromium host-resolver rules, preventing DNS lookup hangs and `EAI_AGAIN` errors under high concurrency.
- **Dynamic CI Matrix**: GitHub Actions dynamically generates runner matrices from [`sites.json`](sites.json), supporting selective single-brand runs or full orchestration.
- **Multi-Device Support**: Emulates Desktop Chrome (`1280x800`) and Mobile Chrome (`Pixel 5`) for responsiveness, touch interaction, and layout integrity.

---

## 🌐 Supported Brand Domains (24 Sites)

All domains are maintained in [`sites.json`](sites.json) and automatically mapped into dynamic Playwright projects:

| # | Brand | Identifier | Production Domain | Flow Type |
|---|---|---|---|:---:|
| 1 | Audi | `audi` | `https://audiwindowsticker.com` | `streaming` |
| 2 | Toyota | `toyota` | `https://toyotawindowsticker.com` | `streaming` |
| 3 | GM | `gm` | `https://gmwindowstickers.com` | `streaming` |
| 4 | Dodge | `dodge` | `https://dodgewindowsticker.com` | `streaming` |
| 5 | Mercedes-Benz | `mercedes` | `https://mercedesbenzwindowsticker.com` | `streaming` |
| 6 | Honda | `honda` | `https://hondawindowsticker.com` | `streaming` |
| 7 | GMC | `gmc` | `https://gmcwindowsticker.com` | `streaming` |
| 8 | Cadillac | `cadillac` | `https://cadillacwindowsticker.com` | `streaming` |
| 9 | Kia | `kia` | `https://kiawindowsticker.com` | `streaming` |
| 10 | Lexus | `lexus` | `https://lexuswindowsticker.com` | `streaming` |
| 11 | Porsche | `porsche` | `https://porschewindowsticker.com` | `streaming` |
| 12 | Alfa Romeo | `alfaromeo` | `https://alfaromeowindowsticker.com` | `streaming` |
| 13 | Ford | `ford` | `https://fordwindowstickerbyvin.com` | `streaming` |
| 14 | Chevrolet | `chevrolet` | `https://chevroletwindowsticker.com` | `streaming` |
| 15 | BMW | `bmw` | `https://bmwwindowsticker.com` | `streaming` |
| 16 | Jeep | `jeep` | `https://jeepwindowsticker.com` | `streaming` |
| 17 | Hyundai | `hyundai` | `https://hyundaiwindowsticker.com` | `streaming` |
| 18 | McLaren | `mclaren` | `https://mclarenwindowsticker.com` | `streaming` |
| 19 | RAM | `ram` | `https://ramwindowsticker.com` | `streaming` |
| 20 | Chrysler | `chrysler` | `https://chryslerwindowsticker.com` | `streaming` |
| 21 | Buick | `buick` | `https://buickwindowsticker.com` | `streaming` |
| 22 | Mitsubishi | `mitsubishi` | `https://mitsubishiwindowsticker.com` | `streaming` |
| 23 | Lincoln | `lincoln` | `https://lincolnwindowsticker.com` | `streaming` |
| 24 | Volvo | `volvo` | `https://volvowindowsticker.com` | `streaming` |

---

## 🧪 Test Suites

1. **Checkout Funnel Suites**:
   - `streaming Task/global_streaming_specs.spec.js`: E2E verification of 17-character VIN decode, classic vehicle decoding, revisit banners, upsells, coupon codes, and exit-intent popups.
   - `tests/global_case_verification.spec.ts`: Fallback suite tailored for legacy / non-streaming checkout flows.

2. **Standalone Quality Audits**:
   - `tests/pricing_page.spec.ts`: Validates personal/business tier pricing card rendering, API parity with `/api/pricing`, regional currency injection, and coupon discount calculations.
   - `tests/session_ip_stickiness.spec.ts`: Verifies Cloudflare / CWA IP stickiness, cross-tab session persistence, and cookie integrity across reloads.
   - `tests/ui_ux_verification.spec.ts`: Layout, typography, viewport responsiveness, and visual accessibility audits.

3. **Telemetry & Attribution**:
   - `tests/datafast_verification.spec.ts`: Stealth tracking and Stripe visitor attribution test suite (preserved; currently commented out).

---

## ⚙️ Prerequisites & Installation

- **Node.js**: `v18+` or `v20+` LTS
- **npm**: `v9+`
- **Browsers**: Chromium (installed via Playwright)

```bash
# Clone the repository
git clone https://github.com/shahnawaz-cmd/-kod-functional-tests.git
cd -kod-functional-tests

# Install dependencies
npm ci

# Install Playwright Chromium browser
npx playwright install chromium
```

---

## 🚀 Running Tests Locally

### Quick Run (With Auto Flow Detection)
```bash
# Runs flow detection on default domain and executes the matched funnel
npm test

# Target a specific project (e.g. MclarenWindowSticker)
node scripts/run-flow.js --project=MclarenWindowSticker

# Target a specific base URL
BASE_URL="https://bmwwindowsticker.com/" npm test
```

### Run Specific Suites
```bash
# Standalone Audits (Pricing, IP Stickiness, UI/UX)
npm run test:standalone

# Pricing Page API parity and discounts
npm run test:pricing

# Session IP stickiness
npm run test:ip

# UI/UX and responsiveness
npm run test:ui-ux
```

### List Scheduled Tests
```bash
npx playwright test --list
```

---

## 🔍 Dynamic Flow Detection

To check the checkout funnel architecture across all configured brand domains:

```bash
# Scan all 24 sites and print the summary table
npm run detect-flow -- --all

# Scan a single URL
node scripts/detect-flow.js "https://toyotawindowsticker.com/"
```

---

## 🤖 AI Agentic Self-Healing

When a test fails in CI or locally, the agentic healer automatically triggers:

```bash
# Run agentic healer against latest failure results
PLAYWRIGHT_PROJECT=ToyotaWindowSticker npm run heal:prod
```

**How it works**:
1. Reads `results.json` to capture failing spec titles, failed locator selectors, and error stacks.
2. Extracts DOM snapshots and current page state.
3. Sends structured diagnostics to the Gemini API (`@google/generative-ai`).
4. Computes resilient locator replacements and updates the test file safely with rollbacks if tests still fail.

---

## 🛡️ DNS Pre-Warming & Network Hardening

To prevent network stalls and DNS drops under high test concurrency:
1. [`global-setup.js`](global-setup.js) pre-warms all production domains using a custom Node.js DNS resolver.
2. Generates [`dns-rules.json`](dns-rules.json) mapping domains to direct IP addresses.
3. Launches Chromium with `--host-resolver-rules` so requests route directly without recurring OS DNS queries.

To manually pre-warm DNS:
```bash
node -e "require('./global-setup')()"
```

---

## 🔄 CI/CD Pipeline (GitHub Actions)

The workflow file is located at [`.github/workflows/playwright.yml`](.github/workflows/playwright.yml).

### Triggering Workflow
1. **Scheduled**: Runs automatically every night at `00:00 UTC`.
2. **On-Demand (`workflow_dispatch`)**:
   - Go to **Actions** → **Window Sticker - Orchestrator E2E Suite** → **Run workflow**.
   - Use the **`site_filter`** dropdown to choose **`all`** or select any specific brand domain (e.g., `toyota`, `bmw`, `mclaren`, `ram`, `volvo`).

### CI Pipeline Stages
1. **Setup Matrix**: Parses `sites.json` and creates runner matrices based on filter input.
2. **Parallel Test Runners**: Runs `Funnel` and `Standalone Audits` in parallel (`max-parallel: 2`).
3. **Consolidation**:
   - Downloads all blob reports and merges them into a unified Playwright HTML report.
   - Generates Allure report with historical trend data.
   - Deploys reports to **GitHub Pages**.
4. **Alerts & Issue Tracking**:
   - Sends rich failure notifications to Slack.
   - Automatically opens or closes GitHub issues based on test status.

---

## 📊 Reporting & Notifications

### Playwright HTML & Allure Reports
```bash
# View Playwright HTML report
npx playwright show-report

# Generate and serve Allure report
npm run allure:generate
npm run allure:open
```

### Environment Variables
Configure the following secrets in GitHub Repository Settings or local `.env`:
```ini
BASE_URL=https://toyotawindowsticker.com/
CI=true
GEMINI_API_KEY=your_gemini_api_key_here
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
GITHUB_TOKEN=your_github_token_here
```

---

## 📁 Project Structure

```text
├── .github/
│   └── workflows/
│       └── playwright.yml         # GitHub Actions CI/CD matrix pipeline
├── scripts/
│   ├── detect-flow.js             # Checkout flow detector (streaming vs non_streaming)
│   ├── run-flow.js                # Dynamic test runner with flow detection
│   ├── agentic-healer-ci.js       # Gemini-based AI self-healer
│   ├── slack-notify.js            # Rich Slack notification handler
│   └── manage-issues.js           # Automated GitHub issues sync
├── streaming Task/
│   ├── global_streaming_specs.spec.js # Core streaming checkout funnel suite
│   ├── pages/                     # Page Object Models (POM)
│   └── tasks/                     # Task wrappers (YMM edit, coupons, Clarity)
├── tasks/
│   ├── pricing/                   # Pricing page audit tasks
│   └── DataFastVerificationTask.ts# DataFast telemetry verification task
├── tests/
│   ├── global_case_verification.spec.ts # Non-streaming fallback suite
│   ├── pricing_page.spec.ts       # Pricing cards & API parity
│   ├── session_ip_stickiness.spec.ts   # Session & CWA IP stickiness
│   ├── ui_ux_verification.spec.ts # UI/UX responsiveness
│   └── datafast_verification.spec.ts  # DataFast telemetry (commented out)
├── global-setup.js                # DNS pre-warming & host resolver generator
├── playwright.config.js           # Playwright root configuration
├── sites.json                     # Brand domains configuration registry
└── package.json                   # Scripts and project dependencies
```

---

## 📄 License
ISC © Window Sticker Quality Engineering Team
