/**
 * Self-healing locator helper specifically designed for Input / Textbox fields.
 * Prioritizes accessibility textboxes, labels, placeholders, and attribute selectors before CSS/XPath fallbacks.
 * Always targets .first() to prevent Playwright strict mode violations.
 */
async function locateInputWithHealing(page, labelText, fallbackSelectors = [], options = {}) {
  const isSlowNetwork = options.isSlowNetwork || process.env.SLOW_NETWORK === 'true';
  const baseTimeout = options.timeout || (isSlowNetwork ? 6000 : 3000);
  const strategyTimeout = options.strategyTimeout || (isSlowNetwork ? 1500 : 800);

  const rawStrategies = [
    () => page.getByRole('textbox', { name: new RegExp(labelText, 'i') }),
    () => page.getByPlaceholder(new RegExp(labelText, 'i')),
    () => page.getByLabel(new RegExp(labelText, 'i')),
    () => page.getByTestId(labelText.toLowerCase().replace(/\s+/g, '-')),
    ...fallbackSelectors.map((sel) => () => (typeof sel === 'function' ? sel(page) : page.locator(sel)))
  ];

  // Pass 1: Look for currently VISIBLE elements first
  for (let i = 0; i < rawStrategies.length; i++) {
    try {
      const loc = rawStrategies[i]().locator('visible=true').first();
      const isVisible = await loc.isVisible({ timeout: strategyTimeout }).catch(() => false);
      if (isVisible) {
        console.log(`✅ [Self-Healing Input] Located visible field "${labelText}" using strategy #${i + 1}`);
        return loc;
      }
    } catch (e) {}
  }

  // Pass 2: Fallback to first matched element
  for (let i = 0; i < rawStrategies.length; i++) {
    try {
      const loc = rawStrategies[i]().first();
      const isVisible = await loc.isVisible({ timeout: 600 }).catch(() => false);
      if (isVisible) {
        return loc;
      }
    } catch (e) {}
  }

  // Final fallback
  if (fallbackSelectors.length > 0) {
    const sel = fallbackSelectors[0];
    return typeof sel === 'function' ? sel(page).first() : page.locator(sel).first();
  }

  return rawStrategies[0]().first();
}

/**
 * Fast and resilient input helper for Desktop & Mobile browsers.
 * Combines self-healing visible field location with instant fill and native event dispatching.
 */
async function fastInputWithHealing(page, labelText, value, fallbackSelectors = [], options = {}) {
  const input = await locateInputWithHealing(page, labelText, fallbackSelectors, options);

  try {
    await input.scrollIntoViewIfNeeded().catch(() => {});
    await input.fill(value);
    await input.dispatchEvent('input').catch(() => {});
    await input.dispatchEvent('change').catch(() => {});
  } catch (err) {
    await input.evaluate((el, val) => {
      el.focus();
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value).catch(() => {});
  }

  return input;
}

/**
 * Self-healing locator helper for general interactive UI elements (buttons, tabs, links, containers).
 */
async function locateElementWithHealing(page, labelText, fallbackSelectors = [], options = {}) {
  const isSlowNetwork = options.isSlowNetwork || process.env.SLOW_NETWORK === 'true';
  const baseTimeout = options.timeout || (isSlowNetwork ? 6000 : 3000);
  const strategyTimeout = options.strategyTimeout || (isSlowNetwork ? 1500 : 800);

  const rawStrategies = [
    () => page.getByRole('tab', { name: new RegExp(labelText, 'i') }),
    () => page.getByRole('button', { name: new RegExp(labelText, 'i') }),
    () => page.locator(`text=${labelText}`),
    () => page.getByTestId(labelText.toLowerCase().replace(/\s+/g, '-')),
    ...fallbackSelectors.map((sel) => () => (typeof sel === 'function' ? sel(page) : page.locator(sel)))
  ];

  // Pass 1: Look for VISIBLE elements first
  for (let i = 0; i < rawStrategies.length; i++) {
    try {
      const loc = rawStrategies[i]().locator('visible=true').first();
      const isVisible = await loc.isVisible({ timeout: strategyTimeout }).catch(() => false);
      if (isVisible) {
        console.log(`✅ [Self-Healing] Located visible element "${labelText}" using strategy #${i + 1}`);
        return loc;
      }
    } catch (e) {}
  }

  // Pass 2: Fallback
  for (let i = 0; i < rawStrategies.length; i++) {
    try {
      const loc = rawStrategies[i]().first();
      const isVisible = await loc.isVisible({ timeout: 600 }).catch(() => false);
      if (isVisible) {
        return loc;
      }
    } catch (e) {}
  }

  if (fallbackSelectors.length > 0) {
    const sel = fallbackSelectors[0];
    return typeof sel === 'function' ? sel(page).first() : page.locator(sel).first();
  }

  return rawStrategies[0]().first();
}

/**
 * Helper to click an element resilience-first using self-healing strategies
 */
async function clickWithHealing(page, buttonTextOrLabel, fallbackSelectors = [], options = {}) {
  const rawStrategies = [
    () => page.getByRole('button', { name: new RegExp(buttonTextOrLabel, 'i') }),
    () => page.locator(`button:has-text("${buttonTextOrLabel}")`),
    () => page.locator(`text=${buttonTextOrLabel}`),
    () => page.getByTestId(buttonTextOrLabel.toLowerCase().replace(/\s+/g, '-')),
    ...fallbackSelectors.map((sel) => () => (typeof sel === 'function' ? sel(page) : page.locator(sel)))
  ];

  const strategyTimeout = options.strategyTimeout || (process.env.SLOW_NETWORK === 'true' ? 2000 : 1000);

  // Pass 1: Try visible match first
  for (let i = 0; i < rawStrategies.length; i++) {
    try {
      const loc = rawStrategies[i]().locator('visible=true').first();
      const isVisible = await loc.isVisible({ timeout: strategyTimeout }).catch(() => false);
      if (isVisible) {
        console.log(`✅ [Self-Healing Click] Located button "${buttonTextOrLabel}" using strategy #${i + 1}`);
        await loc.click({ force: true });
        return;
      }
    } catch (e) {}
  }

  // Pass 2: Regular click
  for (let i = 0; i < rawStrategies.length; i++) {
    try {
      const loc = rawStrategies[i]().first();
      const isVisible = await loc.isVisible({ timeout: 1000 }).catch(() => false);
      if (isVisible) {
        await loc.click({ force: true });
        return;
      }
    } catch (e) {}
  }

  if (fallbackSelectors.length > 0) {
    const sel = fallbackSelectors[0];
    const loc = typeof sel === 'function' ? sel(page).first() : page.locator(sel).first();
    await loc.click({ force: true }).catch(() => {});
    return;
  }

  await rawStrategies[0]().first().click({ force: true });
}

module.exports = {
  locateInputWithHealing,
  fastInputWithHealing,
  locateElementWithHealing,
  clickWithHealing
};
