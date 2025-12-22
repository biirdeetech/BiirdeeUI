import React, { useState, useMemo } from 'react';
import { X, RefreshCw, Plane, Clock } from 'lucide-react';
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
  const [selectedAirport, setSelectedAirport] = useState<string>('');

  const optionsByAirport = useMemo(() => {
    const map = new Map<string, FrtOption[]>();
    frtOptions.forEach(option => {
      const airport = option.airport || 'Unknown';
      if (!map.has(airport)) {
        map.set(airport, []);
      }
      map.get(airport)!.push(option);
    });

    map.forEach((options, airport) => {
      options.sort((a, b) => {
        const aTotalPrice = originFlightPrice + (a.returnFlight?.totalAmount || 0);
        const bTotalPrice = originFlightPrice + (b.returnFlight?.totalAmount || 0);
        return aTotalPrice - bTotalPrice;
      });
    });

    return map;
  }, [frtOptions, originFlightPrice]);

  const availableAirports = useMemo(() => {
    return Array.from(optionsByAirport.keys()).sort();
  }, [optionsByAirport]);

  React.useEffect(() => {
    if (availableAirports.length > 0 && !selectedAirport) {
      setSelectedAirport(availableAirports[0]);
    }
  }, [availableAirports, selectedAirport]);

  const currentAirportOptions = useMemo(() => {
    if (!selectedAirport) return [];
    return optionsByAirport.get(selectedAirport) || [];
  }, [selectedAirport, optionsByAirport]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-gray-700">
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

        {availableAirports.length > 1 && (
          <div className="border-b border-gray-700/50 px-4">
            <div className="flex gap-2 overflow-x-auto py-2">
              {availableAirports.map(airport => {
                const airportOptions = optionsByAirport.get(airport) || [];
                const cheapestOption = airportOptions[0];
                const cheapestTotal = cheapestOption ? originFlightPrice + (cheapestOption.returnFlight?.totalAmount || 0) : 0;
                const savings = cheapestOption ? originFlightPrice - cheapestTotal : 0;

                return (
                  <button
                    key={airport}
                    onClick={() => setSelectedAirport(airport)}
                    className={`
                      px-4 py-3 text-sm font-bold transition-all duration-200 rounded-lg whitespace-nowrap
                      ${selectedAirport === airport
                        ? 'text-blue-400 border-2 border-blue-500 bg-blue-500/10'
                        : 'text-gray-400 border-2 border-transparent hover:text-gray-300 hover:bg-gray-800/30'
                      }
                    `}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-base">{airport}</span>
                      {cheapestOption && (
                        <>
                          <span className={`
                            text-xs font-semibold
                            ${selectedAirport === airport ? 'text-blue-300' : 'text-gray-500'}
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
                      <span className="text-[10px] text-gray-500">({airportOptions.length})</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {currentAirportOptions.map((option, index) => {
              const returnFlight = option.returnFlight;
              if (!returnFlight) return null;

              const returnSlice = returnFlight.slices?.[0];
              if (!returnSlice) return null;

              const returnFlightPrice = returnFlight.totalAmount || 0;
              const frtTotalPrice = originFlightPrice + returnFlightPrice;
              const savings = originFlightPrice - frtTotalPrice;
              const stops = returnSlice.stops || [];
              const isNonstop = stops.length === 0;

              return (
                <div
                  key={index}
                  className="bg-gray-800/30 hover:bg-gray-800/50 rounded-lg border border-gray-700/60 transition-all p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-semibold text-white">
                        Return Flight
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-medium text-blue-400">
                        {isNonstop ? 'Nonstop' : `${stops.length} stop${stops.length > 1 ? 's' : ''}`}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="bg-blue-500/12 border border-blue-500/25 rounded px-3 py-1.5">
                        <span className="text-sm font-semibold text-blue-400">
                          FRT Total: {formatPrice(frtTotalPrice, currency)}
                        </span>
                      </div>
                      <div className={`text-[10px] font-medium ${savings > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {savings > 0 ? `Save ${formatPrice(savings, currency)}` : `+${formatPrice(Math.abs(savings), currency)}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6 flex-1">
                      <div className="text-center min-w-[80px]">
                        <div className="text-lg font-semibold text-white">
                          {formatTime(returnSlice.departure)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatDate(returnSlice.departure)}
                        </div>
                        <div className="text-sm font-medium text-gray-200">
                          {returnSlice.origin?.code || 'N/A'}
                        </div>
                        {returnSlice.origin?.name && (
                          <div className="text-xs text-gray-400">{returnSlice.origin.name}</div>
                        )}
                      </div>

                      <div className="flex-1 px-4">
                        {isNonstop ? (
                          <>
                            <div className="flex items-center gap-1 relative">
                              <div className="flex-1 border-t-2 border-blue-500/40"></div>
                              <Plane className="h-3 w-3 text-blue-400" />
                              <div className="flex-1 border-t-2 border-blue-500/40"></div>
                            </div>
                            <div className="flex flex-col items-center gap-1 mt-2">
                              <div className="text-sm font-medium text-gray-200 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(returnSlice.duration)}
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-1 text-gray-300 relative">
                              <div className="flex-1 relative">
                                <div className="border-t-2 border-gray-600"></div>
                              </div>

                              {stops.map((stop: any, stopIdx: number) => (
                                <React.Fragment key={stopIdx}>
                                  <div className="flex flex-col items-center gap-0.5 bg-orange-500/10 border border-orange-500/30 px-2 py-1.5 rounded">
                                    <div className="text-[10px] font-semibold text-orange-300">{stop}</div>
                                  </div>
                                  {stopIdx < stops.length - 1 && (
                                    <div className="flex-1 relative">
                                      <div className="border-t-2 border-gray-600"></div>
                                    </div>
                                  )}
                                </React.Fragment>
                              ))}

                              <div className="flex-1 relative">
                                <div className="border-t-2 border-gray-600"></div>
                              </div>
                            </div>
                            <div className="flex flex-col items-center gap-1 mt-2">
                              <div className="text-sm font-medium text-gray-200 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(returnSlice.duration)}
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="text-center min-w-[80px]">
                        <div className="text-lg font-semibold text-white">
                          {formatTime(returnSlice.arrival)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatDate(returnSlice.arrival)}
                        </div>
                        <div className="text-sm font-medium text-gray-200">
                          {returnSlice.destination?.code || 'N/A'}
                        </div>
                        {returnSlice.destination?.name && (
                          <div className="text-xs text-gray-400">{returnSlice.destination.name}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {returnSlice.flights && returnSlice.flights.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-700/50 text-xs text-gray-400">
                      <span className="font-medium">Flight{returnSlice.flights.length > 1 ? 's' : ''}: </span>
                      {returnSlice.flights.join(', ')}
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

export default FrtResultsModal;
