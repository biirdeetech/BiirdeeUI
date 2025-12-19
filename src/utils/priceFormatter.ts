export const formatPrice = (price: number, currency: string = 'USD') => {
  // Round the price to nearest whole number
  const roundedPrice = Math.round(price);

  // Format number with commas
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(roundedPrice);

  // Get currency symbol based on currency code
  const currencySymbol = getCurrencySymbol(currency);

  // Return with currency symbol prefix
  return `${currencySymbol}${formatted}`;
};

// Helper function to get currency symbol
const getCurrencySymbol = (currency: string): string => {
  const symbolMap: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'CAD': 'CA$',
    'AUD': 'A$',
    'CHF': 'CHF',
    'CNY': '¥',
    'INR': '₹',
    'MXN': 'MX$',
    'BRL': 'R$',
    'ZAR': 'R',
    'NZD': 'NZ$',
    'SGD': 'S$',
    'HKD': 'HK$',
    'KRW': '₩',
    'SEK': 'kr',
    'NOK': 'kr',
    'DKK': 'kr',
    'PLN': 'zł',
    'THB': '฿',
    'IDR': 'Rp',
    'MYR': 'RM',
    'PHP': '₱',
    'CZK': 'Kč',
    'ILS': '₪',
    'CLP': 'CL$',
    'TWD': 'NT$',
    'TRY': '₺',
    'AED': 'AED',
    'RUB': '₽'
  };

  return symbolMap[currency] || currency;
};

export const formatPricePerMile = (pricePerMile: string | number) => {
  if (typeof pricePerMile === 'string') {
    return pricePerMile.replace('$', '');
  }
  return pricePerMile.toFixed(2);
};