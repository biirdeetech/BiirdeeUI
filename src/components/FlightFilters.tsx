import React, { useState } from 'react';
import { Search, Filter, Clock, Plane, Import as SortAsc, Dessert as SortDesc } from 'lucide-react';

export interface FlightFilterState {
  nonstopOnly: boolean;
  businessOnly: boolean;
  searchQuery: string;
  timeOfDay: string[]; // array of active times: 'morning', 'afternoon', 'night'
  sortBy: 'price' | 'duration';
  sortOrder: 'asc' | 'desc';
}

interface FlightFiltersProps {
  filters: FlightFilterState;
  onFiltersChange: (filters: FlightFilterState) => void;
  resultCount: number;
}

const FlightFilters: React.FC<FlightFiltersProps> = ({
  filters,
  onFiltersChange,
  resultCount
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateFilter = (key: keyof FlightFilterState, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const toggleTimeOfDay = (time: string) => {
    const currentTimes = filters.timeOfDay;
    let newTimes: string[];
    
    if (currentTimes.includes(time)) {
      // Remove the time
      newTimes = currentTimes.filter(t => t !== time);
      
      // If removing would leave us with no times, activate all
      if (newTimes.length === 0) {
        newTimes = ['morning', 'afternoon', 'night'];
      }
    } else {
      // Add the time
      newTimes = [...currentTimes, time];
      
      // If we now have all 3, this represents "all active"
      if (newTimes.length === 3) {
        newTimes = ['morning', 'afternoon', 'night'];
      }
    }
    
    updateFilter('timeOfDay', newTimes);
  };
  
  const isTimeActive = (time: string) => {
    return filters.timeOfDay.includes(time);
  };

  const clearFilters = () => {
    onFiltersChange({
      nonstopOnly: true,
      businessOnly: false,
      searchQuery: '',
      timeOfDay: ['morning', 'afternoon', 'night'],
      sortBy: 'price',
      sortOrder: 'asc'
    });
  };

  return (
    <div className="lg:sticky lg:top-0 bg-gray-900 border-b border-gray-800 z-40">
      <div className="px-4 lg:px-6 py-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="h-5 w-5 text-accent-400" />
            <h3 className="text-base lg:text-lg font-semibold text-white">Filter & Sort</h3>
            <span className="text-xs lg:text-sm text-gray-400">
              {resultCount} flight{resultCount !== 1 ? 's' : ''} found
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                showAdvanced
                  ? 'bg-accent-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:text-white'
              }`}
            >
              Advanced
            </button>
            <button
              onClick={clearFilters}
              className="text-sm text-accent-400 hover:text-accent-300 transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Quick Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-2 lg:gap-4">
            {/* Quick Filter Checkboxes */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.nonstopOnly}
                onChange={(e) => updateFilter('nonstopOnly', e.target.checked)}
                className="bg-gray-800 border border-gray-700 rounded text-accent-500 focus:ring-accent-500 focus:ring-2"
              />
              <span className="text-sm text-gray-300">Nonstop Only</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.businessOnly}
                onChange={(e) => updateFilter('businessOnly', e.target.checked)}
                className="bg-gray-800 border border-gray-700 rounded text-accent-500 focus:ring-accent-500 focus:ring-2"
              />
              <span className="text-sm text-gray-300">Business+ Only</span>
            </label>

            {/* Time of Day Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-sm font-medium text-gray-300">Time:</span>
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => toggleTimeOfDay('morning')}
                  className={`px-2 lg:px-3 py-1 rounded text-xs lg:text-sm font-medium transition-colors ${
                    isTimeActive('morning')
                      ? 'bg-accent-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  Morning
                </button>
                <button
                  onClick={() => toggleTimeOfDay('afternoon')}
                  className={`px-2 lg:px-3 py-1 rounded text-xs lg:text-sm font-medium transition-colors ${
                    isTimeActive('afternoon')
                      ? 'bg-accent-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  Afternoon
                </button>
                <button
                  onClick={() => toggleTimeOfDay('night')}
                  className={`px-2 lg:px-3 py-1 rounded text-xs lg:text-sm font-medium transition-colors ${
                    isTimeActive('night')
                      ? 'bg-accent-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  Night
                </button>
              </div>
            </div>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2 lg:gap-4 justify-end">
            <span className="text-sm font-medium text-gray-300">Sort by:</span>
            
            <div className="flex items-center gap-1 lg:gap-2">
              <select
                value={filters.sortBy}
                onChange={(e) => updateFilter('sortBy', e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 lg:px-3 py-1 lg:py-2 text-gray-100 focus:border-accent-500 text-xs lg:text-sm"
              >
                <option value="price">Price</option>
                <option value="duration">Duration</option>
              </select>
              
              <button
                onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1.5 lg:p-2 bg-gray-800 border border-gray-700 rounded hover:border-gray-600 transition-colors"
                title={`Sort ${filters.sortOrder === 'asc' ? 'descending' : 'ascending'}`}
              >
                {filters.sortOrder === 'asc' ? 
                  <SortAsc className="h-3 w-3 lg:h-4 lg:w-4 text-gray-400" /> : 
                  <SortDesc className="h-3 w-3 lg:h-4 lg:w-4 text-gray-400" />
                }
              </button>
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="space-y-4 mb-4 p-3 lg:p-4 bg-gray-850 rounded-lg border border-gray-700">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Search Flights
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.searchQuery}
                  onChange={(e) => updateFilter('searchQuery', e.target.value)}
                  placeholder="Airport codes, airlines, flight numbers..."
                  className="w-full pl-8 lg:pl-10 pr-3 lg:pr-4 py-2 bg-gray-800 border border-gray-700 rounded text-sm lg:text-base text-gray-100 placeholder-gray-500 focus:border-accent-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 leading-tight">
                Search by airport codes (including layovers), airline names/codes, or flight numbers
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlightFilters;