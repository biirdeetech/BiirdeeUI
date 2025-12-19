import React, { useState, useEffect, useMemo } from 'react';
import { Loader, AlertCircle, Plane, Code } from 'lucide-react';
import FlightCard from './FlightCard';
import MultiLegFlightCard from './MultiLegFlightCard';
import FlightCardGroup from './FlightCardGroup';
import Pagination from './Pagination';
import StopGroupSeparator from './StopGroupSeparator';
import V2EnrichmentViewer from './V2EnrichmentViewer';
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
  displayTimezone,
  perCentValue = 0.015,
  v2EnrichmentData = new Map(),
  onEnrichFlight,
  enrichingAirlines = new Set(),
  isSearchComplete = false,
  searchKey = ''
}) => {
  // ALL HOOKS MUST BE CALLED AT THE TOP, BEFORE ANY EARLY RETURNS
  // State to track which cabin is selected
  const [selectedCabin, setSelectedCabin] = useState<string>('COACH');
  // State to track Best vs Cheap filter
  const [sortMode, setSortMode] = useState<'best' | 'cheap'>('best');
  // State to track which stop group is expanded - will be initialized after we know available groups
  const [expandedStopGroup, setExpandedStopGroup] = useState<number | null>(null);
  const [showV2EnrichmentViewer, setShowV2EnrichmentViewer] = useState(false);
  // State to track which individual flight card is expanded (for exclusive expansion)
  const [expandedFlightCardId, setExpandedFlightCardId] = useState<string | null>(null);

  // Helper to check if a flight has a specific cabin
  const flightHasCabin = (flight: FlightSolution | GroupedFlight, cabin: string): boolean => {
    if ('id' in flight) {
      return flight.slices.some(slice => slice.cabins?.includes(cabin));
    } else {
      return flight.outboundSlice.cabins?.includes(cabin) || false;
    }
  };

  // Get available cabins from all flights
  const availableCabins = useMemo(() => {
    if (!results || !results.solutionList || !results.solutionList.solutions) {
      return [];
    }

    const cabinSet = new Set<string>();
    const cabinCounts = new Map<string, number>();
    const cabinMinPrices = new Map<string, number>();

    results.solutionList.solutions.forEach(flight => {
      const cabins = 'id' in flight
        ? flight.slices.flatMap(slice => slice.cabins || [])
        : flight.outboundSlice.cabins || [];

      const price = 'id' in flight ? flight.displayTotal : flight.returnOptions[0]?.displayTotal || 0;

      cabins.forEach(cabin => {
        cabinSet.add(cabin);
        cabinCounts.set(cabin, (cabinCounts.get(cabin) || 0) + 1);
        const currentMin = cabinMinPrices.get(cabin);
        if (currentMin === undefined || price < currentMin) {
          cabinMinPrices.set(cabin, price);
        }
      });
    });

    // Map cabin codes to display names
    const cabinOrder = ['COACH', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'];
    const cabinNames: { [key: string]: string } = {
      'COACH': 'Economy',
      'PREMIUM_ECONOMY': 'Premium Economy',
      'BUSINESS': 'Business',
      'FIRST': 'First'
    };

    return cabinOrder
      .filter(cabin => cabinSet.has(cabin))
      .map(cabin => ({
        code: cabin,
        name: cabinNames[cabin] || cabin,
        count: cabinCounts.get(cabin) || 0,
        minPrice: cabinMinPrices.get(cabin) || 0
      }));
  }, [results]);

  // Auto-select first available cabin
  useEffect(() => {
    if (availableCabins.length > 0 && !availableCabins.find(c => c.code === selectedCabin)) {
      setSelectedCabin(availableCabins[0].code);
    }
  }, [availableCabins, selectedCabin]);

  // Filter flights by selected cabin
  const cabinFilteredFlights = useMemo(() => {
    if (!results || !results.solutionList || !results.solutionList.solutions) {
      return [];
    }

    return results.solutionList.solutions.filter(flight => flightHasCabin(flight, selectedCabin));
  }, [results, selectedCabin]);

  // Helper to calculate total duration of a flight in minutes
  const getFlightDuration = (flight: FlightSolution | GroupedFlight): number => {
    if ('id' in flight) {
      // Regular flight - sum all slice durations
      return flight.slices.reduce((total, slice) => {
        if (slice.duration) {
          // Parse ISO8601 duration (e.g., "PT13H25M" or "PT1H30M")
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

  // Calculate prices for Best and Cheap tabs
  const tabPrices = useMemo(() => {
    if (cabinFilteredFlights.length === 0) {
      return { bestPrice: 0, cheapPrice: 0 };
    }

    // Find fastest flight (best)
    let fastestFlight = cabinFilteredFlights[0];
    let minDuration = getFlightDuration(fastestFlight);

    for (const flight of cabinFilteredFlights) {
      const duration = getFlightDuration(flight);
      if (duration < minDuration) {
        minDuration = duration;
        fastestFlight = flight;
      }
    }

    // Find cheapest flight
    let cheapestFlight = cabinFilteredFlights[0];
    let minPrice = 'id' in cheapestFlight ? cheapestFlight.displayTotal : cheapestFlight.returnOptions[0]?.displayTotal || 0;

    for (const flight of cabinFilteredFlights) {
      const price = 'id' in flight ? flight.displayTotal : flight.returnOptions[0]?.displayTotal || 0;
      if (price < minPrice) {
        minPrice = price;
        cheapestFlight = flight;
      }
    }

    const bestPrice = 'id' in fastestFlight ? fastestFlight.displayTotal : fastestFlight.returnOptions[0]?.displayTotal || 0;
    const cheapPrice = 'id' in cheapestFlight ? cheapestFlight.displayTotal : cheapestFlight.returnOptions[0]?.displayTotal || 0;

    return { bestPrice, cheapPrice };
  }, [cabinFilteredFlights]);

  // Sort flights by best (fastest) or cheap (lowest price)
  const sortedFilteredFlights = useMemo(() => {
    const flights = [...cabinFilteredFlights];

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
  }, [cabinFilteredFlights, sortMode]);

  // Calculate sortedStopCounts at the top level using useMemo (safe for all states)
  const sortedStopCounts = useMemo(() => {
    if (sortedFilteredFlights.length === 0) {
      return [];
    }

    const flights = sortedFilteredFlights;
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
  }, [sortedFilteredFlights]);

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

  // Show results - use cabin filtered flights
  const flights = cabinFilteredFlights;
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

  // NEW: Get segment-based signature (ignores airline - for code-share detection)
  // This groups flights by the actual route/segments, not by airline
  const getSegmentSignature = (f: FlightSolution | GroupedFlight): string => {
    if ('id' in f) {
      // Build signature from all segments across all slices
      const segmentParts: string[] = [];
      f.slices.forEach(slice => {
        if (slice.segments && slice.segments.length > 0) {
          // For each segment: origin-destination-departure time (minute precision)
          slice.segments.forEach(seg => {
            const origin = seg.origin?.code || '';
            const dest = seg.destination?.code || '';
            const depTime = seg.departure ? normalizeDepartureToMinute(seg.departure) : '';
            segmentParts.push(`${origin}-${dest}-${depTime}`);
          });
        } else {
          // Fallback: use slice-level data
          const origin = slice.origin?.code || '';
          const dest = slice.destination?.code || '';
          const depTime = slice.departure ? normalizeDepartureToMinute(slice.departure) : '';
          const stops = slice.stops?.map(s => typeof s === 'string' ? s : s.code).join(',') || '';
          segmentParts.push(`${origin}-${dest}-${depTime}-${stops}`);
        }
      });
      return `SEG-${segmentParts.join('|')}`;
    } else {
      // For grouped flights, use outbound slice
      const segmentParts: string[] = [];
      if (f.outboundSlice.segments && f.outboundSlice.segments.length > 0) {
        f.outboundSlice.segments.forEach(seg => {
          const origin = seg.origin?.code || '';
          const dest = seg.destination?.code || '';
          const depTime = seg.departure ? normalizeDepartureToMinute(seg.departure) : '';
          segmentParts.push(`${origin}-${dest}-${depTime}`);
        });
      } else {
        const origin = f.outboundSlice.origin?.code || '';
        const dest = f.outboundSlice.destination?.code || '';
        const depTime = f.outboundSlice.departure ? normalizeDepartureToMinute(f.outboundSlice.departure) : '';
        const stops = f.outboundSlice.stops?.map(s => typeof s === 'string' ? s : s.code).join(',') || '';
        segmentParts.push(`${origin}-${dest}-${depTime}-${stops}`);
      }
      return `SEG-${segmentParts.join('|')}`;
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

  // Group similar flights together (FLIGHT-CENTRIC: by segments, not airline)
  const groupSimilarFlights = (flightList: (FlightSolution | GroupedFlight)[]) => {
    const grouped = new Map<string, (FlightSolution | GroupedFlight)[]>();
    const timeOptionGroups = new Map<string, (FlightSolution | GroupedFlight)[]>();

    // First pass: Group by segment signature (ignores airline - groups code-shares together)
    // This ensures flights with same route/segments are grouped together regardless of airline or cabin
    flightList.forEach(flight => {
      // Use segment-based signature (airline-agnostic)
      const signature = getSegmentSignature(flight);

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

    // Helper to get flight number for sorting (shortest = parent)
    const getFlightNumberForSort = (f: FlightSolution | GroupedFlight): string => {
      if ('id' in f) {
        return f.slices[0]?.flights?.[0] || '';
      } else {
        return f.outboundSlice?.flights?.[0] || '';
      }
    };

    // Convert to primary/similar structure and sort within groups
    return Array.from(mergedGroups.values()).map(group => {
      // Sort group by:
      // 1. Shortest flight number (parent code-share - e.g., UA1234 before LH7589)
      // 2. Then by duration (fastest)
      // 3. Then by price (cheapest)
      const sorted = group.sort((a, b) => {
        // First: Sort by flight number length (shorter = parent)
        const aFlightNum = getFlightNumberForSort(a);
        const bFlightNum = getFlightNumberForSort(b);
        const flightNumCompare = aFlightNum.length - bFlightNum.length;
        if (flightNumCompare !== 0) return flightNumCompare;

        // If same length, alphabetically (UA before ZZ)
        if (aFlightNum !== bFlightNum) return aFlightNum.localeCompare(bFlightNum);

        const aFlight = 'id' in a ? a : a.returnOptions[0];
        const bFlight = 'id' in b ? b : b.returnOptions[0];

        // Second: Compare by duration (shorter is better - fastest)
        const aDuration = 'id' in a
          ? a.slices.reduce((sum, slice) => sum + slice.duration, 0)
          : (a.outboundSlice.duration + (a.returnOptions[0]?.returnSlice?.duration || 0));
        const bDuration = 'id' in b
          ? b.slices.reduce((sum, slice) => sum + slice.duration, 0)
          : (b.outboundSlice.duration + (b.returnOptions[0]?.returnSlice?.duration || 0));

        const durationCompare = aDuration - bDuration;
        if (durationCompare !== 0) return durationCompare;

        // Third: Compare by cash price (cheapest)
        const aPrice = aFlight.displayTotal || aFlight.totalAmount || 0;
        const bPrice = bFlight.displayTotal || bFlight.totalAmount || 0;
        const priceCompare = aPrice - bPrice;
        if (priceCompare !== 0) return priceCompare;

        // Fourth: Prioritize mileage deals
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

      {/* Best / Cheap Tabs - Global 50/50 width */}
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
                {(() => {
                  const firstFlight = results.solutionList.solutions[0];
                  const currency = firstFlight && 'id' in firstFlight ? firstFlight.currency : 'USD';
                  return formatPrice(tabPrices.bestPrice, currency);
                })()}
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
                {(() => {
                  const firstFlight = results.solutionList.solutions[0];
                  const currency = firstFlight && 'id' in firstFlight ? firstFlight.currency : 'USD';
                  return formatPrice(tabPrices.cheapPrice, currency);
                })()}
              </span>
              <span className="text-xs text-gray-500">(Cheapest)</span>
            </div>
          </button>
        </div>
      </div>

      {/* Cabin Tabs - Legacy (kept for backward compatibility, hidden by default) */}
      {false && availableCabins.length > 0 && (
        <div className="border-b border-gray-700/50">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {availableCabins.map((cabin) => {
              const isActive = selectedCabin === cabin.code;
              const firstFlight = results.solutionList.solutions[0];
              const currency = firstFlight && 'id' in firstFlight
                ? firstFlight.currency
                : 'USD';

              return (
                <button
                  key={`cabin-${cabin.code}`}
                  onClick={() => {
                    setSelectedCabin(cabin.code);
                    setExpandedStopGroup(null); // Reset stop group when changing cabin
                  }}
                  className={`
                    relative px-5 py-3 text-sm font-semibold transition-all duration-200 whitespace-nowrap
                    border-b-2 -mb-px
                    ${isActive
                      ? 'text-blue-400 border-blue-500 bg-blue-500/10'
                      : 'text-gray-400 border-transparent hover:text-gray-300 hover:border-gray-600/50'
                    }
                  `}
                >
                  <div className="flex items-center gap-2.5">
                    <span>{cabin.name}</span>
                    <span className={`
                      text-xs px-2 py-0.5 rounded-full font-semibold
                      ${isActive
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-gray-800/70 text-gray-500'
                      }
                    `}>
                      {cabin.count}
                    </span>
                    <span className={`
                      text-xs font-semibold
                      ${isActive ? 'text-blue-300' : 'text-gray-500'}
                    `}>
                      {currency}{cabin.minPrice.toLocaleString()}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

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

          // Debug: Log all groups from initial grouping with cabin details
          console.log(`📦 Stop ${stopCount}: ${stopGrouped.length} groups BEFORE fingerprint dedup`);
          stopGrouped.forEach((group, idx) => {
            const flight = group.primary;
            const airlineCode = getFlightAirlineCode(flight);
            if ('id' in flight) {
              const firstSlice = flight.slices[0];
              const flightNum = firstSlice.flights?.[0] || '';
              const departure = normalizeDepartureToMinute(firstSlice.departure || '');
              const price = flight.displayTotal || 0;
              const cabin = firstSlice.cabins?.[0] || '';
              console.log(`  [${idx}] ${airlineCode} ${flightNum} @ ${departure} - $${price} [${cabin}] (${group.similar.length} similar)`);

              // Log similar flights to see cabin variations
              if (group.similar.length > 0) {
                group.similar.forEach((simFlight, simIdx) => {
                  if ('id' in simFlight) {
                    const simSlice = simFlight.slices[0];
                    const simCabin = simSlice.cabins?.[0] || '';
                    const simPrice = simFlight.displayTotal || 0;
                    console.log(`      → Similar[${simIdx}]: $${simPrice} [${simCabin}]`);
                  }
                });
              }
            }
          });

          // Helper to create a detailed flight fingerprint for aggressive deduplication
          // Group by airline + route + stops ONLY
          // This groups ALL flights from the same airline on the same route together
          // Flight number, departure time, arrival time variations will be shown as options
          const getFlightFingerprint = (flight: FlightSolution | GroupedFlight): string => {
            const airlineCode = getFlightAirlineCode(flight);
            if ('id' in flight) {
              const firstSlice = flight.slices[0];
              const lastSlice = flight.slices[flight.slices.length - 1];
              const origin = firstSlice.origin?.code || '';
              const destination = lastSlice.destination?.code || '';
              const stops = flight.slices.map(s => s.stops?.length || 0).join(',');
              // Group by: airline + origin + destination + stops
              // NO flight number, NO times, NO cabin, NO price
              return `${airlineCode}|${origin}|${destination}|${stops}`;
            } else {
              const origin = flight.outboundSlice.origin?.code || '';
              const destination = flight.outboundSlice.destination?.code || '';
              const stops = flight.outboundSlice.stops?.length || 0;
              // Group by: airline + origin + destination + stops
              return `${airlineCode}|${origin}|${destination}|${stops}`;
            }
          };

          // Helper to get unique flight ID
          const getFlightId = (f: FlightSolution | GroupedFlight): string => {
            if ('id' in f) return f.id;
            // For grouped flights, use a combination of outbound slice details
            return `${f.outboundSlice.flights?.[0]}-${f.outboundSlice.departure}-${f.outboundSlice.arrival}`;
          };

          // Aggressive deduplication: Merge groups with identical flight fingerprints
          const fingerprintMap = new Map<string, { primary: FlightSolution | GroupedFlight; similar: (FlightSolution | GroupedFlight)[] }>();

          stopGrouped.forEach((group, idx) => {
            const fingerprint = getFlightFingerprint(group.primary);
            const airlineCode = getFlightAirlineCode(group.primary);

            // Debug: Log fingerprints
            console.log(`  🔍 [${idx}] ${airlineCode} Fingerprint: ${fingerprint}`);

            if (!fingerprintMap.has(fingerprint)) {
              // First occurrence of this fingerprint
              fingerprintMap.set(fingerprint, { primary: group.primary, similar: [...group.similar] });
            } else {
              // Duplicate found - merge into existing group
              const existing = fingerprintMap.get(fingerprint)!;

              console.log(`    ⚠️ ${airlineCode} DUPLICATE FINGERPRINT - Merging into existing group!`);

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

          // Debug: Log final count after deduplication
          console.log(`✅ Stop ${stopCount}: ${deduplicatedStopGrouped.length} groups AFTER fingerprint dedup (removed ${stopGrouped.length - deduplicatedStopGrouped.length})`);

          // Identify top 5 flights for FRT auto-trigger (cheapest and fastest)
          // Sort all flights across all stop groups by: 1. Price (cheapest), 2. Duration (fastest)
          const allFlightsForFrtRanking = processedFlights.map(flight => {
            const price = 'id' in flight ? flight.displayTotal : flight.returnOptions[0]?.displayTotal || 0;
            const duration = 'id' in flight
              ? flight.slices.reduce((sum, slice) => sum + slice.duration, 0)
              : (flight.outboundSlice.duration + (flight.returnOptions[0]?.returnSlice?.duration || 0));
            const flightId = 'id' in flight ? flight.id : `${flight.outboundSlice.flights?.[0]}-${flight.outboundSlice.departure}`;
            return { flight, price, duration, flightId };
          }).sort((a, b) => {
            // Sort by price first (cheapest)
            if (a.price !== b.price) return a.price - b.price;
            // Then by duration (fastest)
            return a.duration - b.duration;
          });

          // Get top 5 flight IDs
          const top5FlightIds = new Set(allFlightsForFrtRanking.slice(0, 5).map(f => f.flightId));

          return deduplicatedStopGrouped.map((group, index) => {
            // Check if this group's primary flight is in top 5
            const primaryFlightId = 'id' in group.primary
              ? group.primary.id
              : `${group.primary.outboundSlice.flights?.[0]}-${group.primary.outboundSlice.departure}`;
            const shouldAutoTriggerFrt = top5FlightIds.has(primaryFlightId);

            return (
            <FlightCardGroup
              key={`flight-group-${stopCount}-${index}`}
              primaryFlight={group.primary}
              similarFlights={group.similar}
              allFlightsInStopGroup={groupFlights} // Pass all flights in stop group for time option calculation
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
              expandedFlightCardId={expandedFlightCardId}
              onFlightCardToggle={setExpandedFlightCardId}
            />
            );
          });
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