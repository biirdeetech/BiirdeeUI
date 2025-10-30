export const formatPrice = (price: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
};

export const formatPricePerMile = (pricePerMile: string | number) => {
  if (typeof pricePerMile === 'string') {
    return pricePerMile.replace('$', '');
  }
  return pricePerMile.toFixed(2);
};