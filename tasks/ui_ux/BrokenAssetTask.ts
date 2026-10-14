// tasks/ui_ux/BrokenAssetTask.ts
import { Page, expect, test } from '@playwright/test';
import { Actor } from '../../actors/Actor';

/**
 * Broken Asset Audit:
 * Detects broken images (img tags with naturalWidth === 0 and complete === true).
 */
export class BrokenAssetTask {
  async performAs(target: Actor | Page) {
    const page = target instanceof Actor ? target.getPage() : target;

    await test.step('UI/UX: Verify No Broken Images or Missing Assets', async () => {
      console.log('🔍 [BrokenAssetTask] Scanning page for broken image elements...');

      const brokenImages = await page.evaluate(() => {
        const results: { src: string; selector: string }[] = [];
        const images = Array.from(document.querySelectorAll('img'));

        for (const img of images) {
          // Ignore analytics / tracking beacon pixels
          const isTrackingPixel = /bat\.bing|google-analytics|doubleclick|facebook\.com\/tr|analytics|pixel|beacon/i.test(img.src) ||
            img.id?.includes('batBeacon') ||
            (img.width <= 1 && img.height <= 1 && (img.style.display === 'none' || img.style.visibility === 'hidden'));
          if (isTrackingPixel) continue;

          if (img.complete && img.naturalWidth === 0 && img.src && !img.src.startsWith('data:')) {
            const selector = img.id ? `#${img.id}` : `img[src*="${img.src.slice(-25)}"]`;
            results.push({ src: img.src.slice(0, 50), selector });
          }
        }
        return results;
      });

      if (brokenImages.length > 0) {
        console.warn(`⚠️ [BrokenAssetTask] Found ${brokenImages.length} broken images:`, brokenImages);
      } else {
        console.log('✅ [BrokenAssetTask] All rendered images loaded successfully with valid dimensions.');
      }

      // Assert no broken images
      expect.soft(
        brokenImages.length,
        `Found ${brokenImages.length} broken images on page (${brokenImages.map(b => b.src).join(', ')})`
      ).toBe(0);
    });
  }
}

export default BrokenAssetTask;
