import { Actor } from '../actors/Actor';

export interface VinTaskSelectors {
  vinField1: string;
  vinField2: string;
  vinField3: string;
  searchButton: string;
  accessButton: string;
  successText: string;
  successText2: string;
  successText3: string;
  successHeading: string;
  successHeading2: string;
}

export class DecodeVinTask {
  constructor(
    public shouldClose: boolean = false,
    public skipSuccessClick: boolean = false,
    public useEuVin: boolean = false,
    private timeout: number = 60000,
    private selectors: VinTaskSelectors = {
      vinField1: 'Vehicle Identification Number',
      vinField2: 'Enter VIN Number',
      vinField3: 'Enter Your VIN',
      searchButton: 'Search VIN',
      accessButton: 'Access Records',
      successText: 'Records found for',
      successText2: 'We found historical records for the',
      successText3: 'Window sticker found for',
      successHeading: 'Success! We found detailed',
      successHeading2: 'We found detailed information for the',
    }
  ) {}

  private generateRandomVin(baseVin: string, numToReplace: number = 1): string {
    const randomDigits = Math.floor(Math.random() * Math.pow(10, numToReplace))
      .toString()
      .padStart(numToReplace, '0');
    return baseVin.slice(0, -numToReplace) + randomDigits;
  }

  private usVinPool: string[] = [
    '1C4RJHBG0PC533410',
    '3MW5R1J01M8B87063',
    '1FMCU0F68LUB98817',
    'WA1VABGE5KB008242',
    '2C4RC1BG6JR152015',
    '1FMCU9GD3JUC83708'
  ];

  private generateUSVin(isMVL: boolean = false): string {
    const baseVin = this.usVinPool[Math.floor(Math.random() * this.usVinPool.length)];
    return this.generateRandomVin(baseVin, 2);
  }

  private generateEuVin(): string {
    const baseVins = [
      'VF3YC2MFB12G20874',
      'SHHEU88701U002012'
    ];
    const baseVin = baseVins[Math.floor(Math.random() * baseVins.length)];
    return this.generateRandomVin(baseVin, 1);
  }

  async performAs(actor: Actor) {
    const page = actor.getPage();
    const vin = this.useEuVin ? this.generateEuVin() : this.generateUSVin();
    console.log(`[VIN Decode] Generated VIN (${this.useEuVin ? 'EU' : 'US'}): ${vin}`);

    const vinField1 = page.getByRole('textbox', { name: this.selectors.vinField1 });
    const vinField2 = page.getByRole('textbox', { name: this.selectors.vinField2 });
    const vinField3 = page.getByRole('textbox', { name: this.selectors.vinField3 });
    const vinField4 = page.getByPlaceholder(this.selectors.vinField1);
    const vinField5 = page.getByPlaceholder(this.selectors.vinField2);
    const vinField6 = page.getByPlaceholder(this.selectors.vinField3);

    const vinInput = vinField1.or(vinField2).or(vinField3).or(vinField4).or(vinField5).or(vinField6).first();
    
    await vinInput.waitFor({ state: 'visible', timeout: this.timeout });
    await vinInput.fill(vin);

    const searchBtn = page.getByRole('button', { name: this.selectors.searchButton }).first();
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
    } else {
      await vinInput.locator('xpath=../..').getByRole('button').first().click();
    }
    
    await page.waitForURL(/.*(\/preview|\/vin-check|\/report|\/checkout).*/, { waitUntil: 'domcontentloaded', timeout: this.timeout }).catch(() => {});
    await page.waitForTimeout(1000);

    // List of potential success elements to check and click
    const successLocator = page.getByText('Records found for', { exact: false })
      .or(page.locator('h1:has-text("Records found for")'))
      .or(page.locator('text=We found detailed information for the'))
      .or(page.locator('h2:has-text("We found")'))
      .or(page.getByRole('heading', { name: 'Success' }))
      .or(page.getByRole('heading', { name: 'Success! We found detailed' }))
      .or(page.locator('h4:has-text("Success!")'))
      .or(page.getByText('Success! We found detailed', { exact: false }))
      .or(page.locator('text=Window sticker found for'))
      .or(page.locator('text=We found historical records for the'))
      .or(page.locator('text=Success!'))
      .or(page.locator('button:has-text("Access Records"), button:has-text("Reveal Records")'))
      .or(page.locator("text=What's your goal"));

    // Wait for the success element to render on preview page (gives fresh/uncached VINs time to decode)
    await successLocator.first().waitFor({ state: 'visible', timeout: this.timeout }).catch(() => {
      console.log('Timeout waiting for success locator visibility');
    });

    const successLocators = [
      page.getByText('Records found for', { exact: false }),
      page.locator('h1:has-text("Records found for")'),
      page.locator('text=We found detailed information for the'),
      page.locator('h2:has-text("We found")'),
      page.getByRole('heading', { name: 'Success' }),
      page.getByRole('heading', { name: 'Success! We found detailed' }),
      page.locator('h4:has-text("Success!")'),
      page.getByText('Success! We found detailed', { exact: false }),
      page.locator('text=Window sticker found for'),
      page.locator('text=We found historical records for the'),
      page.locator('text=Success!'),
      page.locator('button:has-text("Access Records")').first(),
      page.locator('button:has-text("Reveal Records")').first(),
      page.locator("text=What's your goal").first()
    ].filter(Boolean);

    let successClicked = false;

    // If skipSuccessClick is explicitly enabled, skip clicking the success banner
    if (this.skipSuccessClick) {
      console.log('[VIN Decode] Bypassing success banner click as requested by task parameters.');
      successClicked = true;
    } else {
      for (const locator of successLocators) {
        if (await locator.isVisible()) {
          console.log('[VIN Decode] Clicking success element...');
          await locator.click().catch(() => {});
          successClicked = true;
          break;
        }
      }
    }

    if (!successClicked) {
      console.log('Failed to click success condition. Current URL:', page.url());
      throw new Error('Success condition not found');
    }

    console.log('Success condition met.');

    if (this.shouldClose && !page.isClosed()) {
      await page.close().catch(() => {});
      console.log('Closed page as requested.');
    }
  }
}