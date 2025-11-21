import React, { useState, useEffect } from 'react';
import { X, Loader2, Plane, Clock, Info } from 'lucide-react';
import ITAMatrixService from '../services/itaMatrixApi';

interface FlightSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  solutionId: string;
  session?: string;
  solutionSet?: string;
}

const FlightSummaryModal: React.FC<FlightSummaryModalProps> = ({
  isOpen,
  onClose,
  solutionId,
  session,
  solutionSet
}) => {
  const [summaryData, setSummaryData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSummaryData(null);
      setError(null);
      fetchSummary();
    }
  }, [isOpen, solutionId]);

  const fetchSummary = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('🔍 FlightSummaryModal: Fetching summary for solution:', solutionId);
      const result = await ITAMatrixService.getFlightDetails(solutionId, session, solutionSet);
      console.log('✅ FlightSummaryModal: Received summary data:', result);
      setSummaryData(result);
    } catch (err: any) {
      console.error('❌ FlightSummaryModal: Failed to fetch summary:', err);
      setError(err.message || 'Failed to load flight details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatCabin = (cabin: string) => {
    const cabinMap: { [key: string]: string } = {
      'COACH': 'Economy',
      'PREMIUM_COACH': 'Premium Economy',
      'BUSINESS': 'Business',
      'FIRST': 'First'
    };
    return cabinMap[cabin] || cabin;
  };

  const renderSlice = (slice: any, sliceIndex: number) => {
    const pricing = summaryData?.bookingDetails?.tickets?.[0]?.pricings?.[0];
    const fare = pricing?.fares?.[sliceIndex];

    return (
      <div key={sliceIndex} className="space-y-4">
        {/* Slice Header with Price */}
        <div className="flex items-center justify-between border-b border-gray-700 pb-3">
          <div>
            <h4 className="text-lg font-semibold text-white">
              {slice.origin.city?.name || slice.origin.code} → {slice.destination.city?.name || slice.destination.code}
            </h4>
            <p className="text-sm text-gray-400 mt-1">{formatDate(slice.departure)}</p>
          </div>
          {fare && (
            <div className="text-right">
              <div className="text-lg font-bold text-accent-400">{fare.displayAdjustedPrice}</div>
              <div className="text-xs text-gray-400">Base Fare</div>
            </div>
          )}
        </div>

        {/* Segments */}
        <div className="space-y-3">
          {slice.segments.map((segment: any, segIdx: number) => {
            const bookingInfo = segment.bookingInfos?.[0];
            const layoverDuration = segment.connection?.duration;

            return (
              <React.Fragment key={segIdx}>
                <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
                  <div className="flex items-start gap-3">
                    <img 
                      src={`https://www.gstatic.com/flights/airline_logos/35px/${segment.carrier.code}.png`}
                      alt={segment.carrier.shortName}
                      className="w-9 h-9 rounded mt-1"
                      onError={(e) => {
                        e.currentTarget.src = 'https://www.gstatic.com/flights/airline_logos/35px/generic.png';
                      }}
                    />
                    <div className="flex-1 space-y-3">
                      {/* Flight Info */}
                      <div>
                        <div className="font-medium text-white text-base">
                          {segment.carrier.shortName} {segment.flight.number}
                        </div>
                        {segment.codeshare && segment.ext?.operationalDisclosure && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {segment.ext.operationalDisclosure}
                          </div>
                        )}
                      </div>

                      {/* Route & Times */}
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                        <div>
                          <div className="text-xs text-gray-400">
                            {segment.origin.city?.name || segment.origin.code}
                          </div>
                          <div className="text-lg font-semibold text-white">
                            {formatTime(segment.departure)}
                          </div>
                          <div className="text-xs text-gray-400 font-mono">
                            {segment.origin.code}
                          </div>
                        </div>

                        <div className="flex flex-col items-center px-4">
                          <Clock className="w-4 h-4 text-gray-500 mb-1" />
                          <div className="text-xs text-gray-400 whitespace-nowrap">
                            {formatDuration(segment.duration)}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs text-gray-400">
                            {segment.destination.city?.name || segment.destination.code}
                          </div>
                          <div className="text-lg font-semibold text-white">
                            {formatTime(segment.arrival)}
                          </div>
                          <div className="text-xs text-gray-400 font-mono">
                            {segment.destination.code}
                          </div>
                        </div>
                      </div>

                      {/* Details Row */}
                      <div className="flex items-center gap-4 text-xs text-gray-400 pt-2 border-t border-gray-700/50">
                        {bookingInfo && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">Class:</span>
                            <span className="text-gray-300 font-medium">
                              {formatCabin(bookingInfo.cabin)} ({bookingInfo.bookingCode})
                            </span>
                          </div>
                        )}
                        {segment.legs?.[0]?.aircraft?.shortName && (
                          <>
                            <span className="text-gray-600">•</span>
                            <div className="flex items-center gap-1">
                              <Plane className="w-3 h-3" />
                              <span>{segment.legs[0].aircraft.shortName}</span>
                            </div>
                          </>
                        )}
                        {segment.legs?.[0]?.services?.[0]?.meals?.length > 0 && (
                          <>
                            <span className="text-gray-600">•</span>
                            <span>{segment.legs[0].services[0].meals.join(', ')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Layover */}
                {layoverDuration && (
                  <div className="flex items-center justify-center gap-2 py-2">
                    <div className="flex-1 border-t border-gray-700"></div>
                    <div className="text-xs text-gray-500 px-3">
                      Layover: {formatDuration(layoverDuration)}
                    </div>
                    <div className="flex-1 border-t border-gray-700"></div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPriceBreakdown = () => {
    if (!summaryData?.bookingDetails?.tickets?.[0]?.pricings?.[0]) return null;

    const pricing = summaryData.bookingDetails.tickets[0].pricings[0];
    const fares = pricing.fares || [];
    const taxes = pricing.ext?.taxTotals || [];
    const fareConstruction = pricing.fareCalculations?.[0]?.lines?.[0];
    const totalPrice = summaryData.bookingDetails.displayTotal || pricing.displayPrice;

    return (
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-white border-b border-gray-700 pb-3">
          Price Breakdown
        </h4>

        {/* Base Fares Summary */}
        <div className="bg-gray-800/20 rounded-lg p-4 space-y-2">
          {fares.map((fare: any, idx: number) => (
            <div key={idx} className="flex justify-between items-center text-sm">
              <div className="text-gray-300">
                {fare.originCity} → {fare.destinationCity}
              </div>
              <div className="font-semibold text-white">{fare.displayAdjustedPrice}</div>
            </div>
          ))}
        </div>

        {/* Taxes & Fees */}
        {taxes.length > 0 && (
          <div>
            <div className="text-sm font-medium text-gray-300 mb-2">Taxes & Fees</div>
            <div className="bg-gray-800/20 rounded-lg p-3 max-h-64 overflow-y-auto">
              <div className="space-y-1.5">
                {taxes.map((tax: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-start gap-4 text-xs py-1.5 border-b border-gray-800/50 last:border-0">
                    <div className="flex-1">
                      <div className="text-gray-300">{tax.name}</div>
                      <div className="text-gray-500 text-[10px] mt-0.5">({tax.code})</div>
                    </div>
                    <div className="text-gray-400 font-mono whitespace-nowrap">
                      {tax.totalDisplayPrice}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Total */}
        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-accent-500/10 to-accent-600/10 border border-accent-500/30 rounded-lg">
          <div className="text-lg font-semibold text-white">Total Price</div>
          <div className="text-2xl font-bold text-accent-400">{totalPrice}</div>
        </div>

        {/* Notes */}
        {pricing.notes && pricing.notes.length > 0 && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-yellow-200 space-y-1">
                {pricing.notes.map((note: string, idx: number) => (
                  <div key={idx}>{note}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Fare Construction */}
        {fareConstruction && (
          <div className="bg-gray-800/20 rounded-lg p-3">
            <div className="text-xs font-medium text-gray-400 mb-2">Fare Construction</div>
            <div className="text-[10px] text-gray-500 font-mono break-all leading-relaxed">
              {fareConstruction}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Plane className="w-6 h-6 text-accent-400" />
                Flight Details & Pricing
              </h3>
              <p className="text-xs text-gray-500 mt-1 font-mono">{solutionId}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="h-10 w-10 text-accent-500 animate-spin" />
              <p className="text-gray-400">Loading flight details...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <p className="text-red-400 text-center mb-4">{error}</p>
              <button
                onClick={fetchSummary}
                className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          ) : summaryData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
              {/* Left Column - Route Details */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">
                    Route Details
                  </h4>
                  <div className="space-y-6">
                    {summaryData.bookingDetails?.itinerary?.slices?.map((slice: any, idx: number) => (
                      <div key={idx}>
                        {renderSlice(slice, idx)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column - Price Breakdown */}
              <div>
                <div className="lg:sticky lg:top-0">
                  {renderPriceBreakdown()}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {!isLoading && !error && summaryData && (
          <div className="p-4 border-t border-gray-700 bg-gray-900/50">
            <div className="text-xs text-gray-500 text-center">
              Tickets cannot be purchased directly from this application. Provide this information to a travel agent.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlightSummaryModal;
