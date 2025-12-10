import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface FrtState {
  options: any[];
  optionsByAirport: Map<string, any[]>;
  selectedIndex: number;
  selectedAirport: string | null;
  selectedOptionIndexPerAirport: Map<string, number>;
  isFetching: boolean;
  progress: { current: number; total: number } | null;
  autoTriggered: boolean;
}

interface FrtRequestParams {
  origin: string;
  destination: string;
  returnDate: string;
  returnAirports: string[];
  cabin: string;
  maxStops: number;
  viaAirports: string[];
  bookingClasses: string[];
}

interface FrtCacheEntry {
  timestamp: number;
  results: Map<string, any[]>;
}

interface FrtContextType {
  getFrtState: (flightId: string) => FrtState;
  setFrtOptions: (flightId: string, options: any[]) => void;
  addFrtOption: (flightId: string, option: any) => void;
  setSelectedFrtIndex: (flightId: string, index: number) => void;
  setSelectedAirport: (flightId: string, airport: string | null) => void;
  setSelectedOptionForAirport: (flightId: string, airport: string, optionIndex: number) => void;
  setIsFetching: (flightId: string, isFetching: boolean) => void;
  setFrtProgress: (flightId: string, progress: { current: number; total: number } | null) => void;
  setAutoTriggered: (flightId: string, triggered: boolean) => void;
  clearFrtState: (flightId: string) => void;
  getCachedFrtResults: (params: FrtRequestParams) => Map<string, any[]> | null;
  setCachedFrtResults: (params: FrtRequestParams, results: Map<string, any[]>) => void;
  getCachedAirportResults: (params: FrtRequestParams, returnAirport: string) => any[] | null;
}

const FrtContext = createContext<FrtContextType | undefined>(undefined);

const DEFAULT_FRT_STATE: FrtState = {
  options: [],
  optionsByAirport: new Map(),
  selectedIndex: 0,
  selectedAirport: null,
  selectedOptionIndexPerAirport: new Map(),
  isFetching: false,
  progress: null,
  autoTriggered: false,
};

export const FrtProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [frtStates, setFrtStates] = useState<Map<string, FrtState>>(new Map());
  const [frtCache, setFrtCache] = useState<Map<string, FrtCacheEntry>>(new Map());

  const generateCacheKey = useCallback((params: FrtRequestParams): string => {
    return JSON.stringify({
      origin: params.origin,
      destination: params.destination,
      returnDate: params.returnDate,
      returnAirports: [...params.returnAirports].sort(),
      cabin: params.cabin,
      maxStops: params.maxStops,
      viaAirports: [...params.viaAirports].sort(),
      bookingClasses: [...params.bookingClasses].sort()
    });
  }, []);

  const getCachedFrtResults = useCallback((params: FrtRequestParams): Map<string, any[]> | null => {
    const cacheKey = generateCacheKey(params);
    const cached = frtCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    const CACHE_TTL_MS = 30 * 60 * 1000;
    const isExpired = Date.now() - cached.timestamp > CACHE_TTL_MS;

    if (isExpired) {
      setFrtCache(prev => {
        const newMap = new Map(prev);
        newMap.delete(cacheKey);
        return newMap;
      });
      return null;
    }

    console.log('✅ FRT cache hit:', cacheKey.substring(0, 100));
    return cached.results;
  }, [frtCache, generateCacheKey]);

  const setCachedFrtResults = useCallback((params: FrtRequestParams, results: Map<string, any[]>) => {
    const cacheKey = generateCacheKey(params);
    console.log('💾 FRT cache set:', cacheKey.substring(0, 100));

    setFrtCache(prev => {
      const newMap = new Map(prev);
      newMap.set(cacheKey, {
        timestamp: Date.now(),
        results: results
      });
      return newMap;
    });
  }, [generateCacheKey]);

  const getCachedAirportResults = useCallback((params: FrtRequestParams, returnAirport: string): any[] | null => {
    const cacheKey = generateCacheKey(params);
    const cached = frtCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    const CACHE_TTL_MS = 30 * 60 * 1000;
    const isExpired = Date.now() - cached.timestamp > CACHE_TTL_MS;

    if (isExpired) {
      return null;
    }

    const airportResults = cached.results.get(returnAirport);
    if (airportResults) {
      console.log(`✅ FRT airport cache hit: ${returnAirport}`);
    }
    return airportResults || null;
  }, [frtCache, generateCacheKey]);

  const getFrtState = useCallback((flightId: string): FrtState => {
    return frtStates.get(flightId) || { ...DEFAULT_FRT_STATE };
  }, [frtStates]);

  const updateFrtState = useCallback((flightId: string, updates: Partial<FrtState>) => {
    setFrtStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(flightId) || { ...DEFAULT_FRT_STATE };
      newMap.set(flightId, { ...currentState, ...updates });
      return newMap;
    });
  }, []);

  const setFrtOptions = useCallback((flightId: string, options: any[]) => {
    // Group options by airport
    const optionsByAirport = new Map<string, any[]>();
    options.forEach(option => {
      const airport = option.returnAirport;
      if (!optionsByAirport.has(airport)) {
        optionsByAirport.set(airport, []);
      }
      optionsByAirport.get(airport)!.push(option);
    });

    // Sort each airport's options
    for (const [airport, airportOptions] of optionsByAirport.entries()) {
      airportOptions.sort((a, b) => {
        const aStops = a.returnFlight?.slices?.[0]?.segments?.length - 1 || 0;
        const bStops = b.returnFlight?.slices?.[0]?.segments?.length - 1 || 0;
        if (aStops !== bStops) return aStops - bStops;
        return a.totalPrice - b.totalPrice;
      });
    }

    const firstAirport = optionsByAirport.size > 0 ? Array.from(optionsByAirport.keys())[0] : null;

    updateFrtState(flightId, {
      options,
      optionsByAirport,
      selectedIndex: 0,
      selectedAirport: firstAirport,
      selectedOptionIndexPerAirport: new Map()
    });
  }, [updateFrtState]);

  const addFrtOption = useCallback((flightId: string, option: any) => {
    setFrtStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(flightId) || { ...DEFAULT_FRT_STATE };
      const newOptions = [...currentState.options, option].sort((a, b) => a.totalPrice - b.totalPrice);

      // Group by airport
      const newOptionsByAirport = new Map(currentState.optionsByAirport);
      const returnAirport = option.returnAirport;
      const airportOptions = newOptionsByAirport.get(returnAirport) || [];
      const updatedAirportOptions = [...airportOptions, option].sort((a, b) => {
        const aStops = a.returnFlight?.slices?.[0]?.segments?.length - 1 || 0;
        const bStops = b.returnFlight?.slices?.[0]?.segments?.length - 1 || 0;
        if (aStops !== bStops) return aStops - bStops;
        return a.totalPrice - b.totalPrice;
      });
      newOptionsByAirport.set(returnAirport, updatedAirportOptions);

      // Set selectedAirport if not already set
      const selectedAirport = currentState.selectedAirport || returnAirport;

      newMap.set(flightId, {
        ...currentState,
        options: newOptions,
        optionsByAirport: newOptionsByAirport,
        selectedAirport: selectedAirport,
      });
      return newMap;
    });
  }, []);

  const setSelectedFrtIndex = useCallback((flightId: string, index: number) => {
    updateFrtState(flightId, { selectedIndex: index });
  }, [updateFrtState]);

  const setSelectedAirport = useCallback((flightId: string, airport: string | null) => {
    updateFrtState(flightId, { selectedAirport: airport });
  }, [updateFrtState]);

  const setSelectedOptionForAirport = useCallback((flightId: string, airport: string, optionIndex: number) => {
    setFrtStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(flightId) || { ...DEFAULT_FRT_STATE };
      const newSelectedMap = new Map(currentState.selectedOptionIndexPerAirport);
      newSelectedMap.set(airport, optionIndex);
      newMap.set(flightId, {
        ...currentState,
        selectedAirport: airport,
        selectedOptionIndexPerAirport: newSelectedMap,
      });
      return newMap;
    });
  }, []);

  const setIsFetching = useCallback((flightId: string, isFetching: boolean) => {
    updateFrtState(flightId, { isFetching });
  }, [updateFrtState]);

  const setFrtProgress = useCallback((flightId: string, progress: { current: number; total: number } | null) => {
    updateFrtState(flightId, { progress });
  }, [updateFrtState]);

  const setAutoTriggered = useCallback((flightId: string, triggered: boolean) => {
    updateFrtState(flightId, { autoTriggered: triggered });
  }, [updateFrtState]);

  const clearFrtState = useCallback((flightId: string) => {
    setFrtStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(flightId);
      return newMap;
    });
  }, []);

  const value: FrtContextType = {
    getFrtState,
    setFrtOptions,
    addFrtOption,
    setSelectedFrtIndex,
    setSelectedAirport,
    setSelectedOptionForAirport,
    setIsFetching,
    setFrtProgress,
    setAutoTriggered,
    clearFrtState,
    getCachedFrtResults,
    setCachedFrtResults,
    getCachedAirportResults,
  };

  return <FrtContext.Provider value={value}>{children}</FrtContext.Provider>;
};

export const useFrt = () => {
  const context = useContext(FrtContext);
  if (context === undefined) {
    throw new Error('useFrt must be used within a FrtProvider');
  }
  return context;
};
