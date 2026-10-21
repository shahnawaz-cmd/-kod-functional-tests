import { Page, TestInfo, expect, test } from '@playwright/test';

export interface StripeElementsSessionData {
  url: string;
  amount: string | null;
  currency: string | null;
  mode: string | null;
  type: string | null;
  publishableKey: string | null;
  responseStatus: number;
  responseBody?: any;
}

export interface BackendPaymentIntentPayload {
  url: string;
  method: string;
  postData: any;
  hasDatafastMetadata: boolean;
}

/**
 * Stripe Elements Sessions & Payment Intent Verification Task
 *
 * Verifies that when Checkout is loaded in streaming mode:
 * 1. GET https://api.stripe.com/v1/elements/sessions is called with valid deferred_intent params
 * 2. Checks whether DataFast tracking metadata (e.g. dfid / datafast) is passed
 * 3. Captures and attaches full network telemetry to test results
 */
export class StripeElementsVerificationTask {
  constructor(private testInfo?: TestInfo) {}

  /**
   * Listens for api.stripe.com/v1/elements/sessions network request & response
   */
  async captureElementsSession(page: Page, triggerAction: () => Promise<void>): Promise<StripeElementsSessionData> {
    return await test.step('Intercept & Verify Stripe Elements Sessions API', async () => {
      console.log('\n💳 [Stripe Task] Setting up Stripe Elements /elements/sessions listener...');

      let capturedRequestUrl: string | null = null;
      let capturedStatus: number = 0;
      let capturedResponseBody: any = null;

      // 1. Listen for request and response concurrently
      const sessionResponsePromise = page.waitForResponse(res => {
        const url = res.url();
        return url.includes('api.stripe.com/v1/elements/sessions');
      }, { timeout: 35000 });

      // 2. Execute the navigation/action that triggers Checkout load
      await triggerAction();

      // 3. Await the response
      const response = await sessionResponsePromise;
      capturedRequestUrl = response.url();
      capturedStatus = response.status();

      try {
        capturedResponseBody = await response.json();
      } catch (e) {
        console.warn('[Stripe Task] Could not parse response as JSON');
      }

      const parsedUrl = new URL(capturedRequestUrl);
      const params = parsedUrl.searchParams;

      const sessionData: StripeElementsSessionData = {
        url: capturedRequestUrl,
        amount: params.get('deferred_intent[amount]') || params.get('amount'),
        currency: params.get('deferred_intent[currency]') || params.get('currency'),
        mode: params.get('deferred_intent[mode]') || params.get('mode'),
        type: params.get('type'),
        publishableKey: params.get('key'),
        responseStatus: capturedStatus,
        responseBody: capturedResponseBody
      };

      console.log('✅ [Stripe Task] Successfully Intercepted Stripe Elements Sessions:');
      console.log(`   Status: ${sessionData.responseStatus}`);
      console.log(`   Type: ${sessionData.type}`);
      console.log(`   Mode: ${sessionData.mode}`);
      console.log(`   Amount: ${sessionData.amount}`);
      console.log(`   Currency: ${sessionData.currency}`);
      console.log(`   Publishable Key: ${sessionData.publishableKey ? sessionData.publishableKey.slice(0, 15) + '...' : 'none'}`);

      // 4. Assertions on the Stripe session
      expect(sessionData.responseStatus, 'Stripe Elements session must respond with 200 OK').toBe(200);
      expect(sessionData.publishableKey, 'Stripe publishable key must be provided').toContain('pk_');
      expect(sessionData.currency?.toLowerCase(), 'Stripe currency must be USD').toBe('usd');
      expect(Number(sessionData.amount), 'Stripe amount must be greater than 0').toBeGreaterThan(0);

      if (this.testInfo) {
        await this.testInfo.attach('stripe-elements-session.json', {
          body: JSON.stringify({
            requestUrl: sessionData.url,
            queryParams: Object.fromEntries(parsedUrl.searchParams.entries()),
            responseStatus: sessionData.responseStatus,
            responseBody: sessionData.responseBody
          }, null, 2),
          contentType: 'application/json'
        });
      }

      return sessionData;
    });
  }

  /**
   * Inspects all backend requests during checkout for DataFast metadata tracking
   */
  setupDatafastBackendTracker(page: Page, targetDatafastId: string = 'dfid_Czs2Hy80SCi2wqeIdI6R7'): {
    getCapturedPayloads: () => BackendPaymentIntentPayload[];
  } {
    const payloads: BackendPaymentIntentPayload[] = [];

    page.on('request', req => {
      const url = req.url();
      const method = req.method();

      // Check backend API calls or payment calls
      if (method === 'POST' && (url.includes('/api/') || url.includes('checkout') || url.includes('payment') || url.includes('intent'))) {
        const postData = req.postData();
        if (postData) {
          const hasDatafast = postData.includes(targetDatafastId) || postData.toLowerCase().includes('datafast');
          payloads.push({
            url,
            method,
            postData,
            hasDatafastMetadata: hasDatafast
          });
          if (hasDatafast) {
            console.log(`🎯 [Stripe Task] DataFast ID detected in request to: ${url}`);
          }
        }
      }
    });

    return {
      getCapturedPayloads: () => payloads
    };
  }
}
