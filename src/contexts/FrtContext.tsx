import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface FrtState {
  options: any[];
  selectedIndex: number;
  isFetching: boolean;
  progress: { current: number; total: number } | null;
  autoTriggered: boolean;
}

interface FrtContextType {
  getFrtState: (flightId: string) => FrtState;
  setFrtOptions: (flightId: string, options: any[]) => void;
  addFrtOption: (flightId: string, option: any) => void;
  setSelectedFrtIndex: (flightId: string, index: number) => void;
  setIsFetching: (flightId: string, isFetching: boolean) => void;
  setFrtProgress: (flightId: string, progress: { current: number; total: number } | null) => void;
  setAutoTriggered: (flightId: string, triggered: boolean) => void;
  clearFrtState: (flightId: string) => void;
}

const FrtContext = createContext<FrtContextType | undefined>(undefined);

const DEFAULT_FRT_STATE: FrtState = {
  options: [],
  selectedIndex: 0,
  isFetching: false,
  progress: null,
  autoTriggered: false,
};

export const FrtProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [frtStates, setFrtStates] = useState<Map<string, FrtState>>(new Map());

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
    updateFrtState(flightId, { options, selectedIndex: 0 });
  }, [updateFrtState]);

  const addFrtOption = useCallback((flightId: string, option: any) => {
    setFrtStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(flightId) || { ...DEFAULT_FRT_STATE };
      const newOptions = [...currentState.options, option].sort((a, b) => a.totalPrice - b.totalPrice);
      newMap.set(flightId, {
        ...currentState,
        options: newOptions,
      });
      return newMap;
    });
  }, []);

  const setSelectedFrtIndex = useCallback((flightId: string, index: number) => {
    updateFrtState(flightId, { selectedIndex: index });
  }, [updateFrtState]);

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
    setIsFetching,
    setFrtProgress,
    setAutoTriggered,
    clearFrtState,
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
