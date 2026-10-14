// tasks/ui_ux/HorizontalOverflowTask.ts
import { Page, TestInfo, expect, test } from '@playwright/test';
import { Actor } from '../../actors/Actor';
import * as fs from 'fs';
import * as path from 'path';

export class HorizontalOverflowTask {
  async performAs(target: Actor | Page, testInfo?: TestInfo) {
    const page = target instanceof Actor ? target.getPage() : target;

    await test.step('UI/UX: Verify Horizontal Overflow & Viewport Boundaries', async () => {
      const viewport = page.viewportSize() || { width: 1280, height: 720 };
      const projectName = testInfo?.project?.name || (viewport.width < 768 ? 'Mobile' : 'Desktop');
      console.log(`🔍 [HorizontalOverflowTask] Auditing viewport width: ${viewport.width}px (${projectName})`);

      // 1. Detect if page has horizontal bleed or elements extending past viewport width
      const bleedData = await page.evaluate((screenWidth) => {
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const hasPageHorizontalScroll = scrollWidth > docWidth + 15;

        let overflowingElement: {
          selector: string;
          text: string;
          overflowPx: number;
          hasPageHorizontalScroll: boolean;
          scrollWidth: number;
          docWidth: number;
        } | null = null;

        const all = document.querySelectorAll('*');
        for (const el of all) {
          const rect = el.getBoundingClientRect();
          if (rect.right > screenWidth + 5 && rect.width > 0) {
            const selector = el.id 
              ? `#${el.id}` 
              : el.className && typeof el.className === 'string' && el.className.trim()
                ? `.${el.className.trim().split(/\s+/)[0]}` 
                : el.tagName.toLowerCase();
            const text = (el.textContent?.trim() || el.getAttribute('aria-label') || 'Container').slice(0, 30);
            const overflowPx = Math.round(rect.right - screenWidth);

            overflowingElement = {
              selector,
              text,
              overflowPx,
              hasPageHorizontalScroll,
              scrollWidth,
              docWidth
            };
            break;
          }
        }

        return overflowingElement || {
          selector: '',
          text: '',
          overflowPx: 0,
          hasPageHorizontalScroll,
          scrollWidth,
          docWidth
        };
      }, viewport.width);

      // Prepare screenshots folder
      const screenshotDir = path.resolve(process.cwd(), 'test-results', 'screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      let pageSlug = 'page';
      try {
        const pathname = new URL(page.url()).pathname.replace(/^\//, '').replace(/\/$/, '');
        pageSlug = pathname ? pathname.replace(/[^a-zA-Z0-9_-]/g, '_') : 'homepage';
      } catch {}

      // ─────────────────────────────────────────────────────────────
      // CASE 1: OVERFLOW DETECTED -> HIGHLIGHT WITH RED BORDER & FULL PAGE SS
      // ─────────────────────────────────────────────────────────────
      if (bleedData.hasPageHorizontalScroll || bleedData.overflowPx > 0) {
        console.warn(`⚠️ [HorizontalOverflowTask] Horizontal overflow found! Element "${bleedData.text}" bleeds by ${bleedData.overflowPx}px. Highlighting with red border...`);

        // Inject high-contrast red border on the overflowing element & its container
        if (bleedData.selector) {
          await page.evaluate(({ sel, overflow }) => {
            const el = document.querySelector(sel);
            if (el) {
              (el as HTMLElement).style.outline = '4px solid #ff0033';
              (el as HTMLElement).style.outlineOffset = '2px';
              (el as HTMLElement).style.boxShadow = '0 0 15px rgba(255, 0, 51, 0.7)';

              // Also highlight parent container with red border
              const parent = el.parentElement;
              if (parent && parent !== document.body) {
                parent.style.border = '3px dashed #ff0033';
              }

              // Add floating red defect badge
              const existing = document.querySelector('.overflow-defect-badge');
              if (!existing) {
                const badge = document.createElement('div');
                badge.className = 'overflow-defect-badge';
                badge.innerText = `⚠️ OVERFLOW DEFECT: +${overflow}px (Exceeds Viewport)`;
                badge.style.cssText = 'position:absolute;background:#ff0033;color:#ffffff;font-family:sans-serif;font-size:12px;font-weight:bold;padding:4px 10px;border-radius:4px;z-index:999999;box-shadow:0 3px 8px rgba(0,0,0,0.4);';
                el.parentElement?.insertBefore(badge, el);
              }
            }
          }, { sel: bleedData.selector, overflow: bleedData.overflowPx });

          // Scroll overflowing container into view
          const loc = page.locator(bleedData.selector).first();
          await loc.scrollIntoViewIfNeeded().catch(() => {});
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        }

        // Full page screenshot capturing the full layout with the red-bordered container
        const fullPageFileName = `overflow-defect-fullpage-${pageSlug}-${viewport.width}px-${Date.now()}.png`;
        const fullPageFilePath = path.join(screenshotDir, fullPageFileName);

        const defectBuffer = await page.screenshot({
          path: fullPageFilePath,
          fullPage: true,
          scale: 'css',
          timeout: 30000
        });

        // 🌟 Print exact full page screenshot path in STDOUT
        console.log(`📸 [STDOUT PROOF] Red-Border Highlighted Full-Page Screenshot (${viewport.width}px): file:///${fullPageFilePath.replace(/\\/g, '/')}`);

        if (testInfo) {
          await testInfo.attach('overflow-defect-highlighted-fullpage.png', {
            body: defectBuffer,
            contentType: 'image/png'
          }).catch(() => {});
        }

        // Restore scroll position to top for clean state in subsequent tasks
        await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});

        expect.soft(
          bleedData.hasPageHorizontalScroll,
          `Page layout has unwanted horizontal scrollbar extending by ${bleedData.overflowPx || (bleedData.scrollWidth - bleedData.docWidth)}px on ${projectName}`
        ).toBe(false);

      } else {
        // ─────────────────────────────────────────────────────────────
        // CASE 2: NO OVERFLOW DETECTED -> PROOF FULL PAGE SCREENSHOT
        // ─────────────────────────────────────────────────────────────
        console.log(`✅ [HorizontalOverflowTask] 0px Overflow: Content 100% aligned within ${viewport.width}px. Capturing full-page proof...`);

        // Inject green alignment boundary guide down the entire document height
        await page.evaluate((width) => {
          const fullHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
          const guide = document.createElement('div');
          guide.id = 'viewport-alignment-proof-guide';
          guide.style.cssText = `
            position: absolute;
            top: 0;
            right: 0;
            width: 4px;
            height: ${fullHeight}px;
            background: #10b981;
            box-shadow: 0 0 10px rgba(16, 185, 129, 0.8);
            z-index: 999999;
            pointer-events: none;
          `;

          const badge = document.createElement('div');
          badge.id = 'viewport-alignment-proof-badge';
          badge.style.cssText = `
            position: absolute;
            top: 10px;
            right: 12px;
            background: #10b981;
            color: #ffffff;
            font-family: sans-serif;
            font-size: 11px;
            font-weight: bold;
            padding: 4px 8px;
            border-radius: 4px;
            z-index: 1000000;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            pointer-events: none;
          `;
          badge.innerText = `✓ 100% ALIGNED (${width}px - 0px OVERFLOW)`;
          document.body.appendChild(guide);
          document.body.appendChild(badge);
        }, viewport.width);

        const fullPageProofName = `overflow-proof-aligned-fullpage-${pageSlug}-${viewport.width}px-${Date.now()}.png`;
        const fullPageProofPath = path.join(screenshotDir, fullPageProofName);

        const proofBuffer = await page.screenshot({
          path: fullPageProofPath,
          fullPage: true,
          scale: 'css',
          timeout: 30000
        });

        // Cleanup injected proof guides
        await page.evaluate(() => {
          document.getElementById('viewport-alignment-proof-guide')?.remove();
          document.getElementById('viewport-alignment-proof-badge')?.remove();
        }).catch(() => {});

        // 🌟 Print exact full page screenshot path in STDOUT
        console.log(`📸 [STDOUT PROOF] Viewport Alignment Full-Page Screenshot (${viewport.width}px): file:///${fullPageProofPath.replace(/\\/g, '/')}`);

        if (testInfo) {
          await testInfo.attach('overflow-alignment-proof-fullpage.png', {
            body: proofBuffer,
            contentType: 'image/png'
          }).catch(() => {});
        }

        expect.soft(bleedData.hasPageHorizontalScroll).toBe(false);
      }
    });
  }
}

export default HorizontalOverflowTask;
