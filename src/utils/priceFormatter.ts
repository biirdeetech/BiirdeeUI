export const formatPrice = (price: number, currency: string = 'USD') => {
  // Format number with commas
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);

  // Return with currency code prefix
  return `${currency} ${formatted}`;
};

export const formatPricePerMile = (pricePerMile: string | number) => {
  if (typeof pricePerMile === 'string') {
    return pricePerMile.replace('$', '');
  }
  return pricePerMile.toFixed(2);
};