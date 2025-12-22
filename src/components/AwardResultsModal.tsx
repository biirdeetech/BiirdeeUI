import React, { useState, useMemo } from 'react';
import { X, Award } from 'lucide-react';
import FlightSegmentViewer from './FlightSegmentViewer';
import { formatPrice } from '../utils/priceFormatter';

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

  const currentCabinAwards = useMemo(() => {
    if (!selectedCabin) return [];
    const awards = awardsByCabin.get(selectedCabin) || [];
    return [...awards].sort((a, b) => {
      const aValue = (a.miles * perCentValue) + a.tax;
      const bValue = (b.miles * perCentValue) + b.tax;
      return aValue - bValue;
    });
  }, [selectedCabin, awardsByCabin, perCentValue]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-gray-700">
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
            <div className="grid grid-cols-4 gap-0">
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
                      relative px-3 py-4 text-sm font-bold transition-all duration-200
                      border-b-3 -mb-px
                      ${selectedCabin === cabinKey
                        ? 'text-yellow-400 border-yellow-500 bg-yellow-500/10'
                        : 'text-gray-400 border-transparent hover:text-gray-300 hover:bg-gray-800/30'
                      }
                    `}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-base">{cabinDisplay}</span>
                      {cheapestAward && (
                        <span className={`
                          text-xs font-semibold
                          ${selectedCabin === cabinKey ? 'text-yellow-300' : 'text-gray-500'}
                        `}>
                          {cheapestAward.miles.toLocaleString()} mi
                        </span>
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
            {currentCabinAwards.map((award, index) => {
              const cashValue = (award.miles * perCentValue) + award.tax;
              const itinerary = award.itineraries?.[0];
              const segments = itinerary?.segments || [];
              const firstSegment = segments[0];
              const stops = itinerary?.numberOfStops || 0;
              const carrierCode = firstSegment?.carrierCode || 'UA';
              const cabinDisplay = cabinDisplayMap[award.cabin.toUpperCase()] || award.cabin;

              let duration = '';
              if (itinerary?.duration) {
                const match = itinerary.duration.match(/PT(\d+)H(\d+)M/);
                if (match) {
                  const hours = parseInt(match[1]);
                  const minutes = parseInt(match[2]);
                  duration = `${hours}h ${minutes}m`;
                }
              }

              return (
                <div
                  key={award.id || index}
                  className="bg-gray-800/30 hover:bg-gray-800/50 rounded-lg border border-gray-700/60 transition-all p-4"
                >
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-700">
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://www.gstatic.com/flights/airline_logos/35px/${carrierCode}.png`}
                        alt={carrierCode}
                        className="h-6 w-6 object-contain"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {segments.map((seg, idx) => (
                            <span key={idx} className="text-sm font-semibold text-white">
                              {seg.carrierCode}{seg.number}
                              {idx < segments.length - 1 && <span className="text-gray-500 mx-1">→</span>}
                            </span>
                          ))}
                          <span className="px-2 py-0.5 text-[10px] font-medium text-yellow-400">
                            {cabinDisplay}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {stops === 0 ? 'Nonstop' : `${stops} stop${stops > 1 ? 's' : ''}`}
                          {duration && ` • ${duration}`}
                          {award.seats > 0 && ` • ${award.seats} seat${award.seats !== 1 ? 's' : ''}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="bg-yellow-500/12 border border-yellow-500/25 rounded px-3 py-1.5">
                        <span className="text-sm font-bold text-yellow-400">{award.miles.toLocaleString()}</span>
                        <span className="text-[10px] text-yellow-400/70"> mi</span>
                        <span className="text-sm text-yellow-400/60"> + </span>
                        <span className="text-sm font-semibold text-yellow-400">${award.tax.toFixed(2)}</span>
                      </div>
                      <div className="text-[10px] text-gray-400">
                        Value: ${cashValue.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <FlightSegmentViewer
                    segments={segments.map(seg => ({
                      carrierCode: seg.carrierCode,
                      number: seg.number,
                      departure: seg.departure,
                      arrival: seg.arrival,
                      cabin: award.cabin,
                      duration: seg.duration
                    }))}
                    layovers={itinerary?.layovers || []}
                    formatTime={formatTimeInOriginTZ}
                    formatDate={formatDateInOriginTZ}
                    showCabin={true}
                    compact={false}
                  />

                  {award.transferOptions && award.transferOptions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center gap-2 text-xs">
                      <span className="text-gray-500 font-medium">Transfer Partners:</span>
                      <div className="flex flex-wrap gap-2">
                        {award.transferOptions.map((option: any, idx: number) => (
                          <span key={idx} className="px-2 py-1 bg-yellow-500/10 text-yellow-300 rounded border border-yellow-400/30">
                            {option.program} ({option.points?.toLocaleString() || 'N/A'} pts)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AwardResultsModal;
