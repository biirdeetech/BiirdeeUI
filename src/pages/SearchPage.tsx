import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FlightSearchParams, FlightSliceParams, SearchResponse } from '../types/flight';
import { ArrowLeft } from 'lucide-react';
import { FlightApi } from '../services/flightApiConfig';
import { flightCache } from '../services/flightCacheService';
import SearchForm from '../components/SearchForm';
import Navigation from '../components/Navigation';
import FlightResults from '../components/FlightResults';
import FlightFilters, { FlightFilterState } from '../components/FlightFilters';
import { useAuth } from '../hooks/useAuth';

const SearchPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  console.log('🏠 SearchPage: Component rendering');
  
  // Early return for loading state to prevent rendering issues
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navigation />
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-8 h-8 bg-accent-600 animate-pulse rounded-full mx-auto mb-4"></div>
            <p className="text-gray-300">Loading...</p>
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
  const isSearching = useRef(false);
  const lastSearchKey = useRef<string | null>(null);
  const [filters, setFilters] = useState<FlightFilterState>({
    nonstopOnly: false,
    businessOnly: false,
    searchQuery: '',
    timeOfDay: ['morning', 'afternoon', 'night'],
    sortBy: 'price',
    sortOrder: 'asc'
  });

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/sign-in');
    }
  }, [user, authLoading, navigate]);

  // Don't render main content if not authenticated  
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navigation />
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <p className="text-gray-300">Redirecting to sign in...</p>
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
        
        const slice: FlightSliceParams = {
          origins: validOrigins,
          destinations: validDestinations,
          departDate: searchParams.get(`leg${i}_departDate`) || searchParams.get(`departDate${i}`) || '',
          cabin: (searchParams.get(`leg${i}_cabin`) || searchParams.get(`cabin${i}`) as any) || 'COACH',
          flexibility: parseInt(searchParams.get(`leg${i}_flexibility`) || '0'),
          via: searchParams.get(`leg${i}_via`) || '',
          nonstop: searchParams.get(`leg${i}_nonstop`) === 'true',
          ext: searchParams.get(`leg${i}_ext`) || '',
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
        time_tolerance: parseInt(searchParams.get('time_tolerance') || '120'),
        strict_leg_match: searchParams.get('strict_leg_match') === 'true',
        summary: searchParams.get('summary') === 'true'
      };
    } else {
      // Handle one-way and round-trip parameters - create slices for consistency
      const slices: FlightSliceParams[] = [];
      
      // First leg (outbound)
      const firstLegCabin = (searchParams.get('leg0_cabin') || searchParams.get('cabin')) as any || 'COACH';
      const firstOrigins = searchParams.get('leg0_origins')?.split(',').filter(o => o.trim()) || [searchParams.get('origin') || 'SFO'];
      const firstDestinations = searchParams.get('leg0_destinations')?.split(',').filter(d => d.trim()) || [searchParams.get('destination') || 'CDG'];
      
      slices.push({
        origins: firstOrigins,
        destinations: firstDestinations,
        departDate: searchParams.get('departDate') || '',
        cabin: firstLegCabin,
        flexibility: parseInt(searchParams.get('leg0_flexibility') || '0'),
        via: searchParams.get('leg0_via') || '',
        nonstop: searchParams.get('leg0_nonstop') === 'true',
        ext: searchParams.get('leg0_ext') || '',
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
        
        slices.push({
          origins: secondOrigins,
          destinations: secondDestinations,
          departDate: searchParams.get('returnDate') || '',
          cabin: secondLegCabin,
          flexibility: parseInt(searchParams.get('leg1_flexibility') || '0'),
          via: searchParams.get('leg1_via') || '',
          nonstop: searchParams.get('leg1_nonstop') === 'true',
          ext: searchParams.get('leg1_ext') || '',
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
        time_tolerance: parseInt(searchParams.get('time_tolerance') || '120'),
        strict_leg_match: searchParams.get('strict_leg_match') === 'true',
        summary: searchParams.get('summary') === 'true'
      };
    }
  };

  const extractedParams = extractSearchParams();

  console.log('🔍 SearchPage: Extracted URL parameters:', extractedParams);

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

    // Generate cache key (without pageNum) to detect param changes
    const searchCacheKey = flightCache.generateCacheKey({ ...extractedParams, pageNum: 1 });

    // If search params changed (route, date, cabin, etc.), clear the old cache
    if (lastSearchKey.current && lastSearchKey.current !== searchCacheKey) {
      console.log('🗑️  SearchPage: Search params changed, clearing old cache');
      // Clear all cache since we can't clear by old key
      const cachedPages = flightCache.getAllCachedPages(extractedParams);
      if (cachedPages.length > 0) {
        flightCache.clear(extractedParams);
      }
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
      isSearching.current = false;
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

      // Update metadata for both streaming and non-streaming modes
      const finalResults = extractedParams.aero ? {
        ...searchResults,
        solutionList: {
          solutions: results?.solutionList?.solutions || searchResults.solutionList?.solutions || []
        }
      } : searchResults;

      setResults(finalResults);
      setHasSearched(true);

      // Cache the results for this page
      flightCache.set(extractedParams, currentPage, finalResults);
      console.log(`💾 SearchPage: Cached results for page ${currentPage}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('❌ SearchPage: Search failed:', errorMessage);
      setError(errorMessage);
    } finally {
      isSearching.current = false;
      setLoading(false);
    }
  };

  // Filter and sort flights
  const applyFilters = (flights: SearchResponse, filterState: FlightFilterState): SearchResponse => {
    if (!flights.solutionList?.solutions) return flights;
    
    let filteredSolutions = [...flights.solutionList.solutions];
    
    // Apply nonstop filter
    if (filterState.nonstopOnly) {
      filteredSolutions = filteredSolutions.filter(flight =>
        flight.slices.every(slice => !slice.stops || slice.stops.length === 0)
      );
    }
    
    // Apply business+ filter
    if (filterState.businessOnly) {
      filteredSolutions = filteredSolutions.filter(flight =>
        flight.slices.some(slice =>
          slice.cabins.some(cabin => 
            cabin.toLowerCase().includes('business') || 
            cabin.toLowerCase().includes('first')
          )
        )
      );
    }
    
    // Apply time of day filter
    if (filterState.timeOfDay.length > 0 && filterState.timeOfDay.length < 3) {
      filteredSolutions = filteredSolutions.filter(flight => {
        return flight.slices.some(slice => {
          const departureTime = new Date(slice.departure);
          const hour = departureTime.getUTCHours();
          
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
        comparison = a.displayTotal - b.displayTotal;
      } else if (filterState.sortBy === 'duration') {
        const aDuration = a.slices.reduce((sum, slice) => sum + slice.duration, 0);
        const bDuration = b.slices.reduce((sum, slice) => sum + slice.duration, 0);
        comparison = aDuration - bDuration;
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
  // Single useEffect to trigger initial search
  useEffect(() => {
    // Only search if we have required params and haven't searched yet
    if (extractedParams.origin && extractedParams.destination && extractedParams.departDate && !hasSearched) {
      console.log('🔄 SearchPage: Initial search triggered');
      searchFlights();
    }
  }, [extractedParams.origin, extractedParams.destination, extractedParams.departDate, extractedParams.pageNum, hasSearched]);

  // Apply filters whenever results or filters change
  useEffect(() => {
    if (results) {
      const filtered = applyFilters(results, filters);
      setFilteredResults(filtered);
    }
  }, [results, filters]);

  const handleNewSearch = () => {
    // Reset search state to allow new search
    setHasSearched(false);
    setResults(null);
    setFilteredResults(null);
    setError(null);
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
    setHasSearched(false);
  };

  const handlePageSizeChange = (newSize: number) => {
    const currentParams = new URLSearchParams(searchParams.toString());
    currentParams.set('pageSize', newSize.toString());
    currentParams.set('pageNum', '1');
    navigate(`/search?${currentParams.toString()}`);
    setHasSearched(false);
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Navigation - Sticky to top */}
      <Navigation />

      <div className="lg:flex lg:overflow-hidden">
        {/* Mobile/Tablet: Full width top section, Desktop: Fixed Left Sidebar */}
        <div className="w-full lg:w-96 bg-gray-900 border-b lg:border-r lg:border-b-0 border-gray-800 lg:fixed lg:left-0 lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto z-40">
          <div className="p-4 lg:p-6">
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
        
        {/* Main Content - Flight Results */}
        <div className="flex-1 lg:ml-96 lg:overflow-y-auto">
          {/* Flight Filters - Sticky on desktop, normal flow on mobile */}
          {(results || loading || error) && (
            <FlightFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
              resultCount={filteredResults?.solutionList?.solutions?.length || 0}
            />
          )}
          
          {/* Flight Results */}
          <div className="max-w-6xl mx-auto px-4 lg:px-6 py-6 lg:py-8">
            <FlightResults
              results={filteredResults}
              loading={loading}
              error={error}
              searchParams={extractedParams}
              advancedSettings={null}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              currentPage={extractedParams.pageNum || 1}
              pageSize={extractedParams.pageSize || 25}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchPage;