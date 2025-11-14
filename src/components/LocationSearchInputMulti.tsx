import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Plane, X, Locate } from 'lucide-react';
import ITAMatrixService, { Location } from '../services/itaMatrixApi';

interface LocationSearchInputMultiProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  locationType?: 'CITIES_AND_AIRPORTS' | 'SALES_CITIES';
  label?: string;
  onOpenNearbySearch?: (airportCode: string) => void;
  onLocationSelect?: (location: Location, index: number) => void; // Callback with full location object
  tagColor?: 'accent' | 'blue' | 'purple';
  constrainBadges?: boolean;
}

const LocationSearchInputMulti: React.FC<LocationSearchInputMultiProps> = ({
  values,
  onChange,
  placeholder = 'Search location...',
  locationType = 'CITIES_AND_AIRPORTS',
  label,
  onOpenNearbySearch,
  onLocationSelect,
  tagColor = 'accent',
  constrainBadges = false
}) => {
  console.log('🎨 LocationSearchInputMulti: Rendering with values:', values);

  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

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

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      searchLocations(newValue);
    }, 300);

    setSearchTimeout(timeout);
  };

  const handleSelectLocation = (location: Location) => {
    console.log('🎯 LocationSearchInputMulti: Location selected:', location);
    const code = locationType === 'SALES_CITIES' ? location.salesCityCode || location.code : location.code;
    console.log('🎯 LocationSearchInputMulti: Selected code:', code);

    // Don't add duplicates
    if (!values.includes(code)) {
      const newValues = [...values, code];
      console.log('🎯 LocationSearchInputMulti: New values:', newValues);
      onChange(newValues);

      // Call the location select callback with index
      if (onLocationSelect) {
        console.log('🎯 LocationSearchInputMulti: Calling onLocationSelect callback');
        onLocationSelect(location, newValues.length - 1);
      }
    } else {
      console.log('⚠️ LocationSearchInputMulti: Duplicate code not added:', code);
    }

    setInputValue('');
    setIsOpen(false);
    setLocations([]);
  };

  const handleRemove = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const handleNearbySearch = (airportCode: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenNearbySearch) {
      onOpenNearbySearch(airportCode);
    }
  };

  const getLocationIcon = (type: string) => {
    if (type === 'airport' || type === 'helipad') {
      return <Plane className="h-4 w-4 text-accent-400" />;
    }
    return <MapPin className="h-4 w-4 text-blue-400" />;
  };

  const getTagColorClasses = () => {
    switch (tagColor) {
      case 'accent':
        return 'bg-accent-500/20 text-accent-300 hover:bg-accent-500/30';
      case 'blue':
        return 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30';
      case 'purple':
        return 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30';
      default:
        return 'bg-accent-500/20 text-accent-300 hover:bg-accent-500/30';
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
        </label>
      )}

      {/* Tags Display - Always reserve space for consistent height */}
      <div className="min-h-[36px] mb-2 overflow-visible">
        {values.length > 0 && (
          <div className={constrainBadges ? "flex gap-2 scrollbar-hide overflow-visible " : "flex flex-wrap gap-2"}>
            {values.map((value, idx) => (
              <span
                key={idx}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${getTagColorClasses()} rounded text-sm transition-colors relative`}
              >
                {value}
                {onOpenNearbySearch && (
                  <div className="relative group">
                    <button
                      type="button"
                      onClick={(e) => handleNearbySearch(value, e)}
                      className="text-current opacity-70 hover:opacity-100 transition-opacity"
                    >
                      <Locate className="h-3.5 w-3.5" />
                    </button>
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 bg-gray-900 text-gray-200 text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-gray-700 z-[9999]">
                      Search nearby airport
                      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-700"></div>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="text-current opacity-70 hover:opacity-100 transition-opacity"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Input Field */}
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

      {/* Dropdown */}
      {isOpen && locations.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-80 overflow-y-auto">
          {locations.map((location, index) => (
            <button
              type="button"
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

export default LocationSearchInputMulti;
