import React, { useState, useMemo } from 'react';
import { X, Award } from 'lucide-react';
import FlightCard from './FlightCard';
import { FlightSolution } from '../types/flight';

interface AwardOption {
  id: string;
  miles: number;
  tax: number;
  cabin: string;
  segments: any[];
  transferOptions: any[];
  seats: number;
  itineraries: any[];
  price: any;
  data: any;
  bookingUrl?: string;
  airlineName?: string;
}

interface AwardResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  awardOptions: AwardOption[];
  perCentValue: number;
  formatTimeInOriginTZ: (dateStr: string) => string;
  formatDateInOriginTZ: (dateStr: string) => string;
  originTimezone?: string;
  displayTimezone?: string;
}

const cabinDisplayMap: Record<string, string> = {
  'COACH': 'Economy',
  'ECONOMY': 'Economy',
  'PREMIUM': 'Premium Economy',
  'PREMIUM_ECONOMY': 'Premium Economy',
  'BUSINESS': 'Business',
  'FIRST': 'First'
};

const convertAwardToFlightSolution = (award: AwardOption): FlightSolution | null => {
  try {
    const itinerary = award.itineraries?.[0];
    if (!itinerary || !itinerary.segments || itinerary.segments.length === 0) {
      return null;
    }

    const segments = itinerary.segments;
    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1];

    const flightSlice = {
      origin: {
        code: firstSegment.departure?.iataCode || 'N/A',
        name: firstSegment.departure?.cityName || ''
      },
      destination: {
        code: lastSegment.arrival?.iataCode || 'N/A',
        name: lastSegment.arrival?.cityName || ''
      },
      departure: firstSegment.departure?.at || '',
      arrival: lastSegment.arrival?.at || '',
      duration: itinerary.duration ? parseDuration(itinerary.duration) : 0,
      flights: segments.map((seg: any) => `${seg.carrierCode}${seg.number}`),
      cabins: [award.cabin],
      stops: segments.length > 1 ? segments.slice(1).map((seg: any) => ({
        code: seg.departure?.iataCode || 'N/A',
        name: seg.departure?.cityName || ''
      })) : [],
      segments: segments.map((seg: any) => ({
        carrier: {
          code: seg.carrierCode || 'N/A',
          name: seg.carrierName || seg.carrierCode || 'N/A',
          shortName: seg.carrierCode || 'N/A'
        },
        marketingCarrier: seg.marketingCarrier || seg.carrierCode || 'N/A',
        pricings: seg.pricings || [],
        departure: seg.departure?.at || '',
        arrival: seg.arrival?.at || '',
        flightNumber: `${seg.carrierCode}${seg.number}`,
        origin: {
          code: seg.departure?.iataCode || 'N/A',
          name: seg.departure?.cityName || ''
        },
        destination: {
          code: seg.arrival?.iataCode || 'N/A',
          name: seg.arrival?.cityName || ''
        },
        duration: seg.duration ? parseDuration(seg.duration) : 0,
        cabin: award.cabin
      }))
    };

    const totalMiles = award.miles || 0;
    const totalTax = award.tax || 0;

    return {
      id: award.id || `award-${Date.now()}-${Math.random()}`,
      totalAmount: totalTax,
      displayTotal: totalTax,
      currency: award.price?.currency || 'USD',
      slices: [flightSlice],
      ext: {
        pricePerMile: totalMiles > 0 ? totalTax / totalMiles : 0
      },
      totalMileage: totalMiles,
      totalMileagePrice: totalTax,
      isAwardFlight: true,
      awardData: {
        miles: totalMiles,
        tax: totalTax,
        bookingUrl: award.bookingUrl,
        airlineName: award.airlineName,
        seats: award.seats || 0,
        transferOptions: award.transferOptions || []
      }
    };
  } catch (error) {
    console.error('Error converting award to flight solution:', error);
    return null;
  }
};

const parseDuration = (duration: string): number => {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (match) {
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    return hours * 60 + minutes;
  }
  return 0;
};

const AwardResultsModal: React.FC<AwardResultsModalProps> = ({
  isOpen,
  onClose,
  awardOptions,
  perCentValue,
  formatTimeInOriginTZ,
  formatDateInOriginTZ,
  originTimezone,
  displayTimezone
}) => {
  const [selectedCabin, setSelectedCabin] = useState<string>('');

  const awardsByCabin = useMemo(() => {
    const map = new Map<string, AwardOption[]>();
    awardOptions.forEach(award => {
      const cabinKey = award.cabin.toUpperCase();
      if (!map.has(cabinKey)) {
        map.set(cabinKey, []);
      }
      map.get(cabinKey)!.push(award);
    });
    return map;
  }, [awardOptions]);

  const cabinOrder = ['COACH', 'ECONOMY', 'PREMIUM', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'];
  const availableCabins = useMemo(() => {
    return Array.from(awardsByCabin.keys()).sort((a, b) => {
      const aIndex = cabinOrder.indexOf(a) !== -1 ? cabinOrder.indexOf(a) : 999;
      const bIndex = cabinOrder.indexOf(b) !== -1 ? cabinOrder.indexOf(b) : 999;
      return aIndex - bIndex;
    });
  }, [awardsByCabin]);

  React.useEffect(() => {
    if (availableCabins.length > 0 && !selectedCabin) {
      setSelectedCabin(availableCabins[0]);
    }
  }, [availableCabins, selectedCabin]);

  const currentCabinFlights = useMemo(() => {
    if (!selectedCabin) return [];
    const awards = awardsByCabin.get(selectedCabin) || [];
    const sorted = [...awards].sort((a, b) => {
      const aValue = (a.miles * perCentValue) + a.tax;
      const bValue = (b.miles * perCentValue) + b.tax;
      return aValue - bValue;
    });

    return sorted
      .map(award => convertAwardToFlightSolution(award))
      .filter((flight): flight is FlightSolution => flight !== null);
  }, [selectedCabin, awardsByCabin, perCentValue]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Award className="h-5 w-5 text-yellow-400" />
            <h2 className="text-xl font-semibold text-white">Award Availability</h2>
            <span className="text-sm text-gray-400">
              ({awardOptions.length} option{awardOptions.length !== 1 ? 's' : ''})
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {availableCabins.length > 1 && (
          <div className="border-b border-gray-700/50 px-4">
            <div className="flex gap-2 overflow-x-auto py-2">
              {availableCabins.map(cabinKey => {
                const cabinAwards = awardsByCabin.get(cabinKey) || [];
                const cabinDisplay = cabinDisplayMap[cabinKey] || cabinKey;
                const cheapestAward = cabinAwards.reduce((best, award) => {
                  const value = (award.miles * perCentValue) + award.tax;
                  const bestValue = best ? (best.miles * perCentValue) + best.tax : Infinity;
                  return value < bestValue ? award : best;
                }, null as AwardOption | null);

                return (
                  <button
                    key={cabinKey}
                    onClick={() => setSelectedCabin(cabinKey)}
                    className={`
                      px-4 py-3 text-sm font-bold transition-all duration-200 rounded-lg whitespace-nowrap
                      ${selectedCabin === cabinKey
                        ? 'text-yellow-400 border-2 border-yellow-500 bg-yellow-500/10'
                        : 'text-gray-400 border-2 border-transparent hover:text-gray-300 hover:bg-gray-800/30'
                      }
                    `}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-base">{cabinDisplay}</span>
                      {cheapestAward && (
                        <>
                          <span className={`
                            text-xs font-semibold
                            ${selectedCabin === cabinKey ? 'text-yellow-300' : 'text-gray-500'}
                          `}>
                            {cheapestAward.miles.toLocaleString()} mi
                          </span>
                          <span className={`
                            text-[10px] font-medium
                            ${selectedCabin === cabinKey ? 'text-green-400' : 'text-gray-600'}
                          `}>
                            +${cheapestAward.tax.toFixed(2)}
                          </span>
                          <span className={`
                            text-[10px]
                            ${selectedCabin === cabinKey ? 'text-gray-400' : 'text-gray-600'}
                          `}>
                            ≈ ${((cheapestAward.miles * perCentValue) + cheapestAward.tax).toFixed(0)}
                          </span>
                        </>
                      )}
                      <span className="text-[10px] text-gray-500">({cabinAwards.length})</span>
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
                originTimezone={originTimezone}
                displayTimezone={displayTimezone}
                perCentValue={perCentValue}
                isAwardModal={true}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AwardResultsModal;
