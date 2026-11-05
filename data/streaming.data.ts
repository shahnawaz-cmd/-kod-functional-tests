/**
 * Test Data definitions for KOD Streaming Funnel Suite.
 * Layer 7: Test Data Management (Enterprise 8-Layer Architecture)
 */

export const STREAMING_TEST_DATA = {
  /**
   * Dedicated VINs tested across funnel scenarios
   */
  VINS: {
    /** Standard 17-character VIN with rich vehicle specs */
    STANDARD_17: '4JGED6EB0JA121898',
    /** VIN designated for Vehicle History Report (VHR) revisit banners */
    VHR_REVISIT: '1FA6P8CF0H5121898',
    /** Static Classic VIN fallback */
    CLASSIC_STATIC: '223870L108421',
    /** European format VIN for EU region confirmation flows */
    EU_FORMAT: 'VF3YC2MFB12G20874',
  },

  /**
   * Timeouts and wait thresholds (in ms)
   */
  TIMEOUTS: {
    SPECS_VISIBILITY: 60000,
    CHECKOUT_REDIRECT: 30000,
    DOM_SETTLE: 5000,
    LONG_RUNNING_ERROR: 120000,
  },
} as const;
