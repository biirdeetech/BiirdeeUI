import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FlightSearchParams, FlightSliceParams, SearchResponse } from '../types/flight';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { FlightApi } from '../services/flightApiConfig';
import { flightCache } from '../services/flightCacheService';
import ITAMatrixService from '../services/itaMatrixApi';
import SearchForm from '../components/SearchForm';
import Navigation from '../components/Navigation';
import FlightResults from '../components/FlightResults';
import FlightFilters, { FlightFilterState } from '../components/FlightFilters';
import StreamingProgress from '../components/StreamingProgress';
import { useAuth } from '../hooks/useAuth';
import { getDefaultBookingClasses, bookingClassesToExt } from '../utils/bookingClasses';
import { FrtProvider } from '../contexts/FrtContext';

const SearchPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  console.log('🏠 SearchPage: Component rendering');
  
  // Early return for loading state to prevent rendering issues
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
        <Navigation />
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-8 h-8 bg-accent-600 animate-pulse rounded-full mx-auto mb-4"></div>
            <p className="text-gray-700 dark:text-gray-300">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [filteredResults, setFilteredResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamComplete, setStreamComplete] = useState(false);
  const [isSearchComplete, setIsSearchComplete] = useState(false);
  const [originTimezone, setOriginTimezone] = useState<string | undefined>(undefined);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [v2EnrichmentData, setV2EnrichmentData] = useState<Map<string, any[]>>(new Map());
  const [enrichingAirlines, setEnrichingAirlines] = useState<Set<string>>(new Set());
  const enrichmentTriggeredRef = useRef(false);
  const enrichmentTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [perCentValue, setPerCentValue] = useState(0.015);
  const [displayTimezone, setDisplayTimezone] = useState<string>(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'UTC';
    }
  });
  const isSearching = useRef(false);
  const lastSearchKey = useRef<string | null>(null);
  const lastLoadedPage = useRef<number | null>(null);
  const currentSearchKey = useRef<string | null>(null);

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/sign-in');
    }
  }, [user, authLoading, navigate]);

  // Don't render main content if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
        <Navigation />
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <p className="text-gray-700 dark:text-gray-300">Redirecting to sign in...</p>
          </div>
        </div>
      </div>
    );
  }

  // Extract search parameters from URL based on trip type
  const extractSearchParams = (): FlightSearchParams => {
    const tripType = (searchParams.get('tripType') as 'oneWay' | 'roundTrip' | 'multiCity') || 'oneWay';
    const passengers = parseInt(searchParams.get('passengers') || '1');
    const legCount = parseInt(searchParams.get('legCount') || '0');
    
    if (tripType === 'multiCity' || legCount > 2) {
      // Handle multi-city parameters
      const sliceCount = legCount > 0 ? legCount : parseInt(searchParams.get('sliceCount') || '0');
      const slices: FlightSliceParams[] = [];
      
      for (let i = 0; i < sliceCount; i++) {
        // Check for new format first, then fall back to old format
        const origins = searchParams.get(`leg${i}_origins`)?.split(',') || [searchParams.get(`origin${i}`) || ''];
        const destinations = searchParams.get(`leg${i}_destinations`)?.split(',') || [searchParams.get(`destination${i}`) || ''];
        
        // Filter out empty strings
        const validOrigins = origins.filter(o => o.trim());
        const validDestinations = destinations.filter(d => d.trim());
        
        const cabin = (searchParams.get(`leg${i}_cabin`) || searchParams.get(`cabin${i}`) as any) || 'COACH';
        const bookingClassSelection = searchParams.get(`leg${i}_bookingClassSelection`) || 'all';
        
        // Generate ext from booking class selection if not provided
        let ext = searchParams.get(`leg${i}_ext`) || '';
        // Always generate ext if it's empty or not provided, and we have a cabin
        if ((!ext || ext.trim() === '') && cabin) {
          // Generate ext based on booking class selection
          let bookingClasses: string[] = [];
          if (bookingClassSelection === 'all') {
            // When 'all' is selected, include booking classes for all cabins
            bookingClasses = [
              ...getDefaultBookingClasses('COACH'),
              ...getDefaultBookingClasses('PREMIUM-COACH'),
              ...getDefaultBookingClasses('BUSINESS'),
              ...getDefaultBookingClasses('FIRST')
            ];
          } else if (bookingClassSelection === 'economy') {
            bookingClasses = getDefaultBookingClasses('COACH');
          } else if (bookingClassSelection === 'premium') {
            bookingClasses = getDefaultBookingClasses('PREMIUM-COACH');
          } else if (bookingClassSelection === 'business') {
            bookingClasses = getDefaultBookingClasses('BUSINESS');
          } else if (bookingClassSelection === 'first') {
            bookingClasses = getDefaultBookingClasses('FIRST');
          } else if (bookingClassSelection === 'business_plus') {
            bookingClasses = [...getDefaultBookingClasses('BUSINESS'), ...getDefaultBookingClasses('FIRST')];
          } else {
            // Default to cabin's booking classes
            bookingClasses = getDefaultBookingClasses(cabin);
          }
          ext = bookingClassesToExt(bookingClasses);
        }
        
        const slice: FlightSliceParams = {
          origins: validOrigins,
          destinations: validDestinations,
          departDate: searchParams.get(`leg${i}_departDate`) || searchParams.get(`departDate${i}`) || '',
          cabin: cabin,
          via: searchParams.get(`leg${i}_via`) || '',
          nonstop: searchParams.get(`leg${i}_nonstop`) === 'true',
          ext: ext,
          // Date controls
          departureDateType: (searchParams.get(`leg${i}_departureDateType`) as 'depart' | 'arrive') || 'depart',
          departureDateModifier: (searchParams.get(`leg${i}_departureDateModifier`) as '0' | '1' | '10' | '11' | '2' | '22') || '0',
          departureDatePreferredTimes: searchParams.get(`leg${i}_departureDatePreferredTimes`)?.split(',').map(t => parseInt(t)).filter(t => !isNaN(t)) || [],
          // Per-leg ITA Matrix options
          maxStops: parseInt(searchParams.get(`leg${i}_maxStops`) || '-1'),
          extraStops: parseInt(searchParams.get(`leg${i}_extraStops`) || '-1'),
          allowAirportChanges: searchParams.get(`leg${i}_allowAirportChanges`) !== 'false',
          showOnlyAvailable: searchParams.get(`leg${i}_showOnlyAvailable`) !== 'false',
          // Per-leg Aero options
          aero: searchParams.get(`leg${i}_aero`) === 'true',
          fetchSummary: searchParams.get(`leg${i}_fetchSummary`) === 'true'
        };
        if (slice.origins.length > 0 && slice.destinations.length > 0 && slice.departDate) {
          slices.push(slice);
        }
      }
      
      return {
        tripType,
        origin: slices[0]?.origins[0] || '',
        destination: slices[0]?.destinations[0] || '',
        departDate: slices[0]?.departDate || '',
        cabin: slices[0]?.cabin || 'COACH',
        passengers,
        maxStops: parseInt(searchParams.get('maxStops') || '-1'),
        extraStops: parseInt(searchParams.get('extraStops') || '-1'),
        slices,
        // Pagination options
        pageSize: parseInt(searchParams.get('pageSize') || '25'),
        pageNum: parseInt(searchParams.get('pageNum') || '1'),
        // ITA Matrix options
        allowAirportChanges: searchParams.get('allowAirportChanges') !== 'false',
        showOnlyAvailable: searchParams.get('showOnlyAvailable') !== 'false',
        // Aero options
        aero: searchParams.get('aero') === 'true',
        airlines: searchParams.get('airlines') || undefined,
        strict_airline_match: searchParams.get('strict_airline_match') === 'true',
        time_tolerance: parseInt(searchParams.get('time_tolerance') || '960'),
        strict_leg_match: searchParams.get('strict_leg_match') === 'true',
        summary: searchParams.get('summary') === 'true',
        all_aero_cabin: searchParams.get('all_aero_cabin') !== 'false',
        sales_city: searchParams.get('sales_city') || undefined,
        currency: searchParams.get('currency') || undefined
      };
    } else {
      // Handle one-way and round-trip parameters - create slices for consistency
      const slices: FlightSliceParams[] = [];
      
      // First leg (outbound)
      const firstLegCabin = (searchParams.get('leg0_cabin') || searchParams.get('cabin')) as any || 'COACH';
      const firstOrigins = searchParams.get('leg0_origins')?.split(',').filter(o => o.trim()) || [searchParams.get('origin') || 'SFO'];
      const firstDestinations = searchParams.get('leg0_destinations')?.split(',').filter(d => d.trim()) || [searchParams.get('destination') || 'CDG'];
      const firstBookingClassSelection = searchParams.get('leg0_bookingClassSelection') || 'all';
      
      // Generate ext from booking class selection if not provided
      let firstExt = searchParams.get('leg0_ext') || '';
      // Always generate ext if it's empty or not provided, and we have a cabin
      if ((!firstExt || firstExt.trim() === '') && firstLegCabin) {
        let bookingClasses: string[] = [];
        if (firstBookingClassSelection === 'all') {
          // When 'all' is selected, include booking classes for all cabins
          bookingClasses = [
            ...getDefaultBookingClasses('COACH'),
            ...getDefaultBookingClasses('PREMIUM-COACH'),
            ...getDefaultBookingClasses('BUSINESS'),
            ...getDefaultBookingClasses('FIRST')
          ];
        } else if (firstBookingClassSelection === 'economy') {
          bookingClasses = getDefaultBookingClasses('COACH');
        } else if (firstBookingClassSelection === 'premium') {
          bookingClasses = getDefaultBookingClasses('PREMIUM-COACH');
        } else if (firstBookingClassSelection === 'business') {
          bookingClasses = getDefaultBookingClasses('BUSINESS');
        } else if (firstBookingClassSelection === 'first') {
          bookingClasses = getDefaultBookingClasses('FIRST');
        } else if (firstBookingClassSelection === 'business_plus') {
          bookingClasses = [...getDefaultBookingClasses('BUSINESS'), ...getDefaultBookingClasses('FIRST')];
        } else {
          // Fallback to cabin's booking classes
          bookingClasses = getDefaultBookingClasses(firstLegCabin);
        }
        firstExt = bookingClassesToExt(bookingClasses);
      }
      
      slices.push({
        origins: firstOrigins,
        destinations: firstDestinations,
        departDate: searchParams.get('departDate') || '',
        cabin: firstLegCabin,
        via: searchParams.get('leg0_via') || '',
        nonstop: searchParams.get('leg0_nonstop') === 'true',
        ext: firstExt,
        departureDateType: (searchParams.get('leg0_departureDateType') as 'depart' | 'arrive') || 'depart',
        departureDateModifier: (searchParams.get('leg0_departureDateModifier') as '0' | '1' | '10' | '11' | '2' | '22') || '0',
        departureDatePreferredTimes: searchParams.get('leg0_departureDatePreferredTimes')?.split(',').map(t => parseInt(t)).filter(t => !isNaN(t)) || [],
        maxStops: parseInt(searchParams.get('leg0_maxStops') || '-1'),
        extraStops: parseInt(searchParams.get('leg0_extraStops') || '-1'),
        allowAirportChanges: searchParams.get('leg0_allowAirportChanges') !== 'false',
        showOnlyAvailable: searchParams.get('leg0_showOnlyAvailable') !== 'false',
        aero: searchParams.get('leg0_aero') === 'true',
        fetchSummary: searchParams.get('leg0_fetchSummary') === 'true'
      });
      
      // Second leg (return) for round trip
      if (tripType === 'roundTrip' && searchParams.get('returnDate')) {
        const secondLegCabin = (searchParams.get('leg1_cabin') || searchParams.get('cabin')) as any || firstLegCabin;
        const secondOrigins = searchParams.get('leg1_origins')?.split(',').filter(o => o.trim()) || firstDestinations;
        const secondDestinations = searchParams.get('leg1_destinations')?.split(',').filter(d => d.trim()) || firstOrigins;
        const secondBookingClassSelection = searchParams.get('leg1_bookingClassSelection') || 'all';
        
        // Generate ext from booking class selection if not provided
        let secondExt = searchParams.get('leg1_ext') || '';
        // Always generate ext if it's empty or not provided, and we have a cabin
        if ((!secondExt || secondExt.trim() === '') && secondLegCabin) {
          let bookingClasses: string[] = [];
          if (secondBookingClassSelection === 'all') {
            // When 'all' is selected, include booking classes for all cabins
            bookingClasses = [
              ...getDefaultBookingClasses('COACH'),
              ...getDefaultBookingClasses('PREMIUM-COACH'),
              ...getDefaultBookingClasses('BUSINESS'),
              ...getDefaultBookingClasses('FIRST')
            ];
          } else if (secondBookingClassSelection === 'economy') {
            bookingClasses = getDefaultBookingClasses('COACH');
          } else if (secondBookingClassSelection === 'premium') {
            bookingClasses = getDefaultBookingClasses('PREMIUM-COACH');
          } else if (secondBookingClassSelection === 'business') {
            bookingClasses = getDefaultBookingClasses('BUSINESS');
          } else if (secondBookingClassSelection === 'first') {
            bookingClasses = getDefaultBookingClasses('FIRST');
          } else if (secondBookingClassSelection === 'business_plus') {
            bookingClasses = [...getDefaultBookingClasses('BUSINESS'), ...getDefaultBookingClasses('FIRST')];
          } else {
            // Fallback to cabin's booking classes
            bookingClasses = getDefaultBookingClasses(secondLegCabin);
          }
          secondExt = bookingClassesToExt(bookingClasses);
        }
        
        slices.push({
          origins: secondOrigins,
          destinations: secondDestinations,
          departDate: searchParams.get('returnDate') || '',
          cabin: secondLegCabin,
          via: searchParams.get('leg1_via') || '',
          nonstop: searchParams.get('leg1_nonstop') === 'true',
          ext: secondExt,
          departureDateType: (searchParams.get('leg1_departureDateType') as 'depart' | 'arrive') || 'depart',
          departureDateModifier: (searchParams.get('leg1_departureDateModifier') as '0' | '1' | '10' | '11' | '2' | '22') || '0',
          departureDatePreferredTimes: searchParams.get('leg1_departureDatePreferredTimes')?.split(',').map(t => parseInt(t)).filter(t => !isNaN(t)) || [],
          returnDateType: (searchParams.get('leg1_returnDateType') as 'depart' | 'arrive') || 'depart',
          returnDateModifier: (searchParams.get('leg1_returnDateModifier') as '0' | '1' | '10' | '11' | '2' | '22') || '0',
          returnDatePreferredTimes: searchParams.get('leg1_returnDatePreferredTimes')?.split(',').map(t => parseInt(t)).filter(t => !isNaN(t)) || [],
          maxStops: parseInt(searchParams.get('leg1_maxStops') || '-1'),
          extraStops: parseInt(searchParams.get('leg1_extraStops') || '-1'),
          allowAirportChanges: searchParams.get('leg1_allowAirportChanges') !== 'false',
          showOnlyAvailable: searchParams.get('leg1_showOnlyAvailable') !== 'false',
          aero: searchParams.get('leg1_aero') === 'true',
          fetchSummary: searchParams.get('leg1_fetchSummary') === 'true'
        });
      }
      
      return {
        tripType,
        origin: firstOrigins[0] || '',
        destination: firstDestinations[0] || '',
        departDate: searchParams.get('departDate') || '',
        returnDate: searchParams.get('returnDate') || null,
        cabin: firstLegCabin,
        passengers,
        maxStops: parseInt(searchParams.get('maxStops') || '-1'),
        extraStops: parseInt(searchParams.get('extraStops') || '-1'),
        slices,
        // Pagination options
        pageSize: parseInt(searchParams.get('pageSize') || '25'),
        pageNum: parseInt(searchParams.get('pageNum') || '1'),
        // ITA Matrix options
        allowAirportChanges: searchParams.get('allowAirportChanges') !== 'false',
        showOnlyAvailable: searchParams.get('showOnlyAvailable') !== 'false',
        // Aero options
        aero: searchParams.get('aero') === 'true',
        airlines: searchParams.get('airlines') || undefined,
        strict_airline_match: searchParams.get('strict_airline_match') === 'true',
        time_tolerance: parseInt(searchParams.get('time_tolerance') || '960'),
        strict_leg_match: searchParams.get('strict_leg_match') === 'true',
        summary: searchParams.get('summary') === 'true',
        all_aero_cabin: searchParams.get('all_aero_cabin') !== 'false',
        sales_city: searchParams.get('sales_city') || undefined,
        currency: searchParams.get('currency') || undefined
      };
    }
  };

  const extractedParams = extractSearchParams();

  // Extract origin timezone from URL params
  useEffect(() => {
    const timezone = searchParams.get('leg0_originTimezone') || searchParams.get('originTimezone');
    setOriginTimezone(timezone || undefined);

    const perCent = parseFloat(searchParams.get('perCentValue') || '0.015');
    setPerCentValue(perCent);
  }, [searchParams]);

  console.log('🔍 SearchPage: Extracted URL parameters:', extractedParams);
  console.log('🌍 SearchPage: Origin timezone:', originTimezone);

  // Initialize filters from URL parameters
  const initializeFilters = (): FlightFilterState => {
    return {
      nonstopOnly: false, // Default to allow all flights
      businessOnly: false, // Always start with filter off
      searchQuery: '',
      timeOfDay: ['morning', 'afternoon', 'night'],
      stopCounts: [], // Will be populated when results arrive
      sortBy: 'price',
      sortOrder: 'asc'
    };
  };

  // Check if search is for business/first class only
  const isBusinessSearch = extractedParams.slices?.every(slice =>
    slice.cabin === 'BUSINESS' || slice.cabin === 'FIRST'
  ) || extractedParams.cabin === 'BUSINESS' || extractedParams.cabin === 'FIRST';

  const [filters, setFilters] = useState<FlightFilterState>(initializeFilters());

  // Search function
  const searchFlights = async () => {
    // Prevent duplicate requests
    if (isSearching.current) {
      console.log('🚫 SearchPage: Search already in progress, skipping');
      return;
    }

    if (!extractedParams.origin || !extractedParams.destination || !extractedParams.departDate) {
      console.log('❌ SearchPage: Missing required parameters');
      return;
    }

    isSearching.current = true;
    console.log('🚀 SearchPage: Starting flight search');
    setLoading(true);
    setError(null);
    setHasSearched(false);
    setIsSearchComplete(false);

    // Generate cache key (without pageNum) to detect param changes
    const searchCacheKey = flightCache.generateCacheKey({ ...extractedParams, pageNum: 1 });

    // If search params changed (route, date, cabin, etc.), clear the old cache and reset search complete state
    if (lastSearchKey.current && lastSearchKey.current !== searchCacheKey) {
      console.log('🗑️  SearchPage: Search params changed, clearing old cache');
      // Clear all cache since we can't clear by old key
      const cachedPages = flightCache.getAllCachedPages(extractedParams);
      if (cachedPages.length > 0) {
        flightCache.clear(extractedParams);
      }
      currentSearchKey.current = searchCacheKey;
    }
    lastSearchKey.current = searchCacheKey;

    // Check cache first
    const currentPage = extractedParams.pageNum || 1;
    const cachedResult = flightCache.get(extractedParams, currentPage);

    if (cachedResult) {
      console.log(`✅ SearchPage: Using cached results for page ${currentPage}`);
      setResults(cachedResult);
      setHasSearched(true);
      setLoading(false);
      setIsSearchComplete(true);
      isSearching.current = false;
      lastLoadedPage.current = currentPage;
      return;
    }

    console.log(`📡 SearchPage: Cache miss, fetching page ${currentPage} from API`);
    setResults(null); // Clear previous results only when fetching new data

    try {
      // Metadata callback - receives solutionCount immediately when metadata event arrives
      const onMetadata = (metadata: { solutionCount: number; pagination?: any; session?: string; solutionSet?: string }) => {
        console.log('📊 SearchPage: Received metadata:', metadata);
        setResults((prevResults) => ({
          ...prevResults,
          solutionCount: metadata.solutionCount,
          pagination: metadata.pagination,
          session: metadata.session,
          solutionSet: metadata.solutionSet,
          solutionList: prevResults?.solutionList || { solutions: [] }
        }));
        setLoading(false);
        setIsStreaming(true);
        setStreamComplete(false);
        setHasSearched(true);
      };

      // Progressive callback for streaming results
      const onProgress = (solution: any) => {
        console.log('📥 SearchPage: Received progressive solution:', solution.id);

        setResults((prevResults) => {
          const existingSolutions = prevResults?.solutionList?.solutions || [];
          // Check if solution already exists (avoid duplicates)
          const exists = existingSolutions.some(s => s.id === solution.id);
          if (exists) return prevResults;

          // Preserve metadata (solutionCount, pagination, etc.) from previous results
          const newResults = {
            ...prevResults,
            solutionList: {
              solutions: [...existingSolutions, solution]
            }
          };
          console.log(`📊 SearchPage: Now showing ${newResults.solutionList.solutions.length} of ${prevResults?.solutionCount || '?'} results`);
          return newResults;
        });
      };

      const searchResults = await FlightApi.searchFlights(
        extractedParams,
        extractedParams.aero ? onProgress : undefined,
        extractedParams.aero ? onMetadata : undefined
      );
      console.log('✅ SearchPage: Search completed with', searchResults.solutionList?.solutions?.length, 'total results');
      console.log('✅ SearchPage: Metadata - solutionCount:', searchResults.solutionCount, 'pagination:', searchResults.pagination);

      // Mark streaming as complete
      if (extractedParams.aero) {
        setIsStreaming(false);
        setStreamComplete(true);
        // Clear complete state after 3 seconds
        setTimeout(() => setStreamComplete(false), 3000);
      }

      // Update metadata for both streaming and non-streaming modes
      const finalResults = extractedParams.aero ? {
        ...searchResults,
        solutionList: {
          solutions: results?.solutionList?.solutions || searchResults.solutionList?.solutions || []
        }
      } : searchResults;

      setResults(finalResults);
      setHasSearched(true);
      setIsSearchComplete(true);
      lastLoadedPage.current = currentPage;

      // Cache the results for this page
      flightCache.set(extractedParams, currentPage, finalResults);
      console.log(`💾 SearchPage: Cached results for page ${currentPage}`);

      // Reset enrichment trigger flag for new search
      if (currentPage === 1) {
        enrichmentTriggeredRef.current = false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('❌ SearchPage: Search failed:', errorMessage);
      setError(errorMessage);
    } finally {
      isSearching.current = false;
      setLoading(false);
      setIsStreaming(false);
    }
  };

  // Handle on-demand v2 enrichment for specific flight
  const handleEnrichFlight = async (flight: any, carrierCode: string) => {
    console.log('🌟 SearchPage: Starting v2 enrichment for carrier:', carrierCode);
    
    // Mark airline as enriching
    setEnrichingAirlines(prev => new Set(prev).add(carrierCode));
    
    try {
      const enrichmentData = await ITAMatrixService.enrichWithV2Mileage(extractedParams, [carrierCode]);
      
      // Parse enrichment data and store by carrier (same logic as auto-enrichment)
      const carrierMap = new Map<string, any[]>();
      
      enrichmentData.forEach((item: any) => {
        // New format: awardtool-direct
        if (item.type === 'solution' && item.provider === 'awardtool-direct' && item.data) {
          const flightData = item.data;
          const itineraries = flightData.itineraries || [];
          
          // Extract carrier from first segment
          itineraries.forEach((itinerary: any) => {
            const segments = itinerary.segments || [];
            segments.forEach((segment: any) => {
              const carrier = segment.carrierCode || segment.operating?.carrierCode;
              if (carrier && carrier.length === 2) {
                if (!carrierMap.has(carrier)) {
                  carrierMap.set(carrier, []);
                }
                carrierMap.get(carrier)!.push(item);
              }
            });
          });
        }
        // Old format: ita-matrix-enriched
        else if (item.type === 'solution' && item.itinerary?.slices) {
          item.itinerary.slices.forEach((slice: any) => {
            if (slice.mileageBreakdown) {
              slice.mileageBreakdown.forEach((breakdown: any) => {
                if (breakdown.allMatchingFlights) {
                  breakdown.allMatchingFlights.forEach((flight: any) => {
                    const carrier = flight.carrierCode || flight.operatingCarrier;
                    if (carrier) {
                      if (!carrierMap.has(carrier)) {
                        carrierMap.set(carrier, []);
                      }
                      carrierMap.get(carrier)!.push(item);
                    }
                  });
                }
              });
            }
          });
        }
      });
      
      // Merge with existing enrichment data
      setV2EnrichmentData(prev => {
        const newMap = new Map(prev);
        carrierMap.forEach((data, carrier) => {
          if (newMap.has(carrier)) {
            // Merge arrays, avoiding duplicates
            const existing = newMap.get(carrier)!;
            const merged = [...existing];
            data.forEach(item => {
              if (!existing.some(existingItem => existingItem.id === item.id || 
                  (item.data && existingItem.data && item.data.id === existingItem.data.id))) {
                merged.push(item);
              }
            });
            newMap.set(carrier, merged);
          } else {
            newMap.set(carrier, data);
          }
        });
        return newMap;
      });
      
      console.log('✅ SearchPage: V2 enrichment complete for', carrierCode);
      return enrichmentData;
    } catch (enrichError) {
      console.error('⚠️ SearchPage: V2 enrichment failed for', carrierCode, ':', enrichError);
      throw enrichError;
    } finally {
      // Remove from enriching set
      setEnrichingAirlines(prev => {
        const newSet = new Set(prev);
        newSet.delete(carrierCode);
        return newSet;
      });
    }
  };

  // Auto-enrichment effect - runs AFTER search completes, streaming stops, and 2 second delay
  useEffect(() => {
    const autoEnrichEnabled = import.meta.env.VITE_AUTO_ENRICH_TOP5 === 'true';
    // Check award enabled toggle from URL params (defaults to true if not set)
    const awardEnabledFromUrl = searchParams.get('awardEnabled');
    const awardEnabled = awardEnabledFromUrl === null 
      ? (import.meta.env.VITE_AWARD_ENABLED === undefined || import.meta.env.VITE_AWARD_ENABLED === '' ? true : import.meta.env.VITE_AWARD_ENABLED === 'true')
      : awardEnabledFromUrl === 'true';
    
    // Clear any pending timeout if component unmounts or dependencies change
    if (enrichmentTimeoutRef.current) {
      clearTimeout(enrichmentTimeoutRef.current);
      enrichmentTimeoutRef.current = null;
    }
    
    // Don't trigger if:
    // - Auto-enrichment disabled
    // - Award enabled toggle is off
    // - No results yet
    // - Still loading
    // - Still streaming
    // - Already enriching
    // - Already triggered for this search
    if (!autoEnrichEnabled || !awardEnabled || !results || loading || isStreaming || enrichingAirlines.size > 0 || enrichmentTriggeredRef.current) {
      return;
    }
    
    // Only enrich on first page load with fresh results
    const currentPage = extractedParams.pageNum || 1;
    if (currentPage !== 1 || !results.solutionList?.solutions?.length) {
      return;
    }
    
    // Check if we already have enrichment data (avoid re-enriching)
    if (v2EnrichmentData.size > 0) {
      enrichmentTriggeredRef.current = true;
      return;
    }
    
    // Wait 2 seconds after search/streaming completes before triggering enrichment
    console.log('⏳ SearchPage: Waiting 2 seconds after search completion before auto-enrichment...');
    
    enrichmentTimeoutRef.current = setTimeout(() => {
      console.log('🌟 SearchPage: Auto-enrichment enabled (awardEnabled:', awardEnabled, '), extracting top 5 airlines');
    
    const extractTop5Airlines = (searchResponse: SearchResponse): string[] => {
      if (!searchResponse.solutionList?.solutions) return [];
      
      const selectionMode = import.meta.env.VITE_TOP5_SELECTION_CRITERIA || 'price'; // 'price' or 'miles'
      console.log('🎯 SearchPage: Top 5 selection mode:', selectionMode);
      
      // Create map of airline -> best flight info
      interface AirlineBestFlight {
        price: number;
        stops: number;
        mileageValue: number; // For miles mode
        solution: any; // Reference to solution
      }
      
      const airlineBestFlights = new Map<string, AirlineBestFlight>();
      
      searchResponse.solutionList.solutions.forEach(solution => {
        solution.slices.forEach(slice => {
          slice.segments?.forEach(segment => {
            const code = segment.carrier?.code;
            if (code && code.length === 2) {
              const price = solution.displayTotal || solution.totalAmount || 0;
              const stops = Math.max(...solution.slices.map(s => s.stops?.length || 0));
              
              // Calculate mileage value if available (from aero enrichment)
              let mileageValue = Infinity;
              if (solution.totalMileage && solution.totalMileage > 0) {
                const mileageCash = (solution.totalMileage * (perCentValue / 100));
                const mileagePrice = parseFloat(solution.totalMileagePrice || 0);
                mileageValue = mileageCash + mileagePrice;
              }
              
              const existing = airlineBestFlights.get(code);
              if (!existing) {
                airlineBestFlights.set(code, { price, stops, mileageValue, solution });
              } else {
                // Determine if this flight is better based on selection mode
                let isBetter = false;
                
                if (selectionMode === 'miles') {
                  // Miles mode: prefer fewer stops, then best mileage value (or price if no miles)
                  if (stops < existing.stops) {
                    isBetter = true;
                  } else if (stops === existing.stops) {
                    // Within same stop category, compare mileage value
                    if (mileageValue !== Infinity && existing.mileageValue !== Infinity) {
                      isBetter = mileageValue < existing.mileageValue;
                    } else if (mileageValue !== Infinity) {
                      isBetter = true; // Has miles, existing doesn't
                    } else if (existing.mileageValue === Infinity) {
                      isBetter = price < existing.price; // Neither has miles, use price
                    }
                  }
                } else {
                  // Price mode: prefer fewer stops, then lowest price
                  if (stops < existing.stops) {
                    isBetter = true;
                  } else if (stops === existing.stops) {
                    isBetter = price < existing.price;
                  }
                }
                
                if (isBetter) {
                  airlineBestFlights.set(code, { price, stops, mileageValue, solution });
                }
              }
            }
          });
        });
      });
      
      // Sort airlines by their best flights
      const top5 = Array.from(airlineBestFlights.entries())
        .sort((a, b) => {
          const flightA = a[1];
          const flightB = b[1];
          
          // First priority: fewer stops (nonstop -> 1 stop -> 2 stops)
          if (flightA.stops !== flightB.stops) {
            return flightA.stops - flightB.stops;
          }
          
          // Within same stop category, sort by selection criteria
          if (selectionMode === 'miles') {
            // Prefer mileage value if available
            if (flightA.mileageValue !== Infinity && flightB.mileageValue !== Infinity) {
              return flightA.mileageValue - flightB.mileageValue;
            }
            if (flightA.mileageValue !== Infinity) return -1;
            if (flightB.mileageValue !== Infinity) return 1;
            // Both don't have miles, fall back to price
            return flightA.price - flightB.price;
          } else {
            // Price mode: sort by price
            return flightA.price - flightB.price;
          }
        })
        .slice(0, 5)
        .map(([code]) => code);
      
      console.log(`🎯 SearchPage: Extracted top 5 airlines (${selectionMode} mode):`, top5);
      return top5;
    };

    const enrichTop5 = async () => {
      const top5Airlines = extractTop5Airlines(results);
      
      if (top5Airlines.length === 0) return;
      
      // Mark all airlines as enriching
      setEnrichingAirlines(new Set(top5Airlines));
      
      try {
        console.log(`🌟 SearchPage: Auto-enriching ${top5Airlines.length} airlines in batch...`);
        // Single request with all 5 airlines
        const enrichmentData = await ITAMatrixService.enrichWithV2Mileage(extractedParams, top5Airlines);
        
        // Parse enrichment data and store by carrier
        // Handle both old format (ita-matrix-enriched) and new format (awardtool-direct)
        const carrierMap = new Map<string, any[]>();
        
        enrichmentData.forEach((item: any) => {
          // New format: awardtool-direct
          if (item.type === 'solution' && item.provider === 'awardtool-direct' && item.data) {
            const flightData = item.data;
            const itineraries = flightData.itineraries || [];
            
            // Extract carrier from first segment
            itineraries.forEach((itinerary: any) => {
              const segments = itinerary.segments || [];
              segments.forEach((segment: any) => {
                const carrier = segment.carrierCode || segment.operating?.carrierCode;
                if (carrier && carrier.length === 2) {
                  if (!carrierMap.has(carrier)) {
                    carrierMap.set(carrier, []);
                  }
                  carrierMap.get(carrier)!.push(item);
                }
              });
            });
          }
          // Old format: ita-matrix-enriched
          else if (item.type === 'solution' && item.itinerary?.slices) {
            item.itinerary.slices.forEach((slice: any) => {
              if (slice.mileageBreakdown) {
                slice.mileageBreakdown.forEach((breakdown: any) => {
                  if (breakdown.allMatchingFlights) {
                    breakdown.allMatchingFlights.forEach((flight: any) => {
                      const carrier = flight.carrierCode || flight.operatingCarrier;
                      if (carrier) {
                        if (!carrierMap.has(carrier)) {
                          carrierMap.set(carrier, []);
                        }
                        carrierMap.get(carrier)!.push(item);
                      }
                    });
                  }
                });
              }
            });
          }
        });
        
        // Store all enrichment data
        setV2EnrichmentData(carrierMap);
        console.log(`✅ SearchPage: Auto-enrichment complete for ${carrierMap.size} carriers`);
        // Mark as triggered to prevent re-triggering
        enrichmentTriggeredRef.current = true;
      } catch (enrichError) {
        console.error(`⚠️ SearchPage: Auto-enrichment failed (non-fatal):`, enrichError);
        // Mark as triggered even on error to prevent retry loops
        enrichmentTriggeredRef.current = true;
      } finally {
        // Clear enriching state
        setEnrichingAirlines(new Set());
        enrichmentTimeoutRef.current = null;
      }
    };
    
    enrichTop5();
    }, 2000); // Wait 2 seconds after search/streaming completes
    
    // Cleanup function
    return () => {
      if (enrichmentTimeoutRef.current) {
        clearTimeout(enrichmentTimeoutRef.current);
        enrichmentTimeoutRef.current = null;
      }
    };
  }, [results, loading, isStreaming, extractedParams.pageNum, searchParams]); // Run when results change, loading stops, streaming completes, or search params change

  // Filter and sort flights
  const applyFilters = (flights: SearchResponse, filterState: FlightFilterState, perCent: number): SearchResponse => {
    if (!flights.solutionList?.solutions) return flights;
    
    let filteredSolutions = [...flights.solutionList.solutions];
    
    // Apply nonstop filter
    if (filterState.nonstopOnly) {
      filteredSolutions = filteredSolutions.filter(flight =>
        flight.slices.every(slice => !slice.stops || slice.stops.length === 0)
      );
    }

    // Apply stops filter
    if (filterState.stopCounts.length > 0) {
      filteredSolutions = filteredSolutions.filter(flight => {
        // Check if any slice matches the selected stop counts
        return flight.slices.some(slice => {
          const stopCount = slice.stops?.length || 0;
          return filterState.stopCounts.includes(stopCount);
        });
      });
    }
    
    // Apply business+ filter
    if (filterState.businessOnly) {
      filteredSolutions = filteredSolutions.filter(flight =>
        flight.slices.every(slice =>
          slice.cabins.length > 0 && slice.cabins.every(cabin => {
            const cabinLower = cabin.toLowerCase();
            return cabinLower.includes('business') ||
                   cabinLower.includes('first') ||
                   cabinLower.includes('premium');
          })
        )
      );
    }
    
    // Apply time of day filter
    if (filterState.timeOfDay.length > 0 && filterState.timeOfDay.length < 3) {
      filteredSolutions = filteredSolutions.filter(flight => {
        return flight.slices.some(slice => {
          const departureTime = new Date(slice.departure);

          // Get hour in origin timezone if available, otherwise use UTC
          let hour: number;
          if (originTimezone) {
            const hourStr = departureTime.toLocaleString('en-US', {
              hour: 'numeric',
              hour12: false,
              timeZone: originTimezone
            });
            hour = parseInt(hourStr);
          } else {
            hour = departureTime.getUTCHours();
          }

          return filterState.timeOfDay.some(time => {
            switch (time) {
              case 'morning':
                return hour >= 0 && hour < 12;
              case 'afternoon':
                return hour >= 12 && hour < 18;
              case 'night':
                return hour >= 18 && hour < 24;
              default:
                return false;
            }
          });
        });
      });
    }
    // If all 3 times are selected or none, show all flights (no filtering needed)
    
    // Apply search query filter
    if (filterState.searchQuery.trim()) {
      const query = filterState.searchQuery.toLowerCase();
      filteredSolutions = filteredSolutions.filter(flight => {
        // Search in airport codes (origin, destination, stops)
        const airportMatch = flight.slices.some(slice => 
          slice.origin.code.toLowerCase().includes(query) ||
          slice.destination.code.toLowerCase().includes(query) ||
          slice.origin.name.toLowerCase().includes(query) ||
          slice.destination.name.toLowerCase().includes(query) ||
          (slice.stops && slice.stops.some(stop => 
            stop.code.toLowerCase().includes(query) ||
            stop.name.toLowerCase().includes(query)
          ))
        );
        
        // Search in flight numbers
        const flightNumberMatch = flight.slices.some(slice =>
          slice.flights.some(flightNum => 
            flightNum.toLowerCase().includes(query)
          )
        );
        
        // Search in airline codes and names
        const airlineMatch = flight.slices.some(slice =>
          slice.segments.some(segment =>
            segment.carrier.code.toLowerCase().includes(query) ||
            segment.carrier.name.toLowerCase().includes(query) ||
            segment.carrier.shortName.toLowerCase().includes(query)
          )
        );
        
        return airportMatch || flightNumberMatch || airlineMatch;
      });
    }
    
    // Apply sorting
    filteredSolutions.sort((a, b) => {
      let comparison = 0;

      if (filterState.sortBy === 'price') {
        // First, compare cash price
        comparison = a.displayTotal - b.displayTotal;

        // If prices are equal, compare mileage (if available)
        if (comparison === 0) {
          const aMileage = a.totalMileage || Infinity;
          const bMileage = b.totalMileage || Infinity;
          comparison = aMileage - bMileage;

          // If mileage is equal, compare taxes/fees
          if (comparison === 0) {
            const aMileagePrice = a.totalMileagePrice || 0;
            const bMileagePrice = b.totalMileagePrice || 0;
            comparison = aMileagePrice - bMileagePrice;
          }
        }
      } else if (filterState.sortBy === 'duration') {
        const aDuration = a.slices.reduce((sum, slice) => sum + slice.duration, 0);
        const bDuration = b.slices.reduce((sum, slice) => sum + slice.duration, 0);
        comparison = aDuration - bDuration;
      } else if (filterState.sortBy === 'miles') {
        // Sort by mileage USD value (miles * perCentValue + fees)
        // Flights without mileage go to end
        const aMileage = a.totalMileage || 0;
        const bMileage = b.totalMileage || 0;
        const aMileagePrice = a.totalMileagePrice || 0;
        const bMileagePrice = b.totalMileagePrice || 0;

        // Calculate total USD value for each flight
        const aValue = aMileage > 0
          ? (aMileage * perCent) + aMileagePrice
          : (filterState.sortOrder === 'asc' ? Infinity : -Infinity);
        const bValue = bMileage > 0
          ? (bMileage * perCent) + bMileagePrice
          : (filterState.sortOrder === 'asc' ? Infinity : -Infinity);

        comparison = aValue - bValue;
      } else if (filterState.sortBy === 'value') {
        // Comprehensive value scoring
        const getValueScore = (flight: any) => {
          const price = flight.displayTotal;
          const duration = flight.slices.reduce((sum: number, slice: any) => sum + slice.duration, 0);
          const pricePerMile = flight.pricePerMile || 0;
          const mileage = flight.totalMileage || Infinity;
          const mileagePrice = flight.totalMileagePrice || 0;

          // Lower is better for all these metrics
          // Normalize and weight: 50% price, 20% duration, 20% mileage, 10% fees
          const priceScore = price / 1000; // Normalize to reasonable range
          const durationScore = duration / 60; // Convert to hours
          const mileageScore = mileage === Infinity ? 1000 : mileage / 10000;
          const feeScore = mileagePrice / 100;

          return (priceScore * 0.5) + (durationScore * 0.2) + (mileageScore * 0.2) + (feeScore * 0.1);
        };

        comparison = getValueScore(a) - getValueScore(b);
      }

      return filterState.sortOrder === 'desc' ? -comparison : comparison;
    });
    
    return {
      ...flights,
      solutionList: {
        ...flights.solutionList,
        solutions: filteredSolutions
      }
    };
  };
  // Single useEffect to trigger search when params change
  useEffect(() => {
    const currentPage = extractedParams.pageNum || 1;

    // Search if we have required params
    if (extractedParams.origin && extractedParams.destination && extractedParams.departDate) {
      // Generate a key from all relevant search params (excluding page number)
      const searchKey = flightCache.generateCacheKey({ ...extractedParams, pageNum: 1 });

      // Check if search params changed OR if we're on a new page
      const paramsChanged = lastSearchKey.current !== searchKey;
      const pageChanged = lastLoadedPage.current !== currentPage;

      if (paramsChanged || pageChanged) {
        console.log('🔄 SearchPage: Search triggered -', paramsChanged ? 'params changed' : 'page changed', currentPage);
        searchFlights();
      } else {
        console.log('⏭️  SearchPage: Same params and page, skipping search');
      }
    }
  }, [searchParams]);

  // Calculate available stops from results
  const calculateAvailableStops = (searchResponse: SearchResponse): number[] => {
    if (!searchResponse.solutionList?.solutions) return [];

    const stopsSet = new Set<number>();
    searchResponse.solutionList.solutions.forEach(flight => {
      flight.slices.forEach(slice => {
        const stopCount = slice.stops?.length || 0;
        stopsSet.add(stopCount);
      });
    });

    return Array.from(stopsSet).sort((a, b) => a - b);
  };

  // Apply filters whenever results or filters change
  useEffect(() => {
    if (results) {
      // DO NOT auto-set stopCounts - empty array means "all stops"
      // User must manually select specific stop counts if they want to filter

      const filtered = applyFilters(results, filters, perCentValue);
      setFilteredResults(filtered);
    }
  }, [results, filters, perCentValue]);

  const handleNewSearch = () => {
    // Reset search state to allow new search
    setHasSearched(false);
    setResults(null);
    setFilteredResults(null);
    setError(null);
    setIsSearchComplete(false);
    lastLoadedPage.current = null;
    lastSearchKey.current = null; // Force search re-trigger even with same params
    currentSearchKey.current = null;
  };

  const handleFiltersChange = (newFilters: FlightFilterState) => {
    setFilters(newFilters);
  };

  const handleBackToSearch = () => {
    // Navigate back to home page with current search parameters
    navigate(`/?${searchParams.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const currentParams = new URLSearchParams(searchParams.toString());
    currentParams.set('pageNum', newPage.toString());
    navigate(`/search?${currentParams.toString()}`);
  };

  const handlePageSizeChange = (newSize: number) => {
    const currentParams = new URLSearchParams(searchParams.toString());
    currentParams.set('pageSize', newSize.toString());
    currentParams.set('pageNum', '1');
    navigate(`/search?${currentParams.toString()}`);
  };

  return (
    <FrtProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
        {/* Navigation - Sticky to top */}
        <Navigation />

        <div className="lg:flex lg:overflow-hidden lg:relative">
        {/* Mobile/Tablet: Full width top section, Desktop: Overlay Sidebar */}
        <div
          className={`w-full bg-white dark:bg-gray-900 border-b lg:border-r lg:border-b-0 border-gray-200 dark:border-gray-800 lg:fixed lg:left-0 lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto transition-all duration-300 ${
            sidebarCollapsed ? 'lg:w-0 lg:border-r-0 lg:-translate-x-full' : 'lg:w-[480px] lg:translate-x-0 lg:shadow-2xl'
          } lg:z-50`}
        >
          <div className={`p-6 lg:p-8 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
            {/* Back to Search Button */}
            <div className="mb-4">
              <button
                onClick={handleBackToSearch}
                className="flex items-center gap-2 text-accent-400 hover:text-accent-300 transition-colors text-sm font-medium"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Search Form
              </button>
            </div>
            <SearchForm compact onNewSearch={handleNewSearch} />
          </div>
        </div>

        {/* Sidebar Toggle Button - Desktop Only, moved 70px lower */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={`hidden lg:block fixed top-[150px] z-[60] bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded-r-lg p-2 transition-all duration-300 ${
            sidebarCollapsed ? 'left-0 top-[20px]' : 'left-[480px]'
          }`}
          title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          )}
        </button>

        {/* Backdrop when sidebar is open - Desktop Only */}
        {!sidebarCollapsed && (
          <div
            className="hidden lg:block fixed inset-0 top-16 bg-black/20 z-40 transition-opacity duration-300"
            onClick={() => setSidebarCollapsed(true)}
          />
        )}

        {/* Main Content - Flight Results - Full width, no side margins */}
        <div className="flex-1 lg:overflow-y-auto w-full">
          {/* Flight Filters - Sticky on desktop, normal flow on mobile */}
          {(results || loading || error) && (
            <FlightFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
              resultCount={filteredResults?.solutionList?.solutions?.length || 0}
              disableBusinessFilter={isBusinessSearch}
              availableStops={results ? calculateAvailableStops(results) : []}
              isAeroEnabled={extractedParams.aero}
              displayTimezone={displayTimezone}
              onTimezoneChange={setDisplayTimezone}
            />
          )}

          {/* Streaming Progress Indicator */}
          {(isStreaming || streamComplete) && results && (
            <StreamingProgress
              isStreaming={isStreaming}
              currentCount={results?.solutionList?.solutions?.length || 0}
              totalCount={extractedParams.pageSize || 25}
              isComplete={streamComplete}
            />
          )}

          {/* Flight Results */}
          <div className="px-4 py-6 lg:py-8">
            <FlightResults
              key={`results-${displayTimezone}`}
              results={filteredResults}
              loading={loading}
              error={error}
              searchParams={extractedParams}
              advancedSettings={null}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              currentPage={extractedParams.pageNum || 1}
              pageSize={extractedParams.pageSize || 25}
              originTimezone={originTimezone}
              displayTimezone={displayTimezone}
              perCentValue={perCentValue}
              v2EnrichmentData={v2EnrichmentData}
              onEnrichFlight={handleEnrichFlight}
              enrichingAirlines={enrichingAirlines}
              isSearchComplete={isSearchComplete}
              searchKey={currentSearchKey.current || ''}
            />
          </div>
        </div>
      </div>
    </div>
    </FrtProvider>
  );
};

export default SearchPage;