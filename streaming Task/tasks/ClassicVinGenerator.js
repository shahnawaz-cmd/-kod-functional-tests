// tests/tasks/ClassicVinGenerator.js

class ClassicVinGenerator {
  /**
   * Verified pool of classic mapped VINs (pre-1981 architecture)
   */
  static CLASSIC_MAPPED_POOL = [
    'XP29G72104639',
    'M176103674',
    '3N67K5M340214',
    '1H57H5Z447879',
    '242378Z126752',
    'PH27G62105038',
    'CL41M3C146664',
    '2G37M2P213086',
    '609K042321',
    '237W1L416467',
    '223T0Z875629',
    '242K2L287854',
    'AR10548134136',
    'AR10548870657',
    'AR10502646074',
    '2578548',
    '2571897',
    '2238758',
    'CH41V9C612887',
    'CS45V0B348784',
    'CL41V0C889423',
    '707TA823387',
    '507TK165876',
    '707TF964057',
    '1H57H5Z717961',
    '1H57L5B848835',
    '1H57K5A700431',
    'XP29G72757783',
    'XP29E72552502',
    'XP29G72437485',
    '237M2Z396036',
    '2G37T1N483777',
    '242W9N696104',
    'AR10526916097',
    'AR10526406689',
    'AR10526590640',
    '4315745',
    '2236064',
    '4318061',
    'CL41U2B972018',
    'CH41J0R545998',
    'CH23V1G284825'
  ];

  /**
   * Generates a randomized classic VIN using the mapped pool with worker safety.
   * Randomizes the last 4 digits to prevent execution caching.
   * 
   * @param {number|null} workerIndex - Optional Playwright worker index for parallel safety
   * @returns {string} Classic VIN string
   */
  static getRandomClassicVin(workerIndex = null) {
    const pool = this.CLASSIC_MAPPED_POOL;
    const baseVin = pool[Math.floor(Math.random() * pool.length)];
    const chars = baseVin.split('');
    const digits = '0123456789';

    // Randomize last 4 digits
    for (let i = chars.length - 4; i < chars.length; i++) {
      chars[i] = digits[Math.floor(Math.random() * digits.length)];
    }

    // Append worker index modifier if passed
    if (workerIndex !== null && workerIndex !== undefined) {
      const lastIdx = chars.length - 1;
      chars[lastIdx] = String((parseInt(chars[lastIdx], 10) + workerIndex) % 10);
    }

    return chars.join('');
  }

  /**
   * Algorithmic Classic Ford VIN Generator (pre-1981 11-character format)
   * Pattern: Year(1) + Plant(1) + Body(2) + Engine(1) + Serial(6)
   */
  static generateFordClassic() {
    const years = ['5', '6', '7', '8', '9', '0']; // 1965-1970
    const plants = ['F', 'R', 'T', 'K'];
    const engines = ['C', 'A', 'K', 'J', 'F'];
    
    const year = years[Math.floor(Math.random() * years.length)];
    const plant = plants[Math.floor(Math.random() * plants.length)];
    const engine = engines[Math.floor(Math.random() * engines.length)];
    const serial = Math.floor(100000 + Math.random() * 900000);

    return `${year}07${plant}${engine}${serial}`;
  }

  /**
   * Algorithmic Classic GM / Chevrolet VIN Generator (13-character format)
   * Pattern: 1(Chevy) + Series(2) + Body(2) + Engine(1) + Year(1) + Plant(1) + Serial(6)
   */
  static generateGMClassic() {
    const engines = ['H', 'J', 'K', 'L', 'M'];
    const plants = ['Z', 'N', 'B', 'A'];
    
    const engine = engines[Math.floor(Math.random() * engines.length)];
    const plant = plants[Math.floor(Math.random() * plants.length)];
    const serial = Math.floor(100000 + Math.random() * 900000);

    return `1H57${engine}5${plant}${serial}`;
  }

  /**
   * Algorithmic Classic Mopar / Dodge VIN Generator (13-character format)
   */
  static generateMoparClassic() {
    const plants = ['G', 'E', 'R', 'A'];
    const plant = plants[Math.floor(Math.random() * plants.length)];
    const serial = Math.floor(100000 + Math.random() * 900000);

    return `XP29${plant}72${serial}`;
  }

  /**
   * Algorithmic Classic Pontiac VIN Generator (13-character format, e.g. Firebird / GTO)
   * Pattern: 2(Pontiac) + Series(2: 23, 37, 42) + Body(2: 37, 67, 87) + Engine(1: W, Y, K, M) + Year(1) + Plant(1: N, P, L) + Serial(6)
   */
  static generatePontiacClassic() {
    const seriesList = ['23', '37', '42', 'G37'];
    const engines = ['W', 'Y', 'K', 'M', 'T'];
    const plants = ['N', 'P', 'L', 'Z'];
    const years = ['8', '9', '0', '1', '2']; // 1968-1972
    
    const series = seriesList[Math.floor(Math.random() * seriesList.length)];
    const engine = engines[Math.floor(Math.random() * engines.length)];
    const plant = plants[Math.floor(Math.random() * plants.length)];
    const year = years[Math.floor(Math.random() * years.length)];
    const serial = Math.floor(100000 + Math.random() * 900000);

    return `2${series}${engine}${year}${plant}${serial}`;
  }

  /**
   * Algorithmic Classic Alfa Romeo VIN Generator (Classic Alfa Spider / Giulia format)
   * Pattern: AR + Type Code(5 digits: 10548, 11502, 10526) + Serial(6)
   */
  static generateAlfaRomeoClassic() {
    const typeCodes = ['10548', '11502', '10526', '10502'];
    const typeCode = typeCodes[Math.floor(Math.random() * typeCodes.length)];
    const serial = Math.floor(100000 + Math.random() * 900000);

    return `AR${typeCode}${serial}`;
  }

  /**
   * Algorithmic Classic BMW VIN Generator (7-digit Classic 2002 / E9 or 17-digit format)
   */
  static generateBMWClassic() {
    // Classic 7-digit chassis number (1966-1976 2002 / E9 3.0 CS)
    const prefixes = ['223', '243', '257', '431', '345'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const serial = Math.floor(1000 + Math.random() * 9000);

    return `${prefix}${serial}`;
  }

  /**
   * Algorithmic Classic Chrysler VIN Generator (13-character format)
   * Pattern: C(Chrysler) + Price Class(H, L, M) + Body(41, 23) + Engine(T, U, V) + Year(0-9) + Plant(C, G, R) + Serial(6)
   */
  static generateChryslerClassic() {
    const priceClasses = ['H', 'L', 'M', 'S'];
    const bodies = ['41', '23', '45'];
    const engines = ['T', 'U', 'V', 'J'];
    const plants = ['C', 'G', 'R', 'B'];
    const years = ['8', '9', '0', '1', '2', '3'];

    const priceClass = priceClasses[Math.floor(Math.random() * priceClasses.length)];
    const body = bodies[Math.floor(Math.random() * bodies.length)];
    const engine = engines[Math.floor(Math.random() * engines.length)];
    const plant = plants[Math.floor(Math.random() * plants.length)];
    const year = years[Math.floor(Math.random() * years.length)];
    const serial = Math.floor(100000 + Math.random() * 900000);

    return `C${priceClass}${body}${engine}${year}${plant}${serial}`;
  }
}

module.exports = { ClassicVinGenerator };
