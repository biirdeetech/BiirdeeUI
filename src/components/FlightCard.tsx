import React, { useState, useEffect, useMemo } from 'react';
import { Plane, Clock, ChevronDown, Target, Plus, ChevronRight, Zap, AlertCircle, Info, Eye, Award, Loader, Code, Link } from 'lucide-react';
import FlightSegmentViewer from './FlightSegmentViewer';
import { FlightSolution, GroupedFlight, MileageDeal } from '../types/flight';
import { PREMIUM_CARRIERS } from '../utils/fareClasses';
import ITAMatrixService from '../services/itaMatrixApi';
import AddToProposalModal from './AddToProposalModal';
import FlightSegmentDetails from './FlightSegmentDetails';
import FlightSummaryModal from './FlightSummaryModal';
import MileageSegmentTooltip from './MileageSegmentTooltip';
import MileageSelector from './MileageSelector';
import V2EnrichmentViewer from './V2EnrichmentViewer';
import AwardCards from './AwardCards';
import { useProposalContext } from '../contexts/ProposalContext';

interface FlightCardProps {
  flight: FlightSolution | GroupedFlight;
  originTimezone?: string;
  perCentValue?: number;
  session?: string;
  solutionSet?: string;
  v2EnrichmentData?: Map<string, any[]>;
  onEnrichFlight?: (flight: any, carrierCode: string) => Promise<any>;
  enrichingAirlines?: Set<string>;
  similarFlights?: (FlightSolution | GroupedFlight)[]; // Similar flights with different cabins
  similarFlightsCount?: number; // Count of similar flights shown in dropdown (for options count display)
  showSimilarOptions?: boolean; // Whether to show similar options indicator
  onToggleSimilarOptions?: () => void; // Callback to toggle similar options
  isSimilarOptionsExpanded?: boolean; // Whether similar options are expanded
  codeShareFlights?: (FlightSolution | GroupedFlight)[]; // Code-share flights (same segments, different airlines)
  codeShareFlightsCount?: number; // Count of code-share flights
  showCodeShareOptions?: boolean; // Whether to show code-share options indicator
  onToggleCodeShareOptions?: () => void; // Callback to toggle code-share options
  isCodeShareOptionsExpanded?: boolean; // Whether code-share options are expanded
}

// Helper to group similar mileage flights for cleaner display
const groupMileageFlights = (flights: any[]) => {
  // First pass: Group by flight number + departure time (ignoring arrival/layovers)
  const flightGroups = new Map<string, any[]>();

  flights.forEach((flight) => {
    const flightNumber = flight.flightNumber || '';
    const depTime = new Date(flight.departure.at).toISOString().slice(11, 16); // HH:MM
    const origin = flight.departure?.iataCode || '';
    
    // Group by: flight number + departure time + origin
    // This groups flights that are the same but may have different arrival times or layovers
    const groupKey = `${flightNumber}|${depTime}|${origin}`;

    if (!flightGroups.has(groupKey)) {
      flightGroups.set(groupKey, []);
    }
    flightGroups.get(groupKey)!.push(flight);
  });

  // Second pass: Process each group
  return Array.from(flightGroups.values()).map(groupFlights => {
    if (groupFlights.length === 1) {
      return {
        primary: groupFlights[0],
        alternativeArrivals: [], // Different arrival times
        alternativeLayovers: [], // Different layovers/routes
        alternativeTimes: [], // Different departure times (legacy)
        alternativeCarriers: [] // Different carriers (legacy)
      };
    }

    // Sort by arrival time (earliest first)
    groupFlights.sort((a, b) => {
      const aArr = new Date(a.arrival?.at || a.arrival).getTime();
      const bArr = new Date(b.arrival?.at || b.arrival).getTime();
      return aArr - bArr;
    });

    const primary = groupFlights[0];
    const alternatives = groupFlights.slice(1);
    
    // Separate alternatives by type
    const alternativeArrivals: any[] = [];
    const alternativeLayovers: any[] = [];
    
    alternatives.forEach(alt => {
      // Check if same route but different arrival time
      const sameRoute = primary.departure?.iataCode === alt.departure?.iataCode &&
                       primary.arrival?.iataCode === alt.arrival?.iataCode;
      
      // Check if different layovers
      const primaryLayovers = primary.stops?.map((s: any) => typeof s === 'string' ? s : (s.code || s.iataCode)).join(',') || '';
      const altLayovers = alt.stops?.map((s: any) => typeof s === 'string' ? s : (s.code || s.iataCode)).join(',') || '';
      const differentLayovers = primaryLayovers !== altLayovers;
      
      if (sameRoute && differentLayovers) {
        // Same route but different layover pattern
        alternativeLayovers.push(alt);
      } else if (sameRoute) {
        // Same route, same layovers, just different arrival time
        alternativeArrivals.push(alt);
      } else {
        // Different route entirely (different destination or layover airports)
        alternativeLayovers.push(alt);
      }
    });

    return {
      primary,
      alternativeArrivals,
      alternativeLayovers,
      alternativeTimes: [], // Legacy - kept for compatibility
      alternativeCarriers: [] // Legacy - kept for compatibility
    };
  });
};

// Helper to group similar award options for cleaner display (similar to groupMileageFlights)
const groupAwardOptions = (awards: any[]) => {
  const groups = new Map<string, any[]>();

  awards.forEach((award) => {
    const itinerary = award.itineraries?.[0];
    if (!itinerary || !itinerary.segments || itinerary.segments.length === 0) return;
    
    const firstSegment = itinerary.segments[0];
    const lastSegment = itinerary.segments[itinerary.segments.length - 1];
    
    const route = `${firstSegment.departure?.iataCode}-${lastSegment.arrival?.iataCode}`;
    const depTime = firstSegment.departure?.at ? new Date(firstSegment.departure.at).toISOString().slice(11, 16) : '';
    const arrTime = lastSegment.arrival?.at ? new Date(lastSegment.arrival.at).toISOString().slice(11, 16) : '';
    const duration = itinerary.duration || '';
    const layovers = itinerary.layovers?.map((l: any) => l.airport?.code || l.airport?.iataCode).join(',') || '';
    
    // Group by: route + times + duration + cabin + miles + tax
    const groupKey = `${route}|${depTime}|${arrTime}|${duration}|${award.cabin}|${award.miles}|${award.tax}|${layovers}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(award);
  });

  // Convert to grouped structure
  return Array.from(groups.values()).map(groupAwards => {
    if (groupAwards.length === 1) {
      return {
        primary: groupAwards[0],
        alternatives: []
      };
    }

    // Sort by value (cheapest first)
    groupAwards.sort((a, b) => {
      const aValue = (a.miles * 0.015) + a.tax;
      const bValue = (b.miles * 0.015) + b.tax;
      return aValue - bValue;
    });

    return {
      primary: groupAwards[0],
      alternatives: groupAwards.slice(1)
    };
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

const FlightCard: React.FC<FlightCardProps> = ({ flight, originTimezone, perCentValue = 0.015, session, solutionSet, v2EnrichmentData = new Map(), onEnrichFlight, enrichingAirlines = new Set(), similarFlights = [], similarFlightsCount, showSimilarOptions = false, onToggleSimilarOptions, isSimilarOptionsExpanded = false, codeShareFlights = [], codeShareFlightsCount, showCodeShareOptions = false, onToggleCodeShareOptions, isCodeShareOptionsExpanded = false }) => {
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
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set()); // Track multiple added items: 'flight', 'aero-{id}', 'award-{id}'
  const [hoveredAddButton, setHoveredAddButton] = useState<string | null>(null); // Track hover state for "Replace" text
  const [pendingItems, setPendingItems] = useState<Array<{type: 'flight' | 'aero' | 'award', id: string, data: any}>>([]); // Track all items pending to be added to proposal
  // Track selected mileage program per slice: { sliceIndex: carrierCode }
  const [selectedMileagePerSlice, setSelectedMileagePerSlice] = useState<Record<number, string | null>>({});
  const [selectedAwardPerSlice, setSelectedAwardPerSlice] = useState<Record<number, string | null>>({});
  const [expandedSlices, setExpandedSlices] = useState<Record<number, boolean>>({});
  const [expandedSliceAirlines, setExpandedSliceAirlines] = useState<Record<string, boolean>>({});
  const [expandedSegments, setExpandedSegments] = useState<Record<number, boolean>>({});
  const [expandedAwardGroups, setExpandedAwardGroups] = useState<Record<string, boolean>>({});
  const [showV2EnrichmentViewer, setShowV2EnrichmentViewer] = useState(false);
  const [sliceAlternativeTabs, setSliceAlternativeTabs] = useState<Record<string, 'best-match' | 'time-insensitive'>>({});
  const [showAlternativeTimes, setShowAlternativeTimes] = useState<Record<string, boolean>>({});
  const [showMileageDropdown, setShowMileageDropdown] = useState<Record<number, boolean>>({});
  const [mileageAwardTab, setMileageAwardTab] = useState<Record<number, 'aero' | 'award'>>({});
  const [aeroCabinTabs, setAeroCabinTabs] = useState<Record<string, string>>({}); // airlineKey -> cabin
  const [expandedMileageOptions, setExpandedMileageOptions] = useState<Record<number, boolean>>({}); // sliceIndex -> expanded
  const [tooltipStates, setTooltipStates] = useState<Record<string, boolean>>({}); // Track tooltip visibility: 'details', 'awards', 'hacks', 'add'
  const [selectedCabinFilter, setSelectedCabinFilter] = useState<Record<number, string | null>>({}); // sliceIndex -> cabin filter
  const [selectedCabin, setSelectedCabin] = useState<string | null>(null); // Selected cabin for compact card display
  const [selectedPriceOption, setSelectedPriceOption] = useState<Record<string, number>>({}); // cabin -> selected price
  const [selectedTimeOption, setSelectedTimeOption] = useState<Record<string, string>>({}); // cabin -> selected time option key (departure-arrival)
  const [displayedFlight, setDisplayedFlight] = useState<FlightSolution | GroupedFlight | null>(null); // Currently displayed flight variant


  // Get the flight to display (either original or switched variant)
  const flightToDisplay = displayedFlight || flight;
  const isGroupedFlightDisplay = !('id' in flightToDisplay);

  // Get flight data based on type
  const getFlightData = () => {
    if (isGroupedFlightDisplay) {
      const groupedFlight = flightToDisplay as GroupedFlight;
      const selectedReturn = groupedFlight.returnOptions[selectedReturnIndex];
      const slices = [groupedFlight.outboundSlice, selectedReturn.returnSlice];
      
      return {
        slices: slices,
        carrier: groupedFlight.carrier,
        isNonstop: groupedFlight.isNonstop && (!selectedReturn.returnSlice?.stops || selectedReturn.returnSlice.stops.length === 0),
        totalAmount: selectedReturn.totalAmount,
        displayTotal: selectedReturn.displayTotal, // Use backend's round trip total as-is
        currency: selectedReturn.currency || 'USD',
        pricePerMile: selectedReturn.ext.pricePerMile,
        hasMultipleReturns: groupedFlight.returnOptions.length > 1
      };
    } else {
      const regularFlight = flightToDisplay as FlightSolution;
      const firstSlice = regularFlight.slices[0];
      
      return {
        slices: regularFlight.slices,
        carrier: firstSlice.segments[0]?.carrier || { code: '', name: '', shortName: '' },
        isNonstop: regularFlight.slices.every(slice => !slice.stops || slice.stops.length === 0),
        totalAmount: regularFlight.totalAmount,
        displayTotal: regularFlight.displayTotal, // Use backend's price as-is
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

  const flightData = getFlightData();
  const { slices, carrier, isNonstop, displayTotal, currency, hasMultipleReturns, matchType } = flightData;
  // Proposal context available but not directly used in this component
  // const { addToProposal: addToProposalContext, removeFromProposal } = useProposalContext();
  
  // Get flightId - use displayed flight if available, otherwise use original flight
  const flightId = ('id' in flightToDisplay ? flightToDisplay.id : undefined) || 
                   ('id' in flight ? flight.id : undefined) || 
                   (flightData as any).flightId;
  
  // Check if flight has price variations (from deduplication of identical flights)
  // This is now handled per-cabin in getCabinPricing
  
  // Remove unused console.log that references flightId
  // console.log('🎴 FlightCard: Rendering flight with', { 
  //   isGrouped: isGroupedFlight, 
  //   hasMultipleReturns, 
  //   sliceCount: slices.length,
  //   flightId
  // });

  // Helper to get flight signature for price option grouping (same airline, origin, departure time)
  const getPriceOptionSignature = (f: FlightSolution | GroupedFlight) => {
    const airlineCode = getFlightAirlineCode(f);
    if ('id' in f) {
      const firstSlice = f.slices[0];
      const departure = firstSlice.departure || '';
      const origin = firstSlice.origin?.code || '';
      const cabin = firstSlice.cabins?.join(',') || 'UNKNOWN';
      return `${airlineCode}-${departure}-${origin}-${cabin}`;
    } else {
      const departure = f.outboundSlice.departure || '';
      const origin = f.outboundSlice.origin?.code || '';
      const cabin = f.outboundSlice.cabins?.join(',') || 'UNKNOWN';
      return `${airlineCode}-${departure}-${origin}-${cabin}`;
    }
  };

  // Helper to extract airline code from flight number (e.g., "B6816" -> "B6")
  const getAirlineCode = (flightNumber: string): string => {
    if (!flightNumber) return '';
    // Extract airline code (letters before numbers)
    const match = flightNumber.match(/^([A-Z]+)/);
    return match ? match[1] : '';
  };

  // Helper to get airline code from flight
  const getFlightAirlineCode = (f: FlightSolution | GroupedFlight): string => {
    if ('id' in f) {
      const firstSlice = f.slices[0];
      // Try to get from segments first (more reliable)
      if (firstSlice.segments && firstSlice.segments.length > 0 && firstSlice.segments[0].carrier?.code) {
        return firstSlice.segments[0].carrier.code;
      }
      // Fallback to extracting from flight number
      const flightNumber = firstSlice.flights?.[0] || '';
      return getAirlineCode(flightNumber);
    } else {
      // Try to get from carrier if available
      if (f.carrier?.code) {
        return f.carrier.code;
      }
      // Fallback to extracting from flight number
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

  // Helper to get flight signature for time option grouping (same airline, origin, destination, day)
  const getTimeOptionSignature = (f: FlightSolution | GroupedFlight) => {
    const airlineCode = getFlightAirlineCode(f);
    if ('id' in f) {
      const firstSlice = f.slices[0];
      const lastSlice = f.slices[f.slices.length - 1];
      const origin = firstSlice.origin?.code || '';
      const destination = lastSlice.destination?.code || '';
      const departureDate = firstSlice.departure ? getDateFromISO(firstSlice.departure) : '';
      const cabin = firstSlice.cabins?.join(',') || 'UNKNOWN';
      return `${airlineCode}-${origin}-${destination}-${departureDate}-${cabin}`;
    } else {
      const origin = f.outboundSlice.origin?.code || '';
      const destination = f.outboundSlice.destination?.code || '';
      const departureDate = f.outboundSlice.departure ? getDateFromISO(f.outboundSlice.departure) : '';
      const cabin = f.outboundSlice.cabins?.join(',') || 'UNKNOWN';
      return `${airlineCode}-${origin}-${destination}-${departureDate}-${cabin}`;
    }
  };

  // Helper to get time option key (departure-arrival format)
  const getTimeOptionKey = (f: FlightSolution | GroupedFlight) => {
    if ('id' in f) {
      const firstSlice = f.slices[0];
      const lastSlice = f.slices[f.slices.length - 1];
      const depTime = formatTimeInOriginTZ(firstSlice.departure || '', { hour: '2-digit', minute: '2-digit' });
      const arrTime = formatTimeInOriginTZ(lastSlice.arrival || '', { hour: '2-digit', minute: '2-digit' });
      return `${depTime}-${arrTime}`;
    } else {
      const depTime = formatTimeInOriginTZ(f.outboundSlice.departure || '', { hour: '2-digit', minute: '2-digit' });
      const arrTime = formatTimeInOriginTZ(f.outboundSlice.arrival || '', { hour: '2-digit', minute: '2-digit' });
      return `${depTime}-${arrTime}`;
    }
  };

  // Helper to get cabin pricing and time options from similar flights
  // IMPORTANT: Only includes flights from the same airline as the primary flight
  const getCabinPricing = (cabinName: string) => {
    // Normalize cabin names
    // Note: PREMIUM-COACH maps to ECONOMY for display purposes since we don't have a separate PREMIUM_ECONOMY button
    const normalizeCabin = (cabin: string) => {
      const c = cabin.toUpperCase();
      if (c.includes('FIRST')) return 'FIRST';
      if (c.includes('BUSINESS') && c.includes('PREMIUM')) return 'BUSINESS_PREMIUM';
      if (c.includes('BUSINESS')) return 'BUSINESS';
      // PREMIUM-COACH maps to ECONOMY for button display
      if (c.includes('PREMIUM') || c.includes('PREMIUM-COACH') || c.includes('PREMIUM_COACH')) return 'ECONOMY';
      return 'ECONOMY';
    };

    // Get the primary airline code - all flights must match this airline
    const primaryAirlineCode = getFlightAirlineCode(flight);
    if (!primaryAirlineCode) return null; // Can't determine airline, skip

    const targetCabin = normalizeCabin(cabinName);
    const matchingFlights: Array<{ 
      price: number; 
      currency: string; 
      flight: any; 
      duration: number;
      priceOptionSig: string;
      timeOptionSig: string;
      timeOptionKey: string;
    }> = [];
    
    // Helper to check if a flight matches the primary airline
    const matchesAirline = (f: FlightSolution | GroupedFlight): boolean => {
      const airlineCode = getFlightAirlineCode(f);
      return airlineCode === primaryAirlineCode;
    };
    
    // Always include the original flight first (for stable price option signature)
    // But only if it matches the airline (it should, but check anyway)
    if (matchesAirline(flight)) {
      const originalSlices = 'id' in flight ? flight.slices : [flight.outboundSlice];
      const originalDisplayTotal = 'id' in flight 
        ? (flight.displayTotal || flight.totalAmount || 0)
        : (flight.returnOptions?.[0]?.displayTotal || flight.returnOptions?.[0]?.totalAmount || 0);
      const originalCurrency = 'id' in flight 
        ? (flight.currency || 'USD')
        : (flight.returnOptions?.[0]?.currency || 'USD');
      
      // Check original flight first (only use first slice cabin - departing cabin)
      const originalCabin = originalSlices[0]?.cabins?.[0] || '';
      const normalizedOriginalCabin = normalizeCabin(originalCabin);
      const originalCabinUpper = originalCabin.toUpperCase();
      
      // For ECONOMY cabin, also include PREMIUM-COACH flights
      if (normalizedOriginalCabin === targetCabin || 
          (targetCabin === 'ECONOMY' && (originalCabinUpper.includes('PREMIUM') || originalCabinUpper.includes('PREMIUM-COACH') || originalCabinUpper.includes('PREMIUM_COACH')))) {
        matchingFlights.push({
          price: originalDisplayTotal,
          currency: originalCurrency,
          flight: flight,
          duration: originalSlices.reduce((sum, s) => sum + (s.duration || 0), 0),
          priceOptionSig: getPriceOptionSignature(flight),
          timeOptionSig: getTimeOptionSignature(flight),
          timeOptionKey: getTimeOptionKey(flight)
        });
      }
    }
    
    // Also include displayedFlight if it's different from the original flight AND matches airline
    if (displayedFlight && matchesAirline(displayedFlight)) {
      const isDifferent = 'id' in flight && 'id' in displayedFlight
        ? flight.id !== displayedFlight.id
        : flight !== displayedFlight;
      
      if (isDifferent) {
        const displayedSlices = 'id' in displayedFlight ? displayedFlight.slices : [displayedFlight.outboundSlice];
        const displayedDisplayTotal = 'id' in displayedFlight 
          ? (displayedFlight.displayTotal || displayedFlight.totalAmount || 0)
          : (displayedFlight.returnOptions?.[0]?.displayTotal || displayedFlight.returnOptions?.[0]?.totalAmount || 0);
        const displayedCurrency = 'id' in displayedFlight 
          ? (displayedFlight.currency || 'USD')
          : (displayedFlight.returnOptions?.[0]?.currency || 'USD');
        
        const displayedCabin = displayedSlices[0]?.cabins?.[0] || '';
        const normalizedDisplayedCabin = normalizeCabin(displayedCabin);
        const displayedCabinUpper = displayedCabin.toUpperCase();
        if (normalizedDisplayedCabin === targetCabin || 
            (targetCabin === 'ECONOMY' && (displayedCabinUpper.includes('PREMIUM') || displayedCabinUpper.includes('PREMIUM-COACH') || displayedCabinUpper.includes('PREMIUM_COACH')))) {
          // Check if this flight is already in matchingFlights (avoid duplicates)
          const alreadyIncluded = matchingFlights.some(f => {
            const fId = 'id' in f.flight ? f.flight.id : null;
            const dId = 'id' in displayedFlight ? displayedFlight.id : null;
            return fId && dId ? fId === dId : f.flight === displayedFlight;
          });
          
          if (!alreadyIncluded) {
            matchingFlights.push({
              price: displayedDisplayTotal,
              currency: displayedCurrency,
              flight: displayedFlight,
              duration: displayedSlices.reduce((sum, s) => sum + (s.duration || 0), 0),
              priceOptionSig: getPriceOptionSignature(displayedFlight),
              timeOptionSig: getTimeOptionSignature(displayedFlight),
              timeOptionKey: getTimeOptionKey(displayedFlight)
            });
          }
        }
      }
    }

    // Check similar flights - ONLY include flights from the same airline
    for (const similarFlight of similarFlights) {
      // CRITICAL: Only include flights from the same airline
      if (!matchesAirline(similarFlight)) {
        continue; // Skip flights from different airlines
      }

      let similarSlices: any[] = [];
      let similarPrice = 0;
      let similarCurrency = 'USD';
      
      if ('id' in similarFlight) {
        similarSlices = similarFlight.slices;
        similarPrice = similarFlight.displayTotal || similarFlight.totalAmount || 0;
        similarCurrency = similarFlight.currency || 'USD';
      } else {
        const groupedFlight = similarFlight as GroupedFlight;
        similarSlices = [groupedFlight.outboundSlice, groupedFlight.returnOptions[0]?.returnSlice];
        similarPrice = groupedFlight.returnOptions[0]?.displayTotal || groupedFlight.returnOptions[0]?.totalAmount || 0;
        similarCurrency = groupedFlight.returnOptions[0]?.currency || 'USD';
      }

      const similarCabin = similarSlices[0]?.cabins?.[0] || '';
      const normalizedSimilarCabin = normalizeCabin(similarCabin);
      const similarCabinUpper = similarCabin.toUpperCase();
      if ((normalizedSimilarCabin === targetCabin || 
           (targetCabin === 'ECONOMY' && (similarCabinUpper.includes('PREMIUM') || similarCabinUpper.includes('PREMIUM-COACH') || similarCabinUpper.includes('PREMIUM_COACH')))) 
          && similarPrice > 0) {
        matchingFlights.push({
          price: similarPrice,
          currency: similarCurrency,
          flight: similarFlight,
          duration: similarSlices.reduce((sum: number, s: any) => sum + (s.duration || 0), 0),
          priceOptionSig: getPriceOptionSignature(similarFlight),
          timeOptionSig: getTimeOptionSignature(similarFlight),
          timeOptionKey: getTimeOptionKey(similarFlight)
        });
      }
    }

    if (matchingFlights.length === 0) return null;

    // Get primary flight signature for comparison
    // IMPORTANT: Always use the original flight for price option signature
    // This ensures price options remain stable when displayedFlight changes
    // Price options should show ALL prices for flights with the same carrier, origin, departure time
    const primaryPriceSig = getPriceOptionSignature(flight);
    
    // For time options, use displayedFlight if available to show correct time options for current selection
    const primaryTimeSig = getTimeOptionSignature(displayedFlight || flight);

    // Group flights by price option (same carrier, origin, departure time)
    const priceOptionGroups = new Map<string, typeof matchingFlights>();
    matchingFlights.forEach(f => {
      if (!priceOptionGroups.has(f.priceOptionSig)) {
        priceOptionGroups.set(f.priceOptionSig, []);
      }
      priceOptionGroups.get(f.priceOptionSig)!.push(f);
    });

    // Group flights by time option (same origin, destination, day)
    const timeOptionGroups = new Map<string, typeof matchingFlights>();
    matchingFlights.forEach(f => {
      if (!timeOptionGroups.has(f.timeOptionSig)) {
        timeOptionGroups.set(f.timeOptionSig, []);
      }
      timeOptionGroups.get(f.timeOptionSig)!.push(f);
    });

    // Get price options (flights with same price option signature as primary)
    // IMPORTANT: Use ALL flights with the same price option signature AND same airline, not just the primary
    // This ensures all prices are shown even when time options change, but only for the same airline
    const priceOptionFlights = priceOptionGroups.get(primaryPriceSig) || [];
    
    // Filter price option flights to ensure they're all from the same airline
    // (matchingFlights should already be filtered, but double-check)
    let allPriceOptionFlights = priceOptionFlights.filter(f => matchesAirline(f.flight));
    
    // If no flights found with primary price sig, check if there are any flights with similar price sigs
    // This handles cases where flights share the same departure time but have different signatures
    if (allPriceOptionFlights.length === 0) {
      // Fallback: collect all flights that share the same airline, origin, and departure time
      // Always use original flight to ensure price options remain stable
      const primaryOrigin = 'id' in flight 
        ? flight.slices[0]?.origin?.code 
        : flight.outboundSlice?.origin?.code;
      const primaryDepTime = 'id' in flight
        ? flight.slices[0]?.departure
        : flight.outboundSlice?.departure;
      
      if (primaryOrigin && primaryDepTime) {
        allPriceOptionFlights = matchingFlights.filter(f => {
          // Already filtered by airline in matchingFlights, but verify
          if (!matchesAirline(f.flight)) return false;
          
          const fOrigin = 'id' in f.flight 
            ? f.flight.slices[0]?.origin?.code 
            : f.flight.outboundSlice?.origin?.code;
          const fDepTime = 'id' in f.flight
            ? f.flight.slices[0]?.departure
            : f.flight.outboundSlice?.departure;
          
          return fOrigin === primaryOrigin && 
                 fDepTime === primaryDepTime;
        });
      }
    }
    
    const uniquePriceOptionPrices = [...new Set(allPriceOptionFlights.map(f => f.price))];
    const priceOptions = uniquePriceOptionPrices.length > 1 ? {
      allPrices: uniquePriceOptionPrices.sort((a, b) => a - b),
      flightsByPrice: new Map<number, typeof allPriceOptionFlights>(
        uniquePriceOptionPrices.map(price => [
          price,
          allPriceOptionFlights.filter(f => f.price === price)
        ])
      )
    } : null;

    // Get time options (flights with same time option signature as primary)
    // Filter to ensure all flights are from the same airline
    const timeOptionFlights = (timeOptionGroups.get(primaryTimeSig) || []).filter(f => matchesAirline(f.flight));
    const uniqueTimeOptionKeys = [...new Set(timeOptionFlights.map(f => f.timeOptionKey))];
    const timeOptions = uniqueTimeOptionKeys.length > 1 ? {
      allTimeKeys: uniqueTimeOptionKeys.sort(),
      flightsByTime: new Map<string, typeof timeOptionFlights>(
        uniqueTimeOptionKeys.map(timeKey => [
          timeKey,
          timeOptionFlights.filter(f => f.timeOptionKey === timeKey)
        ])
      )
    } : null;

    // Get unique prices (for detecting variations)
    const prices = matchingFlights.map(f => f.price);
    const uniquePrices = [...new Set(prices)];
    const minPrice = Math.min(...prices);
    const hasVariations = uniquePrices.length > 1 && (Math.max(...prices) - minPrice) > 0;

    // Calculate total unique options
    // If similarFlightsCount is provided, use that (count of flights in dropdown)
    // Otherwise, count unique flights from matchingFlights
    const totalOptionsCount = similarFlightsCount !== undefined 
      ? similarFlightsCount + 1 // +1 for the current flight itself
      : (() => {
          const uniqueFlights = new Set(matchingFlights.map(f => 'id' in f.flight ? f.flight.id : JSON.stringify(f.flight)));
          return uniqueFlights.size;
        })();

    return {
      price: minPrice,
      currency: matchingFlights[0].currency,
      flight: matchingFlights[0].flight,
      duration: matchingFlights[0].duration,
      optionsCount: totalOptionsCount,
      hasVariations: hasVariations,
      allPrices: uniquePrices.sort((a, b) => a - b),
      flightsByPrice: new Map<number, typeof matchingFlights>(
        Array.from(new Set(prices)).map(price => [
          price,
          matchingFlights.filter(f => f.price === price)
        ])
      ),
      priceOptions: priceOptions, // Price options (same carrier, origin, departure time)
      timeOptions: timeOptions // Time options (same origin, destination, day)
    };
  };

  // Get pricing for all cabins
  // Recalculate when displayedFlight changes to ensure price options are always accurate
  const cabinPricing = useMemo(() => ({
    ECONOMY: getCabinPricing('ECONOMY'),
    BUSINESS: getCabinPricing('BUSINESS'),
    BUSINESS_PREMIUM: getCabinPricing('BUSINESS PREMIUM'),
    FIRST: getCabinPricing('FIRST')
  }), [displayedFlight, flight, similarFlights, displayTotal, currency, slices]);

  // Set default selected cabin to current flight's cabin (only use departing/first slice cabin)
  useEffect(() => {
    if (!selectedCabin && slices[0]?.cabins?.[0]) {
      const currentCabin = slices[0].cabins[0].toUpperCase();
      let cabinToSelect: string | null = null;
      
      if (currentCabin.includes('FIRST')) {
        cabinToSelect = 'FIRST';
      } else if (currentCabin.includes('BUSINESS') && currentCabin.includes('PREMIUM')) {
        cabinToSelect = 'BUSINESS_PREMIUM';
      } else if (currentCabin.includes('BUSINESS')) {
        cabinToSelect = 'BUSINESS';
      } else if (currentCabin.includes('PREMIUM')) {
        // PREMIUM-COACH maps to ECONOMY button for display
        cabinToSelect = 'ECONOMY';
      } else {
        cabinToSelect = 'ECONOMY';
      }
      
      // Only set if the cabin has pricing available and a valid price
      if (cabinToSelect) {
        const pricing = cabinPricing[cabinToSelect as keyof typeof cabinPricing];
        // Check if pricing exists and has a valid price (not null/0)
        if (pricing && pricing.price > 0) {
          setSelectedCabin(cabinToSelect);
        } else {
          // If the mapped cabin doesn't have pricing, try to find the first available cabin with pricing
          const availableCabins = ['FIRST', 'BUSINESS_PREMIUM', 'BUSINESS', 'ECONOMY'] as const;
          for (const cabin of availableCabins) {
            const cabinPricingData = cabinPricing[cabin];
            if (cabinPricingData && cabinPricingData.price > 0) {
              setSelectedCabin(cabin);
              break;
            }
          }
        }
      }
    }
  }, [slices, selectedCabin, cabinPricing]);

  // Removed console.log for production

  // Check if this airline is currently being enriched
  const isEnriching = enrichingAirlines.has(carrier.code);

  // Find v2 enrichment data for this flight's carrier AND cabin
  const findV2Enrichment = () => {
    if (!v2EnrichmentData || v2EnrichmentData.size === 0 || !carrier.code) return null;
    
    // Get enrichment data for this carrier from the Map
    const carrierEnrichment = v2EnrichmentData.get(carrier.code);
    if (!carrierEnrichment || carrierEnrichment.length === 0) return null;
    
    // Get current flight's cabin class (normalized)
    const currentFlightCabin = slices[0]?.cabins?.[0] || 'COACH';
    const normalizeCabin = (cabin: string) => {
      const c = cabin.toUpperCase();
      if (c.includes('BUSINESS') || c === 'J') return 'BUSINESS';
      if (c.includes('FIRST') || c === 'F') return 'FIRST';
      if (c.includes('PREMIUM') || c === 'W') return 'PREMIUM';
      return 'COACH';
    };
    const currentCabinNormalized = normalizeCabin(currentFlightCabin);
    
    console.log(`🔍 FlightCard: Looking for enrichment - Carrier: ${carrier.code}, Cabin: ${currentCabinNormalized}`);
    
    // Look for enrichment data - find solutions with mileage data matching BOTH carrier AND cabin
    let bestEnrichment: any = null;
    let bestValue = Infinity;

    for (const enrichment of carrierEnrichment) {
      // New format: awardtool-direct
      if (enrichment.type === 'solution' && enrichment.provider === 'awardtool-direct' && enrichment.data) {
        const flightData = enrichment.data;
        const itineraries = flightData.itineraries || [];
        
        // Extract carrier from first segment
        let enrichmentCarrier: string | null = null;
        if (itineraries.length > 0 && itineraries[0].segments && itineraries[0].segments.length > 0) {
          enrichmentCarrier = itineraries[0].segments[0].carrierCode || 
                             itineraries[0].segments[0].operating?.carrierCode;
        }
        
        if (!enrichmentCarrier || enrichmentCarrier !== carrier.code) {
          continue; // Skip if carrier doesn't match
        }
        
        // Check awardtool cabin prices
        const awardtool = flightData.awardtool;
        if (awardtool && awardtool.cabinPrices) {
          // Map cabin names: Business -> BUSINESS, Economy -> COACH, Premium Economy -> PREMIUM
          const cabinMap: Record<string, string> = {
            'Business': 'BUSINESS',
            'Economy': 'COACH',
            'Premium Economy': 'PREMIUM'
          };
          
          // Find matching cabin in awardtool data
          for (const [cabinName, cabinData] of Object.entries(awardtool.cabinPrices)) {
            const normalizedCabinName = cabinMap[cabinName] || cabinName.toUpperCase();
            const cabin = cabinData as any; // Type assertion for awardtool cabin data
            
            if (normalizedCabinName === currentCabinNormalized && cabin.miles > 0) {
              const mileage = cabin.miles;
              const tax = cabin.tax || 0;
              const mileageValue = (mileage * perCentValue);
              const totalValue = mileageValue + tax;
              
              if (totalValue < bestValue || !bestEnrichment) {
                bestValue = totalValue;
                bestEnrichment = {
                  program: enrichmentCarrier,
                  mileage: mileage,
                  price: tax,
                  priceFormatted: `USD ${tax.toFixed(2)}`,
                  cabin: normalizedCabinName,
                  matchType: 'exact-match',
                  fullyEnriched: true,
                  transferOptions: cabin.transfer_options || [],
                  segments: cabin.segments || [],
                  seats: cabin.seats || 0
                };
                console.log(`✅ FlightCard: Found awardtool enrichment - ${enrichmentCarrier} ${normalizedCabinName}: ${mileage} miles + $${tax}`);
              }
            }
          }
        }
      }
      // Old format: ita-matrix-enriched
      else if (enrichment.type === 'solution' && enrichment.totalMileage && enrichment.totalMileage > 0) {
        const itinerary = enrichment.itinerary;
        if (itinerary && itinerary.slices) {
          for (const slice of itinerary.slices) {
            if (slice.mileageBreakdown && slice.mileageBreakdown.length > 0) {
              for (const breakdown of slice.mileageBreakdown) {
                if (breakdown.allMatchingFlights && breakdown.allMatchingFlights.length > 0) {
                  const mileageFlight = breakdown.allMatchingFlights[0];
                  const enrichmentCarrier = mileageFlight.carrierCode || mileageFlight.operatingCarrier;
                  const enrichmentCabin = normalizeCabin(mileageFlight.cabin || mileageFlight.cabinClass || 'COACH');
                  
                  // Match BOTH carrier AND cabin
                  if (enrichmentCarrier === carrier.code && enrichmentCabin === currentCabinNormalized) {
                    // Calculate total value (mileage * perCentValue + cash price)
                    const mileageValue = (enrichment.totalMileage * perCentValue);
                    const cashPrice = parseFloat(enrichment.totalMileagePrice || 0);
                    const totalValue = mileageValue + cashPrice;
                    
                    if (totalValue < bestValue || !bestEnrichment) {
                      bestValue = totalValue;
                      bestEnrichment = {
                        program: enrichmentCarrier,
                        mileage: enrichment.totalMileage,
                        price: enrichment.totalMileagePrice || 0,
                        priceFormatted: typeof enrichment.totalMileagePrice === 'number' 
                          ? `USD ${enrichment.totalMileagePrice.toFixed(2)}`
                          : enrichment.totalMileagePrice,
                        cabin: enrichmentCabin,
                        matchType: enrichment.itinerary?.slices?.[0]?.matchType || 'partial-match',
                        fullyEnriched: enrichment.fullyEnriched || false
                      };
                      console.log(`✅ FlightCard: Found matching enrichment - ${enrichmentCarrier} ${enrichmentCabin}: ${enrichment.totalMileage} miles + ${enrichment.totalMileagePrice}`);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    if (!bestEnrichment) {
      console.log(`⚠️ FlightCard: No enrichment found for ${carrier.code} ${currentCabinNormalized}`);
    }
    
    return bestEnrichment;
  };

  const v2Enrichment = findV2Enrichment();
  const hasV2Enrichment = v2Enrichment !== null;
  
  // Helper to deduplicate award options - preserve all unique combinations
  const deduplicateAwardOptions = (options: any[]): any[] => {
    const uniqueMap = new Map<string, any>();
    
    options.forEach((award) => {
      const itinerary = award.itineraries?.[0];
      if (!itinerary || !itinerary.segments || itinerary.segments.length === 0) return;
      
      const firstSegment = itinerary.segments[0];
      const lastSegment = itinerary.segments[itinerary.segments.length - 1];
      
      // Create unique key: include flight numbers to distinguish different flights with same route/time
      const depTime = firstSegment.departure?.at ? new Date(firstSegment.departure.at).toISOString().slice(11, 16) : '';
      const arrTime = lastSegment.arrival?.at ? new Date(lastSegment.arrival.at).toISOString().slice(11, 16) : '';
      const duration = itinerary.duration || '';
      const origin = firstSegment.departure?.iataCode || '';
      const dest = lastSegment.arrival?.iataCode || '';
      const airline = firstSegment.carrierCode || '';
      
      // Include flight numbers in the key to distinguish different flights
      const flightNumbers = itinerary.segments.map((seg: any) => `${seg.carrierCode}${seg.number}`).join('-');
      
      // Key includes: origin-dest-depTime-arrTime-duration-miles-tax-cabin-airline-flightNumbers
      // This ensures we keep different cabin options for the same flight, and different flights with same route
      const uniqueKey = `${origin}-${dest}-${depTime}-${arrTime}-${duration}-${award.miles}-${award.tax}-${award.cabin}-${airline}-${flightNumbers}`;
      
      // Keep the first occurrence (or prefer one with more seats)
      if (!uniqueMap.has(uniqueKey) || (award.seats > 0 && (uniqueMap.get(uniqueKey)?.seats || 0) < award.seats)) {
        uniqueMap.set(uniqueKey, award);
      }
    });
    
    return Array.from(uniqueMap.values());
  };

  // Extract ALL award options from v2 enrichment data
  const getAllAwardOptions = (): any[] => {
    if (!v2EnrichmentData || v2EnrichmentData.size === 0 || !carrier.code) return [];
    
    const carrierEnrichment = v2EnrichmentData.get(carrier.code);
    if (!carrierEnrichment || carrierEnrichment.length === 0) return [];
    
    const awardOptions: any[] = [];
    
    carrierEnrichment.forEach((enrichment: any) => {
      // New format: awardtool-direct
      if (enrichment.type === 'solution' && enrichment.provider === 'awardtool-direct' && enrichment.data) {
        const flightData = enrichment.data;
        const awardtool = flightData.awardtool;
        
        if (awardtool && awardtool.cabinPrices) {
          // Extract all cabin options from this solution
          Object.entries(awardtool.cabinPrices).forEach(([cabinName, cabinData]: [string, any]) => {
            if (cabinData.miles > 0) {
              // Generate unique ID that includes cabin to distinguish different cabin options from same flight
              const uniqueId = flightData.id 
                ? `${flightData.id}_${cabinName.toUpperCase().replace(/\s+/g, '_')}`
                : `${enrichment.segment?.origin}-${enrichment.segment?.destination}-${cabinName}-${Date.now()}`;
              
              awardOptions.push({
                id: uniqueId,
                miles: cabinData.miles,
                tax: cabinData.tax || 0,
                cabin: cabinName,
                segments: cabinData.segments || [],
                transferOptions: cabinData.transfer_options || [],
                seats: cabinData.seats || 0,
                itineraries: flightData.itineraries || [],
                price: flightData.price,
                data: flightData,
                enrichment: enrichment,
                // Store enrichment segment metadata for filtering
                enrichmentOrigin: enrichment.segment?.origin,
                enrichmentDestination: enrichment.segment?.destination
              });
            }
          });
        }
      }
    });
    
    // Deduplicate before returning
    return deduplicateAwardOptions(awardOptions);
  };
  
  const allAwardOptions = getAllAwardOptions();
  const hasAwardOptions = allAwardOptions.length > 0;
  
  // Check if enrichment exists for this carrier (regardless of cabin match)
  // Used to determine if we should show the "Miles" button
  const hasAnyEnrichmentForCarrier = v2EnrichmentData && v2EnrichmentData.has(carrier.code);

  // Set default selected award to cheapest for each slice if not already selected
  useEffect(() => {
    if (hasAwardOptions && allAwardOptions.length > 0 && slices.length > 0) {
      slices.forEach((slice, sliceIndex) => {
        // Skip if already selected for this slice
        if (selectedAwardPerSlice[sliceIndex]) return;

        // Filter award options for this slice
        const sliceAwardOptions = allAwardOptions.filter(award => {
          // First check enrichment segment metadata (more reliable for route matching)
          if (award.enrichmentOrigin && award.enrichmentDestination) {
            if (award.enrichmentOrigin === slice.origin.code &&
                award.enrichmentDestination === slice.destination.code) {
              return true;
            }
          }
          
          // Fallback to itinerary segments if metadata not available
          const itinerary = award.itineraries?.[0];
          if (!itinerary || !itinerary.segments || itinerary.segments.length === 0) return false;
          const firstSegment = itinerary.segments[0];
          const lastSegment = itinerary.segments[itinerary.segments.length - 1];
          return firstSegment.departure?.iataCode === slice.origin.code &&
                 lastSegment.arrival?.iataCode === slice.destination.code;
        });

        if (sliceAwardOptions.length > 0) {
          const cheapest = [...sliceAwardOptions].sort((a, b) => {
            const aValue = (a.miles * perCentValue) + a.tax;
            const bValue = (b.miles * perCentValue) + b.tax;
            return aValue - bValue;
          })[0];
          
          if (cheapest) {
            setSelectedAwardPerSlice(prev => {
              // Only set if not already set for this slice
              if (prev[sliceIndex]) return prev;
              return { ...prev, [sliceIndex]: cheapest.id };
            });
          }
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAwardOptions.length, hasAwardOptions, slices.length]);
  
  // Check if we have aero mileage options
  const hasAeroMileage = slices.some(slice => slice.mileageBreakdown && slice.mileageBreakdown.length > 0);
  
  console.log('🌟 FlightCard: V2 enrichment check - Carrier:', carrier.code, 'HasAny:', hasAnyEnrichmentForCarrier, 'HasMatch:', hasV2Enrichment, 'AwardOptions:', allAwardOptions.length, 'HasAero:', hasAeroMileage);

  // Handle enrichment button click
  const handleEnrichClick = async () => {
    if (!onEnrichFlight || !carrier.code || isEnriching || hasV2Enrichment) return;
    
    try {
      await onEnrichFlight(flight, carrier.code);
    } catch (error) {
      console.error('Failed to enrich flight:', error);
    }
  };

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

  interface SegmentMatch {
    origin: string;
    destination: string;
    cheapestFlight: any | null;
  }

  interface GroupedMileageProgram {
    carrierCode: string;
    carrierName: string;
    totalMileage: number;
    totalPrice: number;
    matchType: 'exact' | 'partial' | 'mixed';
    flights: any[];
    segmentCount: number;
    segmentMatches: SegmentMatch[];
    hasIncompleteSegments: boolean;
    cabin?: string;
  }

  const groupMileageByProgram = (breakdown?: any[]): GroupedMileageProgram[] => {
    if (!breakdown || breakdown.length === 0) return [];

    // Group flights by carrier+cabin, then by segment
    const programMap = new Map<string, Map<string, any[]>>();

    breakdown.forEach((segment, segmentIndex) => {
      if (!segment.allMatchingFlights || segment.allMatchingFlights.length === 0) return;

      const segmentKey = `${segment.origin}-${segment.destination}`;

      segment.allMatchingFlights.forEach((flight: any) => {
        const carrierCode = flight.operatingCarrier || flight.carrierCode;
        if (!carrierCode) return;

        // Include cabin in the grouping key
        const cabin = flight.cabin || 'COACH';
        const programKey = `${carrierCode}-${cabin}`;

        if (!programMap.has(programKey)) {
          programMap.set(programKey, new Map());
        }

        const carrierSegments = programMap.get(programKey)!;
        if (!carrierSegments.has(segmentKey)) {
          carrierSegments.set(segmentKey, []);
        }

        carrierSegments.get(segmentKey)!.push({
          ...flight,
          segmentIndex,
          segmentKey,
          cabin
        });
      });
    });

    // For each carrier+cabin combination, find the cheapest flight PER SEGMENT
    const result: GroupedMileageProgram[] = [];

    programMap.forEach((carrierSegments, programKey) => {
      // Extract carrier and cabin from the key
      const [carrierCode, cabin] = programKey.split('-');
      let totalMileage = 0;
      let totalPrice = 0;
      let allExactMatch = true;
      let anyExactMatch = false;
      const allFlights: any[] = [];
      const segmentMatches: SegmentMatch[] = [];

      // For each segment, find the CHEAPEST flight
      carrierSegments.forEach((flights, segmentKey) => {
        // Deduplicate codeshares
        const uniqueFlights = new Map<string, any>();
        flights.forEach((flight: any) => {
          const key = `${flight.departure?.iataCode}-${flight.arrival?.iataCode}-${flight.mileage}`;
          if (!uniqueFlights.has(key) ||
              (flight.flightNumber && uniqueFlights.get(key)?.flightNumber > flight.flightNumber)) {
            uniqueFlights.set(key, flight);
          }
        });

        // Find cheapest flight for THIS segment
        const sortedFlights = Array.from(uniqueFlights.values()).sort((a: any, b: any) => {
          const aPrice = typeof a.mileagePrice === 'string'
            ? parseFloat(a.mileagePrice.replace(/[^0-9.]/g, ''))
            : (a.mileagePrice || 0);
          const bPrice = typeof b.mileagePrice === 'string'
            ? parseFloat(b.mileagePrice.replace(/[^0-9.]/g, ''))
            : (b.mileagePrice || 0);
          // Prefer cheaper price, then lower mileage
          if (Math.abs(aPrice - bPrice) > 0.01) {
            return aPrice - bPrice;
          }
          return (a.mileage || 0) - (b.mileage || 0);
        });

        const cheapest = sortedFlights[0];
        if (cheapest) {
          const price = typeof cheapest.mileagePrice === 'string'
            ? parseFloat(cheapest.mileagePrice.replace(/[^0-9.]/g, ''))
            : (cheapest.mileagePrice || 0);

          totalMileage += cheapest.mileage || 0;
          totalPrice += price;
          allFlights.push(cheapest);

          segmentMatches.push({
            origin: cheapest.departure?.iataCode || segmentKey.split('-')[0],
            destination: cheapest.arrival?.iataCode || segmentKey.split('-')[1],
            cheapestFlight: cheapest
          });

          if (cheapest.exactMatch) {
            anyExactMatch = true;
          } else {
            allExactMatch = false;
          }
        }
      });

      // Check if we have all expected segments (based on breakdown length)
      const hasIncompleteSegments = carrierSegments.size < breakdown.length;

      // Add missing segments as unmatched
      if (hasIncompleteSegments) {
        breakdown.forEach(segment => {
          const segmentKey = `${segment.origin}-${segment.destination}`;
          if (!carrierSegments.has(segmentKey)) {
            segmentMatches.push({
              origin: segment.origin,
              destination: segment.destination,
              cheapestFlight: null
            });
          }
        });
      }

      const carrierName = allFlights[0]?.operatingCarrier || carrierCode;

      result.push({
        carrierCode,
        carrierName,
        totalMileage,
        totalPrice,
        matchType: allExactMatch ? 'exact' : anyExactMatch ? 'mixed' : 'partial',
        flights: allFlights,
        segmentCount: allFlights.length,
        segmentMatches,
        hasIncompleteSegments,
        cabin
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

  // Helper to format day difference indicator text
  const formatDayIndicator = (dayDiff: number) => {
    if (dayDiff === 1) return 'Next day';
    if (dayDiff === 2) return '+2 days';
    return `+${dayDiff} days`;
  };

  const formatPrice = (price: number, currencyCode: string, showPlus: boolean = false) => {
    // Format number with commas, preserving decimals if they exist (up to 1 decimal place)
    // This matches the precision shown in the top tabs
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    }).format(price);

    // Return with currency code prefix and optional "+"
    return `${currencyCode} ${formatted}${showPlus ? '+' : ''}`;
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

  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-sync price option when dropdown opens or displayed flight/time option changes
  useEffect(() => {
    if (!isExpanded || !selectedCabin) return;
    
    const selectedCabinPricing = cabinPricing[selectedCabin as keyof typeof cabinPricing];
    if (!selectedCabinPricing?.priceOptions?.flightsByPrice) return;

    // Only update if there's no stored price option for this cabin
    const currentStoredPrice = selectedPriceOption[selectedCabin];
    if (currentStoredPrice) return; // Already has a stored price, don't override

    // Helper to find price for a flight
    const findPriceForFlight = (targetFlight: any): number | null => {
      if (!selectedCabinPricing.priceOptions?.flightsByPrice) return null;
      for (const [price, flights] of selectedCabinPricing.priceOptions.flightsByPrice.entries()) {
        if (flights.some(f => {
          const fId = 'id' in f.flight ? f.flight.id : null;
          const tId = 'id' in targetFlight ? targetFlight.id : null;
          return fId && tId ? fId === tId : f.flight === targetFlight;
        })) {
          return price;
        }
      }
      return null;
    };

    const selectedTime = selectedTimeOption[selectedCabin];
    
    // If there's a selected time option, find price that matches both flight and time
    if (selectedTime && selectedCabinPricing.timeOptions?.flightsByTime) {
      const flightsAtTime = selectedCabinPricing.timeOptions.flightsByTime.get(selectedTime) || [];
      const matchingFlight = flightsAtTime.find(f => {
        const fId = 'id' in f.flight ? f.flight.id : null;
        const tId = 'id' in flightToDisplay ? flightToDisplay.id : null;
        return fId && tId ? fId === tId : f.flight === flightToDisplay;
      });
      
      if (matchingFlight) {
        const priceForFlight = findPriceForFlight(matchingFlight.flight);
        if (priceForFlight !== null) {
          setSelectedPriceOption(prev => ({ ...prev, [selectedCabin]: priceForFlight }));
          return;
        }
      }
    }
    
    // Otherwise, find price for displayed flight
    const priceForFlight = findPriceForFlight(flightToDisplay);
    if (priceForFlight !== null) {
      setSelectedPriceOption(prev => ({ ...prev, [selectedCabin]: priceForFlight }));
    }
  }, [isExpanded, selectedCabin, displayedFlight, selectedTimeOption, cabinPricing, flightToDisplay]);

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
  const handleCardClick = (e: React.MouseEvent) => {
    // Only open modal if clicking on the card itself, not on buttons or interactive elements
    const target = e.target as HTMLElement;
    if (
      target.closest('button') || 
      target.closest('a') || 
      target.closest('[role="button"]') ||
      target.closest('.mileage-selector-container') ||
      target.closest('[data-dropdown]')
    ) {
      return;
    }
    setShowSummaryModal(true);
  };

  return (
    <>
      <div 
        className={`bg-gray-900/80 backdrop-blur-sm border border-gray-800/60 rounded-lg hover:border-gray-700/60 hover:bg-gray-900 transition-all duration-200 ${
          matchType && matchType !== 'none' ? 'border-gray-700/60' : ''
        }`}
      >
      {/* Main Flight Bar - Ultra Compact Google Flights Style */}
      <div className="px-4 py-3 border-b border-gray-800/30">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Airline + Route + Times */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Airline Logo */}
            {carrier.code && (
              <img
                src={`https://www.gstatic.com/flights/airline_logos/35px/${carrier.code}.png`}
                alt={carrier.code}
                className="h-6 w-6 object-contain flex-shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            
            {/* Route: Departure → Duration → Arrival */}
            <div 
              className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {/* Departure */}
              <div className="text-left min-w-[65px]">
                <div className="text-sm font-semibold text-white">
                  {formatTime(slices[0].departure)}
                </div>
                <div className="text-[11px] text-gray-400">
                  {slices[0].origin.code}
                </div>
              </div>

              {/* Arrow & Duration */}
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-px bg-gray-700"></div>
                  {isNonstop ? (
                    <Plane className="h-3 w-3 text-success-400" />
                  ) : (
                    <div className="text-[10px] text-gray-500">
                      {slices[0].stops?.length || 0}
                    </div>
                  )}
                  <div className="w-6 h-px bg-gray-700"></div>
                </div>
                <div className="text-[10px] text-gray-500">
                  {formatDuration(slices[0].duration)}
                </div>
              </div>

              {/* Arrival */}
              <div className="text-left min-w-[65px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-white">
                    {formatTime(slices[0].arrival)}
                  </span>
                  {(() => {
                    const dayDiff = getDayDifference(slices[0].departure, slices[0].arrival);
                    if (dayDiff > 0) {
                      return (
                        <div className="relative">
                          <span 
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-500/10 text-slate-300 border border-slate-600/30 cursor-help"
                            onMouseEnter={() => setTooltipStates(prev => ({ ...prev, 'day-indicator-header': true }))}
                            onMouseLeave={() => setTooltipStates(prev => ({ ...prev, 'day-indicator-header': false }))}
                          >
                            +{dayDiff}
                          </span>
                          {tooltipStates['day-indicator-header'] && (
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-50 w-32 bg-gray-800/95 border border-gray-700/50 rounded-md shadow-lg p-1.5 text-[10px] text-gray-200 text-center backdrop-blur-sm">
                              Arrives {formatDayIndicator(dayDiff).toLowerCase()}
                              <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-gray-800/95 border-r border-b border-gray-700/50 transform rotate-45 -mt-1"></div>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div className="text-[11px] text-gray-400">
                  {slices[slices.length - 1].destination.code}
                </div>
              </div>
            </div>

            {/* Flight Info: Airline Name & Flight Number */}
            <div className="flex flex-col items-start min-w-[120px] ml-2">
              <div className="text-xs font-medium text-white">
                {carrier.shortName || carrier.name || carrier.code}
              </div>
              {slices[0].flights && slices[0].flights.length > 0 && (
                <div className="text-[10px] text-gray-400 font-mono">
                  {slices[0].flights[0]}
                </div>
              )}
              {/* Cabin Class */}
              {slices[0].cabins && slices[0].cabins.length > 0 && (
                <div className="text-[10px] text-teal-300 font-medium mt-0.5">
                  {slices[0].cabins[0]}
                </div>
              )}
            </div>
          </div>

          {/* Center: Badges & Best Deals */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Round Trip Badge */}
            {slices.length > 1 && (
              <div className="px-2 py-0.5 bg-slate-500/10 text-slate-300 text-[10px] font-medium rounded border border-slate-600/30">
                {slices.length === 2 ? 'Round Trip' : `${slices.length} Legs`}
              </div>
            )}

            {/* Match Type Badge */}
            {matchType && matchType !== 'none' && (
              <div className={`px-2 py-0.5 text-[10px] font-medium rounded border ${
                matchType === 'exact'
                  ? 'bg-success-500/15 text-success-400 border-success-500/30'
                  : 'bg-amber-500/10 text-amber-300 border-amber-600/30'
              }`}>
                Aero {matchType === 'exact' ? '✓' : '~'}
              </div>
            )}


            {/* Loading Award Indicator */}
            {isEnriching && !hasV2Enrichment && (
              <div className="px-2 py-0.5 bg-amber-500/10 text-amber-300 text-[10px] font-medium rounded border border-amber-600/30 flex items-center gap-1 animate-pulse">
                <Zap className="h-2.5 w-2.5" />
                Fetching...
              </div>
            )}
          </div>

          {/* Right: Similar Options Indicator + Cabin Sections */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Minimal Similar Options Indicator - Fixed width to prevent layout shift */}
            <div className="w-[40px] flex items-center justify-center flex-shrink-0">
              {showSimilarOptions && similarFlightsCount !== undefined && similarFlightsCount > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (import.meta.env.VITE_ALLOW_VIEW_SIMILAR_FLIGHT === 'true') {
                      onToggleSimilarOptions?.();
                    }
                  }}
                  disabled={import.meta.env.VITE_ALLOW_VIEW_SIMILAR_FLIGHT !== 'true'}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium transition-all ${
                    import.meta.env.VITE_ALLOW_VIEW_SIMILAR_FLIGHT !== 'true'
                      ? 'bg-gray-800/30 text-gray-500 opacity-50 cursor-not-allowed'
                      : isSimilarOptionsExpanded
                      ? 'bg-slate-500/10 text-slate-300'
                      : 'bg-gray-800/30 text-gray-500 hover:bg-gray-700/40 hover:text-gray-400'
                  }`}
                  title={import.meta.env.VITE_ALLOW_VIEW_SIMILAR_FLIGHT === 'true'
                    ? `${similarFlightsCount} similar option${similarFlightsCount !== 1 ? 's' : ''}`
                    : 'Similar flights disabled'}
                >
                  <span>{similarFlightsCount}</span>
                  <ChevronDown className={`h-2.5 w-2.5 transition-transform duration-200 ${isSimilarOptionsExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>

            {/* Cabin Pricing Sections */}
            {(['ECONOMY', 'BUSINESS', 'BUSINESS_PREMIUM', 'FIRST'] as const).map((cabinKey) => {
              const pricing = cabinPricing[cabinKey];
              const isSelected = selectedCabin === cabinKey;
              const cabinLabels: Record<string, string> = {
                'ECONOMY': 'Economy',
                'BUSINESS': 'Business',
                'BUSINESS_PREMIUM': 'Business Premium',
                'FIRST': 'First'
              };

              // Check if awards are available for this cabin
              const cabinHasAwards = hasAwardOptions && allAwardOptions.some(award => {
                const awardCabin = award.cabin?.toUpperCase() || '';
                if (cabinKey === 'ECONOMY') {
                  return awardCabin.includes('ECONOMY') || awardCabin.includes('COACH');
                } else if (cabinKey === 'BUSINESS') {
                  return awardCabin.includes('BUSINESS') && !awardCabin.includes('PREMIUM');
                } else if (cabinKey === 'BUSINESS_PREMIUM') {
                  return awardCabin.includes('BUSINESS') && awardCabin.includes('PREMIUM');
                } else if (cabinKey === 'FIRST') {
                  return awardCabin.includes('FIRST');
                }
                return false;
              });

              // Get the actual price for the currently displayed flight for this cabin
              const getDisplayPrice = () => {
                if (!pricing) return null;
                
                // Find the price of the currently displayed flight
                const normalizeCabin = (cabin: string) => {
                  const c = cabin.toUpperCase();
                  if (c.includes('FIRST')) return 'FIRST';
                  if (c.includes('BUSINESS') && c.includes('PREMIUM')) return 'BUSINESS_PREMIUM';
                  if (c.includes('BUSINESS')) return 'BUSINESS';
                  if (c.includes('PREMIUM')) return 'PREMIUM_ECONOMY';
                  return 'ECONOMY';
                };

                const flightToDisplayCabin = flightToDisplay && 'id' in flightToDisplay
                  ? flightToDisplay.slices[0]?.cabins?.[0] || ''
                  : flightToDisplay
                  ? (flightToDisplay as GroupedFlight).outboundSlice?.cabins?.[0] || ''
                  : '';

                const targetCabin = normalizeCabin(cabinKey);
                const displayedCabin = normalizeCabin(flightToDisplayCabin);

                // If the displayed flight matches this cabin, use its price
                // For ECONOMY, also match PREMIUM-COACH flights
                const flightToDisplayCabinUpper = flightToDisplayCabin.toUpperCase();
                if (displayedCabin === targetCabin || 
                    (targetCabin === 'ECONOMY' && (flightToDisplayCabinUpper.includes('PREMIUM') || flightToDisplayCabinUpper.includes('PREMIUM-COACH') || flightToDisplayCabinUpper.includes('PREMIUM_COACH')))) {
                  const flightPrice = 'id' in flightToDisplay
                    ? (flightToDisplay.displayTotal || flightToDisplay.totalAmount || 0)
                    : (flightToDisplay as GroupedFlight).returnOptions?.[0]?.displayTotal 
                      || (flightToDisplay as GroupedFlight).returnOptions?.[0]?.totalAmount 
                      || 0;
                  return flightPrice > 0 ? flightPrice : pricing.price;
                }

                // Otherwise, find the price from matching flights that match the displayed flight
                if (pricing.flightsByPrice) {
                  for (const [price, flights] of pricing.flightsByPrice.entries()) {
                    const matchingFlight = flights.find(f => {
                      const fId = 'id' in f.flight ? f.flight.id : null;
                      const tId = 'id' in flightToDisplay ? flightToDisplay.id : null;
                      return fId && tId ? fId === tId : f.flight === flightToDisplay;
                    });
                    if (matchingFlight) {
                      return price;
                    }
                  }
                }

                // Fallback to the pricing's price
                return pricing.price;
              };

              const displayPrice = getDisplayPrice();

              // Helper to switch to a flight with the selected cabin
              const switchToCabinFlight = () => {
                if (!pricing) return;

                // Normalize cabin helper
                const normalizeCabin = (cabin: string) => {
                  const c = cabin.toUpperCase();
                  if (c.includes('FIRST')) return 'FIRST';
                  if (c.includes('BUSINESS') && c.includes('PREMIUM')) return 'BUSINESS_PREMIUM';
                  if (c.includes('BUSINESS')) return 'BUSINESS';
                  if (c.includes('PREMIUM')) return 'ECONOMY'; // PREMIUM-COACH maps to ECONOMY
                  return 'ECONOMY';
                };

                // Check if current displayed flight already has this cabin
                const currentCabin = flightToDisplay && 'id' in flightToDisplay
                  ? flightToDisplay.slices[0]?.cabins?.[0] || ''
                  : flightToDisplay
                  ? (flightToDisplay as GroupedFlight).outboundSlice?.cabins?.[0] || ''
                  : '';
                
                const normalizedCurrentCabin = normalizeCabin(currentCabin);
                const normalizedTargetCabin = normalizeCabin(cabinKey);
                const currentCabinUpper = currentCabin.toUpperCase();

                // If current flight already matches the cabin, don't switch
                if (normalizedCurrentCabin === normalizedTargetCabin || 
                    (normalizedTargetCabin === 'ECONOMY' && (currentCabinUpper.includes('PREMIUM') || currentCabinUpper.includes('PREMIUM-COACH') || currentCabinUpper.includes('PREMIUM_COACH')))) {
                  setSelectedCabin(cabinKey);
                  return;
                }

                // Find a flight with the target cabin
                // First, try to get from flightsByPrice (prefer the cheapest price)
                let targetFlight = null;
                
                if (pricing.flightsByPrice && pricing.flightsByPrice.size > 0) {
                  // Get the first (cheapest) price's flights
                  const sortedPrices = Array.from(pricing.flightsByPrice.keys()).sort((a, b) => a - b);
                  if (sortedPrices.length > 0) {
                    const cheapestPrice = sortedPrices[0];
                    const flightsAtPrice = pricing.flightsByPrice.get(cheapestPrice) || [];
                    if (flightsAtPrice.length > 0) {
                      targetFlight = flightsAtPrice[0].flight;
                    }
                  }
                }

                // Fallback to pricing.flight if flightsByPrice doesn't have a match
                if (!targetFlight && pricing.flight) {
                  targetFlight = pricing.flight;
                }

                // Switch to the target flight
                if (targetFlight) {
                  // Safety check: Ensure target flight matches the primary airline
                  const primaryAirlineCode = getFlightAirlineCode(flight);
                  const targetAirlineCode = getFlightAirlineCode(targetFlight);
                  
                  if (targetAirlineCode !== primaryAirlineCode) {
                    // Flight doesn't match airline, skip switching
                    setSelectedCabin(cabinKey);
                    return;
                  }
                  
                  setSelectedCabin(cabinKey);
                  
                  // Check if it's a different flight before switching
                  const isDifferent = 'id' in flightToDisplay && 'id' in targetFlight
                    ? flightToDisplay.id !== targetFlight.id
                    : flightToDisplay !== targetFlight;
                  
                  if (isDifferent) {
                    // Sync price and time options for the new cabin before switching
                    const newCabinPricing = cabinPricing[cabinKey as keyof typeof cabinPricing];
                    
                    if (newCabinPricing) {
                      // Find and set the price option for this flight
                      if (newCabinPricing.flightsByPrice) {
                        for (const [price, flights] of newCabinPricing.flightsByPrice.entries()) {
                          const matchingFlight = flights.find(f => {
                            const fId = 'id' in f.flight ? f.flight.id : null;
                            const tId = 'id' in targetFlight ? targetFlight.id : null;
                            return fId && tId ? fId === tId : f.flight === targetFlight;
                          });
                          if (matchingFlight) {
                            setSelectedPriceOption(prev => ({ ...prev, [cabinKey]: price }));
                            break;
                          }
                        }
                      }
                      
                      // Find and set the time option for this flight
                      if (newCabinPricing.timeOptions?.flightsByTime) {
                        for (const [timeKey, flights] of newCabinPricing.timeOptions.flightsByTime.entries()) {
                          const matchingFlight = flights.find(f => {
                            const fId = 'id' in f.flight ? f.flight.id : null;
                            const tId = 'id' in targetFlight ? targetFlight.id : null;
                            return fId && tId ? fId === tId : f.flight === targetFlight;
                          });
                          if (matchingFlight) {
                            setSelectedTimeOption(prev => ({ ...prev, [cabinKey]: timeKey }));
                            break;
                          }
                        }
                      }
                    }
                    
                    // Switch to the target flight
                    setDisplayedFlight(targetFlight);
                  }
                } else {
                  // If no flight found, just set the cabin (shouldn't happen if pricing exists)
                  setSelectedCabin(cabinKey);
                }
              };

              const hasFlightOrAward = (pricing && displayPrice !== null) || cabinHasAwards;

              return (
                <button
                  key={cabinKey}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (pricing) {
                      switchToCabinFlight();
                    } else if (cabinHasAwards) {
                      // Just switch cabin to show awards
                      setSelectedCabin(cabinKey);
                    }
                  }}
                  className={`relative flex flex-col items-center justify-center min-w-[95px] px-2 py-1.5 rounded border transition-all ${
                    isSelected && hasFlightOrAward
                      ? cabinKey === 'FIRST' || cabinKey === 'BUSINESS' || cabinKey === 'BUSINESS_PREMIUM'
                        ? 'bg-purple-500/20 border-purple-500/40'
                        : 'bg-slate-500/15 border-slate-600/40'
                      : hasFlightOrAward
                      ? 'bg-gray-800/30 border-gray-700/30 hover:bg-gray-800/50 hover:border-gray-600/50'
                      : 'bg-gray-800/10 border-gray-700/20 opacity-50 cursor-not-allowed'
                  }`}
                  disabled={!hasFlightOrAward}
                >
                  {cabinHasAwards && (
                    <div className="absolute -top-1 -right-1">
                      <Award className="h-3 w-3 text-yellow-500 fill-yellow-500/20" />
                    </div>
                  )}
                  <div className={`text-[9px] font-semibold mb-0.5 ${
                    isSelected ? 'text-purple-300' : hasFlightOrAward ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {cabinLabels[cabinKey]}
                  </div>
                  {pricing && displayPrice !== null ? (
                    <>
                      <div className={`text-xs font-bold ${
                        isSelected ? 'text-white' : 'text-gray-300'
                      }`}>
                        {formatPrice(displayPrice, pricing.currency, false)}
                      </div>
                      {(() => {
                        // Only show options count if there are actual price or time options
                        const hasPriceOptions = pricing.priceOptions && pricing.priceOptions.allPrices.length > 1;
                        const hasTimeOptions = pricing.timeOptions && pricing.timeOptions.allTimeKeys.length > 1;
                        const shouldShowOptions = hasPriceOptions || hasTimeOptions;
                        
                        if (!shouldShowOptions) return null;
                        
                        // Calculate actual options count from price and time options
                        const priceOptionsCount = hasPriceOptions ? pricing.priceOptions!.allPrices.length : 0;
                        const timeOptionsCount = hasTimeOptions ? pricing.timeOptions!.allTimeKeys.length : 0;
                        // If both exist, don't double count - use the max
                        const actualOptionsCount = Math.max(priceOptionsCount, timeOptionsCount);
                        
                        return actualOptionsCount > 1 ? (
                          <div className="text-[9px] text-gray-500 mt-0.5">
                            ({actualOptionsCount} options)
                          </div>
                        ) : null;
                      })()}
                    </>
                  ) : (
                    <div className="text-[10px] text-gray-600">N/A</div>
                  )}
                </button>
              );
            })}

            {/* Expand/Collapse Chevron */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-1.5 hover:bg-gray-800/50 rounded transition-colors text-gray-400 hover:text-gray-300 ml-1"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>

            {/* Code-Share Icon - Right of Chevron */}
            {showCodeShareOptions && codeShareFlightsCount !== undefined && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (codeShareFlightsCount > 0) {
                    onToggleCodeShareOptions?.();
                  }
                }}
                className={`relative p-1.5 hover:bg-gray-800/50 rounded transition-colors ml-1 ${
                  isCodeShareOptionsExpanded ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'
                }`}
                title="Code-share"
                disabled={codeShareFlightsCount === 0}
              >
                <Link className="h-4 w-4" />
                <span className={`absolute -top-1 -right-1 text-[9px] font-bold px-1 rounded ${
                  isCodeShareOptionsExpanded ? 'bg-yellow-500 text-gray-900' : 'bg-gray-700 text-gray-300'
                }`}>
                  {codeShareFlightsCount}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>



      {/* Expanded Details - Only show when expanded */}
      {isExpanded && (
        <div className="border-t border-gray-800/30">
          {/* Price and Time Options - Top of expanded section */}
          {(() => {
            const selectedCabinPricing = selectedCabin ? cabinPricing[selectedCabin as keyof typeof cabinPricing] : null;
            if (!selectedCabinPricing) return null;

            const hasPriceOptions = selectedCabinPricing.priceOptions && selectedCabinPricing.priceOptions.allPrices.length > 1;
            const hasTimeOptions = selectedCabinPricing.timeOptions && selectedCabinPricing.timeOptions.allTimeKeys.length > 1;
            
            if (!hasPriceOptions && !hasTimeOptions) return null;

            // Helper to find price for the displayed flight
            const findPriceForFlight = (targetFlight: any): number | null => {
              if (!selectedCabinPricing.priceOptions?.flightsByPrice) return null;
              
              for (const [price, flights] of selectedCabinPricing.priceOptions.flightsByPrice.entries()) {
                if (flights.some(f => {
                  const fId = 'id' in f.flight ? f.flight.id : null;
                  const tId = 'id' in targetFlight ? targetFlight.id : null;
                  return fId && tId ? fId === tId : f.flight === targetFlight;
                })) {
                  return price;
                }
              }
              return null;
            };

            // Determine current selected price:
            // 1. Check if there's a stored price option
            // 2. If there's a selected time option, find price that matches both the displayed flight AND the time option
            // 3. Otherwise, find price that matches the displayed flight
            // 4. Default to first price
            let currentSelectedPrice: number;
            if (selectedCabin && selectedPriceOption[selectedCabin]) {
              currentSelectedPrice = selectedPriceOption[selectedCabin];
            } else {
              const selectedTime = selectedCabin && selectedTimeOption[selectedCabin]
                ? selectedTimeOption[selectedCabin]
                : null;
              
              // If there's a selected time option, find price that matches both flight and time
              if (selectedTime && selectedCabinPricing.timeOptions?.flightsByTime) {
                const flightsAtTime = selectedCabinPricing.timeOptions.flightsByTime.get(selectedTime) || [];
                // Find the flight in the time group that matches the displayed flight
                const matchingFlight = flightsAtTime.find(f => {
                  const fId = 'id' in f.flight ? f.flight.id : null;
                  const tId = 'id' in flightToDisplay ? flightToDisplay.id : null;
                  return fId && tId ? fId === tId : f.flight === flightToDisplay;
                });
                
                if (matchingFlight) {
                  const priceForFlight = findPriceForFlight(matchingFlight.flight);
                  if (priceForFlight !== null) {
                    currentSelectedPrice = priceForFlight;
                  } else {
                    currentSelectedPrice = selectedCabinPricing.allPrices[0];
                  }
                } else {
                  // If no matching flight in time group, find price for displayed flight
                  const priceForFlight = findPriceForFlight(flightToDisplay);
                  currentSelectedPrice = priceForFlight !== null ? priceForFlight : selectedCabinPricing.allPrices[0];
                }
              } else {
                // No time option selected, just find price for displayed flight
                const priceForFlight = findPriceForFlight(flightToDisplay);
                currentSelectedPrice = priceForFlight !== null ? priceForFlight : selectedCabinPricing.allPrices[0];
              }
            }
            
            const currentSelectedTime = selectedCabin && selectedTimeOption[selectedCabin]
              ? selectedTimeOption[selectedCabin]
              : (selectedCabinPricing.timeOptions?.allTimeKeys[0] || null);

            // Helper to switch flight and sync both price and time options
            const switchToFlight = (targetFlight: any) => {
              const isDifferent = 'id' in flightToDisplay && 'id' in targetFlight
                ? flightToDisplay.id !== targetFlight.id
                : flightToDisplay !== targetFlight;
              
              if (isDifferent) {
                // Auto-sync price option BEFORE switching flight
                if (selectedCabinPricing.priceOptions?.flightsByPrice) {
                  for (const [price, flights] of selectedCabinPricing.priceOptions.flightsByPrice.entries()) {
                    if (flights.some(f => {
                      const fId = 'id' in f.flight ? f.flight.id : null;
                      const tId = 'id' in targetFlight ? targetFlight.id : null;
                      return fId && tId ? fId === tId : f.flight === targetFlight;
                    })) {
                      setSelectedPriceOption(prev => ({ ...prev, [selectedCabin!]: price }));
                      break;
                    }
                  }
                } else if (selectedCabinPricing.flightsByPrice) {
                  // Fallback to flightsByPrice if priceOptions not available
                  for (const [price, flights] of selectedCabinPricing.flightsByPrice.entries()) {
                    if (flights.some(f => {
                      const fId = 'id' in f.flight ? f.flight.id : null;
                      const tId = 'id' in targetFlight ? targetFlight.id : null;
                      return fId && tId ? fId === tId : f.flight === targetFlight;
                    })) {
                      setSelectedPriceOption(prev => ({ ...prev, [selectedCabin!]: price }));
                      break;
                    }
                  }
                }
                
                // Auto-sync time option BEFORE switching flight
                if (selectedCabinPricing.timeOptions?.flightsByTime) {
                  // Find the time key for this flight
                  for (const [timeKey, flights] of selectedCabinPricing.timeOptions.flightsByTime.entries()) {
                    if (flights.some(f => {
                      const fId = 'id' in f.flight ? f.flight.id : null;
                      const tId = 'id' in targetFlight ? targetFlight.id : null;
                      return fId && tId ? fId === tId : f.flight === targetFlight;
                    })) {
                      setSelectedTimeOption(prev => ({ ...prev, [selectedCabin!]: timeKey }));
                      break;
                    }
                  }
                }
                
                // Switch flight AFTER setting state
                setDisplayedFlight(targetFlight);
              }
            };

            return (
              <div className="px-4 py-3 bg-gray-800/40 border-b border-gray-800/30 space-y-3">
                {/* Price Options */}
                {hasPriceOptions && (
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-xs font-semibold text-gray-300 whitespace-nowrap">
                      Price Options:
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedCabinPricing.priceOptions!.allPrices.map((price, idx) => {
                        const isSelected = price === currentSelectedPrice;
                        return (
                          <button
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Set price option state first
                              setSelectedPriceOption(prev => ({
                                ...prev,
                                [selectedCabin!]: price
                              }));
                              // Switch to the first flight with this price
                              const flightsAtPrice = selectedCabinPricing.priceOptions!.flightsByPrice.get(price) || [];
                              if (flightsAtPrice.length > 0) {
                                // Use setTimeout to ensure state is set before switching
                                setTimeout(() => {
                                  switchToFlight(flightsAtPrice[0].flight);
                                }, 0);
                              }
                            }}
                            className={`px-2.5 py-1 rounded border transition-all ${
                              isSelected
                                ? 'bg-success-500/20 border-success-500/40 text-success-400 hover:bg-success-500/30'
                                : 'bg-gray-700/40 border-gray-600/40 text-gray-200 hover:bg-gray-700/60 hover:border-gray-500/60'
                            }`}
                          >
                            <span className="text-xs font-bold">
                              {formatPrice(price, selectedCabinPricing.currency, false)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Time Options */}
                {hasTimeOptions && (
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-xs font-semibold text-gray-300 whitespace-nowrap">
                      Time Options:
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedCabinPricing.timeOptions!.allTimeKeys.map((timeKey, idx) => {
                        const isSelected = timeKey === currentSelectedTime;
                        return (
                          <button
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Set time option state first
                              setSelectedTimeOption(prev => ({
                                ...prev,
                                [selectedCabin!]: timeKey
                              }));
                              // Switch to the first flight with this time
                              const flightsAtTime = selectedCabinPricing.timeOptions!.flightsByTime.get(timeKey) || [];
                              if (flightsAtTime.length > 0) {
                                // Use setTimeout to ensure state is set before switching
                                setTimeout(() => {
                                  switchToFlight(flightsAtTime[0].flight);
                                }, 0);
                              }
                            }}
                            className={`px-2.5 py-1 rounded border transition-all ${
                              isSelected
                                ? 'bg-success-500/20 border-success-500/40 text-success-400 hover:bg-success-500/30'
                                : 'bg-gray-700/40 border-gray-600/40 text-gray-200 hover:bg-gray-700/60 hover:border-gray-500/60'
                            }`}
                          >
                            <span className="text-xs font-bold font-mono">
                              {timeKey}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Award Options - Show if awards available for selected cabin */}
          {hasAwardOptions && selectedCabin && (() => {
            // Filter awards for the selected cabin
            const cabinAwardOptions = allAwardOptions.filter(award => {
              const awardCabin = award.cabin?.toUpperCase() || '';
              if (selectedCabin === 'ECONOMY') {
                return awardCabin.includes('ECONOMY') || awardCabin.includes('COACH');
              } else if (selectedCabin === 'BUSINESS') {
                return awardCabin.includes('BUSINESS') && !awardCabin.includes('PREMIUM');
              } else if (selectedCabin === 'BUSINESS_PREMIUM') {
                return awardCabin.includes('BUSINESS') && awardCabin.includes('PREMIUM');
              } else if (selectedCabin === 'FIRST') {
                return awardCabin.includes('FIRST');
              }
              return false;
            });

            if (cabinAwardOptions.length === 0) return null;

            return (
              <div className="px-4 py-3 bg-gray-800/40 border-b border-gray-800/30 space-y-2">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-xs font-semibold text-gray-300 whitespace-nowrap flex items-center gap-2">
                    <Award className="h-3.5 w-3.5 text-yellow-500" />
                    Award Options:
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {cabinAwardOptions.map((award, idx) => {
                      const cashValue = (award.miles * perCentValue) + award.tax;
                      const isSelected = selectedAwardPerSlice[0] === award.id;
                      return (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Toggle selection
                            if (isSelected) {
                              setSelectedAwardPerSlice(prev => {
                                const newState = { ...prev };
                                delete newState[0];
                                return newState;
                              });
                            } else {
                              setSelectedAwardPerSlice(prev => ({
                                ...prev,
                                [0]: award.id
                              }));
                            }
                          }}
                          className={`px-2.5 py-1 rounded border transition-all ${
                            isSelected
                              ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/30'
                              : 'bg-gray-700/40 border-gray-600/40 text-gray-200 hover:bg-gray-700/60 hover:border-gray-500/60'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold">
                              {award.miles.toLocaleString()}
                            </span>
                            <span className="text-[10px]">mi</span>
                            <span className="text-[10px] opacity-50">@</span>
                            <span className="text-xs font-semibold">
                              {formatPrice(cashValue, award.currency || 'USD', false)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Action Buttons - First 80px on right side */}
          <div className="px-4 py-3 flex items-start justify-end gap-3 h-20 border-b border-gray-800/30">
            {/* Details Button */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSummaryModal(true);
                }}
                onMouseEnter={() => setTooltipStates(prev => ({ ...prev, details: true }))}
                onMouseLeave={() => setTooltipStates(prev => ({ ...prev, details: false }))}
                className="flex flex-col items-center gap-1.5 p-2 hover:bg-gray-800/50 rounded transition-colors text-gray-400 hover:text-gray-300"
              >
                <Eye className="h-4 w-4" />
                <span className="text-[10px] font-medium">Details</span>
              </button>
              {tooltipStates.details && (
                <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-2 text-xs text-gray-300">
                  View Flight Details
                  <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-800 border-t border-l border-gray-700 transform rotate-45"></div>
                </div>
              )}
            </div>

            {/* Find Awards Button - Only if no enrichment */}
            {onEnrichFlight && !hasAnyEnrichmentForCarrier && !isEnriching && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEnrichClick();
                  }}
                  onMouseEnter={() => setTooltipStates(prev => ({ ...prev, awards: true }))}
                  onMouseLeave={() => setTooltipStates(prev => ({ ...prev, awards: false }))}
                  className="flex flex-col items-center gap-1.5 p-2 hover:bg-amber-500/15 rounded transition-colors text-amber-300 hover:text-amber-200"
                >
                  <Award className="h-4 w-4" />
                  <span className="text-[10px] font-medium">Find Awards</span>
                </button>
                {tooltipStates.awards && (
                  <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-2 text-xs text-gray-300">
                    Find Award Availability
                    <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-800 border-t border-l border-gray-700 transform rotate-45"></div>
                  </div>
                )}
              </div>
            )}

            {/* Hacks Button */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openHacksPage();
                }}
                onMouseEnter={() => setTooltipStates(prev => ({ ...prev, hacks: true }))}
                onMouseLeave={() => setTooltipStates(prev => ({ ...prev, hacks: false }))}
                className="flex flex-col items-center gap-1.5 p-2 hover:bg-teal-500/15 rounded transition-colors text-teal-300 hover:text-teal-200"
              >
                <Target className="h-4 w-4" />
                <span className="text-[10px] font-medium">Hacks</span>
              </button>
              {tooltipStates.hacks && (
                <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-2 text-xs text-gray-300">
                  View Flight Hacks
                  <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-800 border-t border-l border-gray-700 transform rotate-45"></div>
                </div>
              )}
            </div>

            {/* Add to Proposal Button */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (addedItems.has('flight')) {
                    const newSet = new Set(addedItems);
                    newSet.delete('flight');
                    Array.from(newSet).forEach(item => {
                      if (item.startsWith('aero-') || item.startsWith('award-')) {
                        newSet.delete(item);
                      }
                    });
                    setAddedItems(newSet);
                    setPendingItems(prev => prev.filter(item => item.type !== 'flight' && !item.id.startsWith('aero-') && !item.id.startsWith('award-')));
                    setShowAddToProposal(false);
                    setSelectedMileageFlight(null);
                  } else {
                    setAddedItems(prev => new Set(prev).add('flight'));
                    setPendingItems(prev => {
                      const filtered = prev.filter(item => item.type !== 'flight');
                      return [...filtered, { type: 'flight', id: 'flight', data: flight }];
                    });
                    setShowAddToProposal(true);
                  }
                }}
                onMouseEnter={() => {
                  setTooltipStates(prev => ({ ...prev, add: true }));
                  if (addedItems.has('flight')) {
                    setHoveredAddButton('flight');
                  }
                }}
                onMouseLeave={() => {
                  setTooltipStates(prev => ({ ...prev, add: false }));
                  setHoveredAddButton(null);
                }}
                className={`flex flex-col items-center gap-1.5 p-2 rounded transition-colors ${
                  addedItems.has('flight')
                    ? 'bg-success-500/20 hover:bg-error-500/20 text-success-400 hover:text-error-400'
                    : 'bg-slate-500/15 hover:bg-slate-500/20 text-slate-300 hover:text-slate-200'
                }`}
              >
                {addedItems.has('flight') ? (
                  <>
                    <span className="text-sm">✓</span>
                    <span className="text-[10px] font-medium">Added</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    <span className="text-[10px] font-medium">Add</span>
                  </>
                )}
              </button>
              {tooltipStates.add && (
                <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-2 text-xs text-gray-300">
                  {addedItems.has('flight') ? (hoveredAddButton === 'flight' ? 'Remove from proposal' : 'Added to proposal') : 'Add to proposal'}
                  <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-800 border-t border-l border-gray-700 transform rotate-45"></div>
                </div>
              )}
            </div>
          </div>

          {/* Award Segment Viewer - Show when award is selected */}
          {(() => {
            const selectedAwardId = selectedAwardPerSlice[0];
            if (!selectedAwardId || !hasAwardOptions) return null;

            const selectedAward = allAwardOptions.find(a => a.id === selectedAwardId);
            if (!selectedAward) return null;

            return (
              <div className="px-4 py-3 border-t border-yellow-500/20 bg-yellow-500/5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-semibold text-yellow-400">Selected Award Segments</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {selectedAward.programName} • {selectedAward.cabin}
                  </div>
                </div>
                {selectedAward.segments && selectedAward.segments.length > 0 && (
                  <FlightSegmentViewer
                    segments={selectedAward.segments}
                    formatTime={formatTime}
                    formatDate={formatDate}
                    formatDuration={(duration: string) => {
                      // Convert ISO duration or minutes to formatted string
                      if (typeof duration === 'string' && duration.includes('PT')) {
                        const match = duration.match(/PT(\d+H)?(\d+M)?/);
                        const hours = match?.[1] ? parseInt(match[1]) : 0;
                        const mins = match?.[2] ? parseInt(match[2]) : 0;
                        return `${hours}h ${mins}m`;
                      }
                      const minutes = parseInt(duration);
                      return formatDuration(minutes);
                    }}
                    showCabin={true}
                    compact={false}
                  />
                )}
              </div>
            );
          })()}

          {/* Selected Mileage Badge - If selected */}
          {(() => {
            const hasSelectedMileage = Object.keys(selectedMileagePerSlice).some(key => selectedMileagePerSlice[parseInt(key)]);
            if (!hasSelectedMileage) return null;

            return (
              <div className="px-4 py-2 border-t border-gray-800/30">
                <div className="flex items-center gap-2 flex-wrap">
                  {slices.map((slice, idx) => {
                    const selectedCarrier = selectedMileagePerSlice[idx];
                    if (!selectedCarrier || !slice.mileageBreakdown) return null;

                    const programs = groupMileageByProgram(slice.mileageBreakdown);
                    const selectedProgram = programs.find(p => p.carrierCode === selectedCarrier);
                    if (!selectedProgram) return null;

                    const sliceLabel = slices.length > 1 
                      ? (idx === 0 ? 'Outbound' : `Return`)
                      : 'One-way';

                    return (
                      <div key={idx} className="px-2 py-1 bg-gradient-to-r from-purple-500/12 to-blue-500/12 border border-purple-500/25 text-purple-300 text-xs font-medium rounded">
                        <span className="text-[10px] opacity-70">{sliceLabel}: </span>
                        <span className="font-semibold">{selectedProgram.carrierCode}</span>
                        <span className="mx-1">•</span>
                        <span className="font-bold">{selectedProgram.totalMileage.toLocaleString()} mi</span>
                        {selectedProgram.totalPrice > 0 && (
                          <span className="ml-1">+ ${selectedProgram.totalPrice.toFixed(0)}</span>
                        )}
                      </div>
                    );
                  }).filter(Boolean)}
                </div>
              </div>
            );
          })()}

      {/* Loading Award Info - Show when enrichment is in progress for this airline */}
      {isEnriching && !hasV2Enrichment && (
        <div className="px-4 py-2 bg-gradient-to-r from-amber-500/8 to-amber-500/5 border-l-2 border-amber-600/40 rounded-r">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-amber-300 animate-[pulse_1.5s_ease-in-out_infinite]" />
            <div className="text-xs font-medium text-amber-300">
              Fetching awards...
            </div>
          </div>
        </div>
      )}

        </div>
      )}

      {/* Flight Details - Multiple Slices - Only when expanded */}
      {isExpanded && (
        <div className="px-4 py-3 bg-gray-850/20 border-t border-gray-800/30">
          {slices.map((slice, sliceIndex) => (
          <div key={sliceIndex} className={sliceIndex > 0 ? 'border-t border-gray-700 pt-3 lg:pt-4 mt-3 lg:mt-4' : ''}>
            {/* Slice Label */}
            <div className="flex items-center gap-2 mb-2 lg:mb-3">
              {getSliceLabel(sliceIndex) && (
                <div className="text-sm font-medium text-teal-300">
                  {getSliceLabel(sliceIndex)}
                </div>
              )}
              
              {/* Return Flight Dropdown */}
              {sliceIndex === 1 && hasMultipleReturns && isGroupedFlight && (
                <div className="relative ml-auto hidden sm:block">
                  <button
                    onClick={() => setShowReturnDropdown(!showReturnDropdown)}
                    className="flex items-center gap-1 px-2 lg:px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white text-xs font-medium rounded transition-colors"
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
                            index === selectedReturnIndex ? 'bg-slate-600/20 border-slate-500' : ''
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
                    <div className="text-[10px] text-teal-200 mt-1">
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
                                      slice.stops && stopIdx < slice.stops.length - 1 ? 'border-dashed border-gray-600' : 'border-gray-600'
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
                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    <span className="text-base sm:text-lg lg:text-xl font-semibold text-white">
                      {formatTime(slice.arrival)}
                    </span>
                    {(() => {
                      const dayDiff = getDayDifference(slice.departure, slice.arrival);
                      if (dayDiff > 0) {
                        const tooltipKey = `day-indicator-${sliceIndex}`;
                        return (
                          <div className="relative">
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-500/10 text-slate-300 border border-slate-600/30 whitespace-nowrap cursor-help"
                              onMouseEnter={() => setTooltipStates(prev => ({ ...prev, [tooltipKey]: true }))}
                              onMouseLeave={() => setTooltipStates(prev => ({ ...prev, [tooltipKey]: false }))}
                            >
                              +{dayDiff}
                            </span>
                            {tooltipStates[tooltipKey] && (
                              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-50 w-32 bg-gray-800/95 border border-gray-700/50 rounded-md shadow-lg p-1.5 text-[10px] text-gray-200 text-center backdrop-blur-sm">
                                Arrives {formatDayIndicator(dayDiff).toLowerCase()}
                                <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-gray-800/95 border-r border-b border-gray-700/50 transform rotate-45 -mt-1"></div>
                              </div>
                            )}
                          </div>
                        );
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
                    <div className="text-[10px] text-teal-200 mt-1">
                      {slice.cabins[slice.cabins.length - 1]}
                    </div>
                  )}
                  {/* Arrival flight number - last segment - only show for connecting flights */}
                  {(slice.stops && slice.stops.length > 0) && slice.flights && slice.flights.length > 0 && slice.flights[slice.flights.length - 1] && (
                    <div className="text-[10px] text-gray-500 mt-0.5 font-mono">
                      {slice.flights[slice.flights.length - 1]}
                    </div>
                  )}
                </div>

                {/* Award Button - Fixed width on right */}
                {hasAwardOptions && (() => {
                  // Filter awards for this slice and selected cabin
                  const sliceAwardOptions = allAwardOptions.filter(award => {
                    const routeMatch = award.enrichmentOrigin === slice.origin.code &&
                                      award.enrichmentDestination === slice.destination.code;
                    if (!routeMatch) return false;

                    // Check cabin match
                    const awardCabin = award.cabin?.toUpperCase() || '';
                    if (selectedCabin === 'ECONOMY') {
                      return awardCabin.includes('ECONOMY') || awardCabin.includes('COACH');
                    } else if (selectedCabin === 'BUSINESS') {
                      return awardCabin.includes('BUSINESS') && !awardCabin.includes('PREMIUM');
                    } else if (selectedCabin === 'BUSINESS_PREMIUM') {
                      return awardCabin.includes('BUSINESS') && awardCabin.includes('PREMIUM');
                    } else if (selectedCabin === 'FIRST') {
                      return awardCabin.includes('FIRST');
                    }
                    return false;
                  });

                  if (sliceAwardOptions.length === 0) return null;

                  // Find cheapest award
                  const cheapestAward = sliceAwardOptions.reduce((best, award) => {
                    const value = (award.miles * perCentValue) + award.tax;
                    const bestValue = best ? (best.miles * perCentValue) + best.tax : Infinity;
                    return value < bestValue ? award : best;
                  }, null as any);

                  if (!cheapestAward) return null;

                  const cashValue = (cheapestAward.miles * perCentValue) + cheapestAward.tax;

                  return (
                    <div className="flex flex-col items-center justify-center min-w-[120px] px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
                      <div className="flex items-center gap-1 mb-1">
                        <Award className="h-3 w-3 text-yellow-500" />
                        <span className="text-[9px] text-yellow-400 font-semibold">AWARD</span>
                      </div>
                      <div className="text-xs text-yellow-400 font-bold">{cheapestAward.miles.toLocaleString()}</div>
                      <div className="text-[9px] text-gray-400">miles</div>
                      <div className="text-xs text-green-400 font-semibold mt-0.5">+{formatPrice(cheapestAward.tax, cheapestAward.currency || 'USD', false)}</div>
                      <div className="text-[8px] text-gray-500 mt-0.5">≈{formatPrice(cashValue, cheapestAward.currency || 'USD', false)}</div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Slice Details */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between text-xs lg:text-sm text-gray-300 mb-3 lg:mb-4 gap-2 lg:gap-4">
              <div className="flex flex-wrap items-center gap-2 lg:gap-4">
                {/* View Segments Button */}
                {slice.segments && slice.segments.length > 1 && false && (
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

                  return groupedPrograms.length > 0 && (
                    <div className="mileage-selector-container" onClick={(e) => e.stopPropagation()}>
                      <MileageSelector
                        programs={groupedPrograms}
                        selectedProgram={selectedMileagePerSlice[sliceIndex] || null}
                        onSelect={(carrierCode) => {
                          setSelectedMileagePerSlice(prev => ({
                            ...prev,
                            [sliceIndex]: carrierCode
                          }));
                        }}
                        sliceIndex={sliceIndex}
                      />
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Expanded Segment Details */}
            {expandedSegments[sliceIndex] && slice.segments && slice.segments.length > 0 && (
              <div className="mb-4 border border-slate-600/20 bg-slate-500/5 rounded-lg p-4">
                <div className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Plane className="h-3 w-3" />
                  Flight Segments
                </div>
                <FlightSegmentDetails slice={slice} originTimezone={originTimezone} />
              </div>
            )}

            {/* Cabin Filter Bar - Quick filter for Aero mileage options only */}
            {(() => {
              // Collect all available cabins from Aero flights only
              const allCabins = new Set<string>();

              // From Aero flights
              if (slice.mileageBreakdown && slice.mileageBreakdown.length > 0) {
                slice.mileageBreakdown.forEach(breakdown => {
                  if (breakdown.allMatchingFlights) {
                    breakdown.allMatchingFlights.forEach((flight: any) => {
                      const cabin = (flight.cabin || 'COACH').toUpperCase();
                      allCabins.add(cabin);
                    });
                  }
                });
              }

              if (allCabins.size <= 1) return null; // No need to filter if only one cabin
              
              const cabinOrder = ['FIRST', 'BUSINESS', 'PREMIUM_ECONOMY', 'PREMIUM', 'ECONOMY', 'COACH'];
              const sortedCabins = Array.from(allCabins).sort((a, b) => {
                const aIndex = cabinOrder.indexOf(a) !== -1 ? cabinOrder.indexOf(a) : 999;
                const bIndex = cabinOrder.indexOf(b) !== -1 ? cabinOrder.indexOf(b) : 999;
                return aIndex - bIndex;
              });
              
              const cabinDisplayMap: Record<string, string> = {
                'COACH': 'Economy',
                'ECONOMY': 'Economy',
                'PREMIUM': 'Premium',
                'PREMIUM_ECONOMY': 'Premium',
                'BUSINESS': 'Business',
                'FIRST': 'First'
              };
              
              const selectedCabin = selectedCabinFilter[sliceIndex];
              
              return (
                <div className="mb-3 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400 font-medium">Filter by Cabin:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => setSelectedCabinFilter(prev => ({ ...prev, [sliceIndex]: null }))}
                      className={`px-2 py-1 text-[10px] font-medium rounded transition-all ${
                        !selectedCabin
                          ? 'bg-slate-500/15 text-slate-300 border border-slate-600/30'
                          : 'bg-gray-800/50 text-gray-400 hover:text-gray-300 border border-gray-700/50'
                      }`}
                    >
                      All
                    </button>
                    {sortedCabins.map(cabin => (
                      <button
                        key={cabin}
                        onClick={() => setSelectedCabinFilter(prev => ({ ...prev, [sliceIndex]: cabin }))}
                        className={`px-2 py-1 text-[10px] font-medium rounded transition-all ${
                          selectedCabin === cabin
                            ? cabin === 'BUSINESS' || cabin === 'FIRST'
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                              : cabin === 'PREMIUM' || cabin === 'PREMIUM_ECONOMY'
                              ? 'bg-slate-500/15 text-slate-300 border border-slate-600/30'
                              : 'bg-gray-700/50 text-gray-300 border border-gray-600'
                            : 'bg-gray-800/50 text-gray-400 hover:text-gray-300 border border-gray-700/50'
                        }`}
                      >
                        {cabinDisplayMap[cabin] || cabin}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Mileage Options Section - Combined Aero and Award with Tabs */}
            {((slice.mileageBreakdown && slice.mileageBreakdown.length > 0) || hasAwardOptions) && (() => {
              // Check if we have award options for this slice
              let sliceAwardOptions = hasAwardOptions ? allAwardOptions.filter(award => {
                // First check enrichment segment metadata (more reliable for route matching)
                if (award.enrichmentOrigin && award.enrichmentDestination) {
                  if (award.enrichmentOrigin === slice.origin.code &&
                      award.enrichmentDestination === slice.destination.code) {
                    return true;
                  }
                }
                
                // Fallback to itinerary segments if metadata not available
                const itinerary = award.itineraries?.[0];
                if (!itinerary || !itinerary.segments || itinerary.segments.length === 0) return false;
                const firstSegment = itinerary.segments[0];
                const lastSegment = itinerary.segments[itinerary.segments.length - 1];
                const awardOrigin = firstSegment.departure?.iataCode;
                const awardDest = lastSegment.arrival?.iataCode;
                return awardOrigin === slice.origin.code && awardDest === slice.destination.code;
              }) : [];
              
              // Apply cabin filter if set
              const globalCabinFilter = selectedCabinFilter[sliceIndex];
              if (globalCabinFilter && sliceAwardOptions.length > 0) {
                sliceAwardOptions = sliceAwardOptions.filter(award => {
                  const awardCabin = (award.cabin || 'COACH').toUpperCase();
                  return awardCabin === globalCabinFilter;
                });
              }

              const hasAeroForSlice = slice.mileageBreakdown && slice.mileageBreakdown.length > 0;
              const hasAwardForSlice = sliceAwardOptions.length > 0;
              
              if (!hasAeroForSlice && !hasAwardForSlice) return null;

              // Determine active tab
              const activeTab = mileageAwardTab[sliceIndex] || (hasAeroForSlice ? 'aero' : 'award');
              const showAeroTab = activeTab === 'aero';
              const showAwardTab = activeTab === 'award';

              // Calculate best values for comparison
              let bestAeroValue: number | null = null;
              let bestAwardValue: number | null = null;
              
              if (hasAeroForSlice) {
                const groupedPrograms = groupMileageByProgram(slice.mileageBreakdown);
                if (groupedPrograms.length > 0) {
                  // Get cheapest aero option
                  const cheapestAero = groupedPrograms.reduce((best, program) => {
                    const value = (program.totalMileage * perCentValue) + program.totalPrice;
                    const bestValue = best ? (best.totalMileage * perCentValue) + best.totalPrice : Infinity;
                    return value < bestValue ? program : best;
                  }, null as any);
                  if (cheapestAero) {
                    bestAeroValue = (cheapestAero.totalMileage * perCentValue) + cheapestAero.totalPrice;
                  }
                }
              }
              
              if (hasAwardForSlice) {
                // Use selected award if available, otherwise find the absolute cheapest award across ALL options (all cabins)
                const selectedAwardId = selectedAwardPerSlice[sliceIndex];
                let bestAward = selectedAwardId 
                  ? sliceAwardOptions.find(a => a.id === selectedAwardId)
                  : null;
                
                if (!bestAward) {
                  bestAward = [...sliceAwardOptions].sort((a, b) => {
                    const aValue = (a.miles * perCentValue) + a.tax;
                    const bValue = (b.miles * perCentValue) + b.tax;
                    return aValue - bValue;
                  })[0];
                }
                
                if (bestAward) {
                  bestAwardValue = (bestAward.miles * perCentValue) + bestAward.tax;
                }
              }


              const isExpanded = expandedMileageOptions[sliceIndex] || false;

              return (
                <div key={`mileage-options-${sliceIndex}`} className="mt-3">
                  {/* Header: Collapsible Mileage Options */}
                  <button
                    onClick={() => setExpandedMileageOptions(prev => ({ ...prev, [sliceIndex]: !prev[sliceIndex] }))}
                    className="w-full flex items-center justify-between p-2.5 bg-gray-800/30 hover:bg-gray-800/50 rounded border border-gray-700/50 transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      <Award className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-semibold text-white">Mileage Options</span>
                      {hasAeroForSlice && hasAwardForSlice && (
                        <div className="flex border border-gray-700/50 bg-gray-800/30 rounded overflow-hidden ml-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMileageAwardTab({...mileageAwardTab, [sliceIndex]: 'aero'});
                            }}
                            className={`px-2.5 py-1 text-xs font-medium transition-all ${
                              activeTab === 'aero'
                                ? 'bg-gray-700/50 text-orange-400'
                                : 'text-gray-400 hover:text-gray-300'
                            }`}
                          >
                            Aero
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMileageAwardTab({...mileageAwardTab, [sliceIndex]: 'award'});
                            }}
                            className={`px-2.5 py-1 text-xs font-medium transition-all ${
                              activeTab === 'award'
                                ? 'bg-gray-700/50 text-purple-400'
                                : 'text-gray-400 hover:text-gray-300'
                            }`}
                          >
                            Award Tools
                          </button>
                        </div>
                      )}
                    </div>
                    {!hasAeroForSlice || !hasAwardForSlice ? (
                      <span className="text-xs text-gray-500">
                        {hasAeroForSlice ? 'Aero' : 'Award Tools'}
                      </span>
                    ) : null}
                  </button>

                  {/* Content: Only show when expanded */}
                  {isExpanded && (
                    <div className="mt-2 bg-gray-800/20 p-3 rounded border border-gray-700/30">

                  {/* Aero Tab Content */}
                  {showAeroTab && hasAeroForSlice && slice.mileageBreakdown && (
                    <>
                      {groupMileageByProgram(slice.mileageBreakdown).map((program) => {
                        const airlineKey = `${sliceIndex}-${program.carrierCode}`;
                        if (!expandedSliceAirlines[airlineKey]) {
                          return null;
                        }

                        // Get flights for THIS airline only
                        const allFlights: any[] = [];
                        slice.mileageBreakdown!.forEach(breakdown => {
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

                        // Group flights by cabin
                        const flightsByCabin = new Map<string, any[]>();
                        filteredFlights.forEach(flight => {
                          const cabin = (flight.cabin || 'COACH').toUpperCase();
                          if (!flightsByCabin.has(cabin)) {
                            flightsByCabin.set(cabin, []);
                          }
                          flightsByCabin.get(cabin)!.push(flight);
                        });

                        // Define cabin order (premium first, then economy)
                        const cabinOrder = ['FIRST', 'BUSINESS', 'PREMIUM_ECONOMY', 'PREMIUM', 'ECONOMY', 'COACH'];
                        const availableCabins = Array.from(flightsByCabin.keys()).sort((a, b) => {
                          const aIndex = cabinOrder.indexOf(a) !== -1 ? cabinOrder.indexOf(a) : 999;
                          const bIndex = cabinOrder.indexOf(b) !== -1 ? cabinOrder.indexOf(b) : 999;
                          return aIndex - bIndex;
                        });

                        // Get active cabin tab (default to first available)
                        const activeCabinTab = aeroCabinTabs[airlineKey] || availableCabins[0] || '';
                        const cabinDisplayMap: Record<string, string> = {
                          'COACH': 'Economy',
                          'ECONOMY': 'Economy',
                          'PREMIUM': 'Premium Economy',
                          'PREMIUM_ECONOMY': 'Premium Economy',
                          'BUSINESS': 'Business',
                          'FIRST': 'First'
                        };

                        // Get flights for active cabin (or all if no cabin tabs needed)
                        let activeCabinFlights = availableCabins.length > 1 && activeCabinTab 
                          ? flightsByCabin.get(activeCabinTab) || [] 
                          : filteredFlights;
                        
                        // Apply global cabin filter if set
                        const globalCabinFilter = selectedCabinFilter[sliceIndex];
                        if (globalCabinFilter) {
                          activeCabinFlights = activeCabinFlights.filter(flight => {
                            const flightCabin = (flight.cabin || 'COACH').toUpperCase();
                            return flightCabin === globalCabinFilter;
                          });
                        }

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

                            {/* Time-based Tabs */}
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
                                    ? 'text-slate-300 bg-gray-800/50'
                                    : 'text-gray-400 hover:text-gray-300 cursor-pointer'
                                }`}
                              >
                                <div className="flex items-center justify-center gap-1.5">
                                  <Clock className="h-3 w-3" />
                                  <span>5hr+</span>
                                  <span className="text-[10px]">({timeInsensitiveFlights.length})</span>
                                </div>
                                {sliceAlternativeTabs[airlineKey] === 'time-insensitive' && timeInsensitiveFlights.length > 0 && (
                                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-500" />
                                )}
                              </button>
                            </div>

                            {/* Cabin Tabs */}
                            {availableCabins.length > 1 && (
                              <div className="flex gap-2 border-b border-gray-700/50 pb-2 mb-3 overflow-x-auto">
                                {availableCabins.map((cabinKey) => {
                                  const cabinFlights = flightsByCabin.get(cabinKey) || [];
                                  const cabinDisplay = cabinDisplayMap[cabinKey] || cabinKey;
                                  const isActive = activeCabinTab === cabinKey;
                                  
                                  return (
                                    <button
                                      key={cabinKey}
                                      onClick={() => setAeroCabinTabs({...aeroCabinTabs, [airlineKey]: cabinKey})}
                                      className={`px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                                        isActive
                                          ? cabinKey === 'BUSINESS' || cabinKey === 'FIRST'
                                            ? 'bg-purple-500/20 text-purple-300 border-b-2 border-purple-400'
                                            : cabinKey === 'PREMIUM' || cabinKey === 'PREMIUM_ECONOMY'
                                            ? 'bg-slate-500/15 text-slate-200 border-b-2 border-slate-400'
                                            : 'bg-gray-700/50 text-gray-300 border-b-2 border-gray-500'
                                          : 'text-gray-400 hover:text-gray-300'
                                      }`}
                                    >
                                      {cabinDisplay} ({cabinFlights.length})
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {/* Flight List */}
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                              {activeCabinFlights.length === 0 ? (
                                <div className="text-center py-6 text-gray-500 text-sm">No flights in this cabin</div>
                              ) : (
                                groupMileageFlights(activeCabinFlights.slice(0, 15)).map((group, groupIndex) => {
                                  const altFlight = group.primary;
                                  const altIndex = groupIndex;
                                  const alternativeKey = `${sliceIndex}-${airlineKey}-${groupIndex}`;
                                  const hasAlternatives = (group.alternativeArrivals && group.alternativeArrivals.length > 0) || 
                                                         (group.alternativeLayovers && group.alternativeLayovers.length > 0);
                                  
                                  // Calculate time difference
                                  const flightTime = new Date(altFlight.departure.at).getTime();
                                  const originalTime = new Date(slice.departure).getTime();
                                  const diffMinutes = Math.round((flightTime - originalTime) / (1000 * 60));

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

                                  // Calculate total mileage value for comparison with cash price
                                  const mileageTotalValue = (altFlight.mileage * perCentValue) + priceNum;

                                  // Get cash price for comparison (estimate per-slice for mileage comparison only)
                                  const sliceCashPrice = displayTotal / slices.length;

                                  // Show savings if mileage is significantly cheaper (more than 15% savings)
                                  const mileageSavings = sliceCashPrice > 0 && mileageTotalValue < sliceCashPrice * 0.85
                                    ? sliceCashPrice - mileageTotalValue
                                    : 0;


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
                                          {hasAlternatives && (
                                            <span className="px-1.5 py-0.5 bg-slate-500/15 text-slate-300 text-[9px] font-medium rounded border border-slate-600/30">
                                              +{((group.alternativeArrivals?.length || 0) + (group.alternativeLayovers?.length || 0))} similar
                                            </span>
                                          )}
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
                                                const aeroId = `aero-${altFlight.flightNumber}-${altFlight.departure?.iataCode}-${altFlight.arrival?.iataCode}`;
                                                if (addedItems.has(aeroId)) {
                                                  // Remove if already added
                                                  setAddedItems(prev => {
                                                    const newSet = new Set(prev);
                                                    newSet.delete(aeroId);
                                                    return newSet;
                                                  });
                                                  setPendingItems(prev => prev.filter(item => item.id !== aeroId));
                                                  setShowAddToProposal(false);
                                                  setSelectedMileageFlight(null);
                                                } else {
                                                  // Add new item (can add multiple mileage options)
                                                  setSelectedMileageFlight(altFlight);
                                                  setAddedItems(prev => new Set(prev).add(aeroId));
                                                  setPendingItems(prev => {
                                                    // Add this aero option to pending items
                                                    return [...prev, { type: 'aero', id: aeroId, data: altFlight }];
                                                  });
                                                  setShowAddToProposal(true);
                                                }
                                              }}
                                              onMouseEnter={() => {
                                                const aeroId = `aero-${altFlight.flightNumber}-${altFlight.departure?.iataCode}-${altFlight.arrival?.iataCode}`;
                                                if (addedItems.has(aeroId)) {
                                                  setHoveredAddButton(aeroId);
                                                }
                                              }}
                                              onMouseLeave={() => setHoveredAddButton(null)}
                                              className={`px-2 py-1 text-xs rounded border transition-colors flex items-center gap-1 ${
                                                addedItems.has(`aero-${altFlight.flightNumber}-${altFlight.departure?.iataCode}-${altFlight.arrival?.iataCode}`)
                                                  ? 'bg-green-500/20 hover:bg-red-500/20 text-green-300 hover:text-red-300 border-green-400/30 hover:border-red-400/30'
                                                  : 'bg-slate-500/15 hover:bg-slate-500/20 text-slate-200 border-slate-400/30'
                                              }`}
                                            >
                                              {addedItems.has(`aero-${altFlight.flightNumber}-${altFlight.departure?.iataCode}-${altFlight.arrival?.iataCode}`) ? (
                                                <>
                                                  <span className="text-[10px]">✓</span>
                                                  {hoveredAddButton === `aero-${altFlight.flightNumber}-${altFlight.departure?.iataCode}-${altFlight.arrival?.iataCode}` ? 'Remove' : 'Added'}
                                                </>
                                              ) : (
                                                <>
                                                  <Plus className="h-3 w-3" />
                                                  Add
                                                </>
                                              )}
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

                                      {/* Flight Route Details */}
                                      <div className="mt-3 pt-3 border-t border-gray-700">
                                        <FlightSegmentViewer
                                          segments={[{
                                            carrierCode: altFlight.carrierCode,
                                            number: altFlight.flightNumber,
                                            departure: {
                                              iataCode: altFlight.departure?.iataCode,
                                              at: altFlight.departure?.at
                                            },
                                            arrival: {
                                              iataCode: altFlight.arrival?.iataCode,
                                              at: altFlight.arrival?.at
                                            },
                                            cabin: altFlight.cabin,
                                            duration: `${durationHrs}h ${durationMins}m`
                                          }]}
                                          layovers={altFlight.stops && altFlight.stops.length > 0 ? altFlight.stops.map((stop: any) => {
                                            // Try to calculate layover duration if we have timing information
                                            let durationMinutes: number | undefined;
                                            
                                            // If stop has duration information, use it
                                            if (stop.durationMinutes !== undefined) {
                                              durationMinutes = stop.durationMinutes;
                                            } else if (stop.duration) {
                                              // Parse duration string if available
                                              const match = String(stop.duration).match(/(\d+)h\s*(\d+)m/);
                                              if (match) {
                                                durationMinutes = parseInt(match[1]) * 60 + parseInt(match[2]);
                                              }
                                            }
                                            
                                            return {
                                              airport: {
                                                code: typeof stop === 'string' ? stop : (stop.code || stop.iataCode),
                                                iataCode: typeof stop === 'string' ? stop : (stop.iataCode || stop.code)
                                              },
                                              durationMinutes
                                            };
                                          }) : []}
                                          formatTime={formatTimeInOriginTZ}
                                          formatDate={formatDateInOriginTZ}
                                          showCabin={true}
                                          compact={false}
                                        />
                                      </div>

                                      {/* Alternative Arrivals - Same flight, different arrival times */}
                                      {group.alternativeArrivals && group.alternativeArrivals.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-gray-700">
                                          <button
                                            onClick={() => setShowAlternativeTimes(prev => ({...prev, [`${alternativeKey}-arrivals`]: !showAlternativeTimes[`${alternativeKey}-arrivals`]}))}
                                            className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded border border-gray-600/50 transition-colors"
                                          >
                                            <span className="text-xs font-medium text-gray-300">
                                              {group.alternativeArrivals.length} alternative arrival{group.alternativeArrivals.length !== 1 ? 's' : ''} (same route)
                                            </span>
                                            <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${showAlternativeTimes[`${alternativeKey}-arrivals`] ? 'rotate-180' : ''}`} />
                                          </button>

                                          {/* Alternative Arrivals List */}
                                          {showAlternativeTimes[`${alternativeKey}-arrivals`] && (
                                            <div className="mt-2 space-y-2">
                                              {group.alternativeArrivals.map((altArrival: any, altArrivalIdx: number) => {
                                                const altDepTime = formatTimeInOriginTZ(altArrival.departure?.at || altArrival.departure);
                                                const altDepDate = formatDateInOriginTZ(altArrival.departure?.at || altArrival.departure);
                                                const altArrTime = formatTimeInOriginTZ(altArrival.arrival?.at || altArrival.arrival);
                                                const altArrDate = formatDateInOriginTZ(altArrival.arrival?.at || altArrival.arrival);
                                                
                                                // Calculate duration difference
                                                const primaryArr = new Date(altFlight.arrival?.at || altFlight.arrival).getTime();
                                                const altArr = new Date(altArrival.arrival?.at || altArrival.arrival).getTime();
                                                const diffMinutes = Math.round((altArr - primaryArr) / (1000 * 60));
                                                const diffHours = Math.floor(Math.abs(diffMinutes) / 60);
                                                const diffMins = Math.abs(diffMinutes) % 60;
                                                const diffStr = diffMinutes > 0 
                                                  ? `+${diffHours > 0 ? `${diffHours}h ` : ''}${diffMins}m`
                                                  : `-${diffHours > 0 ? `${diffHours}h ` : ''}${diffMins}m`;

                                                return (
                                                  <div
                                                    key={altArrivalIdx}
                                                    className="flex items-center justify-between px-3 py-2 bg-gray-800/30 rounded border border-gray-700/50"
                                                  >
                                                    <div className="flex items-center gap-3 flex-1">
                                                      <div className="text-xs">
                                                        <div className="text-white font-medium">{altDepTime}</div>
                                                        <div className="text-gray-400">{altDepDate}</div>
                                                      </div>
                                                      <div className="text-gray-500">→</div>
                                                      <div className="text-xs">
                                                        <div className="text-white font-medium">{altArrTime}</div>
                                                        <div className="text-gray-400">{altArrDate}</div>
                                                      </div>
                                                      <div className="text-[10px] text-amber-300 font-medium">
                                                        {diffStr}
                                                      </div>
                                                      {altArrival.mileage && (
                                                        <div className="text-[10px] text-gray-500">
                                                          {altArrival.mileage.toLocaleString()} mi
                                                        </div>
                                                      )}
                                                    </div>
                                                    <button
                                                      onClick={() => {
                                                        setSelectedMileageFlight(altArrival);
                                                        setShowAddToProposal(true);
                                                      }}
                                                      className="px-2 py-1 bg-slate-500/15 hover:bg-slate-500/20 text-slate-200 text-xs rounded border border-slate-400/30 transition-colors flex items-center gap-1"
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

                                      {/* Alternative Layovers - Same flight, different layovers/routes */}
                                      {group.alternativeLayovers && group.alternativeLayovers.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-gray-700">
                                          <button
                                            onClick={() => setShowAlternativeTimes(prev => ({...prev, [`${alternativeKey}-layovers`]: !showAlternativeTimes[`${alternativeKey}-layovers`]}))}
                                            className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded border border-gray-600/50 transition-colors"
                                          >
                                            <span className="text-xs font-medium text-gray-300">
                                              {group.alternativeLayovers.length} alternative route{group.alternativeLayovers.length !== 1 ? 's' : ''} (different layovers)
                                            </span>
                                            <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${showAlternativeTimes[`${alternativeKey}-layovers`] ? 'rotate-180' : ''}`} />
                                          </button>

                                          {/* Alternative Layovers List */}
                                          {showAlternativeTimes[`${alternativeKey}-layovers`] && (
                                            <div className="mt-2 space-y-2">
                                              {group.alternativeLayovers.map((altLayover: any, altLayoverIdx: number) => {
                                                const altDepTime = formatTimeInOriginTZ(altLayover.departure?.at || altLayover.departure);
                                                const altDepDate = formatDateInOriginTZ(altLayover.departure?.at || altLayover.departure);
                                                const altArrTime = formatTimeInOriginTZ(altLayover.arrival?.at || altLayover.arrival);
                                                const altArrDate = formatDateInOriginTZ(altLayover.arrival?.at || altLayover.arrival);
                                                
                                                // Get layover info
                                                const layovers = altLayover.stops?.map((s: any) => typeof s === 'string' ? s : (s.code || s.iataCode)) || [];
                                                const layoverStr = layovers.length > 0 ? layovers.join(', ') : 'Direct';
                                                
                                                // Build route string
                                                const origin = altLayover.departure?.iataCode || '';
                                                const destination = altLayover.arrival?.iataCode || '';
                                                const routeStr = layovers.length > 0 
                                                  ? `${origin} → ${layovers.join(' → ')} → ${destination}`
                                                  : `${origin} → ${destination}`;

                                                return (
                                                  <div
                                                    key={altLayoverIdx}
                                                    className="flex items-center justify-between px-3 py-2 bg-gray-800/30 rounded border border-gray-700/50"
                                                  >
                                                    <div className="flex flex-col gap-1.5 flex-1">
                                                      <div className="flex items-center gap-3">
                                                        <div className="text-xs">
                                                          <div className="text-white font-medium">{altDepTime}</div>
                                                          <div className="text-gray-400">{altDepDate}</div>
                                                        </div>
                                                        <div className="text-gray-500">→</div>
                                                        <div className="text-xs">
                                                          <div className="text-white font-medium">{altArrTime}</div>
                                                          <div className="text-gray-400">{altArrDate}</div>
                                                        </div>
                                                        {altLayover.mileage && (
                                                          <div className="text-[10px] text-gray-500">
                                                            {altLayover.mileage.toLocaleString()} mi
                                                          </div>
                                                        )}
                                                      </div>
                                                      <div className="text-[10px] text-gray-500 font-mono">
                                                        {routeStr}
                                                      </div>
                                                    </div>
                                                    <button
                                                      onClick={() => {
                                                        setSelectedMileageFlight(altLayover);
                                                        setShowAddToProposal(true);
                                                      }}
                                                      className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs rounded border border-blue-400/30 transition-colors flex items-center gap-1 ml-2"
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
                                                      className="px-2 py-1 bg-slate-500/15 hover:bg-slate-500/20 text-slate-200 text-xs rounded border border-slate-400/30 transition-colors flex items-center gap-1"
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
                      })}
                    </>
                  )}

                  {/* Award Tools Tab Content */}
                  {showAwardTab && hasAwardForSlice && (
                    <AwardCards
                      awardOptions={sliceAwardOptions}
                      perCentValue={perCentValue}
                      onAdd={(award) => {
                        const awardId = `award-${award.id}`;
                        if (addedItems.has(awardId)) {
                          // Remove if already added
                          setAddedItems(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(awardId);
                            return newSet;
                          });
                          setPendingItems(prev => prev.filter(item => item.id !== awardId));
                          setShowAddToProposal(false);
                          setSelectedMileageFlight(null);
                        } else {
                          // Add new item (can add multiple award options)
                          const awardData = {
                            ...award,
                            carrierCode: carrier.code,
                            mileage: award.miles,
                            mileagePrice: award.tax,
                            cabin: award.cabin
                          };
                          setSelectedMileageFlight(awardData);
                          setAddedItems(prev => new Set(prev).add(awardId));
                          setPendingItems(prev => {
                            // Add this award option to pending items
                            return [...prev, { type: 'award', id: awardId, data: awardData }];
                          });
                          setShowAddToProposal(true);
                        }
                      }}
                      addedItems={addedItems}
                      hoveredAddButton={hoveredAddButton}
                      setHoveredAddButton={setHoveredAddButton}
                      onSelect={(awardId) => {
                        setSelectedAwardPerSlice({ ...selectedAwardPerSlice, [sliceIndex]: awardId });
                      }}
                      selectedAwardId={selectedAwardPerSlice[sliceIndex]}
                      formatTimeInOriginTZ={formatTimeInOriginTZ}
                      formatDateInOriginTZ={formatDateInOriginTZ}
                      originTimezone={originTimezone}
                      groupAwards={groupAwardOptions}
                    />
                  )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ))}
        </div>
      )}

      {/* Code-Share Flights Section - Shows when code-share button is clicked */}
      {isCodeShareOptionsExpanded && codeShareFlights && codeShareFlights.length > 0 && (
        <div className="mt-2 border border-yellow-500/30 rounded-lg bg-yellow-500/5 overflow-hidden">
          <div className="px-4 py-2.5 bg-yellow-500/10 border-b border-yellow-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link className="h-4 w-4 text-yellow-400" />
                <span className="text-sm font-semibold text-yellow-400">Code-Share Flights</span>
                <span className="text-xs text-gray-400">({codeShareFlights.length} options)</span>
              </div>
              <span className="text-xs text-gray-400">Same route, different airlines</span>
            </div>
          </div>
          <div className="p-3 space-y-2">
            {codeShareFlights.map((csFlight, idx) => {
              const csFlightData = csFlight as FlightSolution;
              const csSlice = csFlightData.slices?.[0];
              if (!csSlice) return null;

              const csCarrier = csSlice.segments?.[0]?.carrier;
              const csPrice = csFlightData.displayTotal || csFlightData.price || 0;
              const csCurrency = csFlightData.currency || 'USD';
              const csPricePerMile = csFlightData.ext?.pricePerMile || 0;

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-800/40 hover:bg-gray-800/60 rounded border border-gray-700/50 hover:border-yellow-500/30 transition-all cursor-pointer"
                  onClick={() => {
                    // Navigate to this flight or add it to proposal
                  }}
                >
                  <div className="flex items-center gap-4">
                    {/* Airline Logo & Code */}
                    <div className="flex items-center gap-2">
                      {csCarrier?.code && (
                        <img
                          src={`https://www.gstatic.com/flights/airline_logos/35px/${csCarrier.code}.png`}
                          alt={csCarrier.name || csCarrier.code}
                          className="h-6 w-6 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {csCarrier?.name || csCarrier?.code || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {csSlice.flights?.join(', ') || 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Flight Times */}
                    <div className="flex items-center gap-2 text-sm">
                      <div className="text-center">
                        <div className="font-semibold text-white">{formatTime(csSlice.departure)}</div>
                        <div className="text-xs text-gray-400">{csSlice.origin?.code}</div>
                      </div>
                      <div className="text-gray-500">→</div>
                      <div className="text-center">
                        <div className="font-semibold text-white">{formatTime(csSlice.arrival)}</div>
                        <div className="text-xs text-gray-400">{csSlice.destination?.code}</div>
                      </div>
                    </div>

                    {/* Duration & Stops */}
                    <div className="text-xs text-gray-400">
                      {formatDuration(csSlice.duration)}
                      {csSlice.stops && csSlice.stops.length > 0 && (
                        <span className="ml-2">
                          • {csSlice.stops.length} {csSlice.stops.length === 1 ? 'stop' : 'stops'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">
                      {formatPrice(csPrice, csCurrency)}
                    </div>
                    <div className="text-xs text-gray-400">
                      ${formatPricePerMile(csPricePerMile)}/mi
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>

    {/* Add to Proposal Modal */}
    {showAddToProposal && (
      <AddToProposalModal
        flight={flight}
        selectedMileageFlight={selectedMileageFlight}
        pendingItems={pendingItems}
        perCentValue={perCentValue}
        flightCardId={('id' in flight ? flight.id : undefined) || `flight-${Date.now()}`}
        onClose={() => {
          setShowAddToProposal(false);
          setSelectedMileageFlight(null);
          // Keep addedItems set to show "Added" state - user can click Remove to clear it
        }}
        onItemRemoved={(itemId) => {
          setAddedItems(prev => {
            const newSet = new Set(prev);
            newSet.delete(itemId);
            return newSet;
          });
          setPendingItems(prev => prev.filter(item => item.id !== itemId));
        }}
      />
    )}

    {/* V2 Enrichment JSON Viewer - Development Tool */}
    {showV2EnrichmentViewer && (
      <V2EnrichmentViewer
        enrichmentData={v2EnrichmentData}
        carrierCode={carrier.code}
        onClose={() => setShowV2EnrichmentViewer(false)}
      />
    )}

    {/* Flight Summary Modal */}
    {showSummaryModal && (
      <FlightSummaryModal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        solutionId={
          flightId || 
          (isGroupedFlightDisplay ? (flightToDisplay as GroupedFlight).returnOptions[selectedReturnIndex]?.originalFlightId : '') ||
          (isGroupedFlight ? (flight as GroupedFlight).returnOptions[selectedReturnIndex]?.originalFlightId : '') ||
          ''
        }
        session={session}
        solutionSet={solutionSet}
      />
    )}
    </>
  );
};

export default FlightCard;
