import { Page } from '@playwright/test';
import { Actor } from '../actors/Actor';

/**
 * Task specifically targeting and dismissing third-party Live Chat overlay widgets on mobile
 * (e.g. Zendesk, LiveChat, Tawk.to, Intercom, Crisp) without touching any site-owned
 * popups, exit intent banners, discount modals, or custom alerts.
 */
export class DismissLiveChat {
  constructor(private customTimeout: number = 1500) {}

  static ifPresent(timeoutMs: number = 1500): DismissLiveChat {
    return new DismissLiveChat(timeoutMs);
  }

  async performAs(actor: Actor): Promise<boolean> {
    const page = actor.getPage();

    // 1. Target external live chat frames only
    for (const frame of page.frames()) {
      const frameUrl = frame.url().toLowerCase();
      const frameName = frame.name().toLowerCase();

      const isLiveChatFrame =
        frameUrl.includes('livechat') ||
        frameUrl.includes('tawk.to') ||
        frameUrl.includes('zendesk') ||
        frameUrl.includes('intercom') ||
        frameUrl.includes('crisp.chat') ||
        frameUrl.includes('drift') ||
        frameUrl.includes('hubspot') ||
        frameName.includes('chat') ||
        frameName.includes('launcher');

      if (isLiveChatFrame) {
        try {
          const chatCloseBtn = frame
            .locator('button[aria-label*="close" i], button[aria-label*="minimize" i], button[title*="close" i], [class*="close" i]')
            .locator('visible=true')
            .first();

          if (await chatCloseBtn.isVisible({ timeout: this.customTimeout }).catch(() => false)) {
            console.log('🛡️ [Live Chat] Dismissing external live chat popup in mobile view...');
            await chatCloseBtn.click({ force: true }).catch(() => {});
            return true;
          }
        } catch (e) {}
      }
    }

    // 2. Target specific external live chat host container buttons only
    const liveChatHostSelectors = [
      '#chat-widget-container button[aria-label*="close" i]',
      '#chat-widget-container button[aria-label*="minimize" i]',
      '#hubspot-messages-iframe-container button[aria-label*="close" i]',
      '.crisp-client [aria-label*="close" i]',
      '.intercom-lightweight-app [aria-label*="close" i]',
      'div[id*="tawk" i] [aria-label*="close" i]',
      'button[aria-label*="chat" i][aria-label*="close" i]'
    ];

    for (const sel of liveChatHostSelectors) {
      try {
        const chatBtn = page.locator(sel).locator('visible=true').first();
        if (await chatBtn.isVisible({ timeout: this.customTimeout }).catch(() => false)) {
          console.log(`🛡️ [Live Chat] Closing external live chat widget ("${sel}")...`);
          await chatBtn.click({ force: true }).catch(() => {});
          return true;
        }
      } catch (e) {}
    }

    return false;
  }
}
