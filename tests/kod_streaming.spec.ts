// tests/kod_streaming.spec.ts
import {
  test,
  expect,
  resilientNavigateHome,
  executeShieldedStreaming,
  skipMobile
} from '../fixtures/streaming.fixture';
import { STREAMING_TEST_DATA } from '../data/streaming.data';

test.describe('KOD Streaming End-to-End Funnel Suite', () => {
  test.describe.configure({ timeout: process.env.CI ? 150000 : 120000 });

  // ─────────────────────────────────────────────────────────────
  // TC_01: 17-Character VIN Decode & Spec Reveal
  // ─────────────────────────────────────────────────────────────
  test('TC_01_VIN_Decode_17_Character_Validation',
    { tag: ['@streaming', '@vin-decode'] },
    async ({ streamingPage, homePage, previewPage }, testInfo) => {
      await executeShieldedStreaming('TC_01_VIN_Decode', streamingPage, testInfo, async () => {
        await test.step('1. Resilient Home Navigation', async () => {
          await resilientNavigateHome(streamingPage);
        });

        await test.step('2. Decode 17-Character VIN', async () => {
          await homePage.decodeVin(STREAMING_TEST_DATA.VINS.STANDARD_17, 3);
        });

        await test.step('3. Verify Vehicle Specs & Access Record CTA', async () => {
          await previewPage.verifySpecsVisible();
          await previewPage.verifyAccessRecordButton();
        });

        await test.step('4. Verify Sample Report & Dismiss Popup', async () => {
          await previewPage.clickAccessRecordButton();
          await previewPage.closeAccessRecordPopup();
        });
      });
    }
  );

  // ─────────────────────────────────────────────────────────────
  // TC_02: Classic VIN Decode
  // ─────────────────────────────────────────────────────────────
  test('TC_02_VIN_Decode_Classic_Validation',
    { tag: ['@streaming', '@classic'] },
    async ({ streamingPage, homePage, previewPage }, testInfo) => {
      await executeShieldedStreaming('TC_02_Classic_VIN_Decode', streamingPage, testInfo, async () => {
        await test.step('1. Resilient Home Navigation', async () => {
          await resilientNavigateHome(streamingPage);
        });

        await test.step('2. Decode Classic VIN', async () => {
          await homePage.decodeVin(STREAMING_TEST_DATA.VINS.CLASSIC_STATIC, 0);
        });

        await test.step('3. Verify Classic Specs Visibility & Records Heading', async () => {
          await previewPage.verifySpecsVisible('Records found for', STREAMING_TEST_DATA.TIMEOUTS.SPECS_VISIBILITY);
          await previewPage.verifyAccessRecordButton();
        });

        await test.step('4. Verify Sample / Access Action Popup', async () => {
          await previewPage.clickAccessRecordButton();
          await previewPage.closeAccessRecordPopup();
        });
      });
    }
  );

  // ─────────────────────────────────────────────────────────────
  // TC_04: VHR Revisit Banner Validation
  // ─────────────────────────────────────────────────────────────
  test('TC_04_VHR_Revisit_Banner_Validation',
    { tag: ['@streaming', '@revisit-banner'] },
    async ({ streamingPage, homePage, previewPage, revisitBannerTask }, testInfo) => {
      skipMobile(testInfo, 'TC_04_VHR_Revisit_Banner_Validation');
      await executeShieldedStreaming('TC_04_VHR_Revisit_Banner', streamingPage, testInfo, async () => {
        await test.step('1. Resilient Home Navigation', async () => {
          await resilientNavigateHome(streamingPage);
        });

        await test.step('2. Decode VIN for VHR Revisit Workflow', async () => {
          await homePage.decodeVin(STREAMING_TEST_DATA.VINS.VHR_REVISIT, 3);
        });

        await test.step('3. Verify VHR Revisit Banner Presence & Persistence', async () => {
          await revisitBannerTask.perform(streamingPage, previewPage, 'vhr');
        });
      });
    }
  );

  // ─────────────────────────────────────────────────────────────
  // TC_06: Preview Page Plan Selection Validation
  // ─────────────────────────────────────────────────────────────
  test('TC_06_Preview_Page_Plan_Selection_Validation',
    { tag: ['@streaming', '@pricing-plans'] },
    async ({ streamingPage, homePage, previewPage }, testInfo) => {
      await executeShieldedStreaming('TC_06_Plan_Selection', streamingPage, testInfo, async () => {
        await test.step('1. Resilient Home Navigation', async () => {
          await resilientNavigateHome(streamingPage);
        });

        await test.step('2. Decode Standard VIN', async () => {
          await homePage.decodeVin(STREAMING_TEST_DATA.VINS.STANDARD_17, 3);
        });

        await test.step('3. Verify Specs and Plan Selection CTA', async () => {
          await previewPage.verifySpecsVisible();
          await previewPage.verifyAccessRecordButton();
        });
      });
    }
  );

  // ─────────────────────────────────────────────────────────────
  // TC_07: Exit Intent Popup Trigger Validation
  // ─────────────────────────────────────────────────────────────
  test('TC_07_Exit_Intent_Popup_Trigger_Validation',
    { tag: ['@streaming', '@exit-intent'] },
    async ({ streamingPage, exitIntentHelper }, testInfo) => {
      skipMobile(testInfo, 'TC_07_Exit_Intent_Popup_Trigger_Validation');
      await executeShieldedStreaming('TC_07_Exit_Intent_Trigger', streamingPage, testInfo, async () => {
        await test.step('1. Resilient Home Navigation', async () => {
          await resilientNavigateHome(streamingPage);
        });

        await test.step('2. Trigger & Validate Exit Intent Popup', async () => {
          await exitIntentHelper.triggerExitIntent(streamingPage);
        });
      });
    }
  );

  // ─────────────────────────────────────────────────────────────
  // TC_08: Checkout Price, Coupon & Email Cache Validation
  // ─────────────────────────────────────────────────────────────
  test('TC_08_Home_To_Checkout_Price_Coupon_And_Email_Cache_Validation',
    { tag: ['@streaming', '@checkout', '@coupon'] },
    async ({ streamingPage, homePage, previewPage }, testInfo) => {
      skipMobile(testInfo, 'TC_08_Checkout_Price_Coupon_Email_Cache');
      await executeShieldedStreaming('TC_08_Price_Coupon_Email_Cache', streamingPage, testInfo, async () => {
        await test.step('1. Resilient Home Navigation', async () => {
          await resilientNavigateHome(streamingPage);
        });

        await test.step('2. Decode VIN and Reveal Specs', async () => {
          await homePage.decodeVin(STREAMING_TEST_DATA.VINS.STANDARD_17, 3);
          await previewPage.verifySpecsVisible();
        });

        await test.step('3. Initiate Checkout Progression', async () => {
          await previewPage.runCheckoutFlow();
        });

        await test.step('4. Verify Redirection to Checkout Page', async () => {
          await expect(streamingPage).toHaveURL(/.*\/checkout.*/, { timeout: STREAMING_TEST_DATA.TIMEOUTS.CHECKOUT_REDIRECT });
        });
      });
    }
  );

  // ─────────────────────────────────────────────────────────────
  // TC_13: Classic VIN YMM Edit Validation
  // ─────────────────────────────────────────────────────────────
  test('TC_13_Classic_VIN_YMM_Edit_Validation',
    { tag: ['@streaming', '@classic', '@ymm-edit'] },
    async ({ streamingPage, homePage, previewPage, ymmTask, classicVinGenerator }, testInfo) => {
      await executeShieldedStreaming('TC_13_Classic_YMM_Edit', streamingPage, testInfo, async () => {
        const classicVin = classicVinGenerator.getRandomClassicVin(testInfo.workerIndex);

        await test.step('1. Resilient Home Navigation & Classic VIN Submission', async () => {
          await resilientNavigateHome(streamingPage);
          await homePage.decodeVin(classicVin, 0);
        });

        await test.step('2. Await Preview Page Navigation and Specs Rendering', async () => {
          await streamingPage.waitForURL(/.*(\/preview|\/ws-preview).*/, {
            waitUntil: 'domcontentloaded',
            timeout: STREAMING_TEST_DATA.TIMEOUTS.SPECS_VISIBILITY
          });
          await previewPage.verifySpecsVisible('Records found for', STREAMING_TEST_DATA.TIMEOUTS.SPECS_VISIBILITY);
        });

        let selectedYMM: any;
        await test.step('3. Execute Year/Make/Model Edit Workflow', async () => {
          selectedYMM = await ymmTask.execute();
          await testInfo.attach('TC_13_Selected_YMM_Data', {
            body: JSON.stringify({ vin: classicVin, ...selectedYMM }, null, 2),
            contentType: 'application/json'
          });
        });

        await test.step('4. Synchronize DOM & Capture Verified State Screenshot', async () => {
          await streamingPage.waitForLoadState('domcontentloaded');
          await streamingPage.locator('.preview-specs-table, [data-testid="specs-container"], h1, main').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
          const screenshot = await streamingPage.screenshot({ fullPage: false });
          await testInfo.attach('TC_13_Updated_Frontend_Screenshot', {
            body: screenshot,
            contentType: 'image/png'
          });
        });
      });
    }
  );

  // ─────────────────────────────────────────────────────────────
  // TC_15: Classic Editable Specs Update
  // ─────────────────────────────────────────────────────────────
  test('TC_15_Classic_Editible_Specs_Update',
    { tag: ['@streaming', '@classic', '@specs-update'] },
    async ({ streamingPage, homePage, previewPage, classicSpecsUpdateTask, classicVinGenerator }, testInfo) => {
      await executeShieldedStreaming('TC_15_Classic_Specs_Update', streamingPage, testInfo, async () => {
        const classicVin = classicVinGenerator.getRandomClassicVin(testInfo.workerIndex);

        await test.step('1. Resilient Home Navigation & Classic VIN Submission', async () => {
          await resilientNavigateHome(streamingPage);
          await homePage.decodeVin(classicVin, 0);
        });

        await test.step('2. Await Preview Page Navigation and Specs Rendering', async () => {
          await streamingPage.waitForURL(/.*(\/preview|\/ws-preview).*/, {
            waitUntil: 'domcontentloaded',
            timeout: STREAMING_TEST_DATA.TIMEOUTS.SPECS_VISIBILITY
          });
          await previewPage.verifySpecsVisible('Records found for', STREAMING_TEST_DATA.TIMEOUTS.SPECS_VISIBILITY);
        });

        let specs: any;
        await test.step('3. Execute Specs Form Field Updates', async () => {
          specs = await classicSpecsUpdateTask.execute(previewPage, STREAMING_TEST_DATA.TIMEOUTS.SPECS_VISIBILITY, testInfo);
          await testInfo.attach('TC_15_Updated_Specs_Data', {
            body: JSON.stringify({ vin: classicVin, ...specs }, null, 2),
            contentType: 'application/json'
          });
        });

        await test.step('4. Synchronize DOM & Capture Verified State Screenshot', async () => {
          await streamingPage.waitForLoadState('domcontentloaded');
          await streamingPage.locator('.preview-specs-table, [data-testid="specs-container"], h1, main').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
          const screenshot = await streamingPage.screenshot({ fullPage: false });
          await testInfo.attach('TC_15_Updated_Frontend_Screenshot', {
            body: screenshot,
            contentType: 'image/png'
          });
        });
      });
    }
  );

  // ─────────────────────────────────────────────────────────────
  // TC_17: EU VIN Confirmation Flow
  // ─────────────────────────────────────────────────────────────
  test('TC_17_EU_VIN_Confirmation_No',
    { tag: ['@streaming', '@eu-vin'] },
    async ({ streamingPage, homePage, previewPage }, testInfo) => {
      await executeShieldedStreaming('TC_17_EU_VIN_Confirmation', streamingPage, testInfo, async () => {
        await test.step('1. Resilient Home Navigation', async () => {
          await resilientNavigateHome(streamingPage);
        });

        await test.step('2. Decode EU VIN with Confirmation Dialog Handling', async () => {
          await homePage.decodeVin(STREAMING_TEST_DATA.VINS.EU_FORMAT, 1);
        });

        await test.step('3. Verify Vehicle Specs Display', async () => {
          await previewPage.verifySpecsVisible();
        });
      });
    }
  );

  // ─────────────────────────────────────────────────────────────
  // TC_20: Default Plan Checking on Preview
  // ─────────────────────────────────────────────────────────────
  test('TC_20_Default_Plan_Checking',
    { tag: ['@streaming', '@plans'] },
    async ({ streamingPage, homePage, previewPage }, testInfo) => {
      await executeShieldedStreaming('TC_20_Default_Plan_Checking', streamingPage, testInfo, async () => {
        await test.step('1. Resilient Home Navigation', async () => {
          await resilientNavigateHome(streamingPage);
        });

        await test.step('2. Decode Standard VIN', async () => {
          await homePage.decodeVin(STREAMING_TEST_DATA.VINS.STANDARD_17, 3);
        });

        await test.step('3. Verify Specs and Default Plan Access CTA', async () => {
          await previewPage.verifySpecsVisible();
          await previewPage.verifyAccessRecordButton();
        });
      });
    }
  );

  // ─────────────────────────────────────────────────────────────
  // TC_24: Coupon Banner Hierarchy & Persistence Validation
  // ─────────────────────────────────────────────────────────────
  test('TC_24_Coupon_Banner_Hierarchy_And_Persistence_Validation',
    { tag: ['@streaming', '@coupon'] },
    async ({ streamingPage, couponBannerHandler }, testInfo) => {
      await executeShieldedStreaming('TC_24_Coupon_Banner', streamingPage, testInfo, async () => {
        await test.step('1. Verify Coupon Banner Hierarchy & State Persistence', async () => {
          const result = await couponBannerHandler.verifyHierarchyAndPersistence(testInfo);
          await testInfo.attach('TC_24_Coupon_Banner_Summary', {
            body: JSON.stringify(result, null, 2),
            contentType: 'application/json'
          });
        });
      });
    }
  );

  // ─────────────────────────────────────────────────────────────
  // TC_25: Home Page Exit Intent Banner Validation
  // ─────────────────────────────────────────────────────────────
  test('TC_25_Home_Page_Exit_Intent_Banner_Validation',
    { tag: ['@streaming', '@exit-intent'] },
    async ({ streamingPage, exitIntentHelper }, testInfo) => {
      skipMobile(testInfo, 'TC_25_Home_Page_Exit_Intent_Banner_Validation');
      await executeShieldedStreaming('TC_25_Home_Page_Exit_Intent', streamingPage, testInfo, async () => {
        await test.step('1. Resilient Home Navigation', async () => {
          await resilientNavigateHome(streamingPage);
        });

        await test.step('2. Trigger & Validate Exit Intent Banner on Home Page', async () => {
          await exitIntentHelper.triggerExitIntent(streamingPage);
        });
      });
    }
  );

  // ─────────────────────────────────────────────────────────────
  // TC_26: VIN Error Validation
  // ─────────────────────────────────────────────────────────────
  test('TC_26_VIN_Error_Validation',
    { tag: ['@streaming', '@validation'] },
    async ({ streamingPage, vinErrorTask }, testInfo) => {
      await executeShieldedStreaming('TC_26_VIN_Error', streamingPage, testInfo, async () => {
        await test.step('1. Execute Negative Input VIN Error Validations', async () => {
          await vinErrorTask.execute(testInfo);
        });
      });
    }
  );

  // ─────────────────────────────────────────────────────────────
  // TC_27: Plate Error Validation
  // ─────────────────────────────────────────────────────────────
  test('TC_27_Plate_Error_Validation',
    { tag: ['@streaming', '@validation'] },
    async ({ streamingPage, plateErrorTask }, testInfo) => {
      await executeShieldedStreaming('TC_27_Plate_Error', streamingPage, testInfo, async () => {
        await test.step('1. Execute License Plate Negative Input Error Validations', async () => {
          await plateErrorTask.execute(testInfo);
        });
      });
    }
  );

  // ─────────────────────────────────────────────────────────────
  // TC_28: URL Space Handling Validation
  // ─────────────────────────────────────────────────────────────
  test('TC_28_URL_Space_Handling_Validation',
    { tag: ['@streaming', '@url-handling'] },
    async ({ streamingPage, urlSpaceTask }, testInfo) => {
      await executeShieldedStreaming('TC_28_URL_Space', streamingPage, testInfo, async () => {
        await test.step('1. Execute URL Whitespace & Encoding Sanitization Validation', async () => {
          await urlSpaceTask.execute(testInfo);
        });
      });
    }
  );

  // ─────────────────────────────────────────────────────────────
  // TC_29: Error Page To Home Collection Validation
  // ─────────────────────────────────────────────────────────────
  test('TC_29_Error_Page_To_Home_Collection_Validation',
    { tag: ['@streaming', '@error-page'] },
    async ({ streamingPage, errorPageTask }, testInfo) => {
      skipMobile(testInfo, 'TC_29_Error_Page_To_Home_Collection_Validation');
      const timeout = process.env.CI ? STREAMING_TEST_DATA.TIMEOUTS.LONG_RUNNING_ERROR : 90000;
      testInfo.setTimeout(timeout);

      await executeShieldedStreaming('TC_29_Error_Page_Collection', streamingPage, testInfo, async () => {
        await test.step('1. Execute Error 404 Recovery to Home Funnel Validation', async () => {
          await errorPageTask.execute(testInfo, timeout);
        });
      });
    }
  );

  // ─────────────────────────────────────────────────────────────
  // TC_30: Exit Popup Behaviour On Sample Links Validation
  // ─────────────────────────────────────────────────────────────
  test('TC_30_Exit_Popup_Behaviour_On_Sample_Links_Validation',
    { tag: ['@streaming', '@sample-links', '@exit-popup'] },
    async ({ streamingPage, homePage, previewPage, exitPopupTask }, testInfo) => {
      skipMobile(testInfo, 'TC_30_Exit_Popup_Behaviour_On_Sample_Links_Validation');
      await executeShieldedStreaming('TC_30_Exit_Popup_Behaviour', streamingPage, testInfo, async () => {
        await test.step('1. Resilient Home Navigation', async () => {
          await resilientNavigateHome(streamingPage);
        });

        await test.step('2. Decode Standard VIN to Reach Preview', async () => {
          await homePage.decodeVin(STREAMING_TEST_DATA.VINS.STANDARD_17, 3);
          await previewPage.verifySpecsVisible();
        });

        await test.step('3. Perform Exit Popup Behavior on Sample Links', async () => {
          await exitPopupTask.performAs(streamingPage, streamingPage.context());
        });
      });
    }
  );

  // ─────────────────────────────────────────────────────────────
  // TC_31: Microsoft Clarity 3-Wrapper Telemetry Verification
  // ─────────────────────────────────────────────────────────────
  test('TC_31_Clarity_Three_Wrapper_Verification',
    {
      tag: ['@streaming', '@clarity', '@telemetry', '@P0'],
      annotation: [
        { type: 'priority', description: 'P0' },
        { type: 'category', description: 'telemetry' }
      ]
    },
    async ({ streamingPage, clarityTask }, testInfo) => {
      skipMobile(testInfo, 'TC_31_Clarity_Three_Wrapper_Verification');
      await test.step('1. Execute Microsoft Clarity 3-Wrapper Telemetry Verification', async () => {
        await clarityTask.execute({
          page: streamingPage,
          context: streamingPage.context(),
          testInfo,
          isStreaming: true
        });
      });
    }
  );
});
