import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Target, Search } from 'lucide-react';
import { FlightApi } from '../services/flightApiConfig';
import { FlightSearchParams } from '../types/flight';
import Navigation from '../components/Navigation';
import { formatPrice } from '../utils/priceFormatter';
import FlightDetailsCard from '../components/hacks/FlightDetailsCard';
import HackResultsTable from '../components/hacks/HackResultsTable';
import FrtStrategyConfig from '../components/hacks/FrtStrategyConfig';
import SkiplagStrategyConfig from '../components/hacks/SkiplagStrategyConfig';
import AddToProposalModal from '../components/AddToProposalModal';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { getDefaultBookingClasses, bookingClassesToExt } from '../utils/bookingClasses';

interface HackResult {
  type: 'frt' | 'skiplag';
  route: string;
  outbound: {
    flight: string;
    departure: string;
    time: string;
  };
  return?: {
    flight: string;
    departure: string;
    time: string;
    origin: string;
    destination: string;
  };
  continuation?: {
    flight: string;
    departure: string;
    time: string;
    destination: string;
  };
  price: string;
  savings: string;
  airline: string;
  finalCity?: string;
  totalAmount: number;
  solutionId: string;
  sessionInfo?: {
    session: string;
    solutionSet: string;
  };
}

const HacksPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const routeConfigsFetched = useRef(false);
  const renderCount = useRef(0);

  renderCount.current++;
  console.log('🔄 HacksPage: Render #', renderCount.current);

  // Helper function to get next week date
  const getNextWeekDate = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      date.setDate(date.getDate() + 7);
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // Use useMemo to prevent URL params from being recreated on every render
  const urlParams = useMemo(() => {
    console.log('🔗 Creating urlParams object (render #' + renderCount.current + ')');
    return {
      origin: searchParams.get('origin') || '',
      destination: searchParams.get('destination') || '',
      departDate: searchParams.get('departDate') || searchParams.get('date') || '',
      cabin: searchParams.get('cabin') || searchParams.get('class') || 'COACH',
      flightNumber: searchParams.get('flightNumber') || searchParams.get('flight') || '',
      price: searchParams.get('price') || '',
      solutionId: searchParams.get('solutionId') || '',
      session: searchParams.get('session') || '',
      solutionSet: searchParams.get('solutionSet') || ''
    };
  }, [searchParams]);

  console.log('🔍 HacksPage: URL Parameters extracted (render #' + renderCount.current + '):', urlParams);

  // State initialization
  const [loading, setLoading] = useState(false);
  const [flightDetails, setFlightDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // FRT Strategy states
  const [frtDates, setFrtDates] = useState({
    outbound: urlParams.departDate,
    return: getNextWeekDate(urlParams.departDate),
    flexibility: 2
  });

  const [frtReturnLeg, setFrtReturnLeg] = useState({
    cabin: 'COACH',
    nonstop: false
  });

  const [frtReturnOrigins, setFrtReturnOrigins] = useState<string[]>([]);
  const [frtReturnDestinations, setFrtReturnDestinations] = useState<string[]>([]);
  const [selectedFinalCities, setSelectedFinalCities] = useState<string[]>([]);

  // Booking class states for both slices
  const [outboundBookingClasses, setOutboundBookingClasses] = useState<string[]>(
    getDefaultBookingClasses(urlParams.cabin)
  );
  const [returnBookingClasses, setReturnBookingClasses] = useState<string[]>(
    getDefaultBookingClasses('COACH')
  );
  
  // Results states
  const [searchResults, setSearchResults] = useState<HackResult[]>([]);
  const [searchingResults, setSearchingResults] = useState(false);
  const [showAddToProposal, setShowAddToProposal] = useState(false);
  const [selectedFlightForProposal, setSelectedFlightForProposal] = useState<any>(null);

  // Helper function to get smart airports
  const getSmartAirports = (destination: string, type: string, configs: any[]) => {
    console.log('🤖 getSmartAirports called:', { destination, type, configsCount: configs.length });
    
    const relevantConfigs = configs.filter(config => {
      const routes = config.routes || [];
      return routes.some((route: any) => 
        route.destination === destination || route.origin === destination
      );
    });
    
    console.log('📍 Relevant configs found:', relevantConfigs.length);
    
    const smartAirports = [...new Set(relevantConfigs.flatMap(config => config.airport_codes))];
    console.log('📍 Smart airports found:', smartAirports);
    return smartAirports;
  };

  // Simple function to add results
  const addResultsIncrementally = (newResults: HackResult[]) => {
    console.log('📊 addResultsIncrementally called (render #' + renderCount.current + ')', { 
      newResultsLength: newResults.length
    });
    
    if (newResults.length > 0) {
      console.log(`✅ Adding ${newResults.length} new results to table`);
      setSearchResults(prevResults => {
        console.log('📈 Updating search results:', prevResults.length, '->', prevResults.length + newResults.length);
        const combined = [...prevResults, ...newResults];
        const sorted = combined.sort((a, b) => a.totalAmount - b.totalAmount);
        console.log(`📊 Total results now: ${sorted.length}`);
        return sorted;
      });
    } else {
      console.log('⚠️ No results to add');
    }
    
    console.log('📊 addResultsIncrementally complete');
  };

  // Helper functions
  const formatTime = (dateTime: string) => {
    if (!dateTime) return 'N/A';
    try {
      // Extract time portion directly from ISO string (e.g., "2025-10-05T14:30:00+03:00")
      const timeMatch = dateTime.match(/T(\d{2}):(\d{2})/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        
        // Convert to 12-hour format
        const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const minutesStr = minutes.toString().padStart(2, '0');
        
        return `${hour12}:${minutesStr} ${ampm}`;
      }
      return 'N/A';
    } catch {
      return 'N/A';
    }
  };

  const formatFlightTime = (slice: any) => {
    if (!slice) return 'N/A';
    try {
      const depTime = formatTime(slice.departure);
      const arrTime = formatTime(slice.arrival);
      const depDate = new Date(slice.departure);
      const arrDate = new Date(slice.arrival);
      const dayDiff = Math.floor((arrDate.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24));
      
      return `${depTime} - ${arrTime}${dayDiff > 0 ? `+${dayDiff}` : ''}`;
    } catch {
      return 'N/A';
    }
  };
  
  const calculateSavings = (newPrice: number, originalPrice: number) => {
    const savings = originalPrice - newPrice;
    if (savings > 0) {
      return `$${Math.round(savings).toLocaleString()}`;
    }
    return `+$${Math.round(Math.abs(savings)).toLocaleString()}`;
  };

  const generateDateRanges = (baseDate: string, flexibility: number) => {
    if (!baseDate) return [];
    
    const ranges = [];
    try {
      if (flexibility <= 2) {
        ranges.push({ date: baseDate, modifier: { minus: flexibility, plus: flexibility } });
      } else if (flexibility <= 7) {
        const base = new Date(baseDate);
        ranges.push({ date: baseDate, modifier: { minus: 2, plus: 2 } });
        
        const plus5 = new Date(base);
        plus5.setDate(plus5.getDate() + 5);
        ranges.push({ date: plus5.toISOString().split('T')[0], modifier: { minus: 2, plus: 2 } });
        
        const minus5 = new Date(base);
        minus5.setDate(minus5.getDate() - 5);
        ranges.push({ date: minus5.toISOString().split('T')[0], modifier: { minus: 2, plus: 2 } });
      } else {
        const base = new Date(baseDate);
        const offsets = [0, 5, -5, 10, -10];
        offsets.forEach(offset => {
          const targetDate = new Date(base);
          targetDate.setDate(targetDate.getDate() + offset);
          ranges.push({ date: targetDate.toISOString().split('T')[0], modifier: { minus: 2, plus: 2 } });
        });
      }
    } catch (error) {
      console.error('Error generating date ranges:', error);
    }
    return ranges;
  };

  const searchFrtStrategy = async () => {
    if (!urlParams.origin || !urlParams.destination || !urlParams.departDate) {
      console.error('❌ Missing required parameters for FRT search');
      return [];
    }
    
    console.log('🔍 Starting FRT searches...');
    const dateRanges = generateDateRanges(frtDates.return, frtDates.flexibility);
    const originalPrice = parseFloat(String(urlParams.price).replace(/[^\d.]/g, '')) || 0;
    
    const frtPromises = dateRanges.map(async (dateRange, index) => {
      console.log(`🔍 FRT Search ${index + 1}/${dateRanges.length}: Return date ${dateRange.date}`);
      
      try {
        const frtParams: FlightSearchParams = {
          tripType: 'roundTrip',
          origin: urlParams.origin,
          destination: urlParams.destination,
          departDate: frtDates.outbound,
          returnDate: dateRange.date,
          cabin: urlParams.cabin as any,
          passengers: 1,
          maxStops: 2,
          slices: [
            {
              origins: [urlParams.origin],
              destinations: [urlParams.destination],
              departDate: frtDates.outbound,
              cabin: urlParams.cabin as any,
              departureDateModifier: '0',
              nonstop: false,
              routing: urlParams.flightNumber,
              ext: bookingClassesToExt(outboundBookingClasses)
            },
            {
              origins: frtReturnOrigins,
              destinations: frtReturnDestinations,
              departDate: dateRange.date,
              cabin: frtReturnLeg.cabin as any,
              departureDateModifier: String(dateRange.modifier.plus) as '0' | '1' | '10' | '11' | '2' | '22',
              nonstop: frtReturnLeg.nonstop,
              ext: bookingClassesToExt(returnBookingClasses)
            }
          ]
        };
        
        const frtResults = await FlightApi.searchFlights(frtParams);

        if (frtResults.solutionList?.solutions && frtResults.solutionList.solutions.length > 0) {
          const sessionInfo = frtResults.session && frtResults.solutionSet
            ? { session: frtResults.session, solutionSet: frtResults.solutionSet }
            : undefined;

          const newResults: HackResult[] = frtResults.solutionList.solutions.slice(0, 5).map(solution => {
            const returnSlice = solution.slices[1];

            return {
              type: 'frt',
              route: `${urlParams.origin} → ${urlParams.destination} → ${returnSlice.origin.code} → ${returnSlice.destination.code}`,
              outbound: {
                flight: urlParams.flightNumber,
                departure: frtDates.outbound,
                time: formatFlightTime(solution.slices[0])
              },
              return: {
                flight: returnSlice.flights.join(', '),
                departure: dateRange.date,
                time: formatFlightTime(returnSlice),
                origin: returnSlice.origin.code,
                destination: returnSlice.destination.code
              },
              price: formatPrice(solution.displayTotal),
              savings: calculateSavings(solution.displayTotal, originalPrice),
              airline: returnSlice.segments[0]?.carrier?.shortName || 'Unknown',
              totalAmount: solution.displayTotal,
              solutionId: solution.id,
              sessionInfo: sessionInfo
            };
          });
          
          addResultsIncrementally(newResults);
          return newResults;
        }
        return [];
      } catch (error) {
        console.error(`❌ FRT search failed for date ${dateRange.date}:`, error);
        return [];
      }
    });

    return Promise.all(frtPromises);
  };

  const searchSkiplagStrategy = async () => {
    if (!urlParams.origin || !urlParams.destination || !urlParams.departDate) {
      console.error('❌ Missing required parameters for Skiplag search');
      return [];
    }
    
    console.log('🔍 Starting Skiplag searches...');
    const originalPrice = parseFloat(String(urlParams.price).replace(/[^\d.]/g, '')) || 0;
    
    try {
      const skiplagParams: FlightSearchParams = {
        tripType: 'oneWay',
        origin: urlParams.origin,
        destination: selectedFinalCities[0],
        departDate: urlParams.departDate,
        cabin: urlParams.cabin as any,
        passengers: 1,
        maxStops: 2,
        slices: [
          {
            origins: [urlParams.origin],
            destinations: selectedFinalCities,
            departDate: urlParams.departDate,
            cabin: urlParams.cabin as any,
            departureDateModifier: '0',
            nonstop: false,
            routing: urlParams.destination,
            ext: bookingClassesToExt(outboundBookingClasses)
          }
        ]
      };
      
      const skiplagResults = await FlightApi.searchFlights(skiplagParams);

      if (skiplagResults.solutionList?.solutions && skiplagResults.solutionList.solutions.length > 0) {
        const sessionInfo = skiplagResults.session && skiplagResults.solutionSet
          ? { session: skiplagResults.session, solutionSet: skiplagResults.solutionSet }
          : undefined;

        const validResults: HackResult[] = [];

        skiplagResults.solutionList.solutions.slice(0, 10).forEach(solution => {
          const slice = solution.slices[0];

          if (slice.stops?.some(stop => stop.code === urlParams.destination)) {
            const finalCity = slice.destination.code;

            validResults.push({
              type: 'skiplag',
              route: `${urlParams.origin} → ${urlParams.destination} → ${finalCity}`,
              outbound: {
                flight: slice.flights.join(', '),
                departure: urlParams.departDate,
                time: formatFlightTime(slice)
              },
              continuation: {
                flight: slice.flights[slice.flights.length - 1],
                departure: urlParams.departDate,
                time: 'Skip this leg',
                destination: finalCity
              },
              price: formatPrice(solution.displayTotal),
              savings: calculateSavings(solution.displayTotal, originalPrice),
              airline: slice.segments[0]?.carrier?.shortName || 'Unknown',
              finalCity,
              totalAmount: solution.displayTotal,
              solutionId: solution.id,
              sessionInfo: sessionInfo
            });
          }
        });
        
        if (validResults.length > 0) {
          addResultsIncrementally(validResults);
        }
        return validResults;
      }
      return [];
    } catch (error) {
      console.error(`❌ Skiplag search failed:`, error);
      return [];
    }
  };

  const handleStrategySearch = async () => {
    console.log('🎯 handleStrategySearch called (render #' + renderCount.current + ')');
    setSearchingResults(true);
    setSearchResults([]);
    
    try {
      await Promise.all([
        searchFrtStrategy(),
        searchSkiplagStrategy()
      ]);
    } catch (err) {
      console.error('❌ Strategy search failed:', err);
    } finally {
      setSearchingResults(false);
    }
  };

  const handleAddToProposal = () => {
    console.log('📝 handleAddToProposal called (render #' + renderCount.current + ')');
    if (flightDetails && flightDetails.bookingDetails) {
      const mockFlight = {
        id: urlParams.solutionId || 'hack-flight',
        slices: flightDetails.bookingDetails.itinerary?.slices || [],
        displayTotal: parseFloat(String(urlParams.price).replace(/[^\d.]/g, '')) || 0,
        totalAmount: parseFloat(String(urlParams.price).replace(/[^\d.]/g, '')) || 0,
        ext: {
          pricePerMile: 0
        }
      };
      
      setSelectedFlightForProposal(mockFlight);
      setShowAddToProposal(true);
    }
  };

  // Handlers for FRT strategy
  const addFrtReturnOrigin = (city: string) => {
    console.log('🏗️ addFrtReturnOrigin called (render #' + renderCount.current + '):', city);
    if (city && city.trim() && !frtReturnOrigins.includes(city.trim().toUpperCase())) {
      setFrtReturnOrigins(prev => [...prev, city.trim().toUpperCase()]);
      console.log('✅ FRT return origin added:', city.trim().toUpperCase());
    } else {
      console.log('⏭️ FRT return origin not added (duplicate or invalid):', city);
    }
  };

  const removeFrtReturnOrigin = (city: string) => {
    console.log('🗑️ removeFrtReturnOrigin called (render #' + renderCount.current + '):', city);
    setFrtReturnOrigins(prev => prev.filter(c => c !== city));
    console.log('✅ FRT return origin removed:', city);
  };

  const addFrtReturnDestination = (city: string) => {
    console.log('🏗️ addFrtReturnDestination called (render #' + renderCount.current + '):', city);
    if (city && city.trim() && !frtReturnDestinations.includes(city.trim().toUpperCase())) {
      setFrtReturnDestinations(prev => [...prev, city.trim().toUpperCase()]);
      console.log('✅ FRT return destination added:', city.trim().toUpperCase());
    } else {
      console.log('⏭️ FRT return destination not added (duplicate or invalid):', city);
    }
  };

  const removeFrtReturnDestination = (city: string) => {
    console.log('🗑️ removeFrtReturnDestination called (render #' + renderCount.current + '):', city);
    setFrtReturnDestinations(prev => prev.filter(c => c !== city));
    console.log('✅ FRT return destination removed:', city);
  };

  // Booking class management
  const addOutboundBookingClass = (bookingClass: string) => {
    if (bookingClass && !outboundBookingClasses.includes(bookingClass.toUpperCase())) {
      setOutboundBookingClasses([...outboundBookingClasses, bookingClass.toUpperCase()]);
    }
  };

  const removeOutboundBookingClass = (bookingClass: string) => {
    setOutboundBookingClasses(outboundBookingClasses.filter(c => c !== bookingClass));
  };

  const addReturnBookingClass = (bookingClass: string) => {
    if (bookingClass && !returnBookingClasses.includes(bookingClass.toUpperCase())) {
      setReturnBookingClasses([...returnBookingClasses, bookingClass.toUpperCase()]);
    }
  };

  const removeReturnBookingClass = (bookingClass: string) => {
    setReturnBookingClasses(returnBookingClasses.filter(c => c !== bookingClass));
  };

  // Initialize default airports only once
  useEffect(() => {
    console.log('🏗️ Initialize defaults effect running (render #' + renderCount.current + ')', {
      origin: urlParams.origin,
      destination: urlParams.destination,
      frtReturnOriginsLength: frtReturnOrigins.length,
      hasOriginAndDestination: !!(urlParams.origin && urlParams.destination)
    });
    
    if (urlParams.origin && urlParams.destination && frtReturnOrigins.length === 0) {
      console.log('🚀 Setting default airports');
      const defaultOrigins = [urlParams.destination, 'LHR', 'AMS', 'FRA', 'ZRH'].filter(Boolean);
      const defaultDestinations = [urlParams.origin, 'LAX', 'JFK', 'ORD', 'BOS'].filter(Boolean);
      const defaultFinals = ['LHR', 'FCO', 'BCN'];
      
      console.log('📋 Default airports to set:', { defaultOrigins, defaultDestinations, defaultFinals });
      
      setFrtReturnOrigins(defaultOrigins);
      setFrtReturnDestinations(defaultDestinations);
      setSelectedFinalCities(defaultFinals);
      
      console.log('✅ Default airports set successfully');
    } else {
      console.log('⏭️ Skipping default airports setup', {
        hasOriginAndDestination: !!(urlParams.origin && urlParams.destination),
        frtReturnOriginsLength: frtReturnOrigins.length,
        reason: !urlParams.origin ? 'no origin' : !urlParams.destination ? 'no destination' : 'already have origins'
      });
    }
    console.log('🏗️ Initialize defaults effect complete');
  }, [urlParams.origin, urlParams.destination]);

  // Fetch route configurations once
  useEffect(() => {
    console.log('📋 Route configs effect running (render #' + renderCount.current + ')', {
      user: !!user,
      routeConfigsFetched: routeConfigsFetched.current,
      destination: urlParams.destination
    });
    
    const fetchRouteConfigurations = async () => {
      if (!user || routeConfigsFetched.current || !urlParams.destination) {
        console.log('⏭️ Skipping route configs fetch', {
          user: !!user,
          routeConfigsFetched: routeConfigsFetched.current,
          destination: urlParams.destination
        });
        return;
      }
      
      console.log('🚀 Starting route configs fetch');
      routeConfigsFetched.current = true;

      try {
        const { data, error } = await supabase
          .from('route_configurations')
          .select('*')
          .eq('is_active', true);

        if (error) {
          console.error('Error fetching route configurations:', error);
          return;
        }

        console.log('📋 Loaded route configurations:', data?.length || 0);
        
        // Apply smart routing if configurations exist
        if (data && data.length > 0) {
          console.log('📋 Processing route configurations:', data.length);
          const smartFrtOrigins = getSmartAirports(urlParams.destination, 'frt_origins', data);
          const smartFrtDestinations = getSmartAirports(urlParams.destination, 'frt_destinations', data);
          const smartSkiplagFinals = getSmartAirports(urlParams.destination, 'skiplag_finals', data);
          
          console.log('🤖 Smart airports found:', { smartFrtOrigins, smartFrtDestinations, smartSkiplagFinals });
          
          if (smartFrtOrigins.length > 0) {
            console.log('🔄 Updating FRT origins with smart routing');
            setFrtReturnOrigins(prev => {
              const combined = [...new Set([...prev, ...smartFrtOrigins])];
              console.log('📍 FRT origins updated:', prev.length, '->', combined.length);
              return combined;
            });
          }
          
          if (smartFrtDestinations.length > 0) {
            console.log('🔄 Updating FRT destinations with smart routing');
            setFrtReturnDestinations(prev => {
              const combined = [...new Set([...prev, ...smartFrtDestinations])];
              console.log('📍 FRT destinations updated:', prev.length, '->', combined.length);
              return combined;
            });
          }
          
          if (smartSkiplagFinals.length > 0) {
            console.log('🔄 Updating Skiplag finals with smart routing');
            setSelectedFinalCities(prev => {
              const combined = [...new Set([...prev, ...smartSkiplagFinals])];
              console.log('📍 Skiplag finals updated:', prev.length, '->', combined.length);
              return combined;
            });
          }
        }
      } catch (error) {
        console.error('Error fetching route configurations:', error);
      }
      
      console.log('📋 Route configs effect complete');
    };

    if (user) {
      fetchRouteConfigurations();
    }
  }, [user]);

  // Auth redirect
  useEffect(() => {
    console.log('🔐 Auth redirect effect running (render #' + renderCount.current + ')', { authLoading, user: !!user });
    if (!authLoading && !user) {
      console.log('🚪 Redirecting to sign-in');
      navigate('/sign-in', { replace: true });
    }
    console.log('🔐 Auth redirect effect complete');
  }, [authLoading, user, navigate]);

  // Flight details effect
  useEffect(() => {
    console.log('✈️ Flight details effect running (render #' + renderCount.current + ')', {
      user: !!user,
      solutionId: urlParams.solutionId,
      hasSession: !!urlParams.session,
      hasSolutionSet: !!urlParams.solutionSet
    });
    
    if (user && urlParams.solutionId && urlParams.session && urlParams.solutionSet) {
      console.log('🚀 Fetching flight details');
      const fetchFlightDetails = async () => {
        setLoading(true);
        setError(null);
        try {
          console.log('⚠️ Flight details fetching not available with BiirdeeApi');
          // BiirdeeApi doesn't have session-based detail retrieval
          // Flight details are included in the search results
          setFlightDetails(null);
        } catch (err) {
          console.error('❌ Error:', err);
          setError(err instanceof Error ? err.message : 'Failed to load flight details');
        } finally {
          setLoading(false);
        }
      };

      fetchFlightDetails();
    } else {
      console.log('⏭️ Skipping flight details fetch');
    }
    console.log('✈️ Flight details effect complete');
  }, [user, urlParams.solutionId, urlParams.session, urlParams.solutionSet]);

  // Show loading state for auth
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

  // Don't render if not authenticated
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Navigation />

      <main className="px-4 sm:px-6 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-accent-600 p-2 rounded-lg">
              <Target className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-100">Flight Hacks</h1>
              <p className="text-sm text-gray-400">{urlParams.origin} → {urlParams.destination}</p>
            </div>
          </div>
        </div>
        
        <div className="grid lg:grid-cols-[1fr_2fr] gap-8">
          <div className="space-y-4">
            <FlightDetailsCard
              origin={urlParams.origin}
              destination={urlParams.destination}
              departDate={urlParams.departDate}
              cabin={urlParams.cabin}
              flightNumber={urlParams.flightNumber}
              price={urlParams.price}
              flightDetails={flightDetails}
              loading={loading}
              error={error}
              onAddToProposal={handleAddToProposal}
            />
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <FrtStrategyConfig
                frtDates={frtDates}
                setFrtDates={setFrtDates}
                frtReturnOrigins={frtReturnOrigins}
                addFrtReturnOrigin={addFrtReturnOrigin}
                removeFrtReturnOrigin={removeFrtReturnOrigin}
                frtReturnDestinations={frtReturnDestinations}
                addFrtReturnDestination={addFrtReturnDestination}
                removeFrtReturnDestination={removeFrtReturnDestination}
                frtReturnLeg={frtReturnLeg}
                setFrtReturnLeg={setFrtReturnLeg}
                outboundBookingClasses={outboundBookingClasses}
                addOutboundBookingClass={addOutboundBookingClass}
                removeOutboundBookingClass={removeOutboundBookingClass}
                returnBookingClasses={returnBookingClasses}
                addReturnBookingClass={addReturnBookingClass}
                removeReturnBookingClass={removeReturnBookingClass}
              />

              <SkiplagStrategyConfig
                selectedFinalCities={selectedFinalCities}
                setSelectedFinalCities={setSelectedFinalCities}
                outboundBookingClasses={outboundBookingClasses}
                addOutboundBookingClass={addOutboundBookingClass}
                removeOutboundBookingClass={removeOutboundBookingClass}
              />

              <button
                onClick={handleStrategySearch}
                disabled={searchingResults}
                className="w-full bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Search className="h-4 w-4" />
                {searchingResults ? 'Searching...' : 'Search Flight Hacks'}
              </button>
            </div>
          </div>
        </div>

        <HackResultsTable searchResults={searchResults} />
      </main>

      {showAddToProposal && selectedFlightForProposal && (
        <AddToProposalModal
          flight={selectedFlightForProposal}
          onClose={() => {
            setShowAddToProposal(false);
            setSelectedFlightForProposal(null);
          }}
        />
      )}
    </div>
  );
};

export default HacksPage;