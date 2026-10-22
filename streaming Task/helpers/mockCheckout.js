/**
 * Mock Checkout Template Generator for Frontend-Only Validation
 *
 * Prevents automated test runs from contacting the backend server or creating
 * Incomplete invoices/subscriptions in the live Stripe dashboard.
 */
function getMockCheckoutHtml(planName, planPrice, upsellPrice, email) {
  const pPrice = parseFloat(planPrice) || 25.00;
  const uPrice = parseFloat(upsellPrice) || 0;
  const initialTotal = (pPrice + uPrice).toFixed(2);
  const discountAmount = (pPrice * 0.20).toFixed(2);
  const discountedTotal = (pPrice + uPrice - parseFloat(discountAmount)).toFixed(2);

  return `<!DOCTYPE html>
<html>
<head>
  <title>Secure Checkout</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script type="text/javascript">
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    })(window, document, "clarity", "script");
  </script>
  <style>
    body { font-family: sans-serif; background: #f8fafc; padding: 20px; }
    aside { max-width: 450px; background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .total { font-size: 1.25rem; font-weight: bold; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 12px; }
    .promo-box { display: flex; gap: 8px; margin: 16px 0; }
    input { flex: 1; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; }
    button { padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; }
    .applied-tag { color: #16a34a; font-size: 0.875rem; font-weight: 500; margin-top: 4px; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <main>
    <h1>Secure checkout</h1>
    <p>Paying as ${email || 'customer@example.com'}</p>
    <aside role="complementary" id="order-summary-aside">
      <h2>Order summary</h2>
      <div class="row">
        <span>PACKAGE</span>
      </div>
      <div class="row">
        <span>${planName || '1 Window Sticker'}</span>
        <span>$${pPrice.toFixed(2)}</span>
      </div>
      ${uPrice > 0 ? `
      <div class="row">
        <span>ADD-ON</span>
      </div>
      <div class="row">
        <span>Vehicle Report</span>
        <span>$${uPrice.toFixed(2)}</span>
      </div>` : ''}
      <div class="promo-box">
        <input type="text" id="promo-input" placeholder="Promo code" aria-label="Promo code">
        <button id="apply-btn" type="button">Apply</button>
      </div>
      <div id="applied-notice" class="applied-tag hidden">
        GET20 applied — 20% off
      </div>
      <div id="total-row" class="row total">
        <span>Total</span>
        <span id="total-val">$${initialTotal}</span>
      </div>
      <p style="font-size: 0.8rem; color: #64748b;">Secure checkout • Instant access</p>
    </aside>
  </main>
  <script>
    const aside = document.getElementById('order-summary-aside');
    const input = document.getElementById('promo-input');
    const applyBtn = document.getElementById('apply-btn');
    const appliedNotice = document.getElementById('applied-notice');
    const totalRow = document.getElementById('total-row');
    const totalVal = document.getElementById('total-val');

    function apply() {
      const code = (input.value || '').trim().toLowerCase();
      if (code === 'get20') {
        const discountDiv = document.createElement('div');
        discountDiv.className = 'row';
        discountDiv.style.color = '#16a34a';
        discountDiv.innerHTML = '<span>Discount</span><span>-$${discountAmount}</span>';
        aside.insertBefore(discountDiv, totalRow);

        appliedNotice.classList.remove('hidden');
        totalVal.innerText = '$${discountedTotal}';
      }
    }

    applyBtn.addEventListener('click', apply);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') apply();
    });
  </script>
</body>
</html>`;
}

/**
 * Attaches frontend mock route handlers to a Playwright page to intercept checkout navigations
 * and prevent backend server-side Stripe invoice creation.
 */
async function attachMockCheckoutRoute(page) {
  // 1. Intercept client-side Stripe SDK and telemetry calls
  await page.route(/.*(api\.stripe\.com|merchant-ui-api\.stripe\.com|r\.stripe\.com|m\.stripe\.com|m\.stripe\.network|stripecdn\.com).*/i, (route) => {
    route.abort().catch(() => {});
  });

  // 2. Intercept /api/preview-analytics to prevent background lead/invoice creation
  await page.route('**/api/preview-analytics', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) }).catch(() => {});
  });

  // 3. Intercept /checkout route to serve dynamic mock HTML without hitting backend server
  await page.route(/.*\/checkout.*/, (route) => {
    const reqUrl = route.request().url();
    let planName = '1 Window Sticker';
    let planPrice = 25.00;
    let upsellPrice = 0;
    let email = 'shahnawaz@empirepixel.com';

    try {
      const urlObj = new URL(reqUrl);
      const rawData = urlObj.searchParams.get('data');
      if (rawData) {
        const decoded = JSON.parse(Buffer.from(rawData, 'base64').toString('utf-8'));
        if (decoded.itemLabel) planName = decoded.itemLabel;
        if (decoded.price) planPrice = decoded.price;
        if (decoded.addOnPrice) upsellPrice = decoded.addOnPrice;
        if (decoded.email) email = decoded.email;
      }
    } catch (e) {}

    const mockHtml = getMockCheckoutHtml(planName, planPrice, upsellPrice, email);
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: mockHtml
    });
  });
}

module.exports = { getMockCheckoutHtml, attachMockCheckoutRoute };
