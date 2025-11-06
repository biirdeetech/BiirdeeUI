import React, { useState } from 'react';
import { Plane, Clock, ChevronDown, Target, Plus } from 'lucide-react';
import { FlightSolution, GroupedFlight, MileageDeal } from '../types/flight';
import { PREMIUM_CARRIERS } from '../utils/fareClasses';
import ITAMatrixService from '../services/itaMatrixApi';
import AddToProposalModal from './AddToProposalModal';
import MileageDealsDropdown from './MileageDealsDropdown';
import MileageDealModal from './MileageDealModal';

interface FlightCardProps {
  flight: FlightSolution | GroupedFlight;
}

const FlightCard: React.FC<FlightCardProps> = ({ flight }) => {
  // Check if this is a grouped flight (round-trip with multiple return options)
  const isGroupedFlight = 'outboundSlice' in flight;
  const [selectedReturnIndex, setSelectedReturnIndex] = useState(0);
  const [showReturnDropdown, setShowReturnDropdown] = useState(false);
  const [showAddToProposal, setShowAddToProposal] = useState(false);
  const [selectedMileageDeal, setSelectedMileageDeal] = useState<MileageDeal | null>(null);
  const [showMileageDealModal, setShowMileageDealModal] = useState(false);
  const [expandedSlices, setExpandedSlices] = useState<Record<number, boolean>>({});

  const handleSelectMileageDeal = (deal: MileageDeal) => {
    setSelectedMileageDeal(deal);
    setShowMileageDealModal(true);
  };

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

  const { slices, carrier, isNonstop, totalAmount, displayTotal, pricePerMile, hasMultipleReturns, flightId, totalMileage, totalMileagePrice, matchType, mileageDeals, fullyEnriched } = getFlightData();
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  const openHacksPage = () => {
    const firstSlice = slices[0];
    const solutionId = flightId || (isGroupedFlight && (flight as GroupedFlight).returnOptions[selectedReturnIndex]?.originalFlightId);
    
    const params = new URLSearchParams({
      origin: firstSlice.origin.code,
      destination: firstSlice.destination.code,
      departDate: firstSlice.departure.split('T')[0],
      cabin: slices[0].cabins[0] || 'BUSINESS',
      price: formatPrice(displayTotal)
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              isPremium ? 'bg-accent-600 text-white' : 'bg-gray-600 text-white'
            }`}>
              {carrier.code}
            </div>
            <span className="font-semibold text-white">{carrier.shortName}</span>
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
          <div className="flex flex-col items-end gap-2">
            {/* Price Display - Right Aligned with Mileage on Left */}
            <div className="flex items-baseline gap-3">
              {/* Mileage Info - Left Side */}
              {totalMileage > 0 && (
                <div>
                  {mileageDeals && mileageDeals.length === 1 ? (
                    <button
                      onClick={() => handleSelectMileageDeal(mileageDeals[0])}
                      className="px-2 py-1 bg-accent-500/30 text-accent-300 text-xs font-medium rounded hover:bg-accent-500/40 transition-colors whitespace-nowrap"
                    >
                      {totalMileage.toLocaleString()} miles
                      {totalMileagePrice > 0 && ` + $${totalMileagePrice.toFixed(2)}`}
                    </button>
                  ) : (
                    <div className="px-2 py-1 bg-accent-500/30 text-accent-300 text-xs font-medium rounded whitespace-nowrap">
                      {totalMileage.toLocaleString()} miles
                      {totalMileagePrice > 0 && ` + $${totalMileagePrice.toFixed(2)}`}
                    </div>
                  )}
                </div>
              )}

              {/* Price Per Mile */}
              <div className="text-xs text-gray-400">
                ${formatPricePerMile(pricePerMile)}/mi
              </div>

              {/* Total Price */}
              <div className="text-xl font-medium text-neutral-100">
                {formatPrice(displayTotal)}
              </div>
            </div>

            {/* Action Buttons - Match badges on left, buttons on right */}
            <div className="flex items-center gap-2">
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
                                {formatPrice(returnOption.displayTotal)}
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
                <div className="text-center">
                  <div className="text-base sm:text-lg lg:text-xl font-semibold text-white">
                    {formatTime(slice.departure)}
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatDate(slice.departure)}
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-gray-200">{slice.origin.code}</div>
                  <div className="text-xs text-gray-400 hidden lg:block">{slice.origin.name}</div>
                </div>
                
                <div className="flex-1 px-1 sm:px-2 lg:px-4">
                  <div className="flex items-center gap-2 text-gray-300">
                    <div className="flex-1 border-t-2 border-gray-600"></div>
                    <Plane className="h-2.5 w-2.5 lg:h-3 lg:w-3" />
                    <div className="flex-1 border-t-2 border-gray-600"></div>
                  </div>
                  <div className="text-center text-xs lg:text-sm font-medium text-gray-200 mt-1 lg:mt-2">
                    <Clock className="h-2.5 w-2.5 lg:h-3 lg:w-3 inline mr-1" />
                    {formatDuration(slice.duration)}
                  </div>
                  {slice.stops && slice.stops.length > 0 && (
                    <div className="text-center text-xs text-gray-400 mt-1 hidden lg:block">
                      Stop: {slice.stops.map(stop => stop.code).join(', ')}
                    </div>
                  )}
                </div>
                
                <div className="text-center">
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
                  <div className="text-xs sm:text-sm font-medium text-gray-200">{slice.destination.code}</div>
                  <div className="text-xs text-gray-400 hidden lg:block">{slice.destination.name}</div>
                </div>
              </div>
            </div>

            {/* Slice Details */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between text-xs lg:text-sm text-gray-300 mb-3 lg:mb-4 gap-2 lg:gap-4">
              <div className="flex flex-wrap items-center gap-2 lg:gap-4">
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 font-medium">Flights:</span>
                  <div className="flex gap-1 lg:gap-2 flex-wrap">
                    {slice.flights.map((flight, idx) => (
                      <span key={idx} className="font-mono bg-gray-700 px-1.5 lg:px-2 py-0.5 lg:py-1 rounded text-white font-medium text-xs">
                        {flight}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 font-medium">Class:</span>
                  <div className="flex gap-1 flex-wrap">
                    {slice.cabins.map((cabin, idx) => (
                      <span key={idx} className="bg-accent-500/20 text-accent-300 px-1.5 lg:px-2 py-0.5 lg:py-1 rounded text-xs lg:text-sm font-medium">
                        {cabin}
                      </span>
                    ))}
                  </div>
                </div>
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
                          className="bg-purple-500/20 text-purple-300 px-1.5 lg:px-2 py-0.5 lg:py-1 rounded text-xs lg:text-sm font-medium hover:bg-purple-500/30 transition-colors flex items-center gap-1"
                        >
                          {slice.mileage.toLocaleString()} miles + {formatMileagePrice(slice.mileagePrice || 0)}
                          <ChevronDown className={`h-3 w-3 transition-transform ${expandedSlices[sliceIndex] ? 'rotate-180' : ''}`} />
                        </button>
                      ) : (
                        <span className="bg-purple-500/20 text-purple-300 px-1.5 lg:px-2 py-0.5 lg:py-1 rounded text-xs lg:text-sm font-medium">
                          {slice.mileage.toLocaleString()} miles + {formatMileagePrice(slice.mileagePrice || 0)}
                        </span>
                      )}
                    </div>
                    {(() => {
                      const programCount = countMileagePrograms(slice.mileageBreakdown);
                      return programCount > 0 && (
                        <span className="text-xs text-gray-400 bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700">
                          {programCount} {programCount === 1 ? 'program' : 'programs'} available
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Expanded Mileage Alternatives */}
            {expandedSlices[sliceIndex] && slice.mileageBreakdown && (
              <div className="mt-3 space-y-2 bg-gray-900/50 p-3 rounded border border-gray-700">
                <div className="text-xs font-medium text-purple-300 mb-2">Alternative Mileage Booking Options:</div>
                {slice.mileageBreakdown.map((breakdown, bdIndex) => (
                  breakdown.allMatchingFlights && breakdown.allMatchingFlights.length > 0 && (
                    <div key={bdIndex} className="space-y-1.5">
                      <div className="text-xs text-gray-400 font-medium">
                        ITA Segment: {breakdown.flightNumber} ({breakdown.origin} → {breakdown.destination})
                      </div>
                      <div className="space-y-1.5 pl-2">
                        {breakdown.allMatchingFlights.map((altFlight, altIndex) => {
                          const carrierName = altFlight.operatingCarrier || altFlight.carrierCode;
                          return (
                            <button
                              key={altIndex}
                              className="w-full flex items-center justify-between text-xs bg-gray-800/70 hover:bg-gray-700/70 px-3 py-2 rounded transition-colors group border border-gray-700 hover:border-purple-500/50"
                            >
                              <div className="flex items-center gap-2 flex-1">
                                <div className="flex flex-col items-start">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-purple-300 font-medium">{altFlight.flightNumber}</span>
                                    <span className="text-gray-500">•</span>
                                    <span className="text-gray-300">Book via {carrierName}</span>
                                  </div>
                                  <div className="text-[10px] text-gray-400 mt-0.5">
                                    {new Date(altFlight.departure.at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    {' → '}
                                    {new Date(altFlight.arrival.at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    {altFlight.exactMatch && <span className="text-green-400 ml-2">✓ Exact Match</span>}
                                    {altFlight.carrierMatch && !altFlight.exactMatch && <span className="text-blue-400 ml-2">Carrier Match</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col items-end">
                                <div className="text-purple-300 font-semibold whitespace-nowrap">
                                  {altFlight.mileage.toLocaleString()} miles
                                </div>
                                <div className="text-[10px] text-gray-400">
                                  + {formatMileagePrice(altFlight.mileagePrice)}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Multiple Mileage Deals Dropdown (bottom left after flight details) */}
      {mileageDeals && mileageDeals.length > 1 && (
        <div className="px-3 sm:px-4 lg:px-6 pb-4">
          <MileageDealsDropdown
            deals={mileageDeals}
            onSelectDeal={handleSelectMileageDeal}
          />
        </div>
      )}

      {/* Add to Proposal Modal */}
      {showAddToProposal && (
        <AddToProposalModal
          flight={flight}
          onClose={() => setShowAddToProposal(false)}
        />
      )}

      {/* Mileage Deal Modal */}
      <MileageDealModal
        deal={selectedMileageDeal}
        isOpen={showMileageDealModal}
        onClose={() => {
          setShowMileageDealModal(false);
          setSelectedMileageDeal(null);
        }}
      />
    </div>
  );
};

export default FlightCard;