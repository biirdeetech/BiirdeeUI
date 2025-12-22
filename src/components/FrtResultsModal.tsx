import React, { useState, useMemo } from 'react';
import { X, RefreshCw } from 'lucide-react';
import FlightCard from './FlightCard';
import { FlightSolution } from '../types/flight';
import { formatPrice } from '../utils/priceFormatter';

interface FrtOption {
  returnFlight: any;
  airport: string;
  totalPrice: number;
  savings: number;
  currency: string;
}

interface FrtResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  frtOptions: FrtOption[];
  originFlightPrice: number;
  currency: string;
  formatTime: (dateStr: string) => string;
  formatDate: (dateStr: string) => string;
  formatDuration: (duration: string) => string;
}

const convertFrtToFlightSolution = (frtOption: FrtOption): FlightSolution | null => {
  try {
    const returnFlight = frtOption.returnFlight;
    if (!returnFlight || !returnFlight.slices || returnFlight.slices.length === 0) {
      return null;
    }

    const slice = returnFlight.slices[0];

    const flightSlice = {
      origin: slice.origin || { code: 'N/A', name: '' },
      destination: slice.destination || { code: 'N/A', name: '' },
      departure: slice.departure || '',
      arrival: slice.arrival || '',
      duration: slice.duration || 0,
      flights: slice.flights || [],
      cabins: slice.cabins || [],
      stops: slice.stops || [],
      segments: (slice.segments || []).map((seg: any) => ({
        carrier: seg.carrier || { code: 'N/A', name: 'N/A', shortName: 'N/A' },
        marketingCarrier: seg.marketingCarrier || 'N/A',
        pricings: seg.pricings || [],
        departure: seg.departure || '',
        arrival: seg.arrival || '',
        flightNumber: seg.flightNumber || '',
        origin: seg.origin || { code: 'N/A', name: '' },
        destination: seg.destination || { code: 'N/A', name: '' },
        duration: seg.duration || 0,
        cabin: seg.cabin || ''
      }))
    };

    return {
      id: returnFlight.id || `frt-${frtOption.airport}-${Date.now()}-${Math.random()}`,
      totalAmount: returnFlight.totalAmount || 0,
      displayTotal: returnFlight.totalAmount || 0,
      currency: returnFlight.currency || frtOption.currency || 'USD',
      slices: [flightSlice],
      ext: {
        pricePerMile: returnFlight.ext?.pricePerMile || 0
      }
    };
  } catch (error) {
    console.error('Error converting FRT to flight solution:', error);
    return null;
  }
};

const cabinDisplayMap: Record<string, string> = {
  'COACH': 'Economy',
  'PREMIUM-COACH': 'Premium Economy',
  'BUSINESS': 'Business',
  'FIRST': 'First'
};

const FrtResultsModal: React.FC<FrtResultsModalProps> = ({
  isOpen,
  onClose,
  frtOptions,
  originFlightPrice,
  currency,
  formatTime,
  formatDate,
  formatDuration
}) => {
  const [selectedCabin, setSelectedCabin] = useState<string>('');

  const optionsByCabin = useMemo(() => {
    const map = new Map<string, FrtOption[]>();
    frtOptions.forEach(option => {
      const returnSlice = option.returnFlight?.slices?.[0];
      if (!returnSlice || !returnSlice.cabins || returnSlice.cabins.length === 0) return;

      const cabin = returnSlice.cabins[0];
      if (!map.has(cabin)) {
        map.set(cabin, []);
      }
      map.get(cabin)!.push(option);
    });

    map.forEach((options) => {
      options.sort((a, b) => {
        const aTotalPrice = originFlightPrice + (a.returnFlight?.totalAmount || 0);
        const bTotalPrice = originFlightPrice + (b.returnFlight?.totalAmount || 0);
        return aTotalPrice - bTotalPrice;
      });
    });

    return map;
  }, [frtOptions, originFlightPrice]);

  const cabinOrder = ['COACH', 'PREMIUM-COACH', 'BUSINESS', 'FIRST'];
  const availableCabins = useMemo(() => {
    return Array.from(optionsByCabin.keys()).sort((a, b) => {
      const aIndex = cabinOrder.indexOf(a) !== -1 ? cabinOrder.indexOf(a) : 999;
      const bIndex = cabinOrder.indexOf(b) !== -1 ? cabinOrder.indexOf(b) : 999;
      return aIndex - bIndex;
    });
  }, [optionsByCabin]);

  React.useEffect(() => {
    if (availableCabins.length > 0 && !selectedCabin) {
      setSelectedCabin(availableCabins[0]);
    }
  }, [availableCabins, selectedCabin]);

  const currentCabinFlights = useMemo(() => {
    if (!selectedCabin) return [];
    const options = optionsByCabin.get(selectedCabin) || [];
    return options
      .map(option => convertFrtToFlightSolution(option))
      .filter((flight): flight is FlightSolution => flight !== null);
  }, [selectedCabin, optionsByCabin]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Fake Round Trip Options</h2>
            <span className="text-sm text-gray-400">
              ({frtOptions.length} option{frtOptions.length !== 1 ? 's' : ''})
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {availableCabins.length > 0 && (
          <div className="border-b border-gray-700/50 px-4">
            <div className="flex gap-2 overflow-x-auto py-2">
              {availableCabins.map(cabinKey => {
                const cabinOptions = optionsByCabin.get(cabinKey) || [];
                const cabinDisplay = cabinDisplayMap[cabinKey] || cabinKey;
                const cheapestOption = cabinOptions[0];
                const cheapestTotal = cheapestOption ? originFlightPrice + (cheapestOption.returnFlight?.totalAmount || 0) : 0;
                const savings = cheapestOption ? originFlightPrice - cheapestTotal : 0;

                return (
                  <button
                    key={cabinKey}
                    onClick={() => setSelectedCabin(cabinKey)}
                    className={`
                      px-4 py-3 text-sm font-bold transition-all duration-200 rounded-lg whitespace-nowrap
                      ${selectedCabin === cabinKey
                        ? 'text-blue-400 border-2 border-blue-500 bg-blue-500/10'
                        : 'text-gray-400 border-2 border-transparent hover:text-gray-300 hover:bg-gray-800/30'
                      }
                    `}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-base">{cabinDisplay}</span>
                      {cheapestOption && (
                        <>
                          <span className={`
                            text-xs font-semibold
                            ${selectedCabin === cabinKey ? 'text-blue-300' : 'text-gray-500'}
                          `}>
                            {formatPrice(cheapestTotal, currency)}
                          </span>
                          <span className={`
                            text-[10px] font-medium
                            ${savings > 0 ? 'text-green-400' : 'text-red-400'}
                          `}>
                            {savings > 0 ? `Save ${formatPrice(savings, currency)}` : `+${formatPrice(Math.abs(savings), currency)}`}
                          </span>
                        </>
                      )}
                      <span className="text-[10px] text-gray-500">({cabinOptions.length})</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {currentCabinFlights.map((flight) => (
              <FlightCard
                key={flight.id}
                flight={flight}
                perCentValue={0.015}
                isFrtModal={true}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FrtResultsModal;
