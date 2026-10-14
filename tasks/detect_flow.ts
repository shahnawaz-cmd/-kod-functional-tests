import { Page } from '@playwright/test';
import { Actor } from '../actors/Actor';

export interface DetectFlowResult {
  flowType: string | null;
  source: 'cookie' | 'localStorage' | 'none';
}

/**
 * Task to detect the active checkout flow (streaming vs non_streaming)
 * from either cookies or localStorage site_settings.
 */
export class DetectFlowTask {
  async performAs(actor: Actor): Promise<DetectFlowResult> {
    const page = actor.getPage();
    return DetectFlowTask.detectFromPage(page);
  }

  static async detectFromPage(page: Page): Promise<DetectFlowResult> {
    let flowType: string | null = null;
    let source: 'cookie' | 'localStorage' | 'none' = 'none';

    // Poll for up to 10 seconds (20 x 500ms)
    for (let attempt = 0; attempt < 20; attempt++) {
      await page.waitForTimeout(500);

      const cookies = await page.context().cookies();
      const flowCookie = cookies.find((c) => c.name === 'checkout_flow');

      if (flowCookie && flowCookie.value) {
        flowType = flowCookie.value;
        source = 'cookie';
        break;
      }

      const lsFlow = await page.evaluate(() => {
        try {
          const settings = JSON.parse(localStorage.getItem('site_settings') || '{}');
          return settings.checkout_flow || null;
        } catch (e) {
          return null;
        }
      });

      if (lsFlow) {
        flowType = lsFlow;
        source = 'localStorage';
        break;
      }
    }

    if (flowType) {
      console.log(`✅ [Flow Detector] Detected Checkout Flow: ${flowType} (via ${source})`);
    } else {
      console.warn('⚠️ [Flow Detector] Could not detect checkout_flow cookie or localStorage.');
    }

    return { flowType, source };
  }
}
