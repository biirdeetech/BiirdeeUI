import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Plus, Minus, ArrowRight, X, ArrowLeftRight, Info, Sparkles, Settings } from 'lucide-react';
import { getDefaultBookingClasses, bookingClassesToExt, extToBookingClasses } from '../utils/bookingClasses';
import LocationSearchInput from './LocationSearchInput';
import LocationSearchInputMulti from './LocationSearchInputMulti';
import LocationSearchInputWithCallback from './LocationSearchInputWithCallback';
import CurrencySearchInput from './CurrencySearchInput';
import NearbyAirportModal from './NearbyAirportModal';
import FakeRoundTripModal from './FakeRoundTripModal';
import StrategyBadge from './StrategyBadge';
import { Currency } from '../utils/currencies';

// Helper function to get date 1 week from now
const getDefaultDepartDate = () => {
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  return nextWeek.toISOString().split('T')[0];
};

const getDefaultReturnDate = () => {
  const today = new Date();
  const twoWeeksOut = new Date(today);
  twoWeeksOut.setDate(today.getDate() + 14);
  return twoWeeksOut.toISOString().split('T')[0];
};

interface FlightLeg {
  id: string;
  origins: string[];
  destinations: string[];
  originTimezone?: string; // Store timezone of first origin airport
  vias: string[]; // Changed from via to vias (array)
  nonstop: boolean;
  departDate: string;
  cabin: string;
  bookingClasses: string[];
  businessPlus: boolean; // Track if Business+ is enabled
  // Date controls
  departureDateType: 'depart' | 'arrive';
  departureDateModifier: '0' | '1' | '10' | '11' | '2' | '22';
  departureDatePreferredTimes: number[];
  // Per-leg ITA Matrix options
  maxStops: number;
  extraStops: number;
  allowAirportChanges: boolean;
  showOnlyAvailable: boolean;
  // Per-leg Aero options
  aero: boolean;
  fetchSummary: boolean;
  // Strategy flags
  isFakeRoundTrip?: boolean;
}

interface SearchFormProps {
  compact?: boolean;
  onNewSearch?: () => void;
}

const SearchForm: React.FC<SearchFormProps> = ({ compact = false, onNewSearch }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [passengers, setPassengers] = useState(1);
  const [perCentValue, setPerCentValue] = useState(0.015);

  const [legs, setLegs] = useState<FlightLeg[]>([
    {
      id: '1',
      origins: [],
      destinations: [],
      vias: [],
      nonstop: true,
      departDate: getDefaultDepartDate(),
      cabin: 'COACH',
      bookingClasses: (() => {
        // Default to all booking classes
        const allClasses = [
          ...getDefaultBookingClasses('COACH'),
          ...getDefaultBookingClasses('PREMIUM-COACH'),
          ...getDefaultBookingClasses('BUSINESS'),
          ...getDefaultBookingClasses('FIRST')
        ];
        return [...new Set(allClasses)];
      })(),
      businessPlus: false,
      departureDateType: 'depart',
      departureDateModifier: '0',
      departureDatePreferredTimes: [],
      maxStops: -1,
      extraStops: -1,
      allowAirportChanges: true,
      showOnlyAvailable: true,
      aero: false,
      fetchSummary: false
    }
  ]);
  const [showExtTooltip, setShowExtTooltip] = useState<string | null>(null);
  const [showViaInput, setShowViaInput] = useState<string | null>(null);
  const [bookingClassSelection, setBookingClassSelection] = useState<Record<string, string>>({ '1': 'all' });

  // Nearby airport modal state
  const [nearbyModalOpen, setNearbyModalOpen] = useState(false);
  const [nearbyModalConfig, setNearbyModalConfig] = useState<{
    legId: string;
    airportCode: string;
    airportName?: string;
    field: 'origins' | 'destinations';
  } | null>(null);

  // Fake round trip modal state
  const [fakeRoundTripModalOpen, setFakeRoundTripModalOpen] = useState(false);
  const [fakeRoundTripLegId, setFakeRoundTripLegId] = useState<string | null>(null);

  // Pagination and Aero options
  const [pageSize, setPageSize] = useState(25);
  const [pageNum, setPageNum] = useState(1);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [aeroEnabled, setAeroEnabled] = useState(true);
  const [airlines, setAirlines] = useState('');
  const [strictAirlineMatch, setStrictAirlineMatch] = useState(false);
  const [timeTolerance, setTimeTolerance] = useState(960);
  const [strictLegMatch, setStrictLegMatch] = useState(false);
  const [fetchSummary, setFetchSummary] = useState(false);
  const [allAeroCabin, setAllAeroCabin] = useState(true);
  const [globalCabinClass, setGlobalCabinClass] = useState<string>('COACH');
  const [salesCity, setSalesCity] = useState<{ code: string; name: string } | null>(null);
  const [currency, setCurrency] = useState<Currency | null>({ code: 'USD', displayName: 'United States Dollar (USD)' });

  // Initialize form from URL params when in compact mode
  // Use a ref to track the last URL we initialized from to avoid infinite loops
  const lastInitializedUrl = useRef<string>('');

  // Debug: Log when legs state changes
  useEffect(() => {
    console.log('✅ SearchForm: legs state updated:', JSON.parse(JSON.stringify(legs)));
  }, [legs]);

  useEffect(() => {
    if (compact && searchParams.get('origin')) {
      const currentUrl = searchParams.toString();

      // Only re-initialize if the URL has actually changed
      if (currentUrl === lastInitializedUrl.current) {
        return;
      }

      lastInitializedUrl.current = currentUrl;

      const legCount = parseInt(searchParams.get('legCount') || '1');
      const newLegs: FlightLeg[] = [];
      const newBookingClassSelections: Record<string, string> = {};

      for (let i = 0; i < legCount; i++) {
        const origins = searchParams.get(`leg${i}_origins`)?.split(',').filter(o => o.trim()) || [];
        const destinations = searchParams.get(`leg${i}_destinations`)?.split(',').filter(d => d.trim()) || [];
        const departDate = searchParams.get(`leg${i}_departDate`) || searchParams.get(i === 0 ? 'departDate' : 'returnDate') || '';
        const cabin = searchParams.get(`leg${i}_cabin`) || searchParams.get('cabin') || 'BUSINESS';

        const ext = searchParams.get(`leg${i}_ext`) || '';
        const viaParam = searchParams.get(`leg${i}_via`) || '';
        const vias = viaParam ? viaParam.split(',').filter(v => v.trim()) : [];

        const isNonstop = searchParams.get(`leg${i}_nonstop`) === 'true';
        const legId = Math.random().toString(36).substr(2, 9);
        const bookingClassSelection = searchParams.get(`leg${i}_bookingClassSelection`) || 'all';

        newBookingClassSelections[legId] = bookingClassSelection;

        newLegs.push({
          id: legId,
          origins: origins.length > 0 ? origins : [searchParams.get(i === 0 ? 'origin' : 'destination') || ''].filter(o => o),
          destinations: destinations.length > 0 ? destinations : [searchParams.get(i === 0 ? 'destination' : 'origin') || ''].filter(d => d),
          vias: vias,
          nonstop: isNonstop,
          departDate,
          cabin,
          bookingClasses: ext ? extToBookingClasses(ext) : getDefaultBookingClasses(cabin),
          businessPlus: cabin === 'BUSINESS' || cabin === 'FIRST',
          departureDateType: (searchParams.get(`leg${i}_departureDateType`) as 'depart' | 'arrive') || 'depart',
          departureDateModifier: (searchParams.get(`leg${i}_departureDateModifier`) as '0' | '1' | '10' | '11' | '2' | '22') || '0',
          departureDatePreferredTimes: searchParams.get(`leg${i}_departureDatePreferredTimes`)?.split(',').map(t => parseInt(t)).filter(t => !isNaN(t)) || [],
          maxStops: isNonstop ? 0 : parseInt(searchParams.get(`leg${i}_maxStops`) || '-1'),
          extraStops: isNonstop ? 0 : parseInt(searchParams.get(`leg${i}_extraStops`) || '-1'),
          allowAirportChanges: searchParams.get(`leg${i}_allowAirportChanges`) !== 'false',
          showOnlyAvailable: searchParams.get(`leg${i}_showOnlyAvailable`) !== 'false',
          aero: searchParams.get(`leg${i}_aero`) === 'true',
          fetchSummary: searchParams.get(`leg${i}_fetchSummary`) === 'true',
          isFakeRoundTrip: searchParams.get(`leg${i}_isFakeRoundTrip`) === 'true'
        });
      }

      if (newLegs.length > 0) {
        setLegs(newLegs);
        setBookingClassSelection(newBookingClassSelections);
      }
      setPassengers(parseInt(searchParams.get('passengers') || '1'));

      // Initialize pagination and aero options from URL
      setPageSize(parseInt(searchParams.get('pageSize') || '25'));
      setPerCentValue(parseFloat(searchParams.get('perCentValue') || '0.015'));
      setPageNum(parseInt(searchParams.get('pageNum') || '1'));
      setAeroEnabled(searchParams.get('aero') === 'true');
      setAirlines(searchParams.get('airlines') || '');
      setStrictAirlineMatch(searchParams.get('strict_airline_match') === 'true');
      setTimeTolerance(parseInt(searchParams.get('time_tolerance') || '960'));
      setStrictLegMatch(searchParams.get('strict_leg_match') === 'true');
      setFetchSummary(searchParams.get('summary') === 'true');
      setAllAeroCabin(searchParams.get('all_aero_cabin') !== 'false');
      setGlobalCabinClass(searchParams.get('cabin') || 'COACH');

      const salesCityCode = searchParams.get('sales_city');
      if (salesCityCode) {
        setSalesCity({ code: salesCityCode, name: salesCityCode });
      }

      const currencyCode = searchParams.get('currency');
      if (currencyCode) {
        setCurrency({ code: currencyCode, displayName: currencyCode });
      }
    }
  }, [compact, searchParams]);

  const addLeg = () => {
    const newLegId = Math.random().toString(36).substr(2, 9);
    const newLeg: FlightLeg = {
      id: newLegId,
      origins: legs.length === 1 ? legs[0].destinations : [''],
      destinations: legs.length === 1 ? legs[0].origins : [''],
      vias: [],
      nonstop: false,
      departDate: legs.length === 1 ? getDefaultReturnDate() : '',
      cabin: legs[0].cabin,
      bookingClasses: legs[0].bookingClasses,
      businessPlus: legs[0].businessPlus,
      departureDateType: legs[0].departureDateType,
      departureDateModifier: legs[0].departureDateModifier,
      departureDatePreferredTimes: legs[0].departureDatePreferredTimes,
      maxStops: legs[0].maxStops,
      extraStops: legs[0].extraStops,
      allowAirportChanges: legs[0].allowAirportChanges,
      showOnlyAvailable: legs[0].showOnlyAvailable,
      aero: legs[0].aero,
      fetchSummary: legs[0].fetchSummary
    };
    setLegs([...legs, newLeg]);
    setBookingClassSelection(prev => ({ ...prev, [newLegId]: 'all' }));
  };

  const removeLeg = (id: string) => {
    setLegs(prevLegs => {
      if (prevLegs.length > 1) {
        const newLegs = prevLegs.filter(leg => leg.id !== id);
        // If we're down to 1 leg, remove fake round trip flags
        if (newLegs.length === 1) {
          return newLegs.map(leg => ({ ...leg, isFakeRoundTrip: false }));
        }
        return newLegs;
      }
      return prevLegs;
    });
  };

  const updateLeg = (id: string, field: keyof FlightLeg, value: any) => {
    console.log('🔄 SearchForm.updateLeg called:', { id, field, value });

    // Use functional state update to get the latest state
    setLegs(prevLegs => {
      console.log('🔄 Current legs before update:', JSON.parse(JSON.stringify(prevLegs)));

      return prevLegs.map(leg => {
        if (leg.id === id) {
          const updated = { ...leg, [field]: value };
          console.log('🔄 Updated leg:', JSON.parse(JSON.stringify(updated)));
          // Auto-update booking classes when cabin changes
          if (field === 'cabin') {
            // Check if Business+ is enabled for this leg (use updated value if businessPlus is being set)
            const isBusinessPlus = field === 'businessPlus' ? value : leg.businessPlus;
            if (isBusinessPlus && (value === 'BUSINESS' || value === 'FIRST')) {
              // Keep Business+ combined classes
              const businessClasses = getDefaultBookingClasses('BUSINESS');
              const firstClasses = getDefaultBookingClasses('FIRST');
              updated.bookingClasses = [...new Set([...businessClasses, ...firstClasses])];
            } else {
              updated.bookingClasses = getDefaultBookingClasses(value);
              // Reset businessPlus if not business/first
              if (value !== 'BUSINESS' && value !== 'FIRST') {
                updated.businessPlus = false;
              }
            }
          }
          return updated;
        }
        return leg;
      });
    });
  };

  const updateLegMultiple = (id: string, updates: Partial<FlightLeg>) => {
    setLegs(prevLegs => prevLegs.map(leg => {
      if (leg.id === id) {
        return { ...leg, ...updates };
      }
      return leg;
    }));
  };

  const addBookingClass = (legId: string, bookingClass: string) => {
    if (bookingClass.trim()) {
      setLegs(prevLegs => prevLegs.map(leg =>
        leg.id === legId && !leg.bookingClasses.includes(bookingClass.toUpperCase())
          ? { ...leg, bookingClasses: [...leg.bookingClasses, bookingClass.toUpperCase()] }
          : leg
      ));
    }
  };

  const removeBookingClass = (legId: string, bookingClass: string) => {
    setLegs(prevLegs => prevLegs.map(leg =>
      leg.id === legId
        ? { ...leg, bookingClasses: leg.bookingClasses.filter(c => c !== bookingClass) }
        : leg
    ));
  };

  const addOrigin = (legId: string, origin: string) => {
    if (origin.trim()) {
      const normalizedOrigin = origin.trim().toUpperCase();
      setLegs(prevLegs => prevLegs.map(leg => {
        if (leg.id === legId) {
          // Check if origin already exists
          if (leg.origins.includes(normalizedOrigin)) {
            return leg; // Don't add duplicate
          }
          return { ...leg, origins: [...leg.origins, normalizedOrigin] };
        }
        return leg;
      }));
    }
  };

  const removeOrigin = (legId: string, index: number) => {
    setLegs(prevLegs => prevLegs.map(leg =>
      leg.id === legId
        ? { ...leg, origins: leg.origins.filter((_, i) => i !== index) }
        : leg
    ));
  };

  const addDestination = (legId: string, destination: string) => {
    if (destination.trim()) {
      const normalizedDestination = destination.trim().toUpperCase();
      setLegs(prevLegs => prevLegs.map(leg => {
        if (leg.id === legId) {
          // Check if destination already exists
          if (leg.destinations.includes(normalizedDestination)) {
            return leg; // Don't add duplicate
          }
          return { ...leg, destinations: [...leg.destinations, normalizedDestination] };
        }
        return leg;
      }));
    }
  };

  const removeDestination = (legId: string, index: number) => {
    setLegs(prevLegs => prevLegs.map(leg =>
      leg.id === legId
        ? { ...leg, destinations: leg.destinations.filter((_, i) => i !== index) }
        : leg
    ));
  };

  const swapOriginsDestinations = (legId: string) => {
    setLegs(prevLegs => prevLegs.map(leg =>
      leg.id === legId
        ? { ...leg, origins: leg.destinations, destinations: leg.origins }
        : leg
    ));
  };

  // Nearby airport modal handlers
  const handleOpenNearbyModal = (legId: string, airportCode: string, field: 'origins' | 'destinations') => {
    setNearbyModalConfig({ legId, airportCode, field });
    setNearbyModalOpen(true);
  };

  const handleAddNearbyAirports = (airports: string[]) => {
    if (!nearbyModalConfig) return;

    const { legId, field } = nearbyModalConfig;
    setLegs(legs.map(leg => {
      if (leg.id === legId) {
        const currentAirports = leg[field];
        const newAirports = airports.filter(code => !currentAirports.includes(code));
        return { ...leg, [field]: [...currentAirports, ...newAirports] };
      }
      return leg;
    }));

    setNearbyModalOpen(false);
    setNearbyModalConfig(null);
  };

  // Fake round trip handlers
  const handleGenerateFakeRoundTrip = (legId: string) => {
    setFakeRoundTripLegId(legId);
    setFakeRoundTripModalOpen(true);
  };

  const handleFakeRoundTripReturnToOrigin = () => {
    if (!fakeRoundTripLegId) return;

    const sourceLeg = legs.find(l => l.id === fakeRoundTripLegId);
    if (!sourceLeg) return;

    const newLeg: FlightLeg = {
      id: Math.random().toString(36).substr(2, 9),
      origins: sourceLeg.destinations,
      destinations: sourceLeg.origins,
      vias: [],
      nonstop: sourceLeg.nonstop,
      departDate: getDefaultReturnDate(),
      cabin: sourceLeg.cabin,
      bookingClasses: sourceLeg.bookingClasses,
      businessPlus: sourceLeg.businessPlus,
      departureDateType: sourceLeg.departureDateType,
      departureDateModifier: sourceLeg.departureDateModifier,
      departureDatePreferredTimes: sourceLeg.departureDatePreferredTimes,
      maxStops: sourceLeg.maxStops,
      extraStops: sourceLeg.extraStops,
      allowAirportChanges: sourceLeg.allowAirportChanges,
      showOnlyAvailable: sourceLeg.showOnlyAvailable,
      aero: sourceLeg.aero,
      fetchSummary: sourceLeg.fetchSummary,
      isFakeRoundTrip: true
    };

    // Mark the source leg as part of fake roundtrip
    setLegs([
      ...legs.map(leg => leg.id === fakeRoundTripLegId ? { ...leg, isFakeRoundTrip: true } : leg),
      newLeg
    ]);

    setFakeRoundTripModalOpen(false);
    setFakeRoundTripLegId(null);
  };

  const handleFakeRoundTripFindNearby = () => {
    if (!fakeRoundTripLegId) return;

    const sourceLeg = legs.find(l => l.id === fakeRoundTripLegId);
    if (!sourceLeg || sourceLeg.destinations.length === 0) return;

    setFakeRoundTripModalOpen(false);

    // Create the return leg first
    const newLeg: FlightLeg = {
      id: Math.random().toString(36).substr(2, 9),
      origins: sourceLeg.destinations,
      destinations: [],
      vias: [],
      nonstop: sourceLeg.nonstop,
      departDate: getDefaultReturnDate(),
      cabin: sourceLeg.cabin,
      bookingClasses: sourceLeg.bookingClasses,
      businessPlus: sourceLeg.businessPlus,
      departureDateType: sourceLeg.departureDateType,
      departureDateModifier: sourceLeg.departureDateModifier,
      departureDatePreferredTimes: sourceLeg.departureDatePreferredTimes,
      maxStops: sourceLeg.maxStops,
      extraStops: sourceLeg.extraStops,
      allowAirportChanges: sourceLeg.allowAirportChanges,
      showOnlyAvailable: sourceLeg.showOnlyAvailable,
      aero: sourceLeg.aero,
      fetchSummary: sourceLeg.fetchSummary,
      isFakeRoundTrip: true
    };

    setLegs([
      ...legs.map(leg => leg.id === fakeRoundTripLegId ? { ...leg, isFakeRoundTrip: true } : leg),
      newLeg
    ]);

    // Open nearby modal for the first origin airport
    setNearbyModalConfig({
      legId: newLeg.id,
      airportCode: sourceLeg.origins[0],
      field: 'destinations'
    });
    setNearbyModalOpen(true);
    setFakeRoundTripLegId(null);
  };

  const handleFakeRoundTripManual = () => {
    if (!fakeRoundTripLegId) return;

    const sourceLeg = legs.find(l => l.id === fakeRoundTripLegId);
    if (!sourceLeg) return;

    const newLeg: FlightLeg = {
      id: Math.random().toString(36).substr(2, 9),
      origins: sourceLeg.destinations,
      destinations: [],
      vias: [],
      nonstop: sourceLeg.nonstop,
      departDate: getDefaultReturnDate(),
      cabin: sourceLeg.cabin,
      bookingClasses: sourceLeg.bookingClasses,
      businessPlus: sourceLeg.businessPlus,
      departureDateType: sourceLeg.departureDateType,
      departureDateModifier: sourceLeg.departureDateModifier,
      departureDatePreferredTimes: sourceLeg.departureDatePreferredTimes,
      maxStops: sourceLeg.maxStops,
      extraStops: sourceLeg.extraStops,
      allowAirportChanges: sourceLeg.allowAirportChanges,
      showOnlyAvailable: sourceLeg.showOnlyAvailable,
      aero: sourceLeg.aero,
      fetchSummary: sourceLeg.fetchSummary,
      isFakeRoundTrip: true
    };

    setLegs([
      ...legs.map(leg => leg.id === fakeRoundTripLegId ? { ...leg, isFakeRoundTrip: true } : leg),
      newLeg
    ]);

    setFakeRoundTripModalOpen(false);
    setFakeRoundTripLegId(null);
  };

  const getTripType = () => {
    if (legs.length === 1) return 'oneWay';
    if (legs.length === 2) return 'roundTrip';
    return 'multiCity';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Filter out empty airport codes and validate
    const validatedLegs = legs.map(leg => ({
      ...leg,
      origins: leg.origins.filter(o => o.trim()),
      destinations: leg.destinations.filter(d => d.trim())
    }));
    
    // Validate that each leg has at least one origin and destination
    const hasValidLegs = validatedLegs.every(leg => 
      leg.origins.length > 0 && leg.destinations.length > 0 && leg.departDate
    );
    
    if (!hasValidLegs) {
      alert('Please ensure each flight leg has at least one origin, destination, and departure date.');
      return;
    }
    
    let searchParams = new URLSearchParams();
    
    const tripType = getTripType();
    searchParams.append('tripType', tripType);
    
    // For backwards compatibility, set the first leg as main params
    const firstLeg = validatedLegs[0];
    searchParams.append('origin', firstLeg.origins[0] || '');
    searchParams.append('destination', firstLeg.destinations[0] || '');
    searchParams.append('departDate', firstLeg.departDate);
    searchParams.append('cabin', globalCabinClass);
    
    if (tripType === 'roundTrip' && validatedLegs[1]) {
      searchParams.append('returnDate', validatedLegs[1].departDate);
    }
    
    // Add advanced leg data
    validatedLegs.forEach((leg, index) => {
      searchParams.append(`leg${index}_origins`, leg.origins.join(','));
      searchParams.append(`leg${index}_destinations`, leg.destinations.join(','));
      if (leg.originTimezone) {
        searchParams.append(`leg${index}_originTimezone`, leg.originTimezone);
      }
      searchParams.append(`leg${index}_via`, leg.vias.join(','));
      searchParams.append(`leg${index}_nonstop`, leg.nonstop.toString());
      searchParams.append(`leg${index}_departDate`, leg.departDate);
      searchParams.append(`leg${index}_cabin`, leg.cabin);
      searchParams.append(`leg${index}_ext`, bookingClassesToExt(leg.bookingClasses));
      searchParams.append(`leg${index}_bookingClassSelection`, bookingClassSelection[leg.id] || 'all');
      // Date controls
      searchParams.append(`leg${index}_departureDateType`, leg.departureDateType);
      searchParams.append(`leg${index}_departureDateModifier`, leg.departureDateModifier);
      if (leg.departureDatePreferredTimes.length > 0) {
        searchParams.append(`leg${index}_departureDatePreferredTimes`, leg.departureDatePreferredTimes.join(','));
      }
      // Per-leg ITA Matrix options
      searchParams.append(`leg${index}_maxStops`, leg.maxStops.toString());
      searchParams.append(`leg${index}_extraStops`, leg.extraStops.toString());
      searchParams.append(`leg${index}_allowAirportChanges`, leg.allowAirportChanges.toString());
      searchParams.append(`leg${index}_showOnlyAvailable`, leg.showOnlyAvailable.toString());
      // Per-leg Aero options - sync with global aeroEnabled
      searchParams.append(`leg${index}_aero`, aeroEnabled.toString());
      searchParams.append(`leg${index}_fetchSummary`, fetchSummary.toString());
      // Strategy flags
      if (leg.isFakeRoundTrip) {
        searchParams.append(`leg${index}_isFakeRoundTrip`, 'true');
      }
    });
    
    searchParams.append('legCount', validatedLegs.length.toString());
    searchParams.append('passengers', passengers.toString());

    // Add pagination options
    searchParams.append('pageSize', pageSize.toString());
    searchParams.append('perCentValue', perCentValue.toString());
    searchParams.append('pageNum', pageNum.toString());

    // Add aero options
    searchParams.append('aero', aeroEnabled.toString());
    if (airlines) {
      searchParams.append('airlines', airlines);
    }
    if (strictAirlineMatch) {
      searchParams.append('strict_airline_match', 'true');
    }
    if (timeTolerance !== 960) {
      searchParams.append('time_tolerance', timeTolerance.toString());
    }
    if (strictLegMatch) {
      searchParams.append('strict_leg_match', 'true');
    }
    if (fetchSummary) {
      searchParams.append('summary', 'true');
    }
    if (!allAeroCabin) {
      searchParams.append('all_aero_cabin', 'false');
    }
    if (salesCity) {
      searchParams.append('sales_city', salesCity.code);
    }
    if (currency) {
      searchParams.append('currency', currency.code);
    }
    
    // Trigger new search callback if provided (for search page)
    if (onNewSearch) {
      onNewSearch();
    }

    // Add a timestamp to force re-triggering even with same params
    searchParams.set('ts', Date.now().toString());

    navigate(`/search?${searchParams.toString()}`);
  };

  return (
    <div className={`bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl ${compact ? 'p-4' : 'p-8'} hover:border-gray-600 transition-all duration-300`}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3">
          {/* Title Row */}
          <div className="flex items-center justify-between">
            <h3 className={`${compact ? 'text-base' : 'text-lg'} font-medium text-white`}>
              {compact ? 'Modify Search' : 'Flight Search'}
            </h3>
          </div>

          {/* Controls Row - Responsive */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Passengers */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-300">Passengers</label>
              <select
                value={passengers}
                onChange={(e) => setPassengers(Number(e.target.value))}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>

            {/* Page Size */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-300">Results</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all"
              >
                {[5, 10, 25, 50, 100, 200, 300, 400, 500].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>

            {/* Per Cent Value */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-300">Per Cent Value</label>
              <input
                type="number"
                value={perCentValue}
                onChange={(e) => setPerCentValue(Number(e.target.value))}
                step="0.001"
                min="0"
                max="1"
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all w-24"
              />
            </div>

            {/* Divider - hide on small screens */}
            <div className="hidden sm:block h-6 w-px bg-gray-700"></div>

            {/* Nonstop Toggle */}
            <label className="relative inline-flex items-center cursor-pointer group">
              <input
                type="checkbox"
                checked={legs.every(leg => leg.nonstop)}
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  setLegs(legs.map(leg => ({
                    ...leg,
                    nonstop: isChecked,
                    maxStops: isChecked ? 0 : -1,
                    extraStops: isChecked ? 0 : -1
                  })));
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent-500/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-500"></div>
              <span className="ms-2 text-sm text-gray-300 group-hover:text-gray-100 transition-colors whitespace-nowrap">Nonstop only</span>
            </label>

            {/* Aero Toggle */}
            <label className="relative inline-flex items-center cursor-pointer group">
              <input
                type="checkbox"
                checked={aeroEnabled}
                onChange={(e) => setAeroEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent-500/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-500"></div>
              <span className="ms-2 text-sm text-gray-300 group-hover:text-gray-100 transition-colors whitespace-nowrap">Aero Enabled</span>
            </label>

            {/* Divider - hide on small screens */}
            <div className="hidden sm:block h-6 w-px bg-gray-700"></div>

            {/* Advanced Button */}
            <button
              type="button"
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-all whitespace-nowrap ${
                showAdvancedOptions
                  ? 'bg-accent-600 hover:bg-accent-700 border-accent-500 text-white shadow-lg shadow-accent-500/20'
                  : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300 hover:text-white'
              }`}
              title="Advanced Options"
            >
              <Settings className={`h-4 w-4 ${showAdvancedOptions ? 'animate-pulse' : ''}`} />
              <span className="text-sm">Advanced</span>
            </button>
          </div>
        </div>

        {/* Flight Legs */}
        <div className="space-y-4">
          {legs.map((leg, index) => (
            <div key={leg.id} className={`bg-gray-850/50 backdrop-blur-sm rounded-xl ${compact ? 'p-3' : 'p-5'} border border-gray-700 hover:border-gray-600 transition-all duration-200 overflow-visible`}>
              <div className="flex items-center gap-3 mb-4">
                <span className={`bg-gradient-to-r from-accent-600 to-accent-700 text-white ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} rounded-lg font-medium shadow-lg`}>
                  Leg {index + 1}
                </span>

                {/* Strategy Badges */}
                {leg.vias.length > 0 && (
                  <StrategyBadge type="skiplag" />
                )}
                {leg.isFakeRoundTrip && (
                  <StrategyBadge type="fake-roundtrip" />
                )}

                <div className="flex-1 border-t border-gray-700"></div>

                {legs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLeg(leg.id)}
                    className="text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {/* Origins and Destinations Row */}
              <div className="flex gap-3 items-start overflow-visible">
                <div className="flex-1 overflow-visible">
                  <LocationSearchInputMulti
                    values={leg.origins}
                    onChange={(origins) => updateLeg(leg.id, 'origins', origins)}
                    onLocationSelect={(location, index) => {
                      // Store timezone from the first origin airport
                      if (index === 0 && location.timezone) {
                        updateLeg(leg.id, 'originTimezone', location.timezone);
                      }
                    }}
                    placeholder="Add origin (e.g., SFO)"
                    label="From"
                    onOpenNearbySearch={(code) => handleOpenNearbyModal(leg.id, code, 'origins')}
                    tagColor="accent"
                    constrainBadges={true}
                  />
                </div>

                {/* Swap Button with Via/Layover */}
                <div className="relative self-end mb-[2px] overflow-visible">
                  <div className="relative group/swap">
                    <button
                      type="button"
                      onClick={() => swapOriginsDestinations(leg.id)}
                      className="bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-gray-500 rounded-full p-2.5 transition-all duration-200 flex items-center justify-center shrink-0"
                      title="Switch origins and destinations"
                    >
                      <ArrowLeftRight className="h-4 w-4 text-gray-400 transition-colors" />
                    </button>

                    {/* Plus icon button - floats above on hover - ALWAYS visible when not in input mode */}
                    {showViaInput !== leg.id && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowViaInput(leg.id);
                        }}
                        className="absolute -top-10 left-1/2 -translate-x-1/2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/50 hover:border-purple-500 text-purple-300 rounded-full p-2 transition-all opacity-0 group-hover/swap:opacity-100 z-20"
                        title="Add via / layover"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}

                    {/* Via Input - appears below button when plus is clicked */}
                    {showViaInput === leg.id && (
                      <div
                        className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-30"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        }}
                      >
                        <div className="relative w-64">
                          <LocationSearchInputWithCallback
                            key={`via-input-${leg.id}-${leg.vias.length}`}
                            value={null}
                            onChange={(location) => {
                              if (location.code && !leg.vias.includes(location.code)) {
                                updateLeg(leg.id, 'vias', [...leg.vias, location.code]);
                                // Don't hide the input, keep it open for adding more
                              }
                            }}
                            placeholder="Add via / layover airport"
                          />
                          <button
                            type="button"
                            onClick={() => setShowViaInput(null)}
                            className="absolute -top-2 -right-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-full p-1 text-gray-400 hover:text-white z-10"
                            title="Close"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Via Badges - displayed below the swap button with better spacing */}
                  {leg.vias.length > 0 && (
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 flex flex-wrap gap-1.5 justify-center z-20 min-w-max">
                      {leg.vias.map((via, idx) => (
                        <div
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/50 text-purple-300 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
                        >
                          <span className="text-[10px] uppercase text-purple-400/70 font-semibold">Via</span>
                          <span className="font-bold text-sm">{via}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const newVias = leg.vias.filter((_, i) => i !== idx);
                              updateLeg(leg.id, 'vias', newVias);
                            }}
                            className="hover:text-white hover:bg-purple-600/40 rounded-full p-0.5 transition-colors"
                            title="Remove"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-visible">
                  <LocationSearchInputMulti
                    values={leg.destinations}
                    onChange={(destinations) => updateLeg(leg.id, 'destinations', destinations)}
                    placeholder="Add destination (e.g., CDG)"
                    label="To"
                    onOpenNearbySearch={(code) => handleOpenNearbyModal(leg.id, code, 'destinations')}
                    tagColor="blue"
                    constrainBadges={true}
                  />
                </div>

                {/* Fake Round Trip Button */}
                {index === 0 && legs.length === 1 && leg.destinations.length > 0 && (
                  <div className="relative group self-end mb-[2px]">
                    <button
                      type="button"
                      onClick={() => handleGenerateFakeRoundTrip(leg.id)}
                      className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/50 hover:border-purple-500 text-purple-300 rounded-lg p-2.5 transition-all flex items-center justify-center"
                    >
                      <Sparkles className="h-4 w-4" />
                    </button>
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 bg-gray-900 text-gray-200 text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-gray-700 z-50">
                      Generate fake round trip
                      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-700"></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Date Row */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Departure Date</label>
                <input
                  type="date"
                  value={leg.departDate}
                  onChange={(e) => updateLeg(leg.id, 'departDate', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 focus:border-accent-500"
                  required
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                />
              </div>

              {/* Cabin Class and Booking Classes Row */}
              <div className={`mt-4 grid ${showAdvancedOptions ? (compact ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2') : (compact ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2')} gap-4`}>
                {/* Cabin Class */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Cabin Class</label>
                  <select
                    value={globalCabinClass}
                    onChange={(e) => {
                      const newCabin = e.target.value;
                      setGlobalCabinClass(newCabin);
                      // Update all legs with the new cabin class
                      setLegs(prevLegs => prevLegs.map(leg => ({ ...leg, cabin: newCabin })));
                    }}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 focus:border-accent-500"
                  >
                    <option value="COACH">Cheapest Available</option>
                    <option value="PREMIUM-COACH">Premium Economy</option>
                    <option value="BUSINESS">Business Class or Higher</option>
                    <option value="FIRST">First Class</option>
                  </select>
                </div>

                {/* Booking Class Codes */}
                <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-300">Booking Class Selection</label>
                  <div className="relative">
                    <button
                      type="button"
                      onMouseEnter={() => setShowExtTooltip(leg.id)}
                      onMouseLeave={() => setShowExtTooltip(null)}
                      className="text-gray-400 hover:text-gray-300"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                    {showExtTooltip === leg.id && (
                      <div className="absolute left-0 top-6 z-50 w-96 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 text-xs">
                        <div className="space-y-3">
                          <div>
                            <p className="font-semibold text-white mb-1">First Class</p>
                            <p className="text-gray-300">Common letters: F, A, P</p>
                            <p className="text-gray-400 text-xs">F = Full-fare First, A = Discounted, P = Award/Promo</p>
                          </div>
                          <div>
                            <p className="font-semibold text-white mb-1">Business Class</p>
                            <p className="text-gray-300">Common letters: J, C, D, I, Z</p>
                            <p className="text-gray-400 text-xs">J/C = Full-fare, D/I/Z = Discounted/Award</p>
                          </div>
                          <div>
                            <p className="font-semibold text-white mb-1">Premium Economy</p>
                            <p className="text-gray-300">Common letters: W, R, G, P</p>
                            <p className="text-gray-400 text-xs">W = Full-fare, R/G = Discounted</p>
                          </div>
                          <div>
                            <p className="font-semibold text-white mb-1">Economy Class</p>
                            <p className="text-gray-300">Common letters: Y, B, H, M, K, L, Q, V, N, S, T, E, O</p>
                            <p className="text-gray-400 text-xs">Y = Full-fare, Others = Discounted tiers</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <select
                    value={bookingClassSelection[leg.id] || 'all'}
                    onChange={(e) => {
                      const value = e.target.value;
                      setBookingClassSelection(prev => ({ ...prev, [leg.id]: value }));
                      if (value === 'all') {
                        // Set all booking classes for all cabins
                        const allClasses = [
                          ...getDefaultBookingClasses('COACH'),
                          ...getDefaultBookingClasses('PREMIUM-COACH'),
                          ...getDefaultBookingClasses('BUSINESS'),
                          ...getDefaultBookingClasses('FIRST')
                        ];
                        updateLeg(leg.id, 'bookingClasses', [...new Set(allClasses)]);
                      } else if (value === 'economy') {
                        updateLeg(leg.id, 'bookingClasses', getDefaultBookingClasses('COACH'));
                      } else if (value === 'premium') {
                        updateLeg(leg.id, 'bookingClasses', getDefaultBookingClasses('PREMIUM-COACH'));
                      } else if (value === 'business') {
                        updateLeg(leg.id, 'bookingClasses', getDefaultBookingClasses('BUSINESS'));
                      } else if (value === 'first') {
                        updateLeg(leg.id, 'bookingClasses', getDefaultBookingClasses('FIRST'));
                      } else if (value === 'business_plus') {
                        const businessClasses = getDefaultBookingClasses('BUSINESS');
                        const firstClasses = getDefaultBookingClasses('FIRST');
                        updateLeg(leg.id, 'bookingClasses', [...new Set([...businessClasses, ...firstClasses])]);
                      }
                    }}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 focus:border-accent-500"
                  >
                    <option value="all">All</option>
                    <option value="economy">Economy</option>
                    <option value="premium">Premium Economy</option>
                    <option value="business">Business</option>
                    <option value="first">First</option>
                    <option value="business_plus">Business + First</option>
                  </select>
                  <div className="text-xs text-gray-400 mt-2 mb-2">Booking Classes</div>
                  <div className="min-h-[36px] mb-2">
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                      {leg.bookingClasses.map((bookingClass) => (
                        <span key={bookingClass} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-sm font-mono whitespace-nowrap">
                          {bookingClass}
                          <button
                            type="button"
                            onClick={() => removeBookingClass(leg.id, bookingClass)}
                            className="text-purple-300 hover:text-purple-100"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Add class (e.g., J, C, D)"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-accent-500 font-mono text-sm"
                    maxLength={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addBookingClass(leg.id, e.currentTarget.value);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Auto-populated based on cabin class. Add/remove specific fare classes.
                </p>
                </div>
              </div>


              {/* Per-Leg ITA Matrix & Aero Options */}
              {showAdvancedOptions && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <h4 className="text-sm font-medium text-gray-200 mb-3">Advanced Search Options for this Leg</h4>

                {/* Date Type and Modifier */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs text-gray-300 mb-1">Date Type</label>
                    <select
                      value={leg.departureDateType}
                      onChange={(e) => updateLeg(leg.id, 'departureDateType', e.target.value as 'depart' | 'arrive')}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-gray-100 text-sm focus:border-accent-500 focus:outline-none"
                    >
                      <option value="depart">Depart</option>
                      <option value="arrive">Arrive</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-300 mb-1">Date Modifier</label>
                    <select
                      value={leg.departureDateModifier}
                      onChange={(e) => updateLeg(leg.id, 'departureDateModifier', e.target.value as '0' | '1' | '10' | '11' | '2' | '22')}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-gray-100 text-sm focus:border-accent-500 focus:outline-none"
                    >
                      <option value="0">Exact date</option>
                      <option value="1">± 1 day</option>
                      <option value="10">+ 1 day</option>
                      <option value="11">- 1 day</option>
                      <option value="2">± 2 days</option>
                      <option value="22">- 2 days</option>
                    </select>
                  </div>
                </div>

                {/* Preferred Departure Times */}
                <div className="mb-4">
                  <label className="block text-xs text-gray-300 mb-2">Preferred Departure Times</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {[
                      { value: 0, label: '< 8 AM' },
                      { value: 1, label: '8-11 AM' },
                      { value: 2, label: '11 AM-2 PM' },
                      { value: 3, label: '2-5 PM' },
                      { value: 4, label: '5-9 PM' },
                      { value: 5, label: '> 9 PM' }
                    ].map(slot => (
                      <label key={slot.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={leg.departureDatePreferredTimes.includes(slot.value)}
                          onChange={(e) => {
                            const times = leg.departureDatePreferredTimes;
                            const newTimes = e.target.checked
                              ? [...times, slot.value]
                              : times.filter(t => t !== slot.value);
                            updateLeg(leg.id, 'departureDatePreferredTimes', newTimes);
                          }}
                          className="bg-gray-800 border border-gray-700 rounded text-accent-500 focus:ring-accent-500 focus:ring-2"
                        />
                        <span className="text-xs text-gray-300">{slot.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-300 mb-1">Max Stops</label>
                    <select
                      value={leg.maxStops}
                      onChange={(e) => updateLeg(leg.id, 'maxStops', parseInt(e.target.value))}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-gray-100 text-sm focus:border-accent-500 focus:outline-none"
                    >
                      <option value="-1">No limit</option>
                      <option value="0">Nonstop only</option>
                      <option value="1">Up to 1 stop</option>
                      <option value="2">Up to 2 stops</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-300 mb-1">Extra Stops</label>
                    <select
                      value={leg.extraStops}
                      onChange={(e) => updateLeg(leg.id, 'extraStops', parseInt(e.target.value))}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-gray-100 text-sm focus:border-accent-500 focus:outline-none"
                    >
                      <option value="-1">No limit</option>
                      <option value="0">Nonstop only</option>
                      <option value="1">Up to 1 stop</option>
                      <option value="2">Up to 2 stops</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={leg.allowAirportChanges}
                      onChange={(e) => updateLeg(leg.id, 'allowAirportChanges', e.target.checked)}
                      className="bg-gray-800 border border-gray-700 rounded text-accent-500 focus:ring-accent-500 focus:ring-2"
                    />
                    <span className="text-xs text-gray-300">Allow Airport Changes</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={leg.showOnlyAvailable}
                      onChange={(e) => updateLeg(leg.id, 'showOnlyAvailable', e.target.checked)}
                      className="bg-gray-800 border border-gray-700 rounded text-accent-500 focus:ring-accent-500 focus:ring-2"
                    />
                    <span className="text-xs text-gray-300">Show Only Available</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={leg.fetchSummary}
                      onChange={(e) => updateLeg(leg.id, 'fetchSummary', e.target.checked)}
                      className="bg-gray-800 border border-gray-700 rounded text-accent-500 focus:ring-accent-500 focus:ring-2"
                    />
                    <span className="text-xs text-gray-300">Fetch ITA Summary</span>
                  </label>
                </div>
              </div>
              )}
            </div>
          ))}
          
          <button
            type="button"
            onClick={addLeg}
            className={`w-full bg-gray-850 border border-gray-700 border-dashed rounded-lg ${compact ? 'p-3' : 'p-4'} text-gray-400 hover:text-gray-300 hover:border-gray-600 transition-colors flex items-center justify-center gap-2`}
          >
            <Plus className="h-4 w-4" />
            <span className={compact ? 'text-sm' : ''}>
              Add Flight Leg {legs.length === 1 ? '(creates round trip)' : ''}
            </span>
          </button>
        </div>

        <div className={`flex items-center gap-4 ${compact ? 'text-xs' : 'text-sm'} text-gray-400`}>
          <span>Trip Type:</span>
          <span className={`px-2 py-1 bg-gray-800 rounded text-gray-200 font-medium ${compact ? 'text-xs' : ''}`}>
            {getTripType() === 'oneWay' && 'One Way'}
            {getTripType() === 'roundTrip' && 'Round Trip'}
            {getTripType() === 'multiCity' && `Multi-City (${legs.length} legs)`}
          </span>
        </div>

        {/* Advanced Options Section */}
        {showAdvancedOptions && (
        <>
        {/* Global Configuration Section */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-medium text-gray-300">Global Configuration</h4>

          {/* Pagination Options */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Page Size</label>
              <input
                type="number"
                min="1"
                max="500"
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value) || 25)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 text-sm focus:border-accent-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Page Number</label>
              <input
                type="number"
                min="1"
                value={pageNum}
                onChange={(e) => setPageNum(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 text-sm focus:border-accent-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Sales City and Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Sales City (Optional)
              </label>
              {salesCity ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 text-sm flex items-center justify-between">
                    <span>{salesCity.name}</span>
                    <button
                      type="button"
                      onClick={() => setSalesCity(null)}
                      className="text-gray-400 hover:text-red-400 transition-colors ml-2"
                      title="Clear"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <LocationSearchInputWithCallback
                  value={salesCity}
                  onChange={(location) => setSalesCity(location)}
                  locationType="SALES_CITIES"
                  placeholder="Search sales city..."
                />
              )}
              <p className="text-xs text-gray-500 mt-1">
                Point of sale for pricing
              </p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Currency (Optional)
              </label>
              {currency ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 text-sm flex items-center justify-between">
                    <span>{currency.displayName}</span>
                    <button
                      type="button"
                      onClick={() => setCurrency(null)}
                      className="text-gray-400 hover:text-red-400 transition-colors ml-2"
                      title="Clear"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <CurrencySearchInput
                  value={currency}
                  onChange={(curr) => setCurrency(curr)}
                  placeholder="Search currency..."
                />
              )}
              <p className="text-xs text-gray-500 mt-1">
                Display prices in currency
              </p>
            </div>
          </div>
        </div>

        {/* Aero Options Accordion */}
        <details open className="bg-gray-800/50 border border-gray-700 rounded-lg">
          <summary className="cursor-pointer px-4 py-3 font-medium text-gray-300 hover:text-white transition-colors flex items-center justify-between">
            <span>Aero Search Options</span>
            <span className="text-xs text-gray-500">Click to collapse</span>
          </summary>
          <div className="px-4 py-4 space-y-4 border-t border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aeroEnabled}
                  onChange={(e) => setAeroEnabled(e.target.checked)}
                  className="w-4 h-4 text-accent-600 bg-gray-700 border-gray-600 rounded focus:ring-accent-500"
                />
                <span className="text-sm text-gray-400">Enable Aero</span>
              </label>
            </div>

              {aeroEnabled && (
                <div className="space-y-3 bg-gray-900/50 p-3 rounded border border-gray-700">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Airlines (comma-separated, e.g., AA,UA,DL)
                    </label>
                    <input
                      type="text"
                      value={airlines}
                      onChange={(e) => setAirlines(e.target.value)}
                      placeholder="Leave empty for all airlines"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 text-sm focus:border-accent-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={strictAirlineMatch}
                        onChange={(e) => setStrictAirlineMatch(e.target.checked)}
                        className="w-4 h-4 text-accent-600 bg-gray-700 border-gray-600 rounded focus:ring-accent-500"
                      />
                      <span className="text-xs text-gray-400">Strict Airline Match</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={strictLegMatch}
                        onChange={(e) => setStrictLegMatch(e.target.checked)}
                        className="w-4 h-4 text-accent-600 bg-gray-700 border-gray-600 rounded focus:ring-accent-500"
                      />
                      <span className="text-xs text-gray-400">Strict Leg Match</span>
                    </label>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allAeroCabin}
                        onChange={(e) => setAllAeroCabin(e.target.checked)}
                        className="w-4 h-4 text-accent-600 bg-gray-700 border-gray-600 rounded focus:ring-accent-500"
                      />
                      <span className="text-xs text-gray-400">Allow All Cabins</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Code Share Time Tolerance (minutes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={timeTolerance}
                      onChange={(e) => setTimeTolerance(parseInt(e.target.value) || 960)}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 text-sm focus:border-accent-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
          </div>
        </details>
        </>
        )}

        {/* Search Button */}
        <button
          type="submit"
          className={`w-full bg-accent-600 hover:bg-accent-700 text-white font-medium ${compact ? 'py-2 px-4' : 'py-3 px-6'} rounded-lg transition-colors flex items-center justify-center gap-2`}
        >
          <Search className="h-4 w-4" />
          {compact ? 'Update Search' : 'Search Flights'}
        </button>
      </form>

      {/* Modals */}
      <NearbyAirportModal
        isOpen={nearbyModalOpen}
        onClose={() => {
          setNearbyModalOpen(false);
          setNearbyModalConfig(null);
        }}
        onAddAirports={handleAddNearbyAirports}
        centerAirportCode={nearbyModalConfig?.airportCode || ''}
        centerAirportName={nearbyModalConfig?.airportCode || ''}
      />

      <FakeRoundTripModal
        isOpen={fakeRoundTripModalOpen}
        onClose={() => {
          setFakeRoundTripModalOpen(false);
          setFakeRoundTripLegId(null);
        }}
        onReturnToOrigin={handleFakeRoundTripReturnToOrigin}
        onFindNearby={handleFakeRoundTripFindNearby}
        onManual={handleFakeRoundTripManual}
        originCode={legs.find(l => l.id === fakeRoundTripLegId)?.origins[0] || ''}
      />
    </div>
  );
};

export default SearchForm;