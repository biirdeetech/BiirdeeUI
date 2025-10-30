export interface Currency {
  displayName: string;
  code: string;
}

export const CURRENCIES: Currency[] = [
  { displayName: 'United States Dollars (USD)', code: 'USD' },
  { displayName: 'Canadian Dollars (CAD)', code: 'CAD' },
  { displayName: 'Euros (EUR)', code: 'EUR' },
  { displayName: 'British Pounds (GBP)', code: 'GBP' },
  { displayName: 'Japanese Yen (JPY)', code: 'JPY' },
  { displayName: 'Australian Dollars (AUD)', code: 'AUD' },
  { displayName: 'Swiss Francs (CHF)', code: 'CHF' },
  { displayName: 'Chinese Yuan (CNY)', code: 'CNY' },
  { displayName: 'Hong Kong Dollars (HKD)', code: 'HKD' },
  { displayName: 'Singapore Dollars (SGD)', code: 'SGD' },
  { displayName: 'Malaysian Ringgit (MYR)', code: 'MYR' },
  { displayName: 'Philippine Pesos (PHP)', code: 'PHP' },
  { displayName: 'Indian Rupees (INR)', code: 'INR' },
  { displayName: 'Pakistani Rupees (PKR)', code: 'PKR' },
  { displayName: 'Thai Baht (THB)', code: 'THB' },
  { displayName: 'Indonesian Rupiah (IDR)', code: 'IDR' },
  { displayName: 'Vietnamese Dong (VND)', code: 'VND' },
  { displayName: 'South Korean Won (KRW)', code: 'KRW' },
  { displayName: 'New Zealand Dollars (NZD)', code: 'NZD' },
  { displayName: 'Mexican Pesos (MXN)', code: 'MXN' },
  { displayName: 'Brazilian Real (BRL)', code: 'BRL' },
  { displayName: 'South African Rand (ZAR)', code: 'ZAR' },
  { displayName: 'UAE Dirhams (AED)', code: 'AED' },
  { displayName: 'Saudi Riyals (SAR)', code: 'SAR' },
  { displayName: 'Turkish Lira (TRY)', code: 'TRY' },
  { displayName: 'Russian Rubles (RUB)', code: 'RUB' },
  { displayName: 'Polish Zloty (PLN)', code: 'PLN' },
  { displayName: 'Swedish Krona (SEK)', code: 'SEK' },
  { displayName: 'Norwegian Krone (NOK)', code: 'NOK' },
  { displayName: 'Danish Krone (DKK)', code: 'DKK' },
];

export function searchCurrencies(query: string): Currency[] {
  if (!query.trim()) return CURRENCIES;

  const lowerQuery = query.toLowerCase();
  return CURRENCIES.filter(currency =>
    currency.displayName.toLowerCase().includes(lowerQuery) ||
    currency.code.toLowerCase().includes(lowerQuery)
  );
}
