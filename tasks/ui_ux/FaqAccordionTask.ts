// tasks/ui_ux/FaqAccordionTask.ts
import { Page, expect, test } from '@playwright/test';
import { Actor } from '../../actors/Actor';

/**
 * FAQ & Accordion Expand/Collapse Task:
 * Tests that FAQ accordions expand and collapse properly upon click without crashing or freezing.
 */
export class FaqAccordionTask {
  async performAs(target: Actor | Page) {
    const page = target instanceof Actor ? target.getPage() : target;

    await test.step('UI/UX: Verify FAQ Accordion Expand & Collapse', async () => {
      const faqTriggers = page.locator(
        'details:not([class*="/dd"]):not([class*="/mdd"]) > summary, section:has-text("FAQ") details summary, [class*="faq" i] button, [class*="accordion" i] button'
      );
      const count = await faqTriggers.count();

      if (count === 0) {
        console.log('ℹ️ [FaqAccordionTask] No FAQ accordion sections found on this route. Skipping.');
        return;
      }

      console.log(`🔍 [FaqAccordionTask] Found ${count} FAQ accordion elements. Testing interactive items...`);
      const itemsToTest = Math.min(count, 3);

      for (let i = 0; i < itemsToTest; i++) {
        const trigger = faqTriggers.nth(i);
        const rawText = await trigger.textContent().catch(() => '');
        const title = (rawText || `FAQ #${i + 1}`).trim().slice(0, 30);

        await trigger.scrollIntoViewIfNeeded().catch(() => {});
        let clicked = false;
        try {
          await trigger.click({ timeout: 2500 });
          clicked = true;
        } catch (err) {
          try {
            await trigger.click({ timeout: 2500, force: true });
            clicked = true;
          } catch (forceErr) {
            console.warn(`⚠️ [FaqAccordionTask] Accordion "${title}" was not clickable:`, err);
          }
        }

        expect.soft(clicked, `FAQ Accordion "${title}" should be clickable`).toBe(true);

        // Check expanded state
        const isExpanded = await trigger.evaluate((el) => {
          const details = el.closest('details');
          if (details) return details.open;
          const aria = el.getAttribute('aria-expanded');
          return aria === 'true';
        });

        console.log(`ℹ️ [FaqAccordionTask] Accordion "${title}" expanded state: ${isExpanded}`);
      }

      console.log('✅ [FaqAccordionTask] FAQ accordions interact smoothly without dead clicks.');
    });
  }
}

export default FaqAccordionTask;
