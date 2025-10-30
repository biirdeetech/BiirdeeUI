// Premium airline carriers that get special highlighting
export const PREMIUM_CARRIERS = [
  'AA', 'DL', 'UA', 'AS', 'B6', 'WN', 'F9', 'NK', 'G4', 'SY',
  'AC', 'WS', 'TS', 'PD', 'F8', 'Y9',
  'BA', 'AF', 'LH', 'KL', 'LX', 'OS', 'SN', 'TP', 'IB', 'AZ',
  'QF', 'NZ', 'VA', 'JQ',
  'JL', 'NH', 'KE', 'OZ', 'CI', 'BR', 'CX', 'KA',
  'EK', 'QR', 'EY', 'TK', 'SV', 'MS',
  'LA', 'CM', 'AV', 'AR',
  'SA', 'ET', 'KQ', 'AT'
];

// Cabin class mapping for API requests
export const CABIN_CLASS_MAPPING: Record<string, string[]> = {
  'COACH': ['y', 'h', 'k', 'm', 'l', 'g', 'v', 's', 'n', 'q', 'o'],
  'PREMIUM_COACH': ['w', 'e'],
  'BUSINESS': ['c', 'j', 'd', 'i', 'z'],
  'FIRST': ['f', 'a']
};

/**
 * Generate command line string for ITA Matrix API
 * @param cabin - Cabin class (COACH, PREMIUM_COACH, BUSINESS, FIRST)
 * @param maxStops - Maximum number of stops (0, 1, 2, or 'any')
 * @returns Command line string like "f bc=y|bc=h|bc=k..."
 */
export function generateCommandLine(cabin: string, maxStops?: string | number): string {
  const cabinClasses = CABIN_CLASS_MAPPING[cabin] || CABIN_CLASS_MAPPING['COACH'];
  const fareClassesString = cabinClasses.map(code => `bc=${code}`).join('|');
  return `f ${fareClassesString}`;
}