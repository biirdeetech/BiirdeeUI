import React, { useState, useMemo } from 'react';
import { Loader, AlertCircle, Plane } from 'lucide-react';
import FlightCard from './FlightCard';
import MultiLegFlightCard from './MultiLegFlightCard';
import Pagination from './Pagination';
import { SearchResponse, FlightSolution, GroupedFlight } from '../types/flight';
import { formatPrice } from '../utils/priceFormatter';
import { groupFlightsByCabin, GroupedFlightByCabin } from '../utils/cabinGrouping';

interface FlightResultsProps {
  results: SearchResponse | null;
  loading: boolean;
  error: string | null;
  searchParams: any;
  advancedSettings: any;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  currentPage?: number;
  pageSize?: number;
  originTimezone?: string;
  displayTimezone?: string;
  perCentValue?: number;
  v2EnrichmentData?: Map<string, any[]>;
  onEnrichFlight?: (flight: any, carrierCode: string) => Promise<any>;
  enrichingAirlines?: Set<string>;
  isSearchComplete?: boolean;
  searchKey?: string;
}

const FlightResults: React.FC<FlightResultsProps> = ({
  results,
  loading,
  error,
  searchParams,
  advancedSettings,
  onPageChange,
  onPageSizeChange,
  currentPage = 1,
  pageSize = 100,
  originTimezone,
  displayTimezone,
  perCentValue = 0.015,
  v2EnrichmentData = new Map(),
  onEnrichFlight,
  enrichingAirlines = new Set(),
  isSearchComplete = false,
  searchKey = ''
}) => {
  const [cabinFilter, setCabinFilter] = useState<'COACH' | 'PREMIUM-COACH' | 'BUSINESS' | 'FIRST'>('COACH');
  const [sortMode, setSortMode] = useState<'best' | 'cheap'>('cheap');
  const [expandedFlightCardId, setExpandedFlightCardId] = useState<string | null>(null);

  // Helper to calculate total duration of a flight in minutes
  const getFlightDuration = (flight: FlightSolution | GroupedFlight): number => {
    if ('id' in flight) {
      return flight.slices.reduce((total, slice) => {
        if (slice.duration) {
          const durationStr = typeof slice.duration === 'string' ? slice.duration : String(slice.duration);
          const hours = durationStr.match(/(\d+)H/);
          const minutes = durationStr.match(/(\d+)M/);
          const h = hours ? parseInt(hours[1]) : 0;
          const m = minutes ? parseInt(minutes[1]) : 0;
          return total + (h * 60) + m;
        }
        return total;
      }, 0);
    } else {
      if (flight.outboundSlice.duration) {
        const durationStr = typeof flight.outboundSlice.duration === 'string' ? flight.outboundSlice.duration : String(flight.outboundSlice.duration);
        const hours = durationStr.match(/(\d+)H/);
        const minutes = durationStr.match(/(\d+)M/);
        const h = hours ? parseInt(hours[1]) : 0;
        const m = minutes ? parseInt(minutes[1]) : 0;
        return (h * 60) + m;
      }
      return 0;
    }
  };

  // Get flat list of flights (only FlightSolution, not GroupedFlight)
  const flatFlights = useMemo(() => {
    if (!results || !results.solutionList || !results.solutionList.solutions) {
      return [];
    }
    // Filter to only FlightSolution (exclude GroupedFlight from round trip searches)
    return results.solutionList.solutions.filter(f => 'id' in f) as FlightSolution[];
  }, [results]);

  // Group flights by cabin
  const groupedByCabin = useMemo(() => {
    console.log('🔄 FlightResults: Grouping flights by cabin');
    const grouped = groupFlightsByCabin(flatFlights);
    console.log(`✅ FlightResults: Grouped into ${grouped.length} flight groups`);
    return grouped;
  }, [flatFlights]);

  // Calculate price ranges for each cabin tab
  const cabinPriceRanges = useMemo(() => {
    const ranges: Record<string, { min: number; max: number; count: number }> = {
      'COACH': { min: Infinity, max: 0, count: 0 },
      'PREMIUM-COACH': { min: Infinity, max: 0, count: 0 },
      'BUSINESS': { min: Infinity, max: 0, count: 0 },
      'FIRST': { min: Infinity, max: 0, count: 0 }
    };

    groupedByCabin.forEach(group => {
      group.cabinOptions.forEach((option, cabinCode) => {
        if (ranges[cabinCode]) {
          const price = option.price;
          ranges[cabinCode].min = Math.min(ranges[cabinCode].min, price);
          ranges[cabinCode].max = Math.max(ranges[cabinCode].max, price);
          ranges[cabinCode].count++;
        }
      });
    });

    // Clean up Infinity values
    Object.keys(ranges).forEach(cabin => {
      if (ranges[cabin].min === Infinity) {
        ranges[cabin].min = 0;
      }
    });

    return ranges;
  }, [groupedByCabin]);

  // Filter flights by selected cabin
  const filteredByCabin = useMemo(() => {
    return groupedByCabin.filter(group => group.cabinOptions.has(cabinFilter));
  }, [groupedByCabin, cabinFilter]);

  // Sort filtered flights by best (fastest) or cheap (lowest price)
  const sortedGroups = useMemo(() => {
    const groups = [...filteredByCabin];

    if (sortMode === 'best') {
      // Sort by duration (fastest first)
      groups.sort((a, b) => {
        const aDuration = getFlightDuration(a.primaryFlight);
        const bDuration = getFlightDuration(b.primaryFlight);
        return aDuration - bDuration;
      });
    } else {
      // Sort by price (cheapest first)
      groups.sort((a, b) => {
        const aCabinOption = a.cabinOptions.get(cabinFilter);
        const bCabinOption = b.cabinOptions.get(cabinFilter);
        const aPrice = aCabinOption?.price || 0;
        const bPrice = bCabinOption?.price || 0;
        return aPrice - bPrice;
      });
    }

    return groups;
  }, [filteredByCabin, sortMode, cabinFilter]);

  // Calculate prices for Best and Cheap tabs (within selected cabin)
  const sortTabPrices = useMemo(() => {
    if (filteredByCabin.length === 0) {
      return { bestPrice: 0, cheapPrice: 0 };
    }

    // Find fastest flight (best) in this cabin
    let fastestGroup = filteredByCabin[0];
    let minDuration = getFlightDuration(fastestGroup.primaryFlight);

    for (const group of filteredByCabin) {
      const duration = getFlightDuration(group.primaryFlight);
      if (duration < minDuration) {
        minDuration = duration;
        fastestGroup = group;
      }
    }

    // Find cheapest flight in this cabin
    let cheapestGroup = filteredByCabin[0];
    let minPrice = cheapestGroup.cabinOptions.get(cabinFilter)?.price || 0;

    for (const group of filteredByCabin) {
      const price = group.cabinOptions.get(cabinFilter)?.price || 0;
      if (price < minPrice) {
        minPrice = price;
        cheapestGroup = group;
      }
    }

    const bestPrice = fastestGroup.cabinOptions.get(cabinFilter)?.price || 0;
    const cheapPrice = cheapestGroup.cabinOptions.get(cabinFilter)?.price || 0;

    return { bestPrice, cheapPrice };
  }, [filteredByCabin, cabinFilter]);

  // Determine top 5 for FRT auto-trigger
  const top5FlightIds = useMemo(() => {
    const rankedFlights = sortedGroups.slice(0, 5).map(group => group.primaryFlight.id);
    return new Set(rankedFlights);
  }, [sortedGroups]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Search Error</h3>
        <p className="text-gray-400 max-w-md">{error}</p>
      </div>
    );
  }

  // No results
  if (!results || !results.solutionList || groupedByCabin.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <Plane className="h-12 w-12 text-gray-500 mb-4" />
        <div>
          <p className="text-gray-300 mb-2">No flights found</p>
          <p className="text-gray-400 text-sm">Try adjusting your search criteria</p>
        </div>
      </div>
    );
  }

  const currency = groupedByCabin[0]?.primaryFlight.currency || 'USD';

  return (
    <div className="space-y-6">
      {/* Results Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">
          {groupedByCabin.length} unique flight{groupedByCabin.length !== 1 ? 's' : ''} found
          {flatFlights.length > groupedByCabin.length && (
            <span className="text-sm text-gray-400 ml-2">
              ({flatFlights.length} total options)
            </span>
          )}
        </h2>
      </div>

      {/* Cabin Tabs */}
      <div className="border-b border-gray-700/50">
        <div className="grid grid-cols-4 gap-0">
          <button
            onClick={() => setCabinFilter('COACH')}
            className={`
              relative px-3 py-4 text-sm font-bold transition-all duration-200
              border-b-3 -mb-px
              ${cabinFilter === 'COACH'
                ? 'text-teal-400 border-teal-500 bg-teal-500/10'
                : 'text-gray-400 border-transparent hover:text-gray-300 hover:bg-gray-800/30'
              }
            `}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-base">Economy</span>
              {cabinPriceRanges['COACH'].count > 0 && (
                <span className={`
                  text-xs font-semibold
                  ${cabinFilter === 'COACH' ? 'text-teal-300' : 'text-gray-500'}
                `}>
                  {formatPrice(cabinPriceRanges['COACH'].min, currency)} — {formatPrice(cabinPriceRanges['COACH'].max, currency)}
                </span>
              )}
              <span className="text-[10px] text-gray-500">({cabinPriceRanges['COACH'].count})</span>
            </div>
          </button>
          <button
            onClick={() => setCabinFilter('PREMIUM-COACH')}
            className={`
              relative px-3 py-4 text-sm font-bold transition-all duration-200
              border-b-3 -mb-px
              ${cabinFilter === 'PREMIUM-COACH'
                ? 'text-teal-400 border-teal-500 bg-teal-500/10'
                : 'text-gray-400 border-transparent hover:text-gray-300 hover:bg-gray-800/30'
              }
            `}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-base">Premium</span>
              {cabinPriceRanges['PREMIUM-COACH'].count > 0 && (
                <span className={`
                  text-xs font-semibold
                  ${cabinFilter === 'PREMIUM-COACH' ? 'text-teal-300' : 'text-gray-500'}
                `}>
                  {formatPrice(cabinPriceRanges['PREMIUM-COACH'].min, currency)} — {formatPrice(cabinPriceRanges['PREMIUM-COACH'].max, currency)}
                </span>
              )}
              <span className="text-[10px] text-gray-500">({cabinPriceRanges['PREMIUM-COACH'].count})</span>
            </div>
          </button>
          <button
            onClick={() => setCabinFilter('BUSINESS')}
            className={`
              relative px-3 py-4 text-sm font-bold transition-all duration-200
              border-b-3 -mb-px
              ${cabinFilter === 'BUSINESS'
                ? 'text-teal-400 border-teal-500 bg-teal-500/10'
                : 'text-gray-400 border-transparent hover:text-gray-300 hover:bg-gray-800/30'
              }
            `}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-base">Business</span>
              {cabinPriceRanges['BUSINESS'].count > 0 && (
                <span className={`
                  text-xs font-semibold
                  ${cabinFilter === 'BUSINESS' ? 'text-teal-300' : 'text-gray-500'}
                `}>
                  {formatPrice(cabinPriceRanges['BUSINESS'].min, currency)} — {formatPrice(cabinPriceRanges['BUSINESS'].max, currency)}
                </span>
              )}
              <span className="text-[10px] text-gray-500">({cabinPriceRanges['BUSINESS'].count})</span>
            </div>
          </button>
          <button
            onClick={() => setCabinFilter('FIRST')}
            className={`
              relative px-3 py-4 text-sm font-bold transition-all duration-200
              border-b-3 -mb-px
              ${cabinFilter === 'FIRST'
                ? 'text-teal-400 border-teal-500 bg-teal-500/10'
                : 'text-gray-400 border-transparent hover:text-gray-300 hover:bg-gray-800/30'
              }
            `}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-base">First</span>
              {cabinPriceRanges['FIRST'].count > 0 && (
                <span className={`
                  text-xs font-semibold
                  ${cabinFilter === 'FIRST' ? 'text-teal-300' : 'text-gray-500'}
                `}>
                  {formatPrice(cabinPriceRanges['FIRST'].min, currency)} — {formatPrice(cabinPriceRanges['FIRST'].max, currency)}
                </span>
              )}
              <span className="text-[10px] text-gray-500">({cabinPriceRanges['FIRST'].count})</span>
            </div>
          </button>
        </div>
      </div>

      {/* Best / Cheap Sort Tabs */}
      <div className="border-b border-gray-700/30">
        <div className="grid grid-cols-2 gap-0">
          <button
            onClick={() => setSortMode('cheap')}
            className={`
              relative px-4 py-3 text-sm font-semibold transition-all duration-200
              border-b-2 -mb-px
              ${sortMode === 'cheap'
                ? 'text-blue-400 border-blue-500 bg-blue-500/5'
                : 'text-gray-400 border-transparent hover:text-gray-300 hover:bg-gray-800/20'
              }
            `}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-base">Cheapest</span>
              <span className={`
                text-xs font-semibold
                ${sortMode === 'cheap' ? 'text-blue-300' : 'text-gray-500'}
              `}>
                {formatPrice(sortTabPrices.cheapPrice, currency)}
              </span>
            </div>
          </button>
          <button
            onClick={() => setSortMode('best')}
            className={`
              relative px-4 py-3 text-sm font-semibold transition-all duration-200
              border-b-2 -mb-px
              ${sortMode === 'best'
                ? 'text-blue-400 border-blue-500 bg-blue-500/5'
                : 'text-gray-400 border-transparent hover:text-gray-300 hover:bg-gray-800/20'
              }
            `}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-base">Best</span>
              <span className={`
                text-xs font-semibold
                ${sortMode === 'best' ? 'text-blue-300' : 'text-gray-500'}
              `}>
                {formatPrice(sortTabPrices.bestPrice, currency)}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Grouped Flight Cards */}
      <div className="mt-4 space-y-4">
        {sortedGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Plane className="h-10 w-10 text-gray-500 mb-3" />
            <p className="text-gray-300 mb-1">No flights in this cabin</p>
            <p className="text-gray-400 text-sm">Try selecting a different cabin above</p>
          </div>
        ) : (
          sortedGroups.map((group, index) => {
            const flightId = group.primaryFlight.id;
            const shouldAutoTriggerFrt = top5FlightIds.has(flightId);

            // Convert cabin options to similar flights array for FlightCard
            const similarFlights = group.allFlights.filter(f => f.id !== group.primaryFlight.id);

            return (
              <FlightCard
                key={`flight-group-${index}-${flightId}`}
                flight={group.primaryFlight}
                similarFlights={similarFlights}
                originTimezone={originTimezone}
                displayTimezone={displayTimezone}
                perCentValue={perCentValue}
                session={results.session}
                solutionSet={results.solutionSet}
                v2EnrichmentData={v2EnrichmentData}
                onEnrichFlight={onEnrichFlight}
                enrichingAirlines={enrichingAirlines}
                shouldAutoTriggerFrt={shouldAutoTriggerFrt}
                isSearchComplete={isSearchComplete}
                searchKey={searchKey}
                expanded={expandedFlightCardId === flightId}
                onToggle={() => setExpandedFlightCardId(expandedFlightCardId === flightId ? null : flightId)}
              />
            );
          })
        )}
      </div>

      {/* Pagination */}
      {results.solutionCount && results.solutionCount > pageSize && onPageChange && (
        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={results.solutionCount}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
};

export default FlightResults;
