import React, { useState, useEffect, useMemo } from 'react';
import { Loader, AlertCircle, Plane, Code } from 'lucide-react';
import FlightCard from './FlightCard';
import MultiLegFlightCard from './MultiLegFlightCard';
import FlightCardGroup from './FlightCardGroup';
import Pagination from './Pagination';
import StopGroupSeparator from './StopGroupSeparator';
import V2EnrichmentViewer from './V2EnrichmentViewer';
import { SearchResponse, FlightSolution, GroupedFlight } from '../types/flight';

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
  perCentValue?: number;
  v2EnrichmentData?: Map<string, any[]>;
  onEnrichFlight?: (flight: any, carrierCode: string) => Promise<any>;
  enrichingAirlines?: Set<string>;
}

const groupFlightsByOutbound = (flights: FlightSolution[]): (FlightSolution | GroupedFlight)[] => {
  console.log('🔍 FlightResults: Starting grouping with', flights.length, 'flights');
  
  if (flights.length === 0) {
    console.log('⚠️ FlightResults: No flights to group');
    return flights;
  }

  // Log first few flights to understand structure
  console.log('📊 FlightResults: First flight structure:', JSON.stringify(flights[0], null, 2));
  

  const groups = new Map<string, GroupedFlight>();
  const ungroupedFlights: FlightSolution[] = [];

  flights.forEach(flight => {
    console.log('🔄 FlightResults: Processing flight:', flight.id, 'with', flight.slices.length, 'slices');
    
    if (flight.slices.length === 0) {
      console.log('⏭️ FlightResults: Skipping flight with no slices:', flight.id);
      ungroupedFlights.push(flight);
      return;
    }

    const firstSlice = flight.slices[0];
    const groupingKey = `${firstSlice.flights.join(',')}-${firstSlice.departure}-${firstSlice.arrival}`;
    
    console.log('🔑 FlightResults: Grouping key for flight', flight.id, ':', groupingKey);
    console.log('🛫 FlightResults: First slice details:', {
      flights: firstSlice.flights,
      departure: firstSlice.departure,
      arrival: firstSlice.arrival,
      origin: firstSlice.origin.code,
      destination: firstSlice.destination.code
    });

    // Check if we want to group this flight (has common outbound pattern)
    const shouldGroup = flights.filter(f => f.slices.length > 0).some(otherFlight => {
      if (otherFlight.id === flight.id) return false;
      const otherFirstSlice = otherFlight.slices[0];
      const otherGroupingKey = `${otherFirstSlice.flights.join(',')}-${otherFirstSlice.departure}-${otherFirstSlice.arrival}`;
      return otherGroupingKey === groupingKey;
    });

    if (!shouldGroup) {
      console.log('⏭️ FlightResults: No grouping needed for flight:', flight.id);
      ungroupedFlights.push(flight);
      return;
    }

    if (!groups.has(groupingKey)) {
      console.log('🆕 FlightResults: Creating new group for:', groupingKey);
      
      // Try to get carrier from multiple sources
      let carrier = { code: '', name: '', shortName: 'Unknown' };
      
      if (firstSlice.segments && firstSlice.segments[0] && firstSlice.segments[0].carrier) {
        carrier = firstSlice.segments[0].carrier;
        console.log('🏢 FlightResults: Carrier from segments:', carrier);
      } else if (flight.ext && (flight.ext as any).carrier) {
        carrier = (flight.ext as any).carrier;
        console.log('🏢 FlightResults: Carrier from ext:', carrier);
      } else {
        // Try to derive carrier from flight number
        const flightCode = firstSlice.flights[0];
        if (flightCode) {
          const carrierCode = flightCode.replace(/\d+$/, '');
          carrier = { code: carrierCode, name: carrierCode, shortName: carrierCode };
          console.log('🏢 FlightResults: Carrier derived from flight code:', carrier);
        }
      }
      
      groups.set(groupingKey, {
        outboundSlice: firstSlice,
        returnOptions: [],
        carrier: carrier,
        isNonstop: firstSlice.stops === null || firstSlice.stops.length === 0
      });
    } else {
      console.log('📝 FlightResults: Adding to existing group:', groupingKey);
    }

    const group = groups.get(groupingKey)!;
    console.log('➕ FlightResults: Adding return option to group:', groupingKey);
    console.log('✈️ FlightResults: Flight details:', firstSlice.flights, firstSlice.departure, '→', firstSlice.arrival);
    group.returnOptions.push({
      returnSlice: flight.slices[1], // Use the return slice (CDG → SFO)
      totalAmount: flight.totalAmount,
      displayTotal: flight.displayTotal,
      ext: flight.ext,
      originalFlightId: flight.id
    });
  });

  // Sort return options by price within each group
  groups.forEach(group => {
    group.returnOptions.sort((a, b) => a.totalAmount - b.totalAmount);
    console.log(`✅ FlightResults: Group has ${group.returnOptions.length} return options`);
  });

  const groupedResults = Array.from(groups.values());
  
  console.log(`📊 FlightResults: ${groupedResults.length} grouped flights, ${ungroupedFlights.length} ungrouped flights`);
  
  return [...groupedResults, ...ungroupedFlights];
};
const FlightResults: React.FC<FlightResultsProps> = ({
  results,
  loading,
  error,
  searchParams,
  advancedSettings,
  onPageChange,
  onPageSizeChange,
  currentPage = 1,
  pageSize = 25,
  originTimezone,
  perCentValue = 0.015,
  v2EnrichmentData = new Map(),
  onEnrichFlight,
  enrichingAirlines = new Set()
}) => {
  // ALL HOOKS MUST BE CALLED AT THE TOP, BEFORE ANY EARLY RETURNS
  // State to track which stop group is expanded - will be initialized after we know available groups
  const [expandedStopGroup, setExpandedStopGroup] = useState<number | null>(null);
  const [showV2EnrichmentViewer, setShowV2EnrichmentViewer] = useState(false);

  // Calculate sortedStopCounts at the top level using useMemo (safe for all states)
  const sortedStopCounts = useMemo(() => {
    if (!results || !results.solutionList || !results.solutionList.solutions || results.solutionList.solutions.length === 0) {
      return [];
    }

    const flights = results.solutionList.solutions;
    const processedFlights = flights;

    // Group flights by stop count
    const groups = new Map<number, { flights: any[], cheapestPrice: number }>();

    processedFlights.forEach(flight => {
      // Determine max stops in the flight
      let maxStops = 0;
      if ('id' in flight) {
        maxStops = Math.max(...flight.slices.map(slice => slice.stops?.length || 0));
      } else {
        maxStops = Math.max(...(flight.outboundSlice.stops?.length ? [flight.outboundSlice.stops.length] : [0]));
      }

      // Get price for comparison
      const flightPrice = 'id' in flight ? flight.displayTotal : flight.returnOptions[0]?.displayTotal || 0;

      if (!groups.has(maxStops)) {
        groups.set(maxStops, { flights: [], cheapestPrice: flightPrice });
      }

      const group = groups.get(maxStops)!;
      group.flights.push(flight);

      // Track the cheapest price in this group
      if (flightPrice < group.cheapestPrice) {
        group.cheapestPrice = flightPrice;
      }
    });

    return Array.from(groups.keys()).sort((a, b) => a - b);
  }, [results]);

  // Ensure at least one group is always open - initialize with first available (nonstop > 1 stop > 2 stops > 3 stops)
  useEffect(() => {
    if (sortedStopCounts.length > 0) {
      // If no group is open, open the first available (lowest stop count = nonstop)
      if (expandedStopGroup === null) {
        setExpandedStopGroup(sortedStopCounts[0]);
      }
      // If the currently open group no longer exists (e.g., after filtering), open the first available
      else if (!sortedStopCounts.includes(expandedStopGroup)) {
        setExpandedStopGroup(sortedStopCounts[0]);
      }
    }
  }, [sortedStopCounts, expandedStopGroup]);

  console.log('🎯 FlightResults: Rendering with results:', results);
  console.log('🎯 FlightResults: Loading state:', loading);
  console.log('🎯 FlightResults: Error state:', error);
  console.log('🎯 FlightResults: solutionCount:', results?.solutionCount);
  console.log('🎯 FlightResults: onPageChange:', onPageChange);
  console.log('🎯 FlightResults: currentPage:', currentPage);
  console.log('🎯 FlightResults: pageSize:', pageSize);

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader className="h-8 w-8 text-accent-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-300">Searching for flights...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-4" />
          <p className="text-red-300 mb-2">Search failed</p>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Show empty state if no results
  if (!results || !results.solutionList || !results.solutionList.solutions || results.solutionList.solutions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Plane className="h-8 w-8 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-300 mb-2">No flights found</p>
          <p className="text-gray-400 text-sm">Try adjusting your search criteria</p>
        </div>
      </div>
    );
  }

  // Show results
  const flights = results.solutionList.solutions;
  // Disable grouping - show each solution as a separate card (as API returns them)
  let processedFlights = flights; // groupFlightsByOutbound(flights);

  // Group similar flights together by airline + route
  const groupSimilarFlights = (flightList: (FlightSolution | GroupedFlight)[]) => {
    const grouped = new Map<string, (FlightSolution | GroupedFlight)[]>();

    flightList.forEach(flight => {
      // Create a signature based on airline, route, AND cabin (so cabin-specific options remain separate)
      let signature = '';
      if ('id' in flight) {
        const firstSlice = flight.slices[0];
        const lastSlice = flight.slices[flight.slices.length - 1];
        // Get primary airline from first segment
        const airline = firstSlice.segments[0]?.carrier.code || 'UNKNOWN';
        // Include cabin information in signature to keep cabin-specific flights separate
        const cabin = firstSlice.cabins?.join(',') || 'UNKNOWN';
        signature = `${airline}-${firstSlice.origin.code}-${lastSlice.destination.code}-${cabin}`;
      } else {
        const airline = flight.outboundSlice.segments[0]?.carrier.code || 'UNKNOWN';
        const returnDest = flight.returnOptions[0]?.returnSlice?.destination.code || flight.outboundSlice.origin.code;
        const cabin = flight.outboundSlice.cabins?.join(',') || 'UNKNOWN';
        signature = `${airline}-${flight.outboundSlice.origin.code}-${returnDest}-${cabin}`;
      }

      if (!grouped.has(signature)) {
        grouped.set(signature, []);
      }
      grouped.get(signature)!.push(flight);
    });

    // Convert to primary/similar structure and sort within groups
    return Array.from(grouped.values()).map(group => {
      // Sort group by best value: mileage deals first, then by price, then by duration
      const sorted = group.sort((a, b) => {
        const aFlight = 'id' in a ? a : a.returnOptions[0];
        const bFlight = 'id' in b ? b : b.returnOptions[0];

        // Prioritize mileage deals
        const aMileageValue = (aFlight.totalMileage || 0) > 0
          ? ((aFlight.totalMileage || 0) * 0.015) + (aFlight.totalMileagePrice || 0)
          : Infinity;
        const bMileageValue = (bFlight.totalMileage || 0) > 0
          ? ((bFlight.totalMileage || 0) * 0.015) + (bFlight.totalMileagePrice || 0)
          : Infinity;

        if (aMileageValue !== Infinity && bMileageValue !== Infinity) {
          return aMileageValue - bMileageValue;
        }
        if (aMileageValue !== Infinity) return -1;
        if (bMileageValue !== Infinity) return 1;

        // Compare by cash price
        const priceCompare = (aFlight.totalAmount || 0) - (bFlight.totalAmount || 0);
        if (priceCompare !== 0) return priceCompare;

        // If prices equal, compare by duration (shorter is better)
        const aDuration = 'id' in a
          ? a.slices.reduce((sum, slice) => sum + slice.duration, 0)
          : (a.outboundSlice.duration + (a.returnOptions[0]?.returnSlice?.duration || 0));
        const bDuration = 'id' in b
          ? b.slices.reduce((sum, slice) => sum + slice.duration, 0)
          : (b.outboundSlice.duration + (b.returnOptions[0]?.returnSlice?.duration || 0));

        return aDuration - bDuration;
      });

      return {
        primary: sorted[0],
        similar: sorted.slice(1)
      };
    });
  };

  const groupedFlights = groupSimilarFlights(processedFlights);

  // Group flights by stop count
  const groupByStops = (flightList: (FlightSolution | GroupedFlight)[]) => {
    const groups = new Map<number, { flights: (FlightSolution | GroupedFlight)[], cheapestPrice: number }>();

    flightList.forEach(flight => {
      // Determine max stops in the flight
      let maxStops = 0;
      if ('id' in flight) {
        maxStops = Math.max(...flight.slices.map(slice => slice.stops?.length || 0));
      } else {
        maxStops = Math.max(...(flight.outboundSlice.stops?.length ? [flight.outboundSlice.stops.length] : [0]));
      }

      // Get price for comparison
      const flightPrice = 'id' in flight ? flight.displayTotal : flight.returnOptions[0]?.displayTotal || 0;

      if (!groups.has(maxStops)) {
        groups.set(maxStops, { flights: [], cheapestPrice: flightPrice });
      }

      const group = groups.get(maxStops)!;
      group.flights.push(flight);

      // Track the cheapest price in this group (always the minimum)
      if (flightPrice < group.cheapestPrice) {
        group.cheapestPrice = flightPrice;
      }
    });

    // Sort each group by price (internal sorting doesn't affect cheapest tracking)
    groups.forEach(group => {
      group.flights.sort((a, b) => {
        const aFlight = 'id' in a ? a : a.returnOptions[0];
        const bFlight = 'id' in b ? b : b.returnOptions[0];

        const aMileageValue = (aFlight.totalMileage || 0) > 0
          ? ((aFlight.totalMileage || 0) * 0.015) + (aFlight.totalMileagePrice || 0)
          : Infinity;
        const bMileageValue = (bFlight.totalMileage || 0) > 0
          ? ((bFlight.totalMileage || 0) * 0.015) + (bFlight.totalMileagePrice || 0)
          : Infinity;

        if (aMileageValue !== Infinity && bMileageValue !== Infinity) {
          return aMileageValue - bMileageValue;
        }
        if (aMileageValue !== Infinity) return -1;
        if (bMileageValue !== Infinity) return 1;

        return (aFlight.totalAmount || 0) - (bFlight.totalAmount || 0);
      });
    });

    return groups;
  };

  const stopGroups = groupByStops(processedFlights);

  return (
    <div className="space-y-6">
      {/* Results Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">
          {results.solutionCount ? (
            // Show "Y flights" when metadata available, with "Showing X of Y" only during progressive loading
            processedFlights.length < results.solutionCount && processedFlights.length > 0
              ? `Showing ${processedFlights.length} of ${results.solutionCount} flight${results.solutionCount !== 1 ? 's' : ''}`
              : `${results.solutionCount} flight${results.solutionCount !== 1 ? 's' : ''} found`
          ) : (
            // Fallback: show current count while waiting for metadata
            `${processedFlights.length} flight${processedFlights.length !== 1 ? 's' : ''} found`
          )}
        </h2>
        <div className="flex items-center gap-4">
          {results.solutionList.minPrice && (
            <div className="text-sm text-gray-400">
              From {results.solutionList.minPrice}
            </div>
          )}
          {/* V2 Enrichment JSON Viewer Button - Development Tool */}
          {v2EnrichmentData.size > 0 && (
            <button
              onClick={() => setShowV2EnrichmentViewer(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm font-medium transition-colors border border-purple-500/30"
              title="View V2 Enrichment JSON Data"
            >
              <Code className="h-4 w-4" />
              <span>View V2 Data</span>
              <span className="text-xs bg-purple-500/30 px-1.5 py-0.5 rounded">
                {v2EnrichmentData.size}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Flight Cards - Grouped by Stops */}
      <div className="space-y-4">
        {sortedStopCounts.map((stopCount, groupIndex) => {
          const groupData = stopGroups.get(stopCount);
          if (!groupData) return null;

          const { flights: groupFlights, cheapestPrice } = groupData;
          const firstFlight = groupFlights[0];
          const currency = firstFlight && 'id' in firstFlight
            ? firstFlight.currency
            : 'USD';

          const isExpanded = expandedStopGroup === stopCount;

          return (
            <React.Fragment key={`stop-group-${stopCount}`}>
              {/* Stop Group Separator */}
              {groupFlights.length > 0 && (
                <StopGroupSeparator
                  stopCount={stopCount}
                  flightCount={groupFlights.length}
                  lowestPrice={cheapestPrice}
                  currency={currency}
                  isExpanded={isExpanded}
                  onClick={() => {
                    // If clicking the currently expanded group
                    if (isExpanded) {
                      // Find other available groups
                      const otherGroups = sortedStopCounts.filter(count => count !== stopCount);
                      // Only allow switching if there's another group to open
                      if (otherGroups.length > 0) {
                        // Open the next available group (prefer lower stop count = nonstop)
                        setExpandedStopGroup(otherGroups[0]);
                      }
                      // If this is the only group, do nothing (prevent closing - at least one must stay open)
                    } else {
                      // Opening a different group - automatically close previous and open this one
                      setExpandedStopGroup(stopCount);
                    }
                  }}
                />
              )}

              {/* Flights in this stop group - only show when expanded */}
              {isExpanded && (() => {
                // Re-group the flights in this stop category
                const stopGrouped = groupSimilarFlights(groupFlights);
                return stopGrouped.map((group, index) => (
                  <FlightCardGroup
                    key={`flight-group-${stopCount}-${index}`}
                    primaryFlight={group.primary}
                    similarFlights={group.similar}
                    originTimezone={originTimezone}
                    perCentValue={perCentValue}
                    session={results.session}
                    solutionSet={results.solutionSet}
                    v2EnrichmentData={v2EnrichmentData}
                    onEnrichFlight={onEnrichFlight}
                    enrichingAirlines={enrichingAirlines}
                  />
                ));
              })()}
            </React.Fragment>
          );
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

      {/* V2 Enrichment JSON Viewer Modal */}
      {showV2EnrichmentViewer && (
        <V2EnrichmentViewer
          enrichmentData={v2EnrichmentData}
          onClose={() => setShowV2EnrichmentViewer(false)}
        />
      )}
    </div>
  );
};

export default FlightResults;