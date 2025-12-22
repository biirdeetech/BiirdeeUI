import React, { useState, useEffect, useMemo } from 'react';
import { Loader, AlertCircle, Plane } from 'lucide-react';
import FlightCard from './FlightCard';
import MultiLegFlightCard from './MultiLegFlightCard';
import Pagination from './Pagination';
import { SearchResponse, FlightSolution, GroupedFlight } from '../types/flight';
import { formatPrice } from '../utils/priceFormatter';

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
  const [sortMode, setSortMode] = useState<'best' | 'cheap'>('cheap');
  const [expandedFlightCardId, setExpandedFlightCardId] = useState<string | null>(null);

  // Helper to calculate total duration of a flight in minutes
  const getFlightDuration = (flight: FlightSolution | GroupedFlight): number => {
    if ('id' in flight) {
      // Regular flight - sum all slice durations
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
      // Grouped flight - use outbound slice duration
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

  // Get flat list of flights
  const flatFlights = useMemo(() => {
    if (!results || !results.solutionList || !results.solutionList.solutions) {
      return [];
    }
    return results.solutionList.solutions;
  }, [results]);

  // Calculate prices for Best and Cheap tabs
  const tabPrices = useMemo(() => {
    if (flatFlights.length === 0) {
      return { bestPrice: 0, cheapPrice: 0 };
    }

    // Find fastest flight (best)
    let fastestFlight = flatFlights[0];
    let minDuration = getFlightDuration(fastestFlight);

    for (const flight of flatFlights) {
      const duration = getFlightDuration(flight);
      if (duration < minDuration) {
        minDuration = duration;
        fastestFlight = flight;
      }
    }

    // Find cheapest flight
    let cheapestFlight = flatFlights[0];
    let minPrice = 'id' in cheapestFlight ? cheapestFlight.displayTotal : cheapestFlight.returnOptions[0]?.displayTotal || 0;

    for (const flight of flatFlights) {
      const price = 'id' in flight ? flight.displayTotal : flight.returnOptions[0]?.displayTotal || 0;
      if (price < minPrice) {
        minPrice = price;
        cheapestFlight = flight;
      }
    }

    const bestPrice = 'id' in fastestFlight ? fastestFlight.displayTotal : fastestFlight.returnOptions[0]?.displayTotal || 0;
    const cheapPrice = 'id' in cheapestFlight ? cheapestFlight.displayTotal : cheapestFlight.returnOptions[0]?.displayTotal || 0;

    return { bestPrice, cheapPrice };
  }, [flatFlights]);

  // Sort flights by best (fastest) or cheap (lowest price)
  const sortedFlights = useMemo(() => {
    const flights = [...flatFlights];

    if (sortMode === 'best') {
      // Sort by duration (fastest first)
      flights.sort((a, b) => {
        const aDuration = getFlightDuration(a);
        const bDuration = getFlightDuration(b);
        return aDuration - bDuration;
      });
    } else {
      // Sort by price (cheapest first)
      flights.sort((a, b) => {
        const aPrice = 'id' in a ? a.displayTotal : a.returnOptions[0]?.displayTotal || 0;
        const bPrice = 'id' in b ? b.displayTotal : b.returnOptions[0]?.displayTotal || 0;
        return aPrice - bPrice;
      });
    }

    return flights;
  }, [flatFlights, sortMode]);

  // Determine top 5 for FRT auto-trigger
  const top5FlightIds = useMemo(() => {
    const rankedFlights = sortedFlights.slice(0, 5).map(flight => {
      if ('id' in flight) {
        return flight.id;
      }
      return `${flight.outboundSlice.flights?.[0]}-${flight.outboundSlice.departure}`;
    });
    return new Set(rankedFlights);
  }, [sortedFlights]);

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
  if (!results || !results.solutionList || sortedFlights.length === 0) {
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

  const firstFlight = sortedFlights[0];
  const currency = firstFlight && 'id' in firstFlight ? firstFlight.currency : 'USD';

  return (
    <div className="space-y-6">
      {/* Results Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">
          {results.solutionCount ? (
            sortedFlights.length < results.solutionCount && sortedFlights.length > 0
              ? `Showing ${sortedFlights.length} of ${results.solutionCount} flight${results.solutionCount !== 1 ? 's' : ''}`
              : `${results.solutionCount} flight${results.solutionCount !== 1 ? 's' : ''} found`
          ) : (
            `${sortedFlights.length} flight${sortedFlights.length !== 1 ? 's' : ''} found`
          )}
        </h2>
      </div>

      {/* Best / Cheap Tabs */}
      <div className="border-b border-gray-700/50">
        <div className="grid grid-cols-2 gap-0">
          <button
            onClick={() => setSortMode('best')}
            className={`
              relative px-5 py-4 text-base font-bold transition-all duration-200
              border-b-3 -mb-px
              ${sortMode === 'best'
                ? 'text-blue-400 border-blue-500 bg-blue-500/10'
                : 'text-gray-400 border-transparent hover:text-gray-300 hover:bg-gray-800/30'
              }
            `}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-lg">Best</span>
              <span className={`
                text-sm font-semibold
                ${sortMode === 'best' ? 'text-blue-300' : 'text-gray-500'}
              `}>
                {formatPrice(tabPrices.bestPrice, currency)}
              </span>
              <span className="text-xs text-gray-500">(Fastest)</span>
            </div>
          </button>
          <button
            onClick={() => setSortMode('cheap')}
            className={`
              relative px-5 py-4 text-base font-bold transition-all duration-200
              border-b-3 -mb-px
              ${sortMode === 'cheap'
                ? 'text-blue-400 border-blue-500 bg-blue-500/10'
                : 'text-gray-400 border-transparent hover:text-gray-300 hover:bg-gray-800/30'
              }
            `}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-lg">Cheap</span>
              <span className={`
                text-sm font-semibold
                ${sortMode === 'cheap' ? 'text-blue-300' : 'text-gray-500'}
              `}>
                {formatPrice(tabPrices.cheapPrice, currency)}
              </span>
              <span className="text-xs text-gray-500">(Cheapest)</span>
            </div>
          </button>
        </div>
      </div>

      {/* Flat Flight Cards */}
      <div className="mt-4 space-y-4">
        {sortedFlights.map((flight, index) => {
          // Determine if this flight should auto-trigger FRT
          const flightId = 'id' in flight
            ? flight.id
            : `${flight.outboundSlice.flights?.[0]}-${flight.outboundSlice.departure}`;
          const shouldAutoTriggerFrt = top5FlightIds.has(flightId);

          // Render MultiLegFlightCard for grouped flights, FlightCard for single flights
          if ('outboundSlice' in flight) {
            return (
              <MultiLegFlightCard
                key={`flight-${index}-${flightId}`}
                flight={flight}
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
              />
            );
          } else {
            return (
              <FlightCard
                key={`flight-${index}-${flightId}`}
                flight={flight}
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
          }
        })}
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
