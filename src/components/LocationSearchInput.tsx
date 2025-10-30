import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Plane } from 'lucide-react';
import ITAMatrixService, { Location } from '../services/itaMatrixApi';

interface LocationSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  locationType?: 'CITIES_AND_AIRPORTS' | 'SALES_CITIES';
  label?: string;
}

const LocationSearchInput: React.FC<LocationSearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search location...',
  locationType = 'CITIES_AND_AIRPORTS',
  label
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchLocations = async (query: string) => {
    if (!query || query.length < 2) {
      setLocations([]);
      return;
    }

    setIsLoading(true);
    try {
      const result = await ITAMatrixService.searchLocations({
        locationType,
        partialName: query,
        pageSize: 10
      });
      setLocations(result.locations || []);
      setIsOpen(true);
    } catch (error) {
      console.error('Location search failed:', error);
      setLocations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      searchLocations(newValue);
    }, 300);

    setSearchTimeout(timeout);
  };

  const handleSelectLocation = (location: Location) => {
    const code = locationType === 'SALES_CITIES' ? location.salesCityCode || location.code : location.code;
    setInputValue(code);
    onChange(code);
    setIsOpen(false);
    setLocations([]);
  };

  const getLocationIcon = (type: string) => {
    if (type === 'airport' || type === 'helipad') {
      return <Plane className="h-4 w-4 text-accent-400" />;
    }
    return <MapPin className="h-4 w-4 text-blue-400" />;
  };

  return (
    <div className="relative" ref={wrapperRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            if (inputValue.length >= 2) {
              searchLocations(inputValue);
            }
          }}
          placeholder={placeholder}
          className="w-full px-3 py-2 pl-10 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-accent-500 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {isOpen && locations.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-80 overflow-y-auto">
          {locations.map((location, index) => (
            <button
              key={`${location.code}-${index}`}
              onClick={() => handleSelectLocation(location)}
              className="w-full px-4 py-3 text-left hover:bg-gray-700 transition-colors flex items-start gap-3 border-b border-gray-700 last:border-b-0"
            >
              <div className="mt-0.5">
                {getLocationIcon(location.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {location.displayName}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {location.type === 'city' ? 'Sales City' : location.type}
                  {location.cityName && ` • ${location.cityName}`}
                </div>
              </div>
              <div className="text-xs font-mono bg-accent-500/20 text-accent-300 px-2 py-1 rounded">
                {locationType === 'SALES_CITIES' ? location.salesCityCode || location.code : location.code}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationSearchInput;
