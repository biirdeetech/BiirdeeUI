import React, { useState } from 'react';
import { Plane, Clock, ChevronDown, Target, Plus, ChevronRight, Zap } from 'lucide-react';
import { FlightSolution, GroupedFlight, MileageDeal } from '../types/flight';
import { PREMIUM_CARRIERS } from '../utils/fareClasses';
import ITAMatrixService from '../services/itaMatrixApi';
import AddToProposalModal from './AddToProposalModal';
import MileageDealsDropdown from './MileageDealsDropdown';
import FlightSegmentDetails from './FlightSegmentDetails';

interface FlightCardProps {
  flight: FlightSolution | GroupedFlight;
}

const FlightCard: React.FC<FlightCardProps> = ({ flight }) => {
  // Check if this is a grouped flight (round-trip with multiple return options)
  const isGroupedFlight = 'outboundSlice' in flight;
  const [selectedReturnIndex, setSelectedReturnIndex] = useState(0);
  const [showReturnDropdown, setShowReturnDropdown] = useState(false);
  const [showAddToProposal, setShowAddToProposal] = useState(false);
  const [expandedSlices, setExpandedSlices] = useState<Record<number, boolean>>({});
  const [expandedSegments, setExpandedSegments] = useState<Record<number, boolean>>({});
  const [sliceAlternativeTabs, setSliceAlternativeTabs] = useState<Record<number, 'best-match' | 'time-insensitive'>>({});


  // Get flight data based on type
  const getFlightData = () => {
    if (isGroupedFlight) {
      const groupedFlight = flight as GroupedFlight;
      const selectedReturn = groupedFlight.returnOptions[selectedReturnIndex];
      return {
        slices: [groupedFlight.outboundSlice, selectedReturn.returnSlice],
        carrier: groupedFlight.carrier,
        isNonstop: groupedFlight.isNonstop && (!selectedReturn.returnSlice?.stops || selectedReturn.returnSlice.stops.length === 0),
        totalAmount: selectedReturn.totalAmount,
        displayTotal: selectedReturn.displayTotal,
        currency: selectedReturn.currency || 'USD',
        pricePerMile: selectedReturn.ext.pricePerMile,
        hasMultipleReturns: groupedFlight.returnOptions.length > 1
      };
    } else {
      const regularFlight = flight as FlightSolution;
      const firstSlice = regularFlight.slices[0];
      return {
        slices: regularFlight.slices,
        carrier: firstSlice.segments[0]?.carrier || { code: '', name: '', shortName: '' },
        isNonstop: regularFlight.slices.every(slice => !slice.stops || slice.stops.length === 0),
        totalAmount: regularFlight.totalAmount,
        displayTotal: regularFlight.displayTotal,
        currency: regularFlight.currency || 'USD',
        pricePerMile: regularFlight.ext.pricePerMile,
        hasMultipleReturns: false,
        flightId: regularFlight.id,
        totalMileage: regularFlight.totalMileage || 0,
        totalMileagePrice: regularFlight.totalMileagePrice || 0,
        matchType: regularFlight.matchType || 'none',
        mileageDeals: regularFlight.mileageDeals || [],
        fullyEnriched: regularFlight.fullyEnriched || false
      };
    }
  };

  const { slices, carrier, isNonstop, totalAmount, displayTotal, currency, pricePerMile, hasMultipleReturns, flightId, totalMileage, totalMileagePrice, matchType, mileageDeals, fullyEnriched } = getFlightData();
  const isPremium = PREMIUM_CARRIERS.includes(carrier.code);

  console.log('🎴 FlightCard: Rendering flight with', { 
    isGrouped: isGroupedFlight, 
    hasMultipleReturns, 
    sliceCount: slices.length,
    flightId
  });

  const formatMileagePrice = (price: number | string): string => {
    if (typeof price === 'string') {
      return price;
    }
    return `USD ${price.toFixed(2)}`;
  };

  const countMileagePrograms = (breakdown?: any[]): number => {
    if (!breakdown) return 0;
    const uniqueCarriers = new Set<string>();
    breakdown.forEach(bd => {
      if (bd.allMatchingFlights) {
        bd.allMatchingFlights.forEach((flight: any) => {
          const carrier = flight.operatingCarrier || flight.carrierCode;
          if (carrier) uniqueCarriers.add(carrier);
        });
      }
    });
    return uniqueCarriers.size;
  };

  const formatTime = (dateTime: string) => {
    if (!dateTime) return 'N/A';
    try {
      // Extract time portion directly from ISO string (e.g., "2025-10-05T14:30:00+03:00")
      const timeMatch = dateTime.match(/T(\d{2}):(\d{2})/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);

        // Convert to 12-hour format
        const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const minutesStr = minutes.toString().padStart(2, '0');

        return `${hour12}:${minutesStr} ${ampm}`;
      }
      return 'N/A';
    } catch {
      return 'N/A';
    }
  };

  const formatTimeOld = (dateTime: string) => {
    const date = new Date(dateTime);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateTime: string) => {
    const date = new Date(dateTime);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getDayDifference = (departureDateTime: string, arrivalDateTime: string) => {
    const depDate = new Date(departureDateTime);
    const arrDate = new Date(arrivalDateTime);
    
    // Reset time to compare just dates
    const depDay = new Date(depDate.getFullYear(), depDate.getMonth(), depDate.getDate());
    const arrDay = new Date(arrDate.getFullYear(), arrDate.getMonth(), arrDate.getDate());
    
    const diffTime = arrDay.getTime() - depDay.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const formatPrice = (price: number, currencyCode: string) => {
    // Format number with commas
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);

    // Return with currency code prefix
    return `${currencyCode} ${formatted}`;
  };

  const openHacksPage = () => {
    const firstSlice = slices[0];
    const solutionId = flightId || (isGroupedFlight && (flight as GroupedFlight).returnOptions[selectedReturnIndex]?.originalFlightId);
    
    const params = new URLSearchParams({
      origin: firstSlice.origin.code,
      destination: firstSlice.destination.code,
      departDate: firstSlice.departure.split('T')[0],
      cabin: slices[0].cabins[0] || 'BUSINESS',
      price: formatPrice(displayTotal, currency)
    });
    
    // Add flight number if available
    if (firstSlice.flights && firstSlice.flights.length > 0) {
      params.append('flightNumber', firstSlice.flights[0]);
    }
    
    // Add solution ID for detailed information
    if (solutionId) {
      params.append('solutionId', solutionId);
    }
    
    // Add session and solutionSet from ITAMatrixService for detailed flight info
    const sessionInfo = ITAMatrixService.getSessionInfo();
    if (sessionInfo) {
      params.append('session', sessionInfo.session);
      params.append('solutionSet', sessionInfo.solutionSet);
    }
    
    console.log('🔗 Opening hacks page with params:', params.toString());
    window.open(`/hacks?${params.toString()}`, '_blank');
  };
  const formatPricePerMile = (pricePerMile: number) => {
    return pricePerMile.toFixed(2);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getSliceLabel = (index: number) => {
    if (slices.length === 2) {
      return index === 0 ? 'Outbound' : 'Return';
    } else if (slices.length > 2) {
      return `Flight ${index + 1}`;
    }
    return null;
  };

  // Calculate segment durations and layover times
  const calculateSegmentTimes = (slice: any) => {
    if (!slice.stops || slice.stops.length === 0) {
      // Direct flight - single segment
      return {
        segments: [{ duration: slice.duration }],
        layovers: []
      };
    }

    // We need to estimate segment times based on proportional distances
    // Since we don't have actual segment times, we'll use the mileageBreakdown if available
    const segments: { duration: number }[] = [];
    const layovers: { duration: number, airportCode: string }[] = [];

    if (slice.mileageBreakdown && slice.mileageBreakdown.length > 0) {
      // Calculate total mileage
      const totalMileage = slice.mileageBreakdown.reduce((sum: number, mb: any) => sum + (mb.mileage || 0), 0);
      const totalFlightTime = slice.duration - layovers.reduce((sum, l) => sum + l.duration, 0);

      // Calculate segment durations based on mileage proportion
      slice.mileageBreakdown.forEach((mb: any, idx: number) => {
        const proportion = totalMileage > 0 ? (mb.mileage || 0) / totalMileage : 1 / slice.mileageBreakdown.length;
        segments.push({ duration: Math.round(totalFlightTime * proportion) });
      });
    } else {
      // Fallback: divide time evenly among segments
      const numSegments = (slice.stops?.length || 0) + 1;
      const avgSegmentTime = Math.round(slice.duration / numSegments * 0.7); // Assume 70% is flight time
      const avgLayoverTime = Math.round((slice.duration - (avgSegmentTime * numSegments)) / (slice.stops?.length || 1));

      for (let i = 0; i < numSegments; i++) {
        segments.push({ duration: avgSegmentTime });
        if (i < numSegments - 1) {
          layovers.push({
            duration: avgLayoverTime,
            airportCode: slice.stops?.[i]?.code || 'N/A'
          });
        }
      }
    }

    return { segments, layovers };
  };

  const handleReturnSelection = (index: number) => {
    setSelectedReturnIndex(index);
    setShowReturnDropdown(false);
  };
  return (
    <div className={`bg-gray-900 border-2 rounded-lg hover:border-gray-700 transition-all duration-200 shadow-lg hover:shadow-xl ${
      matchType && matchType !== 'none' ? 'border-gray-600' : 'border-gray-800'
    }`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {carrier.code && (
              <img
                src={`https://www.gstatic.com/flights/airline_logos/35px/${carrier.code}.png`}
                alt={carrier.code}
                className="h-7 w-7 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <div>
              <div className="font-semibold text-white">{carrier.shortName}</div>
              <div className="text-xs text-gray-400">
                {slices[0].origin.code} → {slices[slices.length - 1].destination.code}
                {slices[0].flights && slices[0].flights.length > 0 && (
                  <span className="ml-2">Flight {slices[0].flights[0]}</span>
                )}
              </div>
            </div>
            {isNonstop && (
              <div className="px-2 py-1 bg-success-500/20 text-success-400 text-xs font-medium rounded">
                Nonstop
              </div>
            )}
            {isPremium && (
              <div className="px-2 py-1 bg-accent-500/20 text-accent-400 text-xs font-medium rounded">
                Premium
              </div>
            )}
            {slices.length > 1 && (
              <div className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-medium rounded flex items-center gap-1">
                {slices.length === 2 ? 'Round Trip' : `${slices.length} Flights`}
                {hasMultipleReturns && (
                  <span className="text-xs">({isGroupedFlight && (flight as GroupedFlight).returnOptions.length} return options)</span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 w-full lg:w-auto">
            {/* Price Display - Right Aligned with Mileage on Left */}
            <div className="flex flex-wrap items-baseline gap-3 justify-end">
              {/* Mileage Info - Left Side */}
              {totalMileage > 0 && (
                <div className="flex items-center gap-2">
                  <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-400/30 rounded-lg px-3 py-1.5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-bold text-orange-300">{totalMileage.toLocaleString()}</span>
                      <span className="text-xs text-orange-400">miles</span>
                      {totalMileagePrice > 0 && (
                        <>
                          <span className="text-xs text-orange-400">+</span>
                          <span className="text-sm font-semibold text-orange-300">${totalMileagePrice.toFixed(2)}</span>
                        </>
                      )}
                      <span className="text-[10px] text-orange-500/70 ml-1">
                        @ ${(totalMileagePrice / totalMileage).toFixed(3)}/mi
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Price Per Mile */}
              <div className="text-xs text-gray-400">
                ${formatPricePerMile(pricePerMile)}/mi
              </div>

              {/* Total Price */}
              <div className="flex flex-col items-end">
                <div className="text-xl font-medium text-neutral-100">
                  {formatPrice(displayTotal, currency)}
                </div>
                {totalMileage > 0 && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    Mileage Value: ${((totalMileage * 0.015) + totalMileagePrice).toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons - Match badges on left, buttons on right */}
            <div className="flex flex-wrap items-center gap-2 justify-end">
              {/* Match Type Badge - Left Side */}
              {matchType && matchType !== 'none' && (
                <div>
                  {matchType === 'exact' && (
                    <span className="inline-flex items-center px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-medium border border-green-500/30">
                      Aero Full Match
                    </span>
                  )}
                  {matchType === 'partial' && (
                    <span className="inline-flex items-center px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full font-medium border border-yellow-500/30">
                      Aero Partial Match
                    </span>
                  )}
                </div>
              )}

              <button
                onClick={openHacksPage}
                className="bg-accent-500/20 hover:bg-accent-500/30 text-accent-400 hover:text-accent-300 px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1"
              >
                <Target className="h-3 w-3" />
                Hacks
              </button>
              <button
                onClick={() => setShowAddToProposal(true)}
                className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Add to proposal
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Flight Details - Multiple Slices */}
      <div className="px-3 sm:px-4 lg:px-6 py-4">
        {slices.map((slice, sliceIndex) => (
          <div key={sliceIndex} className={sliceIndex > 0 ? 'border-t border-gray-700 pt-3 lg:pt-4 mt-3 lg:mt-4' : ''}>
            {/* Slice Label */}
            <div className="flex items-center gap-2 mb-2 lg:mb-3">
              {getSliceLabel(sliceIndex) && (
                <div className="text-sm font-medium text-accent-400">
                  {getSliceLabel(sliceIndex)}
                </div>
              )}
              
              {/* Return Flight Dropdown */}
              {sliceIndex === 1 && hasMultipleReturns && isGroupedFlight && (
                <div className="relative ml-auto hidden sm:block">
                  <button
                    onClick={() => setShowReturnDropdown(!showReturnDropdown)}
                    className="flex items-center gap-1 px-2 lg:px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
                  >
                    Return Options
                    <ChevronDown className={`h-2.5 w-2.5 lg:h-3 lg:w-3 transition-transform ${showReturnDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showReturnDropdown && (
                    <div className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 min-w-72 lg:min-w-80 max-w-md">
                      {(flight as GroupedFlight).returnOptions.map((returnOption, index) => (
                        <button
                          key={index}
                          onClick={() => handleReturnSelection(index)}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors first:rounded-t-lg last:rounded-b-lg border-b border-gray-700 last:border-b-0 ${
                            index === selectedReturnIndex ? 'bg-blue-600/20 border-blue-500' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs text-gray-400 mb-1">
                                {returnOption.returnSlice.segments?.[0]?.carrier?.code || 'Unknown'} {returnOption.returnSlice.flights?.join(', ') || 'N/A'}
                              </div>
                              <div className="text-sm font-medium text-white">
                                {formatTime(returnOption.returnSlice.departure)} → {formatTime(returnOption.returnSlice.arrival)}
                              </div>
                              <div className="text-xs text-gray-400">
                                {returnOption.returnSlice.origin?.code || 'N/A'} → {returnOption.returnSlice.destination?.code || 'N/A'} • {formatDuration(returnOption.returnSlice.duration)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-white">
                                {formatPrice(returnOption.displayTotal, returnOption.currency || 'USD')}
                              </div>
                              <div className="text-xs text-gray-400">
                                ${formatPricePerMile(returnOption.ext.pricePerMile)}/mi
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {getSliceLabel(sliceIndex) && (
                <div className="flex-1 border-t border-gray-700 hidden sm:block"></div>
              )}
            </div>
            
            <div className="flex items-center justify-between mb-3 lg:mb-4">
              <div className="flex items-center gap-2 sm:gap-3 lg:gap-6 flex-1">
                {/* Departure Airport */}
                <div className="text-center min-w-[80px]">
                  <div className="text-base sm:text-lg lg:text-xl font-semibold text-white">
                    {formatTime(slice.departure)}
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatDate(slice.departure)}
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-gray-200">{slice.origin?.code || 'N/A'}</div>
                  {slice.origin?.name && (
                    <div className="text-xs text-gray-400 hidden lg:block">{slice.origin.name}</div>
                  )}
                  {/* Cabin class for departure */}
                  {slice.cabins && slice.cabins.length > 0 && slice.cabins[0] && (
                    <div className="text-[10px] text-accent-300 mt-1">
                      {slice.cabins[0]}
                    </div>
                  )}
                  {/* Departure flight number */}
                  {slice.flights && slice.flights.length > 0 && slice.flights[0] && (
                    <div className="text-[10px] text-gray-500 mt-0.5 font-mono">
                      {slice.flights[0]}
                    </div>
                  )}
                </div>

                <div className="flex-1 px-1 sm:px-2 lg:px-4">
                  {(() => {
                    const isNonstop = !slice.stops || slice.stops.length === 0;

                    if (isNonstop) {
                      // Nonstop flight - single green line with plane in middle
                      return (
                        <>
                          <div className="flex items-center gap-1 relative">
                            <div className="flex-1 border-t-2 border-emerald-500/40"></div>
                            <Plane className="h-3 w-3 text-emerald-400" />
                            <div className="flex-1 border-t-2 border-emerald-500/40"></div>
                          </div>

                          {/* Duration below */}
                          <div className="text-center text-xs lg:text-sm font-medium text-gray-200 mt-2">
                            <Clock className="h-2.5 w-2.5 lg:h-3 lg:w-3 inline mr-1" />
                            {formatDuration(slice.duration)}
                          </div>
                        </>
                      );
                    }

                    // Flights with stops - original complex layout
                    const { segments: segmentTimes, layovers: layoverTimes } = calculateSegmentTimes(slice);

                    return (
                      <>
                        {/* Flight line with layovers and time indicators */}
                        <div className="flex items-center gap-1 text-gray-300 relative">
                          {/* First segment line with duration */}
                          <div className="flex-1 relative">
                            <div className="border-t-2 border-gray-600"></div>
                            {segmentTimes[0] && (
                              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-gray-400 whitespace-nowrap">
                                {formatDuration(segmentTimes[0].duration)}
                              </div>
                            )}
                          </div>

                          {/* Layovers with time indicators */}
                          {slice.stops && slice.stops.length > 0 && slice.stops.map((stop: any, stopIdx: number) => {
                            const nextFlightIdx = stopIdx + 1;
                            const nextCarrier = slice.segments && slice.segments[nextFlightIdx] ? slice.segments[nextFlightIdx].carrier : null;
                            const hasNextSegment = segmentTimes[nextFlightIdx];

                            return (
                              <React.Fragment key={stopIdx}>
                                {/* Layover indicator */}
                                <div className="flex flex-col items-center gap-0.5 bg-gray-800/50 px-1.5 py-1 rounded relative">
                                  {nextCarrier && nextCarrier.code && (
                                    <img
                                      src={`https://www.gstatic.com/flights/airline_logos/35px/${nextCarrier.code}.png`}
                                      alt={nextCarrier.code || 'airline'}
                                      className="h-3 w-3 object-contain"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  )}
                                  <span className="text-[9px] text-gray-300 font-medium">
                                    {stop?.code || 'N/A'}
                                  </span>
                                  {slice.flights && slice.flights[nextFlightIdx] && (
                                    <span className="text-[8px] text-gray-500 font-mono">
                                      {slice.flights[nextFlightIdx]}
                                    </span>
                                  )}
                                  {/* Layover duration below */}
                                  {layoverTimes[stopIdx] && (
                                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-orange-400 whitespace-nowrap">
                                      {formatDuration(layoverTimes[stopIdx].duration)}
                                    </div>
                                  )}
                                </div>

                                {/* Segment between layovers or to arrival */}
                                {hasNextSegment && (
                                  <div className="flex-1 relative">
                                    <div className={`border-t-2 ${
                                      stopIdx < slice.stops.length - 1 ? 'border-dashed border-gray-600' : 'border-gray-600'
                                    }`}></div>
                                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-gray-400 whitespace-nowrap">
                                      {formatDuration(segmentTimes[nextFlightIdx].duration)}
                                    </div>
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}

                        </div>

                        {/* Total Duration - Long thin line at bottom */}
                        <div className="relative mt-8">
                          <div className="border-t border-gray-700"></div>
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 px-2">
                            <div className="text-center text-[10px] font-medium text-gray-300 flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5 inline" />
                              {formatDuration(slice.duration)}
                            </div>
                          </div>
                        </div>

                        {/* Stop count */}
                        {slice.stops && slice.stops.length > 0 && (
                          <div className="text-center text-[10px] text-gray-400 mt-2">
                            {slice.stops.length === 1 ? '1 stop' : `${slice.stops.length} stops`}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Arrival Airport */}
                <div className="text-center min-w-[80px]">
                  <div className="text-base sm:text-lg lg:text-xl font-semibold text-white">
                    {formatTime(slice.arrival)}
                    {(() => {
                      const dayDiff = getDayDifference(slice.departure, slice.arrival);
                      if (dayDiff > 0) {
                        return <span className="text-xs text-accent-400 ml-1">+{dayDiff}</span>;
                      }
                      return null;
                    })()}
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatDate(slice.arrival)}
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-gray-200">{slice.destination?.code || 'N/A'}</div>
                  {slice.destination?.name && (
                    <div className="text-xs text-gray-400 hidden lg:block">{slice.destination.name}</div>
                  )}
                  {/* Cabin class for arrival */}
                  {slice.cabins && slice.cabins.length > 0 && slice.cabins[slice.cabins.length - 1] && (
                    <div className="text-[10px] text-accent-300 mt-1">
                      {slice.cabins[slice.cabins.length - 1]}
                    </div>
                  )}
                  {/* Arrival flight number - last segment */}
                  {slice.flights && slice.flights.length > 0 && slice.flights[slice.flights.length - 1] && (
                    <div className="text-[10px] text-gray-500 mt-0.5 font-mono">
                      {slice.flights[slice.flights.length - 1]}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Slice Details */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between text-xs lg:text-sm text-gray-300 mb-3 lg:mb-4 gap-2 lg:gap-4">
              <div className="flex flex-wrap items-center gap-2 lg:gap-4">
                {slice.segments && slice.segments.length > 0 && slice.segments[0].pricings && slice.segments[0].pricings.length > 0 && slice.segments[0].pricings[0].bookingClass && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400 font-medium">Booking:</span>
                    <span className="font-mono bg-gray-700 px-1.5 lg:px-2 py-0.5 lg:py-1 rounded text-white font-medium text-xs">
                      {slice.segments[0].pricings[0].bookingClass}
                    </span>
                  </div>
                )}
                {slice.mileage && slice.mileage > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 font-medium">Miles:</span>
                      {slice.mileageBreakdown && slice.mileageBreakdown.some(mb => mb.allMatchingFlights && mb.allMatchingFlights.length > 0) ? (
                        <button
                          onClick={() => setExpandedSlices(prev => ({ ...prev, [sliceIndex]: !prev[sliceIndex] }))}
                          className="bg-purple-500/20 text-purple-300 px-1.5 lg:px-2 py-0.5 lg:py-1 rounded text-xs lg:text-sm font-medium hover:bg-purple-500/30 transition-colors flex items-center gap-1 relative"
                        >
                          {slice.mileage.toLocaleString()} miles + {formatMileagePrice(slice.mileagePrice || 0)}
                          <ChevronDown className={`h-3 w-3 transition-transform ${expandedSlices[sliceIndex] ? 'rotate-180' : ''}`} />
                          {(() => {
                            const programCount = countMileagePrograms(slice.mileageBreakdown);
                            return programCount > 1 && (
                              <div className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-gray-900">
                                {programCount}
                              </div>
                            );
                          })()}
                        </button>
                      ) : (
                        <span className="bg-purple-500/20 text-purple-300 px-1.5 lg:px-2 py-0.5 lg:py-1 rounded text-xs lg:text-sm font-medium">
                          {slice.mileage.toLocaleString()} miles + {formatMileagePrice(slice.mileagePrice || 0)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Expanded Mileage Alternatives */}
            {expandedSlices[sliceIndex] && slice.mileageBreakdown && (
              <div className="mt-3 space-y-3 bg-gray-900/50 p-3 rounded border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-medium text-purple-300">
                    Alternative Mileage Programs for {slice.origin.code} → {slice.destination.code}
                  </div>
                  {slice.stops && slice.stops.length > 0 && (
                    <div className="text-[10px] text-gray-500">
                      via {slice.stops.map(s => s.code).join(', ')}
                    </div>
                  )}
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-700/50 bg-gray-800/50 rounded-t-lg overflow-hidden -mx-3 px-3">
                  <button
                    onClick={() => setSliceAlternativeTabs({...sliceAlternativeTabs, [sliceIndex]: 'best-match'})}
                    className={`flex-1 px-4 py-2.5 text-xs font-medium transition-all relative ${
                      (sliceAlternativeTabs[sliceIndex] || 'best-match') === 'best-match'
                        ? 'text-green-400 bg-gray-800/70'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Zap className="h-3.5 w-3.5" />
                      <span>Best Matches (within 5hr)</span>
                    </div>
                    {(sliceAlternativeTabs[sliceIndex] || 'best-match') === 'best-match' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500" />
                    )}
                  </button>
                  <button
                    onClick={() => setSliceAlternativeTabs({...sliceAlternativeTabs, [sliceIndex]: 'time-insensitive'})}
                    className={`flex-1 px-4 py-2.5 text-xs font-medium transition-all relative ${
                      sliceAlternativeTabs[sliceIndex] === 'time-insensitive'
                        ? 'text-blue-400 bg-gray-800/70'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Time Insensitive (5hr+)</span>
                    </div>
                    {sliceAlternativeTabs[sliceIndex] === 'time-insensitive' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                    )}
                  </button>
                </div>

                {slice.mileageBreakdown.map((breakdown, bdIndex) => {
                  // Sort allMatchingFlights by time proximity to original departure
                  const sortedFlights = breakdown.allMatchingFlights ? [...breakdown.allMatchingFlights].sort((a, b) => {
                    const aTime = new Date(a.departure.at).getTime();
                    const bTime = new Date(b.departure.at).getTime();
                    const originalTime = new Date(slice.departure).getTime();
                    const aDiff = Math.abs(aTime - originalTime);
                    const bDiff = Math.abs(bTime - originalTime);
                    return aDiff - bDiff;
                  }) : [];

                  // Filter flights based on active tab (5 hours = 300 minutes)
                  const activeTab = sliceAlternativeTabs[sliceIndex] || 'best-match';
                  const originalTime = new Date(slice.departure).getTime();
                  const filteredFlights = sortedFlights.filter(altFlight => {
                    const flightTime = new Date(altFlight.departure.at).getTime();
                    const diffMinutes = Math.abs((flightTime - originalTime) / (1000 * 60));

                    if (activeTab === 'best-match') {
                      return diffMinutes <= 300; // Within 5 hours
                    } else {
                      return diffMinutes > 300; // More than 5 hours
                    }
                  });

                  // Calculate time difference in minutes for color coding
                  const getTimeProximityColor = (departureTime: string) => {
                    const flightTime = new Date(departureTime).getTime();
                    const originalTime = new Date(slice.departure).getTime();
                    const diffMinutes = Math.abs(flightTime - originalTime) / (1000 * 60);

                    if (diffMinutes <= 120) {
                      // Within 120 minutes - greenish, fade based on distance
                      const opacity = Math.max(0.2, 1 - (diffMinutes / 120) * 0.8);
                      return {
                        borderColor: `rgba(34, 197, 94, ${opacity})`,
                        bgColor: `rgba(34, 197, 94, ${opacity * 0.15})`
                      };
                    }
                    return null;
                  };

                  return (
                    filteredFlights.length > 0 && (
                    <div key={bdIndex} className="space-y-1.5">
                      <div className="text-xs text-gray-400 font-medium flex items-center gap-2">
                        <span className="text-gray-500">Leg {bdIndex + 1}:</span>
                        <span>{breakdown.flightNumber}</span>
                        <span className="text-gray-600">•</span>
                        <span className="font-mono text-[10px]">{breakdown.origin} → {breakdown.destination}</span>
                      </div>
                      <div className="space-y-2 pl-2">
                        {filteredFlights.map((altFlight, altIndex) => {
                          const proximityColors = getTimeProximityColor(altFlight.departure.at);
                          const carrierName = altFlight.operatingCarrier || altFlight.carrierCode;

                          // Calculate time difference
                          const flightTime = new Date(altFlight.departure.at).getTime();
                          const originalTime = new Date(slice.departure).getTime();
                          const diffMinutes = Math.round((flightTime - originalTime) / (1000 * 60));
                          const timeDiffText = diffMinutes === 0 ? 'Same time' :
                            diffMinutes > 0 ? `+${diffMinutes}m` : `${diffMinutes}m`;

                          // Check if within tolerance (only show matches within 960 minutes)
                          const isWithinTolerance = Math.abs(diffMinutes) <= 960 && altFlight.timeComparison?.withinTolerance;

                          // Calculate duration
                          const depTime = new Date(altFlight.departure.at);
                          const arrTime = new Date(altFlight.arrival.at);
                          const durationMinutes = Math.round((arrTime.getTime() - depTime.getTime()) / (1000 * 60));
                          const durationHours = Math.floor(durationMinutes / 60);
                          const durationMins = durationMinutes % 60;

                          // Calculate mileage value - use proper per-mile calculation
                          const priceNum = typeof altFlight.mileagePrice === 'string'
                            ? parseFloat(altFlight.mileagePrice.replace(/[^0-9.]/g, ''))
                            : altFlight.mileagePrice;
                          const perMile = altFlight.mileage > 0 ? (priceNum / altFlight.mileage) : 0;

                          // Format times in AM/PM
                          const formatTime = (dateStr: string) => {
                            return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                          };

                          // Format date
                          const formatDate = (dateStr: string) => {
                            return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          };

                          return (
                            <div
                              key={altIndex}
                              className="bg-gray-800/30 hover:bg-gray-800/50 rounded-lg border transition-all duration-200 overflow-hidden"
                              style={proximityColors && isWithinTolerance ? {
                                borderColor: proximityColors.borderColor,
                                backgroundColor: proximityColors.bgColor
                              } : { borderColor: 'rgb(55, 65, 81)' }}
                            >
                              {/* Header with carrier and mileage */}
                              <div className="flex items-center justify-between px-3 py-2 bg-gray-900/30 border-b border-gray-700/50">
                                <div className="flex items-center gap-2">
                                  <img
                                    src={`https://www.gstatic.com/flights/airline_logos/35px/${altFlight.carrierCode}.png`}
                                    alt={carrierName}
                                    className="h-6 w-6 rounded"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                  <div>
                                    <div className="text-sm font-semibold text-white">{altFlight.flightNumber}</div>
                                    <div className="text-xs text-gray-400">{carrierName}</div>
                                  </div>
                                </div>

                                {/* Mileage value badge with proper calculation */}
                                <div className="flex flex-col items-end gap-1">
                                  <div className="flex items-center gap-2">
                                    <div className="bg-gradient-to-r from-orange-500/15 to-amber-500/15 border border-orange-400/40 rounded-lg px-2.5 py-1.5">
                                      <div className="flex items-baseline gap-1">
                                        <span className="text-xs font-bold text-orange-300">{altFlight.mileage.toLocaleString()}</span>
                                        <span className="text-[10px] text-orange-400/70">mi</span>
                                        <span className="text-xs text-orange-400/60">+</span>
                                        <span className="text-xs font-semibold text-orange-300">${priceNum.toFixed(2)}</span>
                                        <span className="text-[9px] text-orange-500/50 ml-0.5">@ ${perMile.toFixed(3)}/mi</span>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => setShowAddToProposal(true)}
                                      className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs rounded border border-blue-400/30 transition-colors flex items-center gap-1"
                                    >
                                      <Plus className="h-3 w-3" />
                                      Add
                                    </button>
                                  </div>
                                  <div className="text-[10px] text-gray-400">
                                    Mileage Value: ${((altFlight.mileage * 0.015) + priceNum).toFixed(2)}
                                  </div>
                                </div>
                              </div>

                              {/* Flight details */}
                              <div className="px-3 py-2.5">
                                {/* Flight route visualization */}
                                <div className="flex items-center gap-2 mb-2">
                                  {/* Departure */}
                                  <div className="flex-shrink-0">
                                    <div className="text-sm font-bold text-white">{formatTime(altFlight.departure.at)}</div>
                                    <div className="text-[10px] text-gray-400 font-mono">{altFlight.departure.iataCode}</div>
                                    <div className="text-[10px] text-gray-500">{formatDate(altFlight.departure.at)}</div>
                                  </div>

                                  {/* Route line with centered plane icon */}
                                  <div className="flex-1 flex items-center justify-center relative">
                                    <div className="absolute inset-0 flex items-center">
                                      <div className="w-full border-t-2 border-gray-600"></div>
                                    </div>
                                    <div className="relative bg-gray-900 px-2 flex items-center gap-1.5">
                                      {altFlight.numberOfStops > 0 ? (
                                        <div className="bg-orange-500/20 border border-orange-500/30 rounded px-1.5 py-0.5 text-[9px] text-orange-300">
                                          {altFlight.numberOfStops} {altFlight.numberOfStops === 1 ? 'stop' : 'stops'}
                                        </div>
                                      ) : (
                                        <div className="bg-green-500/20 border border-green-500/30 rounded px-1.5 py-0.5 text-[9px] text-green-300">
                                          Nonstop
                                        </div>
                                      )}
                                      <Plane className="h-3 w-3 text-gray-400" />
                                      <div className="text-[10px] text-gray-400">
                                        <Clock className="h-2 w-2 inline mr-0.5" />
                                        {durationHours}h{durationMins}m
                                      </div>
                                    </div>
                                  </div>

                                  {/* Arrival */}
                                  <div className="flex-shrink-0 text-right">
                                    <div className="text-sm font-bold text-white">{formatTime(altFlight.arrival.at)}</div>
                                    <div className="text-[10px] text-gray-400 font-mono">{altFlight.arrival.iataCode}</div>
                                    <div className="text-[10px] text-gray-500">{formatDate(altFlight.arrival.at)}</div>
                                  </div>
                                </div>

                                {/* Match badges - only show if within tolerance */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {isWithinTolerance && altFlight.exactMatch && altFlight.carrierMatch && altFlight.routeMatch && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded font-medium border border-green-500/30">
                                      Match Type: Exact
                                    </span>
                                  )}
                                  {isWithinTolerance && !altFlight.exactMatch && altFlight.carrierMatch && altFlight.routeMatch && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded font-medium border border-blue-500/30">
                                      Match Type: Carrier
                                    </span>
                                  )}
                                  {isWithinTolerance && altFlight.routeMatch && !altFlight.carrierMatch && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] rounded font-medium border border-yellow-500/30">
                                      Match Type: Route
                                    </span>
                                  )}
                                  {isWithinTolerance && !altFlight.routeMatch && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-500/20 text-gray-400 text-[10px] rounded font-medium border border-gray-500/30">
                                      Match Type: Time
                                    </span>
                                  )}
                                  {isWithinTolerance && Math.abs(diffMinutes) <= 960 && (
                                    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] rounded font-medium border ${
                                      Math.abs(diffMinutes) <= 120 ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                                      Math.abs(diffMinutes) <= 480 ? 'bg-green-500/15 text-green-400 border-green-500/25' :
                                      'bg-green-500/10 text-green-400 border-green-500/20'
                                    }`}>
                                      Time Difference: {timeDiffText}
                                    </span>
                                  )}
                                  {altFlight.cabin && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-700/50 text-gray-300 text-[10px] rounded font-medium">
                                      {altFlight.cabin}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    )
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>


      {/* Add to Proposal Modal */}
      {showAddToProposal && (
        <AddToProposalModal
          flight={flight}
          onClose={() => setShowAddToProposal(false)}
        />
      )}

    </div>
  );
};

export default FlightCard;