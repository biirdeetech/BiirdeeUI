import React from 'react';
import { CabinPrice } from '../types/flight';

interface CabinSelectorProps {
  cabinPrices?: Record<string, CabinPrice>;
  selectedCabin?: string;
  onCabinSelect: (cabin: string) => void;
  compact?: boolean;
}

const CABIN_LABELS: Record<string, string> = {
  'COACH': 'Economy',
  'PREMIUM-COACH': 'Premium',
  'BUSINESS': 'Business',
  'FIRST': 'First'
};

const CabinSelector: React.FC<CabinSelectorProps> = ({
  cabinPrices,
  selectedCabin,
  onCabinSelect,
  compact = false
}) => {
  if (!cabinPrices || Object.keys(cabinPrices).length === 0) {
    return null;
  }

  const availableCabins = Object.keys(cabinPrices);

  // If only one cabin, don't show selector
  if (availableCabins.length === 1) {
    return null;
  }

  const formatPrice = (price: number, currency: string) => {
    const currencySymbols: Record<string, string> = {
      USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'CA$',
      AUD: 'A$', CHF: 'CHF', CNY: '¥', INR: '₹', KRW: '₩',
      BRL: 'R$', MXN: 'MX$', ZAR: 'R', SGD: 'S$', HKD: 'HK$',
      NZD: 'NZ$', SEK: 'kr', NOK: 'kr', DKK: 'kr', PLN: 'zł',
      THB: '฿', IDR: 'Rp', MYR: 'RM', PHP: '₱', CZK: 'Kč',
      ILS: '₪', CLP: 'CLP', AED: 'AED', SAR: 'SAR', TRY: '₺'
    };

    const symbol = currencySymbols[currency] || currency + ' ';
    const rounded = Math.round(price);
    return `${symbol}${rounded.toLocaleString()}`;
  };

  const cabinOrder = ['COACH', 'PREMIUM-COACH', 'BUSINESS', 'FIRST'];
  const sortedCabins = availableCabins.sort((a, b) => {
    return cabinOrder.indexOf(a) - cabinOrder.indexOf(b);
  });

  return (
    <div className="flex items-center gap-1.5">
      {sortedCabins.map(cabin => {
        const cabinData = cabinPrices[cabin];
        const isSelected = selectedCabin === cabin;
        const label = CABIN_LABELS[cabin] || cabin;

        return (
          <button
            key={cabin}
            onClick={() => onCabinSelect(cabin)}
            className={`
              flex flex-col items-center justify-center
              ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}
              rounded-md border transition-all duration-200
              ${isSelected
                ? 'bg-accent-500/20 border-accent-500/60 text-accent-300'
                : 'bg-gray-800/40 border-gray-700/40 text-gray-400 hover:bg-gray-800/60 hover:border-gray-600/60 hover:text-gray-300'
              }
            `}
          >
            <div className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-medium uppercase`}>
              {label}
            </div>
            <div className={`${compact ? 'text-[10px]' : 'text-xs'} font-bold ${isSelected ? 'text-accent-200' : 'text-white'}`}>
              {formatPrice(cabinData.price, cabinData.currency)}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default CabinSelector;
