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

  // Group deals by airline and find primary/alternatives
  const groupedByAirline = useMemo(() => {
    const grouped = new Map<string, MileageDeal[]>();

    deals.forEach(deal => {
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
                            {hasStops ? `${slice.stops.length} stop${slice.stops.length > 1 ? 's' : ''}` : 'Nonstop'}
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

                    {/* Expanded Stop Details */}
                    {hasStops && isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
                        {slice.segments.map((segment, segIndex) => (
                          <div key={segIndex} className="flex items-center gap-3 text-sm">
                            <div className="flex-shrink-0 w-16 text-gray-400">
                              {segment.carrier.code} {segment.flightNumber}
                            </div>
                            <div className="flex items-center gap-2 flex-1">
                              <span className="font-medium text-white">{segment.origin.code}</span>
                              <span className="text-gray-500">→</span>
                              <span className="font-medium text-white">{segment.destination.code}</span>
                              <span className="text-gray-500 text-xs ml-2">
                                {formatDuration(segment.duration)}
                              </span>
                            </div>
                            {segIndex < slice.segments.length - 1 && (
                              <div className="text-xs text-amber-400 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Layover: {formatDuration(slice.segments[segIndex + 1].layoverDuration || 0)}
                              </div>
                            )}
                          </div>
                        ))}
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
                        <div className="flex items-start justify-between gap-4">
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
                                  {activeAlternatives.map((deal, index) => (
                                    <div
                                      key={index}
                                      className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg"
                                    >
                                      <div className="flex items-center justify-between gap-3">
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
                                    </div>
                                  ))}
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
