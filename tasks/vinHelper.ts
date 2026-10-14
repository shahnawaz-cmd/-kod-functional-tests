import { Page, Locator } from '@playwright/test';
import { locateInputWithHealing } from '../utils/selfHealingLocator';

// Pool of high-validity US VINs for multi-brand decoding
export const US_VIN_POOL = [
  '1C4RJHBG0PC533410',
  '3MW5R1J01M8B87063',
  '1FMCU0F68LUB98817',
  'WA1VABGE5KB008242',
  '2C4RC1BG6JR152015',
  '1FMCU9GD3JUC83708'
];

// Shared utility for VIN operations
export const generateRandomVin = (baseVin: string, numToReplace: number = 1): string => {
  const randomDigits = Math.floor(Math.random() * Math.pow(10, numToReplace))
    .toString()
    .padStart(numToReplace, '0');
  return baseVin.slice(0, -numToReplace) + randomDigits;
};

// US-specific VIN generator (picks randomly from US_VIN_POOL and randomizes last 2 characters)
export const generateUSVin = (): string => {
  const baseVin = US_VIN_POOL[Math.floor(Math.random() * US_VIN_POOL.length)];
  return generateRandomVin(baseVin, 2);
};

// Pool of Classic VINs
export const CLASSIC_VIN_POOL = [
  'CCY145A104163',
  '3N67K5M290995'
];

// Classic VIN generator (randomizes last 2 characters to numeric only from classic pool)
export const generateClassicNumericVin = (baseVin?: string): string => {
  const selectedBase = baseVin || CLASSIC_VIN_POOL[Math.floor(Math.random() * CLASSIC_VIN_POOL.length)];
  return generateRandomVin(selectedBase, 2);
};

// EU-specific VIN generator (randomizes last 1 character across base VINs)
export const generateEuVin = (): string => {
  const baseVins = [
    'VF3YC2MFB12G20874',
    'WBY1Z62030V719559',
    'WV1ZZZSYZL9025249',
    'SHHEU88701U002012'
  ];
  const baseVin = baseVins[Math.floor(Math.random() * baseVins.length)];
  return generateRandomVin(baseVin, 1);
};

// Centralized robust self-healing VIN input locator
export const getRobustVinInput = async (page: Page): Promise<Locator> => {
  return await locateInputWithHealing(page, 'VIN', [
    'input[name="vin"]',
    'input[placeholder*="VIN" i]',
    'input[aria-label*="VIN" i]',
    'input[type="text"]'
  ]);
};
