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

  // Get grouping mode from environment variable (default: "segment")
  const groupingMode = (import.meta.env.VITE_FLIGHT_GROUPING_MODE || 'segment') as 'segment' | 'flight';

  // Helper to extract airline code from flight number
  const getAirlineCode = (flightNumber: string): string => {
    if (!flightNumber) return '';
    const match = flightNumber.match(/^([A-Z]+)/);
    return match ? match[1] : '';
  };

  // Helper to get airline code from flight
  const getFlightAirlineCode = (f: FlightSolution | GroupedFlight): string => {
    if ('id' in f) {
      const firstSlice = f.slices[0];
      if (firstSlice.segments && firstSlice.segments.length > 0 && firstSlice.segments[0].carrier?.code) {
        return firstSlice.segments[0].carrier.code;
      }
      const flightNumber = firstSlice.flights?.[0] || '';
      return getAirlineCode(flightNumber);
    } else {
      if (f.carrier?.code) {
        return f.carrier.code;
      }
      const flightNumber = f.outboundSlice.flights?.[0] || '';
      return getAirlineCode(flightNumber);
    }
  };

  // Helper to extract date from ISO string (YYYY-MM-DD) without timezone conversion
  const getDateFromISO = (isoString: string): string => {
    if (!isoString) return '';
    // Extract date part (YYYY-MM-DD) from ISO string before timezone conversion
    const dateMatch = isoString.match(/^(\d{4}-\d{2}-\d{2})/);
    return dateMatch ? dateMatch[1] : '';
  };

  // Helper to get time option signature (same airline, origin, destination, day, cabin)
  const getTimeOptionSignature = (f: FlightSolution | GroupedFlight) => {
    const airlineCode = getFlightAirlineCode(f);
    if ('id' in f) {
      const firstSlice = f.slices[0];
      const lastSlice = f.slices[f.slices.length - 1];
      const origin = firstSlice.origin?.code || '';
      const destination = lastSlice.destination?.code || '';
      const departureDate = firstSlice.departure ? getDateFromISO(firstSlice.departure) : '';
      const cabin = firstSlice.cabins?.join(',') || 'UNKNOWN';
      return `TIME-${airlineCode}-${origin}-${destination}-${departureDate}-${cabin}`;
    } else {
      const origin = f.outboundSlice.origin?.code || '';
      const destination = f.outboundSlice.destination?.code || '';
      const departureDate = f.outboundSlice.departure ? getDateFromISO(f.outboundSlice.departure) : '';
      const cabin = f.outboundSlice.cabins?.join(',') || 'UNKNOWN';
      return `TIME-${airlineCode}-${origin}-${destination}-${departureDate}-${cabin}`;
    }
  };

  // Helper to normalize departure time to minute precision (removes seconds/milliseconds)
  const normalizeDepartureToMinute = (departure: string): string => {
    if (!departure) return '';
    // Extract date+time up to minutes: YYYY-MM-DDTHH:MM
    return departure.substring(0, 16);
  };

  // Group similar flights together
  const groupSimilarFlights = (flightList: (FlightSolution | GroupedFlight)[]) => {
    const grouped = new Map<string, (FlightSolution | GroupedFlight)[]>();
    const timeOptionGroups = new Map<string, (FlightSolution | GroupedFlight)[]>();

    // First pass: Group by airline + flight number + departure time (to minute) + origin (NO cabin)
    // This ensures flights with same airline, route, departure time are grouped together regardless of cabin
    // All cabin variations will be shown in the same card
    flightList.forEach(flight => {
      let signature = '';
      const airlineCode = getFlightAirlineCode(flight);

      if (groupingMode === 'segment') {
        // Group by airline + flight number + departure time + origin (ignoring cabin, arrival time and layovers)
        if ('id' in flight) {
          // For FlightSolution: get first slice info
          const firstSlice = flight.slices[0];
          const flightNumber = firstSlice.flights?.[0] || '';
          const departure = normalizeDepartureToMinute(firstSlice.departure || '');
          const origin = firstSlice.origin?.code || '';

          // Group by: airline + flight number + departure time (minute precision) + origin (NO cabin)
          // This groups ALL cabins for the same airline flight together
          signature = `FLIGHT-${airlineCode}-${flightNumber}-${departure}-${origin}`;
        } else {
          // For GroupedFlight: get outbound slice info
          const flightNumber = flight.outboundSlice.flights?.[0] || '';
          const departure = normalizeDepartureToMinute(flight.outboundSlice.departure || '');
          const origin = flight.outboundSlice.origin?.code || '';

          // Group by: airline + flight number + departure time (minute precision) + origin (NO cabin)
          signature = `FLIGHT-${airlineCode}-${flightNumber}-${departure}-${origin}`;
        }
      } else {
        // Group by airline + flight (flight number + departure time + origin) - groups same flight with different cabins/arrival/layovers/prices
        if ('id' in flight) {
          const firstSlice = flight.slices[0];
          const flightNumber = firstSlice.flights?.[0] || '';
          const departure = normalizeDepartureToMinute(firstSlice.departure || '');
          const origin = firstSlice.origin?.code || '';

          // Group by: airline + flight number + departure time (minute precision) + origin (NO cabin)
          // This groups ALL cabins for the same airline flight together
          signature = `FLIGHT-${airlineCode}-${flightNumber}-${departure}-${origin}`;
        } else {
          const flightNumber = flight.outboundSlice.flights?.[0] || '';
          const departure = normalizeDepartureToMinute(flight.outboundSlice.departure || '');
          const origin = flight.outboundSlice.origin?.code || '';
          signature = `FLIGHT-${airlineCode}-${flightNumber}-${departure}-${origin}`;
        }
      }

      if (!grouped.has(signature)) {
        grouped.set(signature, []);
      }
      grouped.get(signature)!.push(flight);

      // Also track by time option signature for merging
      const timeSig = getTimeOptionSignature(flight);
      if (!timeOptionGroups.has(timeSig)) {
        timeOptionGroups.set(timeSig, []);
      }
      timeOptionGroups.get(timeSig)!.push(flight);
    });

    // Helper to compare flights by ID
    const getFlightId = (f: FlightSolution | GroupedFlight): string => {
      if ('id' in f) return f.id;
      // For grouped flights, use a combination of outbound slice details
      return `${f.outboundSlice.flights?.[0]}-${f.outboundSlice.departure}-${f.outboundSlice.arrival}`;
    };

    const flightIdMap = new Map<string, FlightSolution | GroupedFlight>();
    // Build a map of flight IDs to flights for quick lookup
    flightList.forEach(f => {
      flightIdMap.set(getFlightId(f), f);
    });

    // Second pass: Merge groups that share time options (if they have 2+ flights)
    // We need to process all time option groups and merge any groups that contain flights with the same time signature
    const processedTimeSigs = new Set<string>();
    
    timeOptionGroups.forEach((timeGroup, timeSig) => {
      if (timeGroup.length >= 2 && !processedTimeSigs.has(timeSig)) {
        processedTimeSigs.add(timeSig);
        
        // Find all existing groups that contain any of these flights
        const groupsToMerge = new Set<string>();
        const timeGroupIds = new Set(timeGroup.map(f => getFlightId(f)));
        
        // Find all groups that contain any flight from this time group
        for (const [sig, group] of grouped.entries()) {
          const groupIds = new Set(group.map(f => getFlightId(f)));
          const hasMatch = Array.from(timeGroupIds).some(id => groupIds.has(id));
          if (hasMatch) {
            groupsToMerge.add(sig);
          }
        }

        // Collect ALL flights that share this time signature (from timeGroup)
        const allTimeSigFlights: (FlightSolution | GroupedFlight)[] = [];
        const seenTimeSigIds = new Set<string>();
        timeGroup.forEach(f => {
          const flightId = getFlightId(f);
          if (!seenTimeSigIds.has(flightId)) {
            seenTimeSigIds.add(flightId);
            allTimeSigFlights.push(f);
          }
        });

        // If we found groups to merge, merge them all
        if (groupsToMerge.size > 0) {
          const groupsArray = Array.from(groupsToMerge);
          const primaryGroup = groupsArray[0];
          const mergedFlights: (FlightSolution | GroupedFlight)[] = [];
          const seenFlightIds = new Set<string>();

          // Collect ALL flights from all groups to merge (avoid duplicates by ID)
          groupsArray.forEach(sig => {
            grouped.get(sig)?.forEach(f => {
              const flightId = getFlightId(f);
              if (!seenFlightIds.has(flightId)) {
                seenFlightIds.add(flightId);
                mergedFlights.push(f);
              }
            });
          });

          // Also add any flights from timeGroup that aren't already in mergedFlights
          allTimeSigFlights.forEach(f => {
            const flightId = getFlightId(f);
            if (!seenFlightIds.has(flightId)) {
              seenFlightIds.add(flightId);
              mergedFlights.push(f);
            }
          });

          // Remove all merged groups except the primary
          groupsArray.slice(1).forEach(sig => grouped.delete(sig));

          // Update primary group with all merged flights
          grouped.set(primaryGroup, mergedFlights);
        } else {
          // No existing groups found, create a new group with all time sig flights
          // Use the first flight's signature as the group key
          if (allTimeSigFlights.length > 0) {
            const firstFlight = allTimeSigFlights[0];
            const airlineCode = getFlightAirlineCode(firstFlight);
            let newSignature = '';
            if ('id' in firstFlight) {
              const firstSlice = firstFlight.slices[0];
              const flightNumber = firstSlice.flights?.[0] || '';
              const departure = firstSlice.departure || '';
              const origin = firstSlice.origin?.code || '';
              const cabin = firstSlice.cabins?.join(',') || 'UNKNOWN';
              newSignature = `FLIGHT-${airlineCode}-${flightNumber}-${departure}-${origin}-${cabin}`;
            } else {
              const flightNumber = firstFlight.outboundSlice.flights?.[0] || '';
              const departure = firstFlight.outboundSlice.departure || '';
              const origin = firstFlight.outboundSlice.origin?.code || '';
              const cabin = firstFlight.outboundSlice.cabins?.join(',') || 'UNKNOWN';
              newSignature = `FLIGHT-${airlineCode}-${flightNumber}-${departure}-${origin}-${cabin}`;
            }
            grouped.set(newSignature, allTimeSigFlights);
          }
        }
      }
    });

    // Deduplicate across groups: Merge groups that have flights with same airline, route, departure time
    // Create a map of normalized route keys to groups (NO cabin in key - group all cabins together)
    const routeKeyToGroups = new Map<string, string[]>();

    grouped.forEach((flights, signature) => {
      if (flights.length === 0) return;

      const firstFlight = flights[0];
      const airlineCode = getFlightAirlineCode(firstFlight);
      let routeKey = '';

      if ('id' in firstFlight) {
        const firstSlice = firstFlight.slices[0];
        const lastSlice = firstFlight.slices[firstFlight.slices.length - 1];
        const departure = normalizeDepartureToMinute(firstSlice.departure || '');
        const origin = firstSlice.origin?.code || '';
        const destination = lastSlice.destination?.code || '';
        // NO cabin in key - group all cabins for same airline together
        routeKey = `${airlineCode}-${origin}-${destination}-${departure}`;
      } else {
        const departure = normalizeDepartureToMinute(firstFlight.outboundSlice.departure || '');
        const origin = firstFlight.outboundSlice.origin?.code || '';
        const destination = firstFlight.outboundSlice.destination?.code || '';
        // NO cabin in key - group all cabins for same airline together
        routeKey = `${airlineCode}-${origin}-${destination}-${departure}`;
      }
      
      if (!routeKeyToGroups.has(routeKey)) {
        routeKeyToGroups.set(routeKey, []);
      }
      routeKeyToGroups.get(routeKey)!.push(signature);
    });
    
    // Merge groups that share the same normalized route key
    const mergedGroups = new Map<string, (FlightSolution | GroupedFlight)[]>();
    const processedSignatures = new Set<string>();
    
    routeKeyToGroups.forEach((signatures, routeKey) => {
      if (signatures.length > 1) {
        // Multiple groups with same route - merge them
        const mergedFlights: (FlightSolution | GroupedFlight)[] = [];
        const seenFlightIds = new Set<string>();
        
        signatures.forEach(sig => {
          if (processedSignatures.has(sig)) return;
          processedSignatures.add(sig);
          
          const groupFlights = grouped.get(sig) || [];
          groupFlights.forEach(flight => {
            const flightId = getFlightId(flight);
            if (!seenFlightIds.has(flightId)) {
              seenFlightIds.add(flightId);
              mergedFlights.push(flight);
            }
          });
        });
        
        if (mergedFlights.length > 0) {
          // Use the first signature as the key
          mergedGroups.set(signatures[0], mergedFlights);
        }
      } else {
        // Single group - keep as is
        const sig = signatures[0];
        if (!processedSignatures.has(sig)) {
          processedSignatures.add(sig);
          mergedGroups.set(sig, grouped.get(sig) || []);
        }
      }
    });
    
    // Also include any groups that weren't processed (shouldn't happen, but safety check)
    grouped.forEach((flights, signature) => {
      if (!processedSignatures.has(signature)) {
        mergedGroups.set(signature, flights);
      }
    });

    // Convert to primary/similar structure and sort within groups
    return Array.from(mergedGroups.values()).map(group => {
      // Sort group: fastest (shortest duration) first, then cheapest (lowest price)
      const sorted = group.sort((a, b) => {
        const aFlight = 'id' in a ? a : a.returnOptions[0];
        const bFlight = 'id' in b ? b : b.returnOptions[0];

        // First: Compare by duration (shorter is better - fastest)
        const aDuration = 'id' in a
          ? a.slices.reduce((sum, slice) => sum + slice.duration, 0)
          : (a.outboundSlice.duration + (a.returnOptions[0]?.returnSlice?.duration || 0));
        const bDuration = 'id' in b
          ? b.slices.reduce((sum, slice) => sum + slice.duration, 0)
          : (b.outboundSlice.duration + (b.returnOptions[0]?.returnSlice?.duration || 0));
        
        const durationCompare = aDuration - bDuration;
        if (durationCompare !== 0) return durationCompare;

        // If durations equal, compare by cash price (cheapest)
        const aPrice = aFlight.displayTotal || aFlight.totalAmount || 0;
        const bPrice = bFlight.displayTotal || bFlight.totalAmount || 0;
        const priceCompare = aPrice - bPrice;
        if (priceCompare !== 0) return priceCompare;

        // If prices equal, prioritize mileage deals
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

        return 0;
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
          {/* V2 Enrichment JSON Viewer Button - Development Tool (Hidden for now) */}
          {false && v2EnrichmentData.size > 0 && (
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

      {/* Stop Count Tabs - Only show if multiple stop groups exist */}
      {sortedStopCounts.length > 1 && (
        <div className="border-b border-gray-800/50">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {sortedStopCounts.map((stopCount) => {
              const groupData = stopGroups.get(stopCount);
              if (!groupData) return null;

              const { flights: groupFlights, cheapestPrice } = groupData;
              const firstFlight = groupFlights[0];
              const currency = firstFlight && 'id' in firstFlight
                ? firstFlight.currency
                : 'USD';
              
              const isActive = expandedStopGroup === stopCount;
              const stopText = stopCount === 0 ? 'Nonstop' : `${stopCount} stop${stopCount > 1 ? 's' : ''}`;

              return (
                <button
                  key={`tab-${stopCount}`}
                  onClick={() => setExpandedStopGroup(stopCount)}
                  className={`
                    relative px-4 py-2.5 text-sm font-medium transition-all duration-200 whitespace-nowrap
                    border-b-2 -mb-px
                    ${isActive
                      ? 'text-blue-400 border-blue-500 bg-blue-500/8'
                      : 'text-gray-400 border-transparent hover:text-gray-300 hover:border-gray-600/50'
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    <span>{stopText}</span>
                    <span className={`
                      text-xs px-1.5 py-0.5 rounded font-medium
                      ${isActive 
                        ? 'bg-blue-500/15 text-blue-400' 
                        : 'bg-gray-800/60 text-gray-500'
                      }
                    `}>
                      {groupFlights.length}
                    </span>
                    <span className={`
                      text-xs font-medium
                      ${isActive ? 'text-blue-400' : 'text-gray-500'}
                    `}>
                      {currency}{cheapestPrice.toLocaleString()}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Flight Cards - Show selected stop group */}
      <div className="mt-4">
        {sortedStopCounts.map((stopCount) => {
          const groupData = stopGroups.get(stopCount);
          if (!groupData) return null;

          const { flights: groupFlights } = groupData;
          const isExpanded = expandedStopGroup === stopCount;

          if (!isExpanded) return null;

          // Re-group the flights in this stop category
          const stopGrouped = groupSimilarFlights(groupFlights);

          // Helper to create a detailed flight fingerprint for aggressive deduplication
          // IMPORTANT: DO NOT include cabin in fingerprint - cabin variations should be shown as options, not separate cards
          const getFlightFingerprint = (flight: FlightSolution | GroupedFlight): string => {
            const airlineCode = getFlightAirlineCode(flight);
            if ('id' in flight) {
              const firstSlice = flight.slices[0];
              const lastSlice = flight.slices[flight.slices.length - 1];
              const departure = normalizeDepartureToMinute(firstSlice.departure || '');
              const arrival = normalizeDepartureToMinute(lastSlice.arrival || '');
              const origin = firstSlice.origin?.code || '';
              const destination = lastSlice.destination?.code || '';
              const flightNum = firstSlice.flights?.[0] || '';
              const stops = flight.slices.map(s => s.stops?.length || 0).join(',');
              // NO cabin, NO duration, NO price - just route/time/stops/flight number
              return `${airlineCode}|${flightNum}|${origin}|${destination}|${departure}|${arrival}|${stops}`;
            } else {
              const departure = normalizeDepartureToMinute(flight.outboundSlice.departure || '');
              const arrival = normalizeDepartureToMinute(flight.outboundSlice.arrival || '');
              const origin = flight.outboundSlice.origin?.code || '';
              const destination = flight.outboundSlice.destination?.code || '';
              const flightNum = flight.outboundSlice.flights?.[0] || '';
              const stops = flight.outboundSlice.stops?.length || 0;
              // NO cabin, NO duration, NO price - just route/time/stops/flight number
              return `${airlineCode}|${flightNum}|${origin}|${destination}|${departure}|${arrival}|${stops}`;
            }
          };

          // Aggressive deduplication: Merge groups with identical flight fingerprints
          const fingerprintMap = new Map<string, { primary: FlightSolution | GroupedFlight; similar: (FlightSolution | GroupedFlight)[] }>();

          stopGrouped.forEach((group, idx) => {
            const fingerprint = getFlightFingerprint(group.primary);
            const airlineCode = getFlightAirlineCode(group.primary);

            // Debug logging for Alaska flights
            if (airlineCode === 'AS') {
              const flight = group.primary;
              if ('id' in flight) {
                const firstSlice = flight.slices[0];
                console.log(`[AS Debug ${idx}] Fingerprint: ${fingerprint}`);
                console.log(`  ID: ${flight.id}, Flight#: ${firstSlice.flights?.[0]}, Similar: ${group.similar.length}`);
                console.log(`  Departure: ${firstSlice.departure}, Arrival: ${firstSlice.arrival}`);
                console.log(`  Price: ${flight.displayTotal}, Duration: ${firstSlice.duration}`);
              }
            }

            if (!fingerprintMap.has(fingerprint)) {
              // First occurrence of this fingerprint
              fingerprintMap.set(fingerprint, { primary: group.primary, similar: [...group.similar] });
              if (airlineCode === 'AS') {
                console.log(`  ✨ NEW group created`);
              }
            } else {
              // Duplicate found - merge into existing group
              const existing = fingerprintMap.get(fingerprint)!;

              if (airlineCode === 'AS') {
                console.log(`  ✅ MERGING into existing group`);
              }

              // Add all similar flights from this group
              existing.similar.push(...group.similar);

              // Add the primary as a similar flight if it has a different ID
              if (getFlightId(group.primary) !== getFlightId(existing.primary)) {
                existing.similar.push(group.primary);
              }
            }
          });

          // Convert back to array
          const deduplicatedStopGrouped = Array.from(fingerprintMap.values());

          return deduplicatedStopGrouped.map((group, index) => (
            <FlightCardGroup
              key={`flight-group-${stopCount}-${index}`}
              primaryFlight={group.primary}
              similarFlights={group.similar}
              allFlightsInStopGroup={groupFlights} // Pass all flights in stop group for time option calculation
              originTimezone={originTimezone}
              perCentValue={perCentValue}
              session={results.session}
              solutionSet={results.solutionSet}
              v2EnrichmentData={v2EnrichmentData}
              onEnrichFlight={onEnrichFlight}
              enrichingAirlines={enrichingAirlines}
            />
          ));
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