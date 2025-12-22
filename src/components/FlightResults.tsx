import React, { useState, useMemo } from 'react';
import { Loader, AlertCircle, Plane } from 'lucide-react';
import FlightCard from './FlightCard';
import MultiLegFlightCard from './MultiLegFlightCard';
import Pagination from './Pagination';
import { SearchResponse, FlightSolution, GroupedFlight } from '../types/flight';
import { formatPrice } from '../utils/priceFormatter';
import { groupFlightsByCabin, GroupedFlightByCabin, detectCodeShares } from '../utils/cabinGrouping';

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

  // Helper to count total stops in a flight
  const getFlightStops = (flight: FlightSolution | GroupedFlight): number => {
    if ('id' in flight) {
      return flight.slices.reduce((total, slice) => {
        const segmentCount = slice.segment?.length || 0;
        return total + Math.max(0, segmentCount - 1);
      }, 0);
    }
    return 0;
  };

  // Get flat list of flights (only FlightSolution, not GroupedFlight)
  const flatFlights = useMemo(() => {
    if (!results || !results.solutionList || !results.solutionList.solutions) {
      return [];
    }
    // Filter to only FlightSolution (exclude GroupedFlight from round trip searches)
    return results.solutionList.solutions.filter(f => 'id' in f) as FlightSolution[];
  }, [results]);

  // Group flights by cabin and detect code-shares
  const groupedByCabin = useMemo(() => {
    console.log('🔄 FlightResults: Grouping flights by cabin');
    const grouped = groupFlightsByCabin(flatFlights);
    console.log(`✅ FlightResults: Grouped into ${grouped.length} flight groups`);

    // Detect code-share relationships
    const withCodeShares = detectCodeShares(grouped);
    console.log(`✅ FlightResults: Code-share detection complete`);

    return withCodeShares;
  }, [flatFlights]);

  // Calculate cheapest and best prices for each cabin tab
  const cabinPriceRanges = useMemo(() => {
    const ranges: Record<string, { cheapestPrice: number; bestPrice: number; count: number; codeShareParentCount: number }> = {
      'COACH': { cheapestPrice: Infinity, bestPrice: Infinity, count: 0, codeShareParentCount: 0 },
      'PREMIUM-COACH': { cheapestPrice: Infinity, bestPrice: Infinity, count: 0, codeShareParentCount: 0 },
      'BUSINESS': { cheapestPrice: Infinity, bestPrice: Infinity, count: 0, codeShareParentCount: 0 },
      'FIRST': { cheapestPrice: Infinity, bestPrice: Infinity, count: 0, codeShareParentCount: 0 }
    };

    const cabinCodes = ['COACH', 'PREMIUM-COACH', 'BUSINESS', 'FIRST'] as const;

    cabinCodes.forEach(cabinCode => {
      const flightsInCabin = groupedByCabin.filter(group => group.cabinOptions.has(cabinCode));

      if (flightsInCabin.length === 0) {
        ranges[cabinCode].cheapestPrice = 0;
        ranges[cabinCode].bestPrice = 0;
        return;
      }

      ranges[cabinCode].count = flightsInCabin.length;

      // Count code-share parents
      ranges[cabinCode].codeShareParentCount = flightsInCabin.filter(group => group.isParentCodeShare).length;

      // Find cheapest price
      let minPrice = Infinity;
      for (const group of flightsInCabin) {
        const price = group.cabinOptions.get(cabinCode)?.price || Infinity;
        minPrice = Math.min(minPrice, price);
      }
      ranges[cabinCode].cheapestPrice = minPrice;

      // Find best flight (fewest stops, fastest, then cheapest)
      let bestFlight = flightsInCabin[0];
      let bestStops = getFlightStops(bestFlight.primaryFlight);
      let bestDuration = getFlightDuration(bestFlight.primaryFlight);
      let bestPrice = bestFlight.cabinOptions.get(cabinCode)?.price || Infinity;

      for (const group of flightsInCabin) {
        const stops = getFlightStops(group.primaryFlight);
        const duration = getFlightDuration(group.primaryFlight);
        const price = group.cabinOptions.get(cabinCode)?.price || Infinity;

        // Compare: stops first, then duration, then price
        const isBetter =
          stops < bestStops ||
          (stops === bestStops && duration < bestDuration) ||
          (stops === bestStops && duration === bestDuration && price < bestPrice);

        if (isBetter) {
          bestFlight = group;
          bestStops = stops;
          bestDuration = duration;
          bestPrice = price;
        }
      }

      ranges[cabinCode].bestPrice = bestPrice;
    });

    return ranges;
  }, [groupedByCabin]);

  // Filter flights by selected cabin
  const filteredByCabin = useMemo(() => {
    return groupedByCabin.filter(group => group.cabinOptions.has(cabinFilter));
  }, [groupedByCabin, cabinFilter]);

  // Sort filtered flights by best or cheap
  const sortedGroups = useMemo(() => {
    const groups = [...filteredByCabin];

    if (sortMode === 'best') {
      // Best = fewest stops, fastest duration, then cheapest price
      groups.sort((a, b) => {
        const aStops = getFlightStops(a.primaryFlight);
        const bStops = getFlightStops(b.primaryFlight);

        if (aStops !== bStops) {
          return aStops - bStops;
        }

        const aDuration = getFlightDuration(a.primaryFlight);
        const bDuration = getFlightDuration(b.primaryFlight);

        if (aDuration !== bDuration) {
          return aDuration - bDuration;
        }

        const aPrice = a.cabinOptions.get(cabinFilter)?.price || 0;
        const bPrice = b.cabinOptions.get(cabinFilter)?.price || 0;
        return aPrice - bPrice;
      });
    } else {
      // Cheapest = lowest price only
      groups.sort((a, b) => {
        const aPrice = a.cabinOptions.get(cabinFilter)?.price || 0;
        const bPrice = b.cabinOptions.get(cabinFilter)?.price || 0;
        return aPrice - bPrice;
      });
    }

    return groups;
  }, [filteredByCabin, sortMode, cabinFilter]);

  // Calculate prices for Best and Cheap sort tabs (within selected cabin)
  const sortTabPrices = useMemo(() => {
    if (filteredByCabin.length === 0) {
      return { bestPrice: 0, cheapPrice: 0 };
    }

    // Find cheapest price
    let cheapestPrice = Infinity;
    for (const group of filteredByCabin) {
      const price = group.cabinOptions.get(cabinFilter)?.price || Infinity;
      cheapestPrice = Math.min(cheapestPrice, price);
    }

    // Find best flight (fewest stops, fastest, then cheapest)
    let bestGroup = filteredByCabin[0];
    let bestStops = getFlightStops(bestGroup.primaryFlight);
    let bestDuration = getFlightDuration(bestGroup.primaryFlight);
    let bestPrice = bestGroup.cabinOptions.get(cabinFilter)?.price || Infinity;

    for (const group of filteredByCabin) {
      const stops = getFlightStops(group.primaryFlight);
      const duration = getFlightDuration(group.primaryFlight);
      const price = group.cabinOptions.get(cabinFilter)?.price || Infinity;

      const isBetter =
        stops < bestStops ||
        (stops === bestStops && duration < bestDuration) ||
        (stops === bestStops && duration === bestDuration && price < bestPrice);

      if (isBetter) {
        bestGroup = group;
        bestStops = stops;
        bestDuration = duration;
        bestPrice = price;
      }
    }

    return {
      bestPrice: bestPrice === Infinity ? 0 : bestPrice,
      cheapPrice: cheapestPrice === Infinity ? 0 : cheapestPrice
    };
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
                  {cabinPriceRanges['COACH'].cheapestPrice === cabinPriceRanges['COACH'].bestPrice
                    ? formatPrice(cabinPriceRanges['COACH'].cheapestPrice, currency)
                    : `${formatPrice(cabinPriceRanges['COACH'].cheapestPrice, currency)} — ${formatPrice(cabinPriceRanges['COACH'].bestPrice, currency)}`
                  }
                </span>
              )}
              <span className="text-[10px] text-gray-500">
                ({cabinPriceRanges['COACH'].count}
                {cabinPriceRanges['COACH'].codeShareParentCount > 0 &&
                  ` • ${cabinPriceRanges['COACH'].codeShareParentCount} code-share parent${cabinPriceRanges['COACH'].codeShareParentCount !== 1 ? 's' : ''}`
                })
              </span>
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
                  {cabinPriceRanges['PREMIUM-COACH'].cheapestPrice === cabinPriceRanges['PREMIUM-COACH'].bestPrice
                    ? formatPrice(cabinPriceRanges['PREMIUM-COACH'].cheapestPrice, currency)
                    : `${formatPrice(cabinPriceRanges['PREMIUM-COACH'].cheapestPrice, currency)} — ${formatPrice(cabinPriceRanges['PREMIUM-COACH'].bestPrice, currency)}`
                  }
                </span>
              )}
              <span className="text-[10px] text-gray-500">
                ({cabinPriceRanges['PREMIUM-COACH'].count}
                {cabinPriceRanges['PREMIUM-COACH'].codeShareParentCount > 0 &&
                  ` • ${cabinPriceRanges['PREMIUM-COACH'].codeShareParentCount} code-share parent${cabinPriceRanges['PREMIUM-COACH'].codeShareParentCount !== 1 ? 's' : ''}`
                })
              </span>
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
                  {cabinPriceRanges['BUSINESS'].cheapestPrice === cabinPriceRanges['BUSINESS'].bestPrice
                    ? formatPrice(cabinPriceRanges['BUSINESS'].cheapestPrice, currency)
                    : `${formatPrice(cabinPriceRanges['BUSINESS'].cheapestPrice, currency)} — ${formatPrice(cabinPriceRanges['BUSINESS'].bestPrice, currency)}`
                  }
                </span>
              )}
              <span className="text-[10px] text-gray-500">
                ({cabinPriceRanges['BUSINESS'].count}
                {cabinPriceRanges['BUSINESS'].codeShareParentCount > 0 &&
                  ` • ${cabinPriceRanges['BUSINESS'].codeShareParentCount} code-share parent${cabinPriceRanges['BUSINESS'].codeShareParentCount !== 1 ? 's' : ''}`
                })
              </span>
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
                  {cabinPriceRanges['FIRST'].cheapestPrice === cabinPriceRanges['FIRST'].bestPrice
                    ? formatPrice(cabinPriceRanges['FIRST'].cheapestPrice, currency)
                    : `${formatPrice(cabinPriceRanges['FIRST'].cheapestPrice, currency)} — ${formatPrice(cabinPriceRanges['FIRST'].bestPrice, currency)}`
                  }
                </span>
              )}
              <span className="text-[10px] text-gray-500">
                ({cabinPriceRanges['FIRST'].count}
                {cabinPriceRanges['FIRST'].codeShareParentCount > 0 &&
                  ` • ${cabinPriceRanges['FIRST'].codeShareParentCount} code-share parent${cabinPriceRanges['FIRST'].codeShareParentCount !== 1 ? 's' : ''}`
                })
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Best / Cheap Sort Tabs - only show if there's a meaningful difference */}
      {sortTabPrices.cheapPrice !== sortTabPrices.bestPrice && (
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
      )}

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

            // Get code-share partners (convert to primary flights)
            const codeSharePartnerFlights = group.codeSharePartners?.map(partner => partner.primaryFlight) || [];

            return (
              <FlightCard
                key={`flight-group-${index}-${flightId}`}
                flight={group.primaryFlight}
                similarFlights={similarFlights}
                codeShareFlights={codeSharePartnerFlights}
                codeShareFlightsCount={codeSharePartnerFlights.length}
                showCodeShareOptions={true}
                isParentCodeShare={group.isParentCodeShare}
                isChildCodeShare={group.isChildCodeShare}
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
