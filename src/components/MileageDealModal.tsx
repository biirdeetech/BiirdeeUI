import React, { useState, useMemo } from 'react';
import { X, Plane, Award, DollarSign, Clock, Zap, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { MileageDeal, FlightSlice } from '../types/flight';

interface MileageDealModalProps {
  deals: MileageDeal[];
  flightSlices: FlightSlice[];
  isOpen: boolean;
  onClose: () => void;
}

interface GroupedDeals {
  airline: string;
  airlineCode: string;
  primary: MileageDeal;
  alternatives: MileageDeal[];
  alternativesBestMatch: MileageDeal[];
  alternativesTimeInsensitive: MileageDeal[];
}

interface ConsolidatedDeal extends MileageDeal {
  flightNumbers: string[];
  variantCount: number;
}

const MileageDealModal: React.FC<MileageDealModalProps> = ({ deals, flightSlices, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'best-match' | 'more-options'>('best-match');
  const [expandedAirlines, setExpandedAirlines] = useState<Record<string, boolean>>({});
  const [expandedSlices, setExpandedSlices] = useState<Record<number, boolean>>({});
  const [airlineAlternativeTabs, setAirlineAlternativeTabs] = useState<Record<string, 'best-match' | 'time-insensitive'>>({});

  // Calculate time difference in hours from original flight
  const calculateTimeDifference = (deal: MileageDeal): number => {
    if (!flightSlices[0]) return Infinity;

    const originalDepartureTime = new Date(flightSlices[0].departure).getTime();

    // Try to parse the departure time from the deal (this may need adjustment based on your data structure)
    // For now, we'll assume the deal doesn't have departure info and return 0
    // You may need to add departure time to MileageDeal interface
    return 0; // Placeholder - will need actual departure time from deal
  };

  // Consolidate deals that are identical except for flight numbers
  const consolidateDeals = (deals: MileageDeal[]): ConsolidatedDeal[] => {
    const consolidated = new Map<string, ConsolidatedDeal>();

    deals.forEach(deal => {
      // Create a key based on all properties except flight number
      const key = `${deal.airlineCode}-${deal.mileage}-${deal.mileagePrice}-${deal.cabins.join(',')}-${deal.matchType}`;

      if (consolidated.has(key)) {
        const existing = consolidated.get(key)!;
        // Add flight number if not already included
        if (!existing.flightNumbers.includes(deal.flightNumber)) {
          existing.flightNumbers.push(deal.flightNumber);
          existing.variantCount++;
        }
      } else {
        consolidated.set(key, {
          ...deal,
          flightNumbers: [deal.flightNumber],
          variantCount: 1
        });
      }
    });

    return Array.from(consolidated.values());
  };

  // Enrich deals with segment information from flight slices and mileageBreakdown
  const enrichDealsWithSegments = (dealsList: MileageDeal[]): MileageDeal[] => {
    return dealsList.map(deal => {
      // If deal already has segments, return as is
      if (deal.segments && deal.segments.length > 0) {
        return deal;
      }

      // Try to enrich from flight slices mileageBreakdown
      if (flightSlices && flightSlices.length > 0) {
        const slice = flightSlices[0]; // Use first slice for now

        // Check if this slice has mileageBreakdown with allMatchingFlights
        if (slice.mileageBreakdown && slice.mileageBreakdown.length > 0) {
          // Find matching flights for this deal's airline
          const breakdown = slice.mileageBreakdown.find(mb =>
            mb.carrier === deal.airlineCode ||
            (mb.allMatchingFlights && mb.allMatchingFlights.some((f: any) =>
              f.carrierCode === deal.airlineCode || f.operatingCarrier === deal.airlineCode
            ))
          );

          if (breakdown && breakdown.allMatchingFlights && breakdown.allMatchingFlights.length > 0) {
            // Get the matching flights for this airline
            const matchingFlights = breakdown.allMatchingFlights.filter((f: any) =>
              f.carrierCode === deal.airlineCode || f.operatingCarrier === deal.airlineCode
            );

            if (matchingFlights.length > 0) {
              // Use the first matching flight to extract segment data
              const flight = matchingFlights[0];

              // If it's a multi-stop flight, we need to create segments
              if (flight.numberOfStops > 0 && flight.stops && flight.stops.length > 0) {
                // For multi-stop flights, create segments based on stops
                // Note: We don't have individual segment times, so we'll show simplified version
                const segments = [];

                // First segment
                segments.push({
                  origin: flight.departure.iataCode,
                  destination: flight.stops[0].code || flight.stops[0].iataCode,
                  departure: flight.departure.at,
                  arrival: undefined, // Not available in individual segment data
                  flightNumber: flight.flightNumber,
                  duration: undefined,
                  carrier: flight.operatingCarrier || flight.carrierCode,
                  aircraft: flight.aircraft?.code
                });

                // Middle segments (if multiple stops)
                for (let i = 0; i < flight.stops.length - 1; i++) {
                  segments.push({
                    origin: flight.stops[i].code || flight.stops[i].iataCode,
                    destination: flight.stops[i + 1].code || flight.stops[i + 1].iataCode,
                    departure: undefined,
                    arrival: undefined,
                    flightNumber: flight.flightNumber,
                    duration: undefined,
                    carrier: flight.operatingCarrier || flight.carrierCode,
                    aircraft: flight.aircraft?.code
                  });
                }

                // Last segment
                segments.push({
                  origin: flight.stops[flight.stops.length - 1].code || flight.stops[flight.stops.length - 1].iataCode,
                  destination: flight.arrival.iataCode,
                  departure: undefined,
                  arrival: flight.arrival.at,
                  flightNumber: flight.flightNumber,
                  duration: undefined,
                  carrier: flight.operatingCarrier || flight.carrierCode,
                  aircraft: flight.aircraft?.code
                });

                return {
                  ...deal,
                  segments,
                  stops: flight.stops.map((s: any) => ({
                    code: s.code || s.iataCode,
                    duration: undefined // Layover duration not provided
                  })),
                  departure: flight.departure.at,
                  arrival: flight.arrival.at,
                  duration: flight.duration ? parseDuration(flight.duration) : undefined,
                  flightNumber: flight.flightNumber
                };
              } else {
                // Nonstop flight - single segment
                return {
                  ...deal,
                  segments: [{
                    origin: flight.departure.iataCode,
                    destination: flight.arrival.iataCode,
                    departure: flight.departure.at,
                    arrival: flight.arrival.at,
                    flightNumber: flight.flightNumber,
                    duration: flight.duration ? parseDuration(flight.duration) : undefined,
                    carrier: flight.operatingCarrier || flight.carrierCode,
                    aircraft: flight.aircraft?.code
                  }],
                  stops: [],
                  departure: flight.departure.at,
                  arrival: flight.arrival.at,
                  duration: flight.duration ? parseDuration(flight.duration) : undefined,
                  flightNumber: flight.flightNumber
                };
              }
            }
          }
        }

        // Fallback: Try to enrich from basic slice segments
        if (slice.segments && slice.segments.length > 0) {
          // Extract segment information
          const segments = slice.segments.map((seg, idx) => ({
            origin: seg.origin?.code || slice.origin.code,
            destination: seg.destination?.code || slice.destination.code,
            departure: seg.departure,
            arrival: seg.arrival,
            flightNumber: seg.flightNumber || slice.flights[idx],
            duration: seg.duration,
            carrier: seg.carrier.code,
            aircraft: undefined
          }));

          return {
            ...deal,
            segments,
            stops: slice.stops,
            departure: slice.departure,
            arrival: slice.arrival,
            duration: slice.duration
          };
        }
      }

      return deal;
    });
  };

  // Helper to parse ISO 8601 duration (e.g., "PT6H59M") to minutes
  const parseDuration = (duration: string): number => {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    return hours * 60 + minutes;
  };

  // Group deals by airline and find primary/alternatives
  const groupedByAirline = useMemo(() => {
    // First enrich deals with segment information
    const enrichedDeals = enrichDealsWithSegments(deals);

    // Then consolidate deals to combine identical flights with different flight numbers
    const consolidatedDeals = consolidateDeals(enrichedDeals);

    const grouped = new Map<string, ConsolidatedDeal[]>();

    consolidatedDeals.forEach(deal => {
      const key = deal.airlineCode;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(deal);
    });

    // Convert to grouped structure with primary and alternatives
    const result: GroupedDeals[] = [];
    grouped.forEach((airlineDeals, airlineCode) => {
      // Sort by value (miles + weighted fees) then by time difference
      const sorted = airlineDeals.sort((a, b) => {
        const aValue = a.mileage + (a.mileagePrice * 100);
        const bValue = b.mileage + (b.mileagePrice * 100);
        const valueCompare = aValue - bValue;

        if (valueCompare !== 0) return valueCompare;

        // If values equal, sort by time difference
        const aTimeDiff = calculateTimeDifference(a);
        const bTimeDiff = calculateTimeDifference(b);
        return aTimeDiff - bTimeDiff;
      });

      const primary = sorted[0];
      const alternatives = sorted.slice(1);

      // Split alternatives into best match (within 5 hours) and time insensitive
      // For now, since we don't have actual time data, put all in best matches
      // TODO: Update when time difference data is available
      const alternativesBestMatch = alternatives.slice().sort((a, b) => {
        // Sort by value first, then by time difference
        const aValue = a.mileage + (a.mileagePrice * 100);
        const bValue = b.mileage + (b.mileagePrice * 100);
        const valueCompare = aValue - bValue;

        if (valueCompare !== 0) return valueCompare;

        return calculateTimeDifference(a) - calculateTimeDifference(b);
      });

      const alternativesTimeInsensitive: MileageDeal[] = [];
      // Will be populated when time difference calculation is implemented

      result.push({
        airline: sorted[0].airline,
        airlineCode: airlineCode,
        primary,
        alternatives,
        alternativesBestMatch,
        alternativesTimeInsensitive
      });
    });

    // Sort groups by primary deal value
    return result.sort((a, b) => {
      const aValue = a.primary.mileage + (a.primary.mileagePrice * 100);
      const bValue = b.primary.mileage + (b.primary.mileagePrice * 100);
      return aValue - bValue;
    });
  }, [deals, flightSlices]);

  // Separate into best matches and more options
  const { bestMatches, moreOptions } = useMemo(() => {
    const best = groupedByAirline.filter(g => g.primary.matchType === 'full');
    const more = groupedByAirline.filter(g => g.primary.matchType === 'partial');
    return { bestMatches: best, moreOptions: more };
  }, [groupedByAirline]);

  const toggleAirline = (airlineCode: string) => {
    setExpandedAirlines(prev => ({
      ...prev,
      [airlineCode]: !prev[airlineCode]
    }));
  };

  const toggleSlice = (index: number) => {
    setExpandedSlices(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const setAirlineAlternativeTab = (airlineCode: string, tab: 'best-match' | 'time-insensitive') => {
    setAirlineAlternativeTabs(prev => ({
      ...prev,
      [airlineCode]: tab
    }));
  };

  const getAirlineAlternativeTab = (airlineCode: string): 'best-match' | 'time-insensitive' => {
    return airlineAlternativeTabs[airlineCode] || 'best-match';
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (!isOpen || !deals || deals.length === 0) return null;

  const activeGroups = activeTab === 'best-match' ? bestMatches : moreOptions;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900 flex-shrink-0">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Award className="h-6 w-6 text-accent-400" />
            Mileage Booking Options
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Flight Route Summary */}
          <div className="p-6 bg-gray-800/30 border-b border-gray-700">
            <h4 className="text-sm font-semibold text-gray-400 mb-3">Flight Route</h4>
            <div className="space-y-3">
              {flightSlices.map((slice, index) => {
                const isExpanded = expandedSlices[index];
                const hasStops = slice.stops && slice.stops.length > 0;

                return (
                  <div key={index} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    {/* Slice Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-white">{slice.origin.code}</div>
                          <div className="text-xs text-gray-400">{formatTime(slice.departure)}</div>
                          <div className="text-xs text-gray-500">{formatDate(slice.departure)}</div>
                        </div>

                        <div className="flex-1 flex flex-col items-center">
                          <div className="text-xs text-gray-400 mb-1">{formatDuration(slice.duration)}</div>
                          <div className="w-full h-0.5 bg-gray-700 relative">
                            <Plane className="h-4 w-4 text-accent-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800" />
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {hasStops ? (
                              <span>
                                {slice.stops.length} stop{slice.stops.length > 1 ? 's' : ''}
                                {slice.stops.length > 0 && (
                                  <span className="text-amber-400 ml-1">
                                    ({slice.stops.map(s => s.code).join(', ')})
                                  </span>
                                )}
                              </span>
                            ) : 'Nonstop'}
                          </div>
                        </div>

                        <div className="text-center">
                          <div className="text-2xl font-bold text-white">{slice.destination.code}</div>
                          <div className="text-xs text-gray-400">{formatTime(slice.arrival)}</div>
                          <div className="text-xs text-gray-500">{formatDate(slice.arrival)}</div>
                        </div>
                      </div>

                      {hasStops && (
                        <button
                          onClick={() => toggleSlice(index)}
                          className="ml-4 p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Expanded Stop Details - Enhanced Layover Information */}
                    {hasStops && isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-700 space-y-2">
                        {slice.segments.map((segment, segIndex) => {
                          const nextSegment = slice.segments[segIndex + 1];
                          let layoverDuration = 0;
                          let layoverAirport = '';

                          if (nextSegment && segment.arrival && nextSegment.departure) {
                            const arrTime = new Date(segment.arrival).getTime();
                            const depTime = new Date(nextSegment.departure).getTime();
                            layoverDuration = Math.round((depTime - arrTime) / (1000 * 60));
                            layoverAirport = segment.destination?.code || '';
                          }

                          return (
                            <div key={segIndex}>
                              {/* Flight Segment */}
                              <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <img
                                      src={`https://www.gstatic.com/flights/airline_logos/35px/${segment.carrier.code}.png`}
                                      alt={segment.carrier.code}
                                      className="h-5 w-5 object-contain"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                    <span className="text-sm font-semibold text-blue-300">
                                      {segment.carrier.code} {segment.flightNumber || slice.flights[segIndex]}
                                    </span>
                                    {segment.cabin && (
                                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                                        {segment.cabin}
                                      </span>
                                    )}
                                  </div>
                                  {segment.duration && (
                                    <div className="text-xs text-gray-400 flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {formatDuration(segment.duration)}
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-3">
                                  {/* Departure */}
                                  <div className="flex-1">
                                    <div className="text-sm font-bold text-white">
                                      {segment.departure ? formatTime(segment.departure) : formatTime(slice.departure)}
                                    </div>
                                    <div className="text-xs text-gray-400 font-mono">
                                      {segment.origin?.code || slice.origin.code}
                                    </div>
                                    {segment.departure && (
                                      <div className="text-xs text-gray-500">
                                        {formatDate(segment.departure)}
                                      </div>
                                    )}
                                  </div>

                                  {/* Flight Line */}
                                  <div className="flex-1 flex items-center">
                                    <div className="flex-1 border-t-2 border-gray-600"></div>
                                    <Plane className="h-3 w-3 text-gray-400 mx-1" />
                                    <div className="flex-1 border-t-2 border-gray-600"></div>
                                  </div>

                                  {/* Arrival */}
                                  <div className="flex-1 text-right">
                                    <div className="text-sm font-bold text-white">
                                      {segment.arrival ? formatTime(segment.arrival) : formatTime(slice.arrival)}
                                    </div>
                                    <div className="text-xs text-gray-400 font-mono">
                                      {segment.destination?.code || slice.destination.code}
                                    </div>
                                    {segment.arrival && (
                                      <div className="text-xs text-gray-500">
                                        {formatDate(segment.arrival)}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Booking Class */}
                                {segment.pricings && segment.pricings.length > 0 && segment.pricings[0].bookingClass && (
                                  <div className="mt-2 text-xs text-gray-400">
                                    Booking Class: <span className="font-mono text-white">{segment.pricings[0].bookingClass}</span>
                                  </div>
                                )}
                              </div>

                              {/* Layover Information */}
                              {nextSegment && layoverDuration > 0 && (
                                <div className="flex items-center justify-center py-2">
                                  <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg px-3 py-2 text-sm">
                                    <div className="flex items-center gap-2 text-orange-300 font-medium">
                                      <MapPin className="h-4 w-4 text-orange-400" />
                                      <span>Layover at {layoverAirport}</span>
                                      <span className="text-orange-400">•</span>
                                      <Clock className="h-4 w-4 text-orange-400" />
                                      <span className="text-orange-200">{formatDuration(layoverDuration)}</span>
                                    </div>
                                    <div className="text-xs text-orange-400/70 text-center mt-1">
                                      Next flight: {nextSegment.carrier.code} {nextSegment.flightNumber || slice.flights[segIndex + 1]}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Total Travel Time Summary */}
                        <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center justify-between text-sm">
                          <span className="text-gray-400">Total Travel Time:</span>
                          <span className="text-white font-semibold">{formatDuration(slice.duration)}</span>
                        </div>
                      </div>
                    )}

                    {/* Flight Numbers */}
                    <div className="mt-3 text-xs text-gray-500">
                      Operated by: {slice.flights.join(', ')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-700 bg-gray-800/50 sticky top-0 z-10">
            <button
              onClick={() => setActiveTab('best-match')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-all relative ${
                activeTab === 'best-match'
                  ? 'text-white bg-gray-800'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Zap className="h-4 w-4" />
                <span>Best Matches</span>
                {bestMatches.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full font-medium border border-green-500/30">
                    {bestMatches.length}
                  </span>
                )}
              </div>
              {activeTab === 'best-match' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('more-options')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-all relative ${
                activeTab === 'more-options'
                  ? 'text-white bg-gray-800'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Clock className="h-4 w-4" />
                <span>More Options</span>
                {moreOptions.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-full font-medium">
                    {moreOptions.length}
                  </span>
                )}
              </div>
              {activeTab === 'more-options' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500" />
              )}
            </button>
          </div>

          {/* Grouped Deals List */}
          <div className="p-6">
            {activeGroups.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                No {activeTab === 'best-match' ? 'best match' : 'additional'} options available
              </div>
            ) : (
              <div className="space-y-3">
                {activeGroups.map((group) => {
                  const isExpanded = expandedAirlines[group.airlineCode];
                  const hasAlternatives = group.alternatives.length > 0;
                  const activeAltTab = getAirlineAlternativeTab(group.airlineCode);
                  const activeAlternatives = activeAltTab === 'best-match'
                    ? group.alternativesBestMatch
                    : group.alternativesTimeInsensitive;

                  return (
                    <div
                      key={group.airlineCode}
                      className={`border rounded-lg overflow-hidden transition-all ${
                        group.primary.matchType === 'full'
                          ? 'border-green-500/30 bg-green-500/5'
                          : 'border-gray-700 bg-gray-800/30'
                      }`}
                    >
                      {/* Primary Deal */}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="p-2 bg-accent-500/10 rounded-lg">
                                <Plane className="h-5 w-5 text-accent-400" />
                              </div>
                              <div>
                                <div className="text-lg font-bold text-white">{group.airline}</div>
                                <div className="text-xs text-gray-500">Code: {group.airlineCode}</div>
                              </div>
                              {group.primary.matchType === 'full' && (
                                <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-medium border border-green-500/30">
                                  Full Match
                                </span>
                              )}
                              {group.primary.matchType === 'partial' && (
                                <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full font-medium border border-yellow-500/30">
                                  Partial Match
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2 mb-2">
                              {group.primary.cabins.map((cabin, i) => (
                                <span
                                  key={i}
                                  className="px-3 py-1 bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg"
                                >
                                  {cabin}
                                </span>
                              ))}
                            </div>

                            {/* Flight Numbers Display */}
                            <div className="text-sm text-gray-400">
                              {(group.primary as ConsolidatedDeal).flightNumbers ? (
                                <>
                                  <span className="text-gray-500">Flights: </span>
                                  <span className="text-white font-medium">
                                    {(group.primary as ConsolidatedDeal).flightNumbers.join(', ')}
                                  </span>
                                  {(group.primary as ConsolidatedDeal).variantCount > 1 && (
                                    <span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full border border-blue-500/30">
                                      {(group.primary as ConsolidatedDeal).variantCount} variants
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span className="text-gray-500">Flight: </span>
                                  <span className="text-white font-medium">{group.primary.flightNumber}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <div className="text-2xl font-bold text-accent-400">
                              {group.primary.mileage.toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-400">miles</div>
                            {group.primary.mileagePrice > 0 && (
                              <div className="flex items-center justify-end gap-1 mt-1 text-gray-300">
                                <DollarSign className="h-3 w-3" />
                                <span className="text-sm">+ ${group.primary.mileagePrice.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Flight Timeline - Show stops/segments if available */}
                        {group.primary.segments && group.primary.segments.length > 0 && (
                          <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
                            <div className="space-y-2">
                              {group.primary.segments.map((segment, segIdx) => {
                                const nextSegment = group.primary.segments![segIdx + 1];
                                let layoverDuration = 0;

                                if (nextSegment && segment.arrival && nextSegment.departure) {
                                  const arrTime = new Date(segment.arrival).getTime();
                                  const depTime = new Date(nextSegment.departure).getTime();
                                  layoverDuration = Math.round((depTime - arrTime) / (1000 * 60));
                                }

                                return (
                                  <div key={segIdx}>
                                    {/* Segment */}
                                    <div className="flex items-center gap-2 text-sm">
                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <span className="text-xs font-semibold text-blue-300">{segment.flightNumber}</span>
                                      </div>
                                      <div className="flex items-center gap-2 flex-1">
                                        <span className="font-mono text-white">{segment.origin}</span>
                                        <div className="flex-1 flex items-center">
                                          <div className="flex-1 border-t border-gray-600"></div>
                                          <Plane className="h-3 w-3 text-gray-500 mx-1" />
                                          <div className="flex-1 border-t border-gray-600"></div>
                                        </div>
                                        <span className="font-mono text-white">{segment.destination}</span>
                                      </div>
                                      {segment.duration && (
                                        <span className="text-xs text-gray-500">{formatDuration(segment.duration)}</span>
                                      )}
                                    </div>

                                    {/* Layover */}
                                    {nextSegment && layoverDuration > 0 && (
                                      <div className="flex items-center justify-center py-1.5">
                                        <div className="bg-orange-500/20 border border-orange-500/30 rounded px-2.5 py-1 text-xs">
                                          <span className="text-orange-300 flex items-center gap-1.5">
                                            <MapPin className="h-3 w-3" />
                                            <span>Layover at {segment.destination}</span>
                                            <span className="text-orange-400">•</span>
                                            <Clock className="h-3 w-3" />
                                            <span>{formatDuration(layoverDuration)}</span>
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            {group.primary.duration && (
                              <div className="mt-2 pt-2 border-t border-gray-700/50 text-xs text-gray-400 flex items-center justify-between">
                                <span>Total Travel Time:</span>
                                <span className="text-white font-medium">{formatDuration(group.primary.duration)}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {/* Show stops summary if segments not available but stops are */}
                        {(!group.primary.segments || group.primary.segments.length === 0) && group.primary.stops && group.primary.stops.length > 0 && (
                          <div className="text-xs text-gray-400">
                            <span className="text-orange-400">{group.primary.stops.length} stop{group.primary.stops.length > 1 ? 's' : ''}</span>
                            <span className="ml-1">({group.primary.stops.map(s => s.code).join(', ')})</span>
                          </div>
                        )}

                        {/* Expand Button for Alternatives */}
                        {hasAlternatives && (
                          <button
                            onClick={() => toggleAirline(group.airlineCode)}
                            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg transition-all text-sm text-gray-300"
                          >
                            <span>{group.alternatives.length} alternative option{group.alternatives.length > 1 ? 's' : ''}</span>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Alternative Deals */}
                      {hasAlternatives && isExpanded && (
                        <div className="border-t border-gray-700 bg-gray-900/50">
                          {/* Alternative Tabs */}
                          <div className="flex border-b border-gray-700/50 bg-gray-900/30">
                            <button
                              onClick={() => setAirlineAlternativeTab(group.airlineCode, 'best-match')}
                              className={`flex-1 px-4 py-2 text-xs font-medium transition-all relative ${
                                activeAltTab === 'best-match'
                                  ? 'text-green-400 bg-gray-800/50'
                                  : 'text-gray-400 hover:text-gray-300'
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1.5">
                                <Zap className="h-3 w-3" />
                                <span>Best Matches</span>
                                {group.alternativesBestMatch.length > 0 && (
                                  <span className="ml-1 px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded-full font-medium border border-green-500/30">
                                    {group.alternativesBestMatch.length}
                                  </span>
                                )}
                              </div>
                              {activeAltTab === 'best-match' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500" />
                              )}
                            </button>
                            <button
                              onClick={() => setAirlineAlternativeTab(group.airlineCode, 'time-insensitive')}
                              className={`flex-1 px-4 py-2 text-xs font-medium transition-all relative ${
                                activeAltTab === 'time-insensitive'
                                  ? 'text-blue-400 bg-gray-800/50'
                                  : 'text-gray-400 hover:text-gray-300'
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1.5">
                                <Clock className="h-3 w-3" />
                                <span>Time Insensitive</span>
                                {group.alternativesTimeInsensitive.length > 0 && (
                                  <span className="ml-1 px-1.5 py-0.5 bg-gray-700 text-gray-300 text-[10px] rounded-full font-medium">
                                    {group.alternativesTimeInsensitive.length}
                                  </span>
                                )}
                              </div>
                              {activeAltTab === 'time-insensitive' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                              )}
                            </button>
                          </div>

                          <div className="p-3">
                            {activeAlternatives.length === 0 ? (
                              <div className="text-center py-6 text-gray-500 text-xs">
                                No {activeAltTab === 'best-match' ? 'programs within 5 hours' : 'additional programs'}
                              </div>
                            ) : (
                              <>
                                <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-3">
                                  {activeAltTab === 'best-match'
                                    ? 'Within 5 hours (sorted by value & timing)'
                                    : 'More than 5 hours (sorted by value)'}
                                </div>
                                <div className="space-y-2">
                                  {activeAlternatives.map((deal, index) => {
                                    const consolidatedDeal = deal as ConsolidatedDeal;
                                    return (
                                      <div
                                        key={index}
                                        className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg"
                                      >
                                        <div className="flex items-center justify-between gap-3 mb-2">
                                          <div className="flex-1">
                                            <div className="flex flex-wrap gap-1 mb-1">
                                              {deal.cabins.map((cabin, i) => (
                                                <span
                                                  key={i}
                                                  className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded"
                                                >
                                                  {cabin}
                                                </span>
                                              ))}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1">
                                              {consolidatedDeal.flightNumbers ? (
                                                <>
                                                  <span className="text-gray-500">Flights: </span>
                                                  <span className="text-white">
                                                    {consolidatedDeal.flightNumbers.join(', ')}
                                                  </span>
                                                  {consolidatedDeal.variantCount > 1 && (
                                                    <span className="ml-1 px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded-full border border-blue-500/30">
                                                      {consolidatedDeal.variantCount}
                                                    </span>
                                                  )}
                                                </>
                                              ) : (
                                                <>
                                                  <span className="text-gray-500">Flight: </span>
                                                  <span className="text-white">{deal.flightNumber}</span>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <div className="text-lg font-bold text-accent-400">
                                              {deal.mileage.toLocaleString()}
                                            </div>
                                            {deal.mileagePrice > 0 && (
                                              <div className="text-xs text-gray-400">
                                                + ${deal.mileagePrice.toFixed(2)}
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* Segment details for alternative deals */}
                                        {deal.segments && deal.segments.length > 0 && (
                                          <div className="mt-2 pt-2 border-t border-gray-700/50">
                                            <div className="space-y-1.5">
                                              {deal.segments.map((segment, segIdx) => {
                                                const nextSegment = deal.segments![segIdx + 1];
                                                let layoverDuration = 0;

                                                if (nextSegment && segment.arrival && nextSegment.departure) {
                                                  const arrTime = new Date(segment.arrival).getTime();
                                                  const depTime = new Date(nextSegment.departure).getTime();
                                                  layoverDuration = Math.round((depTime - arrTime) / (1000 * 60));
                                                }

                                                return (
                                                  <div key={segIdx}>
                                                    <div className="flex items-center gap-1.5 text-xs">
                                                      <span className="text-blue-300 font-semibold">{segment.flightNumber}</span>
                                                      <span className="font-mono text-gray-300">{segment.origin}</span>
                                                      <div className="flex-1 flex items-center">
                                                        <div className="flex-1 border-t border-gray-600"></div>
                                                        <Plane className="h-2.5 w-2.5 text-gray-500 mx-0.5" />
                                                        <div className="flex-1 border-t border-gray-600"></div>
                                                      </div>
                                                      <span className="font-mono text-gray-300">{segment.destination}</span>
                                                      {segment.duration && (
                                                        <span className="text-gray-500 text-[10px]">{formatDuration(segment.duration)}</span>
                                                      )}
                                                    </div>
                                                    {nextSegment && layoverDuration > 0 && (
                                                      <div className="flex items-center justify-center py-1">
                                                        <div className="bg-orange-500/20 border border-orange-500/30 rounded px-2 py-0.5 text-[10px] text-orange-300 flex items-center gap-1">
                                                          <MapPin className="h-2.5 w-2.5" />
                                                          <span>Layover at {segment.destination}</span>
                                                          <span>•</span>
                                                          <Clock className="h-2.5 w-2.5" />
                                                          <span>{formatDuration(layoverDuration)}</span>
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                            {deal.duration && (
                                              <div className="mt-1.5 pt-1.5 border-t border-gray-700/50 text-[10px] text-gray-400 flex items-center justify-between">
                                                <span>Total:</span>
                                                <span className="text-white">{formatDuration(deal.duration)}</span>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        {/* Show stops summary if segments not available */}
                                        {(!deal.segments || deal.segments.length === 0) && deal.stops && deal.stops.length > 0 && (
                                          <div className="mt-2 text-[10px] text-gray-400">
                                            <span className="text-orange-400">{deal.stops.length} stop{deal.stops.length > 1 ? 's' : ''}</span>
                                            <span className="ml-1">({deal.stops.map(s => s.code).join(', ')})</span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Info Footer */}
          <div className="p-4 bg-gray-800/50 border-t border-gray-700 text-xs text-gray-400">
            {activeTab === 'best-match' ? (
              <p>✓ <strong className="text-green-400">Best Matches</strong> exactly match your search criteria including route, dates, and cabin class. Book directly through the airline's loyalty program.</p>
            ) : (
              <p>⚠️ <strong className="text-yellow-400">More Options</strong> may have different timing, routing, or cabin class. Review details carefully before booking.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-800/50 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-accent-600 hover:bg-accent-700 text-white font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default MileageDealModal;
