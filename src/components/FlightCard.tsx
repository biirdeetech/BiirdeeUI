import React, { useState, useEffect } from 'react';
import { Plane, Clock, ChevronDown, Target, Plus, ChevronRight, Zap, AlertCircle, Info, Eye, Award, Loader, Code } from 'lucide-react';
import FlightSegmentViewer from './FlightSegmentViewer';
import { FlightSolution, GroupedFlight, MileageDeal } from '../types/flight';
import { PREMIUM_CARRIERS } from '../utils/fareClasses';
import ITAMatrixService from '../services/itaMatrixApi';
import AddToProposalModal from './AddToProposalModal';
import MileageDealsDropdown from './MileageDealsDropdown';
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

const FlightCard: React.FC<FlightCardProps> = ({ flight, originTimezone, perCentValue = 0.015, session, solutionSet, v2EnrichmentData = new Map(), onEnrichFlight, enrichingAirlines = new Set() }) => {
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


  // Get flight data based on type
  const getFlightData = () => {
    if (isGroupedFlight) {
      const groupedFlight = flight as GroupedFlight;
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
      const regularFlight = flight as FlightSolution;
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

  const { slices, carrier, isNonstop, totalAmount, displayTotal, currency, pricePerMile, hasMultipleReturns, flightId, totalMileage, totalMileagePrice, matchType, mileageDeals, fullyEnriched } = getFlightData();
  const { addToProposal: addToProposalContext, removeFromProposal } = useProposalContext();
  const flightCardId = flightId || `flight-${Date.now()}`;
  const isPremium = PREMIUM_CARRIERS.includes(carrier.code);

  console.log('🎴 FlightCard: Rendering flight with', { 
    isGrouped: isGroupedFlight, 
    hasMultipleReturns, 
    sliceCount: slices.length,
    flightId
  });

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
        className={`bg-gray-900 border-2 rounded-lg hover:border-gray-700 transition-all duration-200 shadow-lg hover:shadow-xl ${
          matchType && matchType !== 'none' ? 'border-gray-600' : 'border-gray-800'
        }`}
      >
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
            {/* Selected Mileage Badges - Show for user-selected programs */}
            {(() => {
              const hasSelectedMileage = Object.keys(selectedMileagePerSlice).some(key => selectedMileagePerSlice[parseInt(key)]);
              if (!hasSelectedMileage) return null;

              return slices.map((slice, idx) => {
                const selectedCarrier = selectedMileagePerSlice[idx];
                if (!selectedCarrier || !slice.mileageBreakdown) return null;

                const programs = groupMileageByProgram(slice.mileageBreakdown);
                const selectedProgram = programs.find(p => p.carrierCode === selectedCarrier);
                if (!selectedProgram) return null;

                const sliceLabel = slices.length > 1 
                  ? (idx === 0 ? 'Outbound' : `Return`)
                  : 'One-way';

                return (
                  <div key={idx} className="px-2 py-1 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-400/40 text-purple-200 text-xs font-medium rounded flex items-center gap-1.5">
                    <span className="text-[10px] uppercase opacity-70">{sliceLabel}:</span>
                    <span className="font-semibold">{selectedProgram.carrierCode}</span>
                    {selectedProgram.cabin && (
                      <span className="text-[10px] opacity-70">{selectedProgram.cabin}</span>
                    )}
                    <span className="font-bold">{selectedProgram.totalMileage.toLocaleString()}</span>
                    <span className="text-[10px]">mi</span>
                    {selectedProgram.totalPrice > 0 && (
                      <>
                        <span className="text-[10px]">+</span>
                        <span className="font-semibold">${selectedProgram.totalPrice.toFixed(0)}</span>
                      </>
                    )}
                  </div>
                );
              }).filter(Boolean);
            })()}
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end w-full lg:w-auto h-7">
            {/* Price Per Mile */}
            {/* <div className="text-xs text-gray-400 flex items-center h-full">
              ${formatPricePerMile(pricePerMile)}/mi
            </div> */}

            {/* Total Price */}
            {(() => {
              // Calculate mileage value ONLY if user has selected mileage programs
              const hasSelectedMileage = Object.keys(selectedMileagePerSlice).some(key => selectedMileagePerSlice[parseInt(key)]);
              
              let bestMileageValue = null;
              if (hasSelectedMileage) {
                // Calculate total from selected programs
                let totalMileage = 0;
                let totalPrice = 0;
                
                slices.forEach((slice, idx) => {
                  const selectedCarrier = selectedMileagePerSlice[idx];
                  if (selectedCarrier && slice.mileageBreakdown) {
                    const programs = groupMileageByProgram(slice.mileageBreakdown);
                    const selectedProgram = programs.find(p => p.carrierCode === selectedCarrier);
                    if (selectedProgram) {
                      totalMileage += selectedProgram.totalMileage;
                      totalPrice += selectedProgram.totalPrice;
                    }
                  }
                });
                
                if (totalMileage > 0) {
                  bestMileageValue = (totalMileage * perCentValue) + totalPrice;
                }
              }

              // Calculate best award value if available - use selected award per slice or find cheapest
              let bestAwardValue = null;
              if (hasAwardOptions && allAwardOptions.length > 0) {
                // Check if any slice has a selected award
                let selectedAward: any = null;
                for (let idx = 0; idx < slices.length; idx++) {
                  const selectedAwardId = selectedAwardPerSlice[idx];
                  if (selectedAwardId) {
                    const sliceAwardOptions = allAwardOptions.filter(award => {
                      // First check enrichment segment metadata (more reliable for route matching)
                      if (award.enrichmentOrigin && award.enrichmentDestination) {
                        if (award.enrichmentOrigin === slices[idx].origin.code &&
                            award.enrichmentDestination === slices[idx].destination.code) {
                          return true;
                        }
                      }
                      
                      // Fallback to itinerary segments if metadata not available
                      const itinerary = award.itineraries?.[0];
                      if (!itinerary || !itinerary.segments || itinerary.segments.length === 0) return false;
                      const firstSegment = itinerary.segments[0];
                      const lastSegment = itinerary.segments[itinerary.segments.length - 1];
                      return firstSegment.departure?.iataCode === slices[idx].origin.code &&
                             lastSegment.arrival?.iataCode === slices[idx].destination.code;
                    });
                    selectedAward = sliceAwardOptions.find(a => a.id === selectedAwardId);
                    if (selectedAward) break;
                  }
                }
                
                // Use selected award or find cheapest
                const bestAward = selectedAward || [...allAwardOptions].sort((a, b) => {
                  const aValue = (a.miles * perCentValue) + a.tax;
                  const bValue = (b.miles * perCentValue) + b.tax;
                  return aValue - bValue;
                })[0];
                if (bestAward) {
                  bestAwardValue = (bestAward.miles * perCentValue) + bestAward.tax;
                }
              }

              // Get cash price (displayTotal is always a number)
              const cashPrice = displayTotal;

              // Show strike-through if mileage or award is significantly cheaper (more than 10% savings)
              const bestAlternativeValue = bestMileageValue && bestAwardValue
                ? Math.min(bestMileageValue, bestAwardValue)
                : bestMileageValue || bestAwardValue;
              const showStrikeThrough = bestAlternativeValue && bestAlternativeValue < cashPrice * 0.90;

              return (
                <div className="flex items-center gap-2 h-full">
                  <div className={`text-xl font-medium flex items-center ${showStrikeThrough ? 'text-red-400 relative' : 'text-neutral-100'}`}>
                    {formatPrice(displayTotal, currency)}
                    {showStrikeThrough && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-full h-0.5 bg-red-500 transform rotate-[20deg]"></div>
                      </div>
                    )}
                  </div>
                  {showStrikeThrough && bestAlternativeValue && (
                    <button
                      onClick={() => {
                        // Expand the slice with the best alternative
                        if (bestMileageValue && (!bestAwardValue || bestMileageValue <= bestAwardValue)) {
                          const dealIndex = slices.findIndex(s => s.mileageBreakdown?.length);
                          if (dealIndex >= 0) {
                            setExpandedSlices(prev => ({ ...prev, [dealIndex]: !prev[dealIndex] }));
                          }
                        } else if (bestAwardValue) {
                          // Expand first slice and show award tab
                          const firstSliceIndex = 0;
                          setExpandedSlices(prev => ({ ...prev, [firstSliceIndex]: true }));
                          setMileageAwardTab(prev => ({ ...prev, [firstSliceIndex]: 'award' }));
                        }
                      }}
                      className="text-sm font-bold text-green-400 hover:text-green-300 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      ${bestAlternativeValue.toFixed(2)} <span className="text-xs font-normal">
                        {bestMileageValue && bestAwardValue
                          ? (bestMileageValue <= bestAwardValue ? 'mileage' : 'award')
                          : (bestMileageValue ? 'mileage' : 'award')
                        } cash
                      </span>
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Loading Award Info - Show when enrichment is in progress for this airline */}
        {isEnriching && !hasV2Enrichment && (
          <div className="mt-2 px-3 py-2 bg-gradient-to-r from-yellow-500/5 to-amber-500/5 border border-yellow-400/20 rounded-lg">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-400 animate-[pulse_1.5s_ease-in-out_infinite]" />
              <div className="text-sm font-medium text-yellow-400">
                Fetching awards...
              </div>
            </div>
          </div>
        )}

        {/* V2 Mileage Enrichment - Display best award if available */}
        {hasAwardOptions && slices.length > 0 && (() => {
          // Get best award for the first slice (outbound)
          const firstSlice = slices[0];
          const sliceAwardOptions = allAwardOptions.filter(award => {
            // First check enrichment segment metadata (more reliable for route matching)
            if (award.enrichmentOrigin && award.enrichmentDestination) {
              if (award.enrichmentOrigin === firstSlice.origin.code &&
                  award.enrichmentDestination === firstSlice.destination.code) {
                return true;
              }
            }
            
            // Fallback to itinerary segments if metadata not available
            const itinerary = award.itineraries?.[0];
            if (!itinerary || !itinerary.segments || itinerary.segments.length === 0) return false;
            const firstSegment = itinerary.segments[0];
            const lastSegment = itinerary.segments[itinerary.segments.length - 1];
            return firstSegment.departure?.iataCode === firstSlice.origin.code &&
                   lastSegment.arrival?.iataCode === firstSlice.destination.code;
          });

          if (sliceAwardOptions.length === 0) return null;

          // Get best award for this slice
          const bestAward = [...sliceAwardOptions].sort((a, b) => {
            const aValue = (a.miles * perCentValue) + a.tax;
            const bValue = (b.miles * perCentValue) + b.tax;
            return aValue - bValue;
          })[0];

          if (!bestAward) return null;

          const cashValue = (bestAward.miles * perCentValue) + bestAward.tax;

          return (
            <div className="mt-2 px-4 py-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-purple-400" />
                  <div>
                    <div className="text-xs font-medium text-gray-300">Best Award Available</div>
                    <div className="text-[10px] text-gray-500 uppercase">{bestAward.cabin} • {sliceAwardOptions.length} options</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-bold text-purple-300">
                      {bestAward.miles.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-400">
                      miles
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-400">
                      + ${bestAward.tax.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-400">
                      taxes/fees
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-purple-200">
                      ${cashValue.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      total value
                    </div>
                  </div>
                  {/* View JSON Button - Development Tool */}
                  <button
                    onClick={() => setShowV2EnrichmentViewer(true)}
                    className="p-1.5 hover:bg-purple-500/20 rounded transition-colors"
                    title="View V2 Enrichment JSON"
                  >
                    <Code className="h-4 w-4 text-purple-400" />
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

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
                onClick={() => setShowSummaryModal(true)}
                className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 hover:text-purple-300 px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1"
                title="View Flight Details"
              >
                <Eye className="h-3 w-3" />
                Details
              </button>

              {/* Mileage Enrichment Button - Only show if no enrichment data exists for this carrier at all */}
              {onEnrichFlight && !hasAnyEnrichmentForCarrier && !isEnriching && (
                <button
                  onClick={handleEnrichClick}
                  className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 hover:text-amber-300 px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1"
                  title="Find Award Availability"
                >
                  <Award className="h-3 w-3" />
                  Find Awards
                </button>
              )}

              <button
                onClick={openHacksPage}
                className="bg-accent-500/20 hover:bg-accent-500/30 text-accent-400 hover:text-accent-300 px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1"
              >
                <Target className="h-3 w-3" />
                Hacks
              </button>
              <button
                onClick={() => {
                  if (addedItems.has('flight')) {
                    // Remove flight and all associated mileage/awards
                    const newSet = new Set(addedItems);
                    newSet.delete('flight');
                    // Remove all aero and award items for this flight
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
                    // Add flight
                    setAddedItems(prev => new Set(prev).add('flight'));
                    setPendingItems(prev => {
                      // Remove any existing flight entry and add new one
                      const filtered = prev.filter(item => item.type !== 'flight');
                      return [...filtered, { type: 'flight', id: 'flight', data: flight }];
                    });
                    setShowAddToProposal(true);
                  }
                }}
                onMouseEnter={() => {
                  if (addedItems.has('flight')) {
                    setHoveredAddButton('flight');
                  } else if (addedItems.size > 0) {
                    setHoveredAddButton('flight');
                  }
                }}
                onMouseLeave={() => setHoveredAddButton(null)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                  addedItems.has('flight')
                    ? 'bg-green-500/20 hover:bg-red-500/20 text-green-400 hover:text-red-400 border border-green-500/30 hover:border-red-500/30'
                    : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300'
                }`}
              >
                {addedItems.has('flight') ? (
                  <>
                    <span className="text-xs">✓</span>
                    {hoveredAddButton === 'flight' ? 'Remove' : 'Added'}
                  </>
                ) : (
                  <>
                    <Plus className="h-3 w-3" />
                    {hoveredAddButton === 'flight' && addedItems.size > 0 ? 'Replace' : 'Add to proposal'}
                  </>
                )}
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
                <div className="text-sm font-medium text-accent-400">
                  {getSliceLabel(sliceIndex)}
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
                  {(slice.stops && slice.stops.length > 0) && slice.flights && slice.flights.length > 0 && slice.flights[slice.flights.length - 1] && (
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
              <div className="mb-4 border border-blue-500/20 bg-blue-500/5 rounded-lg p-4">
                <div className="text-xs font-semibold text-blue-400 mb-3 flex items-center gap-2">
                  <Plane className="h-3 w-3" />
                  Flight Segments
                </div>
                <FlightSegmentDetails slice={slice} originTimezone={originTimezone} />
              </div>
            )}

            {/* Mileage Options Section - Combined Aero and Award with Tabs */}
            {((slice.mileageBreakdown && slice.mileageBreakdown.length > 0) || hasAwardOptions) && (() => {
              // Check if we have award options for this slice
              const sliceAwardOptions = hasAwardOptions ? allAwardOptions.filter(award => {
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
                        const activeCabinFlights = availableCabins.length > 1 && activeCabinTab 
                          ? flightsByCabin.get(activeCabinTab) || [] 
                          : filteredFlights;

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
                                            ? 'bg-blue-500/20 text-blue-300 border-b-2 border-blue-400'
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
                                  const showAlternatives = showAlternativeTimes[alternativeKey] || false;
                                  
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
                                                  : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-400/30'
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


      {/* Add to Proposal Modal */}
      {showAddToProposal && (
        <AddToProposalModal
          flight={flight}
          selectedMileageFlight={selectedMileageFlight}
          pendingItems={pendingItems}
          perCentValue={perCentValue}
          flightCardId={flightCardId}
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

    </div>

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
