// tasks/ui_ux/UiUxAuditTask.ts
import { Page, test } from '@playwright/test';
import { Actor } from '../../actors/Actor';
import { HorizontalOverflowTask } from './HorizontalOverflowTask';
import { HeaderOverlapTask } from './HeaderOverlapTask';
import { TouchTargetTask } from './TouchTargetTask';
import { MobileKeyboardTask } from './MobileKeyboardTask';
import { NavigationMenuTask } from './NavigationMenuTask';
import { FloatingWidgetOverlapTask } from './FloatingWidgetOverlapTask';
import { CardStackingTask } from './CardStackingTask';
import { FaqAccordionTask } from './FaqAccordionTask';
import { InputZoomGuardTask } from './InputZoomGuardTask';
import { ResponsiveTableTask } from './ResponsiveTableTask';
import { ScrollFooterTask } from './ScrollFooterTask';
import { BrokenAssetTask } from './BrokenAssetTask';

/**
 * Composite UI/UX Full Audit Task:
 * Sequentially runs all 12 UI & UX inspection rules on any given page.
 */
export class UiUxAuditTask {
  async performAs(target: Actor | Page) {
    const page = target instanceof Actor ? target.getPage() : target;

    await test.step('UI/UX: Full Page Responsiveness & Quality Suite', async () => {
      await new HorizontalOverflowTask().performAs(page);
      await new HeaderOverlapTask().performAs(page);
      await new NavigationMenuTask().performAs(page);
      await new ScrollFooterTask().performAs(page);
      await new FaqAccordionTask().performAs(page);
      await new FloatingWidgetOverlapTask().performAs(page);
      await new CardStackingTask().performAs(page);
      await new ResponsiveTableTask().performAs(page);
      await new BrokenAssetTask().performAs(page);
      await new TouchTargetTask().performAs(page);
      await new InputZoomGuardTask().performAs(page);
      await new MobileKeyboardTask().performAs(page);
    });
  }
}

export default UiUxAuditTask;
