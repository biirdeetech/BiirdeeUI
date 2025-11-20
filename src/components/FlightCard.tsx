import React, { useState } from 'react';
import { Plane, Clock, ChevronDown, Target, Plus, ChevronRight, Zap } from 'lucide-react';
import { FlightSolution, GroupedFlight, MileageDeal } from '../types/flight';
import { PREMIUM_CARRIERS } from '../utils/fareClasses';
import ITAMatrixService from '../services/itaMatrixApi';
import AddToProposalModal from './AddToProposalModal';
import MileageDealsDropdown from './MileageDealsDropdown';
import FlightSegmentDetails from './FlightSegmentDetails';
import { calculateBestMileageForTrip } from '../utils/mileageCalculator';
import MileageCalculationModal from './MileageCalculationModal';

interface FlightCardProps {
  flight: FlightSolution | GroupedFlight;
  originTimezone?: string;
  perCentValue?: number;
}

// Helper to group similar mileage flights for cleaner display
const groupMileageFlights = (flights: any[]) => {
  const groups = new Map<string, any[]>();

  flights.forEach((flight) => {
    const route = `${flight.departure.iataCode}-${flight.arrival.iataCode}`;
    const depTime = new Date(flight.departure.at).toISOString().slice(11, 16); // HH:MM
    const arrTime = new Date(flight.arrival.at).toISOString().slice(11, 16);
    const layovers = flight.segments?.map((s: any) => s.arrival?.iataCode).filter((code: string, idx: number, arr: string[]) => idx < arr.length - 1).join(',') || '';

    // Primary grouping: same route + same times + same layovers = different carriers
    const timeRouteKey = `${route}|${depTime}|${arrTime}|${layovers}`;

    if (!groups.has(timeRouteKey)) {
      groups.set(timeRouteKey, []);
    }
    groups.get(timeRouteKey)!.push(flight);
  });

  // Convert to grouped structure with sub-grouping
  return Array.from(groups.values()).map(groupFlights => {
    if (groupFlights.length === 1) {
      return {
        primary: groupFlights[0],
        alternativeTimes: [],
        alternativeCarriers: []
      };
    }

    // Check if same flight number (time alternatives) or different flight numbers (carrier alternatives)
    const sameFlightNum = groupFlights.every(f => f.flightNumber === groupFlights[0].flightNumber);

    if (sameFlightNum) {
      // Time alternatives - same flight at different departure times
      groupFlights.sort((a, b) =>
        new Date(a.departure.at).getTime() - new Date(b.departure.at).getTime()
      );
      return {
        primary: groupFlights[0],
        alternativeTimes: groupFlights.slice(1),
        alternativeCarriers: []
      };
    } else {
      // Carrier alternatives - different flights at same time/route
      // Prefer lower flight number or carrier code
      groupFlights.sort((a, b) => {
        const aNum = parseInt(a.flightNumber?.replace(/\D/g, '') || '9999');
        const bNum = parseInt(b.flightNumber?.replace(/\D/g, '') || '9999');
        return aNum - bNum;
      });
      return {
        primary: groupFlights[0],
        alternativeTimes: [],
        alternativeCarriers: groupFlights.slice(1)
      };
    }
  });
};

// Helper to group mileage options by cabin and find best value per cabin
const groupMileageByCabin = (slices: any[], perCentValue: number) => {
  const cabinGroups = new Map<string, { mileage: number; price: number; totalValue: number }>();

  slices.forEach((slice: any) => {
    if (slice.mileageBreakdown && Array.isArray(slice.mileageBreakdown)) {
      slice.mileageBreakdown.forEach((breakdown: any) => {
        if (breakdown.allMatchingFlights && Array.isArray(breakdown.allMatchingFlights)) {
          breakdown.allMatchingFlights.forEach((flight: any) => {
            const cabin = flight.cabin || 'UNKNOWN';
            const mileage = flight.mileage || 0;

            // Parse price (handle AUD/USD/etc)
            let price = 0;
            const priceStr = flight.mileagePrice || '0';
            if (typeof priceStr === 'string') {
              const cleaned = priceStr.replace(/[A-Z]+\s*/g, '').trim();
              price = parseFloat(cleaned) || 0;
              // Simple currency conversion (AUD to USD approximation)
              if (priceStr.includes('AUD')) {
                price = price * 0.65;
              }
            } else {
              price = priceStr;
            }

            const totalValue = (mileage * perCentValue) + price;

            // Keep only the best (lowest) value for each cabin
            const existing = cabinGroups.get(cabin);
            if (!existing || totalValue < existing.totalValue) {
              cabinGroups.set(cabin, { mileage, price, totalValue });
            }
          });
        }
      });
    }
  });

  return Array.from(cabinGroups.entries()).map(([cabin, data]) => ({
    cabin,
    ...data
  }));
};

const FlightCard: React.FC<FlightCardProps> = ({ flight, originTimezone, perCentValue = 0.015 }) => {
  // Helper function to format times in origin timezone
  const formatTimeInOriginTZ = (dateStr: string, options?: Intl.DateTimeFormatOptions) => {
    const date = new Date(dateStr);
    const defaultOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      ...(originTimezone && { timeZone: originTimezone }),
      ...options
    };
    return date.toLocaleTimeString('en-US', defaultOptions);
  };

  const formatDateInOriginTZ = (dateStr: string) => {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      ...(originTimezone && { timeZone: originTimezone })
    };
    return date.toLocaleDateString('en-US', options);
  };

  // Check if this is a grouped flight (round-trip with multiple return options)
  const isGroupedFlight = 'outboundSlice' in flight;
  const [selectedReturnIndex, setSelectedReturnIndex] = useState(0);
  const [showReturnDropdown, setShowReturnDropdown] = useState(false);
  const [showAddToProposal, setShowAddToProposal] = useState(false);
  const [selectedMileageFlight, setSelectedMileageFlight] = useState<any>(null);
  const [expandedSlices, setExpandedSlices] = useState<Record<number, boolean>>({});
  const [expandedSliceAirlines, setExpandedSliceAirlines] = useState<Record<string, boolean>>({});
  const [expandedSegments, setExpandedSegments] = useState<Record<number, boolean>>({});
  const [sliceAlternativeTabs, setSliceAlternativeTabs] = useState<Record<string, 'best-match' | 'time-insensitive'>>({});
  const [showAlternativeTimes, setShowAlternativeTimes] = useState<Record<string, boolean>>({});
  const [showMileageDropdown, setShowMileageDropdown] = useState<Record<number, boolean>>({});
  const [showMileageCalculation, setShowMileageCalculation] = useState(false);


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

  interface GroupedMileageProgram {
    carrierCode: string;
    carrierName: string;
    totalMileage: number;
    totalPrice: number;
    matchType: 'exact' | 'partial' | 'mixed';
    flights: any[];
    segmentCount: number;
  }

  const groupMileageByProgram = (breakdown?: any[]): GroupedMileageProgram[] => {
    if (!breakdown || breakdown.length === 0) return [];

    // Collect all flights from all segments and group by carrier
    const programMap = new Map<string, any[]>();

    breakdown.forEach(segment => {
      if (!segment.allMatchingFlights || segment.allMatchingFlights.length === 0) return;

      segment.allMatchingFlights.forEach((flight: any) => {
        const carrierCode = flight.operatingCarrier || flight.carrierCode;
        if (!carrierCode) return;

        if (!programMap.has(carrierCode)) {
          programMap.set(carrierCode, []);
        }
        programMap.get(carrierCode)!.push(flight);
      });
    });

    // For each carrier, find the cheapest combination across all segments
    const result: GroupedMileageProgram[] = [];

    programMap.forEach((flights, carrierCode) => {
      // Deduplicate codeshare flights (same route, departure, arrival, mileage)
      const uniqueFlights = new Map<string, any>();
      flights.forEach((flight: any) => {
        const key = `${flight.departure?.iataCode}-${flight.arrival?.iataCode}-${flight.departure?.at}-${flight.arrival?.at}-${flight.mileage}`;
        if (!uniqueFlights.has(key) ||
            (flight.flightNumber && uniqueFlights.get(key)?.flightNumber > flight.flightNumber)) {
          uniqueFlights.set(key, flight);
        }
      });

      // Sort all unique flights for this carrier by value (cheapest first)
      const sortedFlights = Array.from(uniqueFlights.values()).sort((a: any, b: any) => {
        const aPrice = typeof a.mileagePrice === 'string'
          ? parseFloat(a.mileagePrice.replace(/[^0-9.]/g, ''))
          : (a.mileagePrice || 0);
        const bPrice = typeof b.mileagePrice === 'string'
          ? parseFloat(b.mileagePrice.replace(/[^0-9.]/g, ''))
          : (b.mileagePrice || 0);
        const aValue = (a.mileage || 0) + (aPrice * 100);
        const bValue = (b.mileage || 0) + (bPrice * 100);
        return aValue - bValue;
      });

      // Take the cheapest option (or sum if multiple segments)
      let totalMileage = 0;
      let totalPrice = 0;
      let allExactMatch = true;
      let anyExactMatch = false;
      const carrierName = sortedFlights[0].operatingCarrier || carrierCode;

      sortedFlights.forEach((flight: any) => {
        const price = typeof flight.mileagePrice === 'string'
          ? parseFloat(flight.mileagePrice.replace(/[^0-9.]/g, ''))
          : (flight.mileagePrice || 0);

        totalMileage += flight.mileage || 0;
        totalPrice += price;

        if (flight.exactMatch) {
          anyExactMatch = true;
        } else {
          allExactMatch = false;
        }
      });

      result.push({
        carrierCode,
        carrierName,
        totalMileage,
        totalPrice,
        matchType: allExactMatch ? 'exact' : anyExactMatch ? 'mixed' : 'partial',
        flights: sortedFlights,
        segmentCount: sortedFlights.length
      });
    });

    // Sort programs by best value
    result.sort((a, b) => {
      const aValue = a.totalMileage + (a.totalPrice * 100);
      const bValue = b.totalMileage + (b.totalPrice * 100);
      return aValue - bValue;
    });

    return result;
  };

  // Use timezone-aware formatting for main flight display
  const formatTime = (dateTime: string) => {
    if (!dateTime) return 'N/A';
    return formatTimeInOriginTZ(dateTime);
  };

  const formatDate = (dateTime: string) => {
    if (!dateTime) return 'N/A';
    return formatDateInOriginTZ(dateTime);
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
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2">
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
                Premium Carrier
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
            {/* Cheapest Mileage Badge - Show for exact match */}
            {matchType === 'exact' && (() => {
              const cabinMileageOptions = groupMileageByCabin(slices, perCentValue);
              if (cabinMileageOptions.length === 0) return null;

              // Find cheapest option
              const cheapest = cabinMileageOptions.reduce((min, opt) =>
                opt.totalValue < min.totalValue ? opt : min
              , cabinMileageOptions[0]);

              return (
                <div className="px-2 py-1 bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-400/40 text-orange-300 text-xs font-medium rounded flex items-center gap-1.5">
                  <span className="text-[10px] uppercase opacity-70">{cheapest.cabin}:</span>
                  <span className="font-bold">{cheapest.mileage.toLocaleString()}</span>
                  <span className="text-[10px]">mi</span>
                  {cheapest.price > 0 && (
                    <>
                      <span className="text-[10px]">+</span>
                      <span className="font-semibold">${cheapest.price.toFixed(2)}</span>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end w-full lg:w-auto h-7">
            {/* Price Per Mile */}
            <div className="text-xs text-gray-400 flex items-center h-full">
              ${formatPricePerMile(pricePerMile)}/mi
            </div>

            {/* Total Price */}
            {(() => {
              // Use new intelligent mileage calculator
              const bestMileageResult = calculateBestMileageForTrip(slices, perCentValue);
              const bestMileageValue = bestMileageResult?.totalValue || null;

              // Parse cash price
              const cashPrice = typeof displayTotal === 'string'
                ? parseFloat(displayTotal.replace(/[^0-9.]/g, ''))
                : displayTotal;

              // Show strike-through if mileage is significantly cheaper (more than 10% savings)
              const showStrikeThrough = bestMileageValue && bestMileageValue < cashPrice * 0.90;

              return (
                <div className="flex flex-col items-end gap-1 h-full">
                  {slices.length === 2 && (
                    <div className="text-xs text-gray-400 font-medium">Total Price</div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className={`text-xl font-medium flex items-center ${showStrikeThrough ? 'text-red-400 relative' : 'text-neutral-100'}`}>
                      {formatPrice(displayTotal, currency)}
                      {showStrikeThrough && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-full h-0.5 bg-red-500 transform rotate-[20deg]"></div>
                        </div>
                      )}
                    </div>
                    {showStrikeThrough && bestMileageResult && (
                      <button
                        onClick={() => setShowMileageCalculation(true)}
                        className="text-sm font-bold text-green-400 hover:text-green-300 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
                        title={`Click to see breakdown\nStrategy: ${bestMileageResult.strategy}\nSegments: ${bestMileageResult.segments.length}`}
                      >
                        ${bestMileageResult.totalValue.toFixed(2)}
                        <span className="text-xs font-normal">mileage</span>
                        {bestMileageResult.strategy === 'pieced' && (
                          <span className="text-[10px] opacity-70">(pieced)</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="mt-3 flex flex-wrap items-center gap-2 justify-end">
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

      {/* Flight Details - Multiple Slices */}
      <div className="px-3 sm:px-4 lg:px-6 py-4">
        {slices.map((slice, sliceIndex) => (
          <div key={sliceIndex} className={sliceIndex > 0 ? 'border-t border-gray-700 pt-3 lg:pt-4 mt-3 lg:mt-4' : ''}>
            {/* Slice Label */}
            <div className="flex items-center gap-2 mb-2 lg:mb-3">
              {getSliceLabel(sliceIndex) && (
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium text-accent-400">
                    {getSliceLabel(sliceIndex)}
                  </div>
                  {slices.length === 2 && (
                    <div className="text-sm font-semibold text-gray-300">
                      {formatPrice(displayTotal / 2, currency)}
                    </div>
                  )}
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
                  {/* Departure flight number - only show for connecting flights */}
                  {(!slice.stops || slice.stops.length > 0) && slice.flights && slice.flights.length > 0 && slice.flights[0] && (
                    <div className="text-[10px] text-gray-500 mt-0.5 font-mono">
                      {slice.flights[0]}
                    </div>
                  )}
                </div>

                <div className="flex-1 px-1 sm:px-2 lg:px-4">
                  {(() => {
                    const isNonstop = !slice.stops || slice.stops.length === 0;

                    if (isNonstop) {
                      // Nonstop flight - only show carrier if different from main carrier in header
                      const firstSegment = slice.segments?.[0];
                      const carrierCode = firstSegment?.carrier?.code;
                      const flightNumber = slice.flights?.[0];

                      // Check if this carrier/flight is same as shown in header (redundant)
                      const isRedundant = carrierCode === carrier.code && flightNumber === slices[0].flights?.[0];

                      return (
                        <>
                          <div className="flex items-center gap-1 relative">
                            <div className="flex-1 border-t-2 border-emerald-500/40"></div>
                            <Plane className="h-3 w-3 text-emerald-400" />
                            <div className="flex-1 border-t-2 border-emerald-500/40"></div>
                          </div>

                          {/* Carrier and flight number in center - hide if redundant with header */}
                          <div className="flex flex-col items-center gap-1 mt-2">
                            {!isRedundant && carrierCode && (
                              <div className="flex items-center gap-1.5">
                                <img
                                  src={`https://www.gstatic.com/flights/airline_logos/35px/${carrierCode}.png`}
                                  alt={carrierCode}
                                  className="h-4 w-4 object-contain"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                                {flightNumber && (
                                  <span className="text-xs text-gray-400 font-mono">{flightNumber}</span>
                                )}
                              </div>
                            )}
                            {/* Duration */}
                            <div className="text-xs lg:text-sm font-medium text-gray-200 flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5 lg:h-3 lg:w-3" />
                              {formatDuration(slice.duration)}
                            </div>
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
                  {/* Arrival flight number - last segment - only show for connecting flights */}
                  {(!slice.stops || slice.stops.length > 0) && slice.flights && slice.flights.length > 0 && slice.flights[slice.flights.length - 1] && (
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
                {/* View Segments Button */}
                {slice.segments && slice.segments.length > 1 && (
                  <button
                    onClick={() => {
                      const isCurrentlyExpanded = expandedSegments[sliceIndex];
                      // Close all mileage containers and segments
                      setExpandedSliceAirlines({});
                      setExpandedSegments({});
                      // Toggle current one
                      if (!isCurrentlyExpanded) {
                        setExpandedSegments({ [sliceIndex]: true });
                      }
                    }}
                    className="flex items-center gap-1 px-2 py-1 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white text-xs rounded transition-colors"
                  >
                    <Plane className="h-3 w-3" />
                    <span>{expandedSegments[sliceIndex] ? 'Hide' : 'View'} Segments ({slice.segments.length})</span>
                    <ChevronDown className={`h-3 w-3 transition-transform ${expandedSegments[sliceIndex] ? 'rotate-180' : ''}`} />
                  </button>
                )}
                {slice.segments && slice.segments.length > 0 && slice.segments[0].pricings && slice.segments[0].pricings.length > 0 && slice.segments[0].pricings[0].bookingClass && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400 font-medium">Booking:</span>
                    <span className="font-mono bg-gray-700 px-1.5 lg:px-2 py-0.5 lg:py-1 rounded text-white font-medium text-xs">
                      {slice.segments[0].pricings[0].bookingClass}
                    </span>
                  </div>
                )}
                {slice.mileageBreakdown && slice.mileageBreakdown.some(mb => mb.allMatchingFlights && mb.allMatchingFlights.length > 0) && (() => {
                  const groupedPrograms = groupMileageByProgram(slice.mileageBreakdown);
                  const anyExpanded = groupedPrograms.some(p => expandedSliceAirlines[`${sliceIndex}-${p.carrierCode}`]);
                  const expandedProgram = groupedPrograms.find(p => expandedSliceAirlines[`${sliceIndex}-${p.carrierCode}`]);
                  const isDropdownOpen = showMileageDropdown[sliceIndex] || false;

                  return groupedPrograms.length > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => {
                          setShowMileageDropdown(prev => ({ ...prev, [sliceIndex]: !isDropdownOpen }));
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-purple-900/20 hover:bg-purple-900/30 border border-purple-500/30 rounded-lg transition-colors text-sm"
                      >
                        <span className="text-gray-300 font-medium">Mile Programs Available ({groupedPrograms?.length || '0'})</span>
                        {expandedProgram && (
                          <>
                            <span className="text-gray-500">-</span>
                            <img
                              src={`https://www.gstatic.com/flights/airline_logos/35px/${expandedProgram.carrierCode}.png`}
                              alt={expandedProgram.carrierCode}
                              className="h-4 w-4 object-contain"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                            <span className={`font-semibold ${
                              expandedProgram.matchType === 'exact' ? 'text-green-400' :
                              expandedProgram.matchType === 'partial' ? 'text-purple-300' : 'text-blue-300'
                            }`}>
                              {expandedProgram.carrierCode}
                            </span>
                          </>
                        )}
                        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isDropdownOpen && (
                        <div className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 min-w-[200px]">
                          {groupedPrograms.map((program) => {
                            const airlineKey = `${sliceIndex}-${program.carrierCode}`;
                            const isSelected = expandedSliceAirlines[airlineKey];
                            return (
                              <button
                                key={program.carrierCode}
                                onClick={() => {
                                  setExpandedSliceAirlines({});
                                  setExpandedSegments({});
                                  setExpandedSliceAirlines({ [airlineKey]: true });
                                  setShowMileageDropdown(prev => ({ ...prev, [sliceIndex]: false }));
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                                  isSelected ? 'bg-gray-700' : ''
                                }`}
                              >
                                <img
                                  src={`https://www.gstatic.com/flights/airline_logos/35px/${program.carrierCode}.png`}
                                  alt={program.carrierCode}
                                  className="h-4 w-4 object-contain"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                                <span className={`font-semibold ${
                                  program.matchType === 'exact' ? 'text-green-400' :
                                  program.matchType === 'partial' ? 'text-purple-300' : 'text-blue-300'
                                }`}>
                                  {program.carrierCode}
                                </span>
                                <span className="text-gray-300">{program.totalMileage.toLocaleString()}</span>
                                {program.totalPrice > 0 && (
                                  <span className="text-gray-400 text-xs">+ ${program.totalPrice.toFixed(2)}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Expanded Segment Details */}
            {expandedSegments[sliceIndex] && slice.segments && slice.segments.length > 0 && (
              <div className="mb-4 border border-blue-500/20 bg-blue-500/5 rounded-lg p-4">
                <div className="text-xs font-semibold text-blue-400 mb-3 flex items-center gap-2">
                  <Plane className="h-3 w-3" />
                  Flight Segments
                </div>
                <FlightSegmentDetails slice={slice} originTimezone={originTimezone} />
              </div>
            )}

            {/* Expanded Mileage Alternatives - Per Airline */}
            {slice.mileageBreakdown && (() => {
              const groupedPrograms = groupMileageByProgram(slice.mileageBreakdown);

              return groupedPrograms.map((program) => {
                const airlineKey = `${sliceIndex}-${program.carrierCode}`;
                if (!expandedSliceAirlines[airlineKey]) {
                  return null;
                }

                // Get flights for THIS airline only
                const allFlights: any[] = [];
                slice.mileageBreakdown.forEach(breakdown => {
                  if (breakdown.allMatchingFlights) {
                    breakdown.allMatchingFlights.forEach((flight: any) => {
                      // Filter by carrier code
                      if (flight.carrierCode === program.carrierCode) {
                        allFlights.push(flight);
                      }
                    });
                  }
                });

              if (allFlights.length === 0) {
                return null;
              }

              // Sort by time proximity
              const originalTime = new Date(slice.departure).getTime();
              const sortedFlights = allFlights.sort((a, b) => {
                const aTime = new Date(a.departure.at).getTime();
                const bTime = new Date(b.departure.at).getTime();
                const aDiff = Math.abs(aTime - originalTime);
                const bDiff = Math.abs(bTime - originalTime);
                return aDiff - bDiff;
              });

              // Filter by time proximity
              let activeTab = sliceAlternativeTabs[airlineKey] || 'best-match';
              const bestMatchFlights = sortedFlights.filter(f => {
                const flightTime = new Date(f.departure.at).getTime();
                const diffMinutes = Math.abs((flightTime - originalTime) / (1000 * 60));
                return diffMinutes <= 300;
              });
              const timeInsensitiveFlights = sortedFlights.filter(f => {
                const flightTime = new Date(f.departure.at).getTime();
                const diffMinutes = Math.abs((flightTime - originalTime) / (1000 * 60));
                return diffMinutes > 300;
              });

              // Auto-switch tabs if empty
              if (activeTab === 'best-match' && bestMatchFlights.length === 0 && timeInsensitiveFlights.length > 0) {
                activeTab = 'time-insensitive';
              } else if (activeTab === 'time-insensitive' && timeInsensitiveFlights.length === 0 && bestMatchFlights.length > 0) {
                activeTab = 'best-match';
              }

              const filteredFlights = activeTab === 'best-match' ? bestMatchFlights : timeInsensitiveFlights;

                return (
                  <div key={airlineKey} className="mt-3 bg-purple-900/10 p-3 rounded border border-purple-500/20">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <img
                          src={`https://www.gstatic.com/flights/airline_logos/35px/${program.carrierCode}.png`}
                          alt={program.carrierCode}
                          className="h-5 w-5 object-contain"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        <span className="text-sm font-semibold text-white">{program.carrierCode} Mileage Options</span>
                        <span className="text-xs text-gray-400">({sortedFlights.length} flights)</span>
                      </div>
                      <button
                        onClick={() => {
                          setExpandedSliceAirlines(prev => {
                            const newState = { ...prev };
                            delete newState[airlineKey];
                            return newState;
                          });
                        }}
                        className="text-xs text-gray-400 hover:text-gray-300 transition-colors px-2 py-1 hover:bg-gray-800/50 rounded"
                      >
                        Collapse
                      </button>
                    </div>

                  {/* Tabs */}
                  <div className="flex border-b border-gray-700/50 bg-gray-800/30 rounded-t-lg overflow-hidden mb-3">
                    <button
                      onClick={() => bestMatchFlights.length > 0 && setSliceAlternativeTabs({...sliceAlternativeTabs, [airlineKey]: 'best-match'})}
                      disabled={bestMatchFlights.length === 0}
                      className={`flex-1 px-3 py-2 text-xs font-medium transition-all relative ${
                        bestMatchFlights.length === 0
                          ? 'text-gray-600 cursor-not-allowed opacity-50'
                          : (sliceAlternativeTabs[airlineKey] || 'best-match') === 'best-match'
                          ? 'text-green-400 bg-gray-800/50'
                          : 'text-gray-400 hover:text-gray-300 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <Zap className="h-3 w-3" />
                        <span>Within 5hr</span>
                        <span className="text-[10px]">({bestMatchFlights.length})</span>
                      </div>
                      {(sliceAlternativeTabs[airlineKey] || 'best-match') === 'best-match' && bestMatchFlights.length > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500" />
                      )}
                    </button>
                    <button
                      onClick={() => timeInsensitiveFlights.length > 0 && setSliceAlternativeTabs({...sliceAlternativeTabs, [airlineKey]: 'time-insensitive'})}
                      disabled={timeInsensitiveFlights.length === 0}
                      className={`flex-1 px-3 py-2 text-xs font-medium transition-all relative ${
                        timeInsensitiveFlights.length === 0
                          ? 'text-gray-600 cursor-not-allowed opacity-50'
                          : sliceAlternativeTabs[airlineKey] === 'time-insensitive'
                          ? 'text-blue-400 bg-gray-800/50'
                          : 'text-gray-400 hover:text-gray-300 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        <span>5hr+</span>
                        <span className="text-[10px]">({timeInsensitiveFlights.length})</span>
                      </div>
                      {sliceAlternativeTabs[airlineKey] === 'time-insensitive' && timeInsensitiveFlights.length > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                      )}
                    </button>
                  </div>

                  {/* Flight List */}
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {filteredFlights.length === 0 ? (
                      <div className="text-center py-6 text-gray-500 text-sm">No flights in this time range</div>
                    ) : (
                      groupMileageFlights(filteredFlights.slice(0, 15)).map((group, groupIndex) => {
                        const altFlight = group.primary;
                        const altIndex = groupIndex;
                        const alternativeKey = `${sliceIndex}-${airlineKey}-${groupIndex}`;
                        const showAlternatives = showAlternativeTimes[alternativeKey] || false;
                  // Calculate time difference
                  const flightTime = new Date(altFlight.departure.at).getTime();
                  const originalTime = new Date(slice.departure).getTime();
                  const diffMinutes = Math.round((flightTime - originalTime) / (1000 * 60));
                  const timeDiffText = diffMinutes === 0 ? 'Same time' :
                    diffMinutes > 0 ? `+${diffMinutes}m` : `${diffMinutes}m`;

                  // Check if within tolerance
                  const isWithinTolerance = Math.abs(diffMinutes) <= 960 && altFlight.timeComparison?.withinTolerance;

                  const carrierName = altFlight.operatingCarrier || altFlight.carrierCode;

                  // Calculate duration
                  const depTime = new Date(altFlight.departure.at);
                  const arrTime = new Date(altFlight.arrival.at);
                  const durationMinutes = Math.round((arrTime.getTime() - depTime.getTime()) / (1000 * 60));
                  const durationHrs = Math.floor(durationMinutes / 60);
                  const durationMins = durationMinutes % 60;

                  // Calculate mileage value - use proper per-mile calculation
                  const priceNum = typeof altFlight.mileagePrice === 'string'
                    ? parseFloat(altFlight.mileagePrice.replace(/[^0-9.]/g, ''))
                    : altFlight.mileagePrice;
                  const perMile = altFlight.mileage > 0 ? (priceNum / altFlight.mileage) : 0;

                  // Calculate total mileage value for comparison with cash price
                  const mileageTotalValue = (altFlight.mileage * (perCentValue / 100)) + priceNum;

                  // Get original flight cash price for this slice
                  const sliceCashPrice = typeof slice.price === 'string'
                    ? parseFloat(slice.price.replace(/[^0-9.]/g, ''))
                    : (slice.price || 0);

                  // Show savings if mileage is significantly cheaper (more than 15% savings)
                  const mileageSavings = sliceCashPrice > 0 && mileageTotalValue < sliceCashPrice * 0.85
                    ? sliceCashPrice - mileageTotalValue
                    : 0;

                  // Use component-level formatters that respect origin timezone
                  const formatTime = formatTimeInOriginTZ;
                  const formatDate = formatDateInOriginTZ;

                  // Format times in origin timezone
                  const depTimeFormatted = formatTimeInOriginTZ(altFlight.departure.at);
                  const depDateFormatted = formatDateInOriginTZ(altFlight.departure.at);
                  const arrTimeFormatted = formatTimeInOriginTZ(altFlight.arrival.at);
                  const arrDateFormatted = formatDateInOriginTZ(altFlight.arrival.at);

                  const isNonstop = !altFlight.stops || altFlight.stops.length === 0;

                  return (
                    <div
                      key={altIndex}
                      className="bg-gray-800/30 hover:bg-gray-800/50 rounded-lg border border-gray-700 transition-all duration-200 p-3"
                    >
                      {/* Header: Flight Number + Mileage + Add Button */}
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700">
                        <div className="flex items-center gap-2">
                          <img
                            src={`https://www.gstatic.com/flights/airline_logos/35px/${altFlight.carrierCode}.png`}
                            alt={altFlight.carrierCode}
                            className="h-5 w-5 object-contain"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          <span className="text-sm font-semibold text-white">{altFlight.flightNumber}</span>
                          <span className="text-xs text-gray-400">{carrierName}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2">
                            <div className="bg-orange-500/15 border border-orange-400/40 rounded px-2 py-1">
                              {altFlight.cabin && (
                                <>
                                  <span className="text-[10px] text-orange-400/70 uppercase">{altFlight.cabin}:</span>
                                  <span className="text-xs text-orange-400/60"> </span>
                                </>
                              )}
                              <span className="text-xs font-bold text-orange-300">{altFlight.mileage.toLocaleString()}</span>
                              <span className="text-[10px] text-orange-400/70"> mi</span>
                              <span className="text-xs text-orange-400/60"> + </span>
                              <span className="text-xs font-semibold text-orange-300">${priceNum.toFixed(2)}</span>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedMileageFlight(altFlight);
                                setShowAddToProposal(true);
                              }}
                              className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs rounded border border-blue-400/30 transition-colors flex items-center gap-1"
                            >
                              <Plus className="h-3 w-3" />
                              Add
                            </button>
                          </div>
                          <div className="flex flex-col items-end gap-0.5">
                            {mileageSavings > 0 ? (
                              <>
                                <div className="text-[10px] text-gray-400 line-through">
                                  Cash: ${sliceCashPrice.toFixed(2)}
                                </div>
                                <div className="text-[10px] font-semibold text-green-400">
                                  Save ${mileageSavings.toFixed(2)} with miles!
                                </div>
                              </>
                            ) : (
                              <div className="text-[10px] text-orange-400/80">
                                Total Value: ${mileageTotalValue.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Flight Route: Departure → Layover → Arrival */}
                      <div className="flex items-center gap-3">
                        {/* Departure */}
                        <div className="text-center min-w-[70px]">
                          <div className="text-lg font-semibold text-white">{depTimeFormatted}</div>
                          <div className="text-xs text-gray-400">{depDateFormatted}</div>
                          <div className="text-sm font-medium text-gray-200">{altFlight.departure.iataCode}</div>
                          {altFlight.cabin && (
                            <div className="text-[10px] text-accent-300 mt-0.5">{altFlight.cabin}</div>
                          )}
                        </div>

                        {/* Flight Line with Layovers */}
                        <div className="flex-1 px-2">
                          {isNonstop ? (
                            // Nonstop flight
                            <div>
                              <div className="flex items-center gap-1 relative">
                                <div className="flex-1 border-t-2 border-emerald-500/40"></div>
                                <Plane className="h-3 w-3 text-emerald-400" />
                                <div className="flex-1 border-t-2 border-emerald-500/40"></div>
                              </div>
                              <div className="text-center text-xs text-gray-200 mt-1">
                                <Clock className="h-2.5 w-2.5 inline mr-1" />
                                {durationHrs}h {durationMins}m
                              </div>
                            </div>
                          ) : (
                            // Flight with stops
                            <div>
                              <div className="flex items-center gap-1 relative">
                                <div className="flex-1 border-t-2 border-gray-600"></div>
                                {altFlight.stops && altFlight.stops.map((stop: any, idx: number) => (
                                  <React.Fragment key={idx}>
                                    <div className="flex flex-col items-center gap-0.5 bg-gray-800/50 px-1.5 py-1 rounded">
                                      <span className="text-[9px] text-gray-300 font-medium">
                                        {typeof stop === 'string' ? stop : (stop.code || stop.iataCode || 'N/A')}
                                      </span>
                                    </div>
                                    {idx < altFlight.stops.length - 1 && (
                                      <div className="flex-1 border-t-2 border-dashed border-gray-600"></div>
                                    )}
                                  </React.Fragment>
                                ))}
                                {altFlight.stops && altFlight.stops.length > 0 && (
                                  <div className="flex-1 border-t-2 border-gray-600"></div>
                                )}
                              </div>
                              <div className="text-center text-xs text-gray-200 mt-1">
                                <Clock className="h-2.5 w-2.5 inline mr-1" />
                                {durationHrs}h {durationMins}m • {altFlight.numberOfStops} stop{altFlight.numberOfStops !== 1 ? 's' : ''}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Arrival */}
                        <div className="text-center min-w-[70px]">
                          <div className="text-lg font-semibold text-white">{arrTimeFormatted}</div>
                          <div className="text-xs text-gray-400">{arrDateFormatted}</div>
                          <div className="text-sm font-medium text-gray-200">{altFlight.arrival.iataCode}</div>
                          {altFlight.cabin && (
                            <div className="text-[10px] text-accent-300 mt-0.5">{altFlight.cabin}</div>
                          )}
                        </div>
                      </div>

                      {/* Alternative Times Button */}
                      {group.alternativeTimes.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <button
                            onClick={() => setShowAlternativeTimes(prev => ({...prev, [alternativeKey]: !showAlternatives}))}
                            className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded border border-gray-600/50 transition-colors"
                          >
                            <span className="text-xs font-medium text-gray-300">
                              {group.alternativeTimes.length} alternative time{group.alternativeTimes.length !== 1 ? 's' : ''}
                            </span>
                            <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${showAlternatives ? 'rotate-180' : ''}`} />
                          </button>

                          {/* Alternative Times List */}
                          {showAlternatives && (
                            <div className="mt-2 space-y-2">
                              {group.alternativeTimes.map((altTime: any, altTimeIdx: number) => {
                                const altDepTime = formatTimeInOriginTZ(altTime.departure.at);
                                const altDepDate = formatDateInOriginTZ(altTime.departure.at);
                                const altArrTime = formatTimeInOriginTZ(altTime.arrival.at);
                                const altArrDate = formatDateInOriginTZ(altTime.arrival.at);

                                return (
                                  <div
                                    key={altTimeIdx}
                                    className="flex items-center justify-between px-3 py-2 bg-gray-800/30 rounded border border-gray-700/50"
                                  >
                                    <div className="flex items-center gap-2 flex-1">
                                      <div className="text-xs">
                                        <div className="text-white font-medium">{altDepTime}</div>
                                        <div className="text-gray-400">{altDepDate}</div>
                                      </div>
                                      <div className="text-gray-500">→</div>
                                      <div className="text-xs">
                                        <div className="text-white font-medium">{altArrTime}</div>
                                        <div className="text-gray-400">{altArrDate}</div>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setSelectedMileageFlight(altTime);
                                        setShowAddToProposal(true);
                                      }}
                                      className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs rounded border border-blue-400/30 transition-colors flex items-center gap-1"
                                    >
                                      <Plus className="h-3 w-3" />
                                      Add
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Alternative Carriers Button */}
                      {group.alternativeCarriers.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <button
                            onClick={() => setShowAlternativeTimes(prev => ({...prev, [`${alternativeKey}-carriers`]: !showAlternativeTimes[`${alternativeKey}-carriers`]}))}
                            className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded border border-gray-600/50 transition-colors"
                          >
                            <span className="text-xs font-medium text-gray-300">
                              {group.alternativeCarriers.length} alternative carrier{group.alternativeCarriers.length !== 1 ? 's' : ''}
                            </span>
                            <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${showAlternativeTimes[`${alternativeKey}-carriers`] ? 'rotate-180' : ''}`} />
                          </button>

                          {/* Alternative Carriers List */}
                          {showAlternativeTimes[`${alternativeKey}-carriers`] && (
                            <div className="mt-2 space-y-2">
                              {group.alternativeCarriers.map((altCarrier: any, altCarrierIdx: number) => {
                                return (
                                  <div
                                    key={altCarrierIdx}
                                    className="flex items-center justify-between px-3 py-2 bg-gray-800/30 rounded border border-gray-700/50"
                                  >
                                    <div className="flex items-center gap-2 flex-1">
                                      <img
                                        src={`https://www.gstatic.com/flights/airline_logos/35px/${altCarrier.carrierCode}.png`}
                                        alt={altCarrier.carrierCode}
                                        className="h-5 w-5 object-contain"
                                      />
                                      <div className="text-xs">
                                        <div className="text-white font-medium">{altCarrier.flightNumber}</div>
                                        <div className="text-gray-400">{altCarrier.carrierCode}</div>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setSelectedMileageFlight(altCarrier);
                                        setShowAddToProposal(true);
                                      }}
                                      className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs rounded border border-blue-400/30 transition-colors flex items-center gap-1"
                                    >
                                      <Plus className="h-3 w-3" />
                                      Add
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
                  </div>
                </div>
              );
              });
            })()}
          </div>
        ))}
      </div>


      {/* Add to Proposal Modal */}
      {showAddToProposal && (
        <AddToProposalModal
          flight={flight}
          selectedMileageFlight={selectedMileageFlight}
          perCentValue={perCentValue}
          onClose={() => {
            setShowAddToProposal(false);
            setSelectedMileageFlight(null);
          }}
        />
      )}

      {/* Mileage Calculation Modal */}
      {showMileageCalculation && (() => {
        const bestMileageResult = calculateBestMileageForTrip(slices, perCentValue);
        return bestMileageResult ? (
          <MileageCalculationModal
            isOpen={showMileageCalculation}
            onClose={() => setShowMileageCalculation(false)}
            calculation={bestMileageResult}
            perCentValue={perCentValue}
          />
        ) : null;
      })()}

    </div>
  );
};

export default FlightCard;
