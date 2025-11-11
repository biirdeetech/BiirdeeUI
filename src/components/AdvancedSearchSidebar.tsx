import React, { useState, useEffect } from 'react';
import { Settings, MapPin, Plane } from 'lucide-react';
import LocationSearchInput from './LocationSearchInput';
import LocationSearchInputWithCallback from './LocationSearchInputWithCallback';
import CurrencySearchInput from './CurrencySearchInput';
import { Currency } from '../utils/currencies';
import { Location } from '../services/itaMatrixApi';

interface AdvancedSearchSidebarProps {
  searchParams: any;
  onSettingsChange: (settings: any) => void;
}

const AdvancedSearchSidebar: React.FC<AdvancedSearchSidebarProps> = ({
  searchParams,
  onSettingsChange
}) => {
  const [advancedSettings, setAdvancedSettings] = useState({
    frt: {
      destinations: [] as string[],
      throwawayOrigins: [] as string[]
    },
    skiplag: {
      destinations: [] as string[],
      pinnedCity: ''
    },
    pagination: {
      pageSize: 25,
      pageNum: 1
    },
    aero: {
      enabled: false,
      airlines: '',
      strict_airline_match: false,
      time_tolerance: 960,
      strict_leg_match: false,
      summary: false,
      salesCity: null as { code: string; name: string } | null,
      currency: null as Currency | null
    }
  });

  const [newDestination, setNewDestination] = useState('');
  const [newOrigin, setNewOrigin] = useState('');
  const [activeSection, setActiveSection] = useState<'frt' | 'skiplag' | 'aero'>('frt');

  useEffect(() => {
    // Don't trigger on initial mount - only when user makes actual changes
    // This prevents unnecessary API calls when the component first loads
  }, [advancedSettings]);

  const addDestination = (section: 'frt' | 'skiplag') => {
    if (newDestination.trim()) {
      setAdvancedSettings(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          destinations: [...prev[section].destinations, newDestination.trim().toUpperCase()]
        }
      }));
      setNewDestination('');
    }
  };

  const removeDestination = (section: 'frt' | 'skiplag', destination: string) => {
    setAdvancedSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        destinations: prev[section].destinations.filter(d => d !== destination)
      }
    }));
  };

  const addOrigin = () => {
    if (newOrigin.trim()) {
      setAdvancedSettings(prev => ({
        ...prev,
        frt: {
          ...prev.frt,
          throwawayOrigins: [...prev.frt.throwawayOrigins, newOrigin.trim().toUpperCase()]
        }
      }));
      setNewOrigin('');
    }
  };

  const removeOrigin = (origin: string) => {
    setAdvancedSettings(prev => ({
      ...prev,
      frt: {
        ...prev.frt,
        throwawayOrigins: prev.frt.throwawayOrigins.filter(o => o !== origin)
      }
    }));
  };

  const setPinnedCity = (city: string) => {
    setAdvancedSettings(prev => ({
      ...prev,
      skiplag: {
        ...prev.skiplag,
        pinnedCity: city.toUpperCase()
      }
    }));
  };

  return (
    <div className="w-80 bg-gray-900 border-r border-gray-800 p-6 overflow-y-auto">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-5 w-5 text-accent-400" />
        <h2 className="text-xl font-semibold text-white">Advanced Search</h2>
      </div>

      {/* Section Tabs */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <button
          onClick={() => setActiveSection('frt')}
          className={`py-2 px-3 rounded-md text-xs font-medium transition-colors ${
            activeSection === 'frt'
              ? 'bg-success-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          FRT
        </button>
        <button
          onClick={() => setActiveSection('skiplag')}
          className={`py-2 px-3 rounded-md text-xs font-medium transition-colors ${
            activeSection === 'skiplag'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          Skiplag
        </button>
        <button
          onClick={() => setActiveSection('aero')}
          className={`py-2 px-3 rounded-md text-xs font-medium transition-colors ${
            activeSection === 'aero'
              ? 'bg-accent-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          Aero
        </button>
      </div>

      {/* FRT Section */}
      {activeSection === 'frt' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-success-400 mb-3">Fake Round Trip</h3>
            <p className="text-sm text-gray-400 mb-4">
              Search for round-trip tickets but only use the outbound flight. The return flight acts as a "throwaway" to potentially lower the overall price.
            </p>
          </div>

          {/* Throwaway Destinations */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Throwaway Destinations
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newDestination}
                onChange={(e) => setNewDestination(e.target.value)}
                placeholder="e.g., LAX, JFK"
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 placeholder-gray-500 focus:border-success-500"
                maxLength={3}
              />
              <button
                onClick={() => addDestination('frt')}
                className="px-4 py-2 bg-success-600 hover:bg-success-700 text-white rounded font-medium"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {advancedSettings.frt.destinations.map((dest, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-success-500/20 text-success-300 rounded text-sm"
                >
                  <MapPin className="h-3 w-3" />
                  {dest}
                  <button
                    onClick={() => removeDestination('frt', dest)}
                    className="ml-1 text-success-300 hover:text-success-100"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Throwaway Origins */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Alternative Origins
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newOrigin}
                onChange={(e) => setNewOrigin(e.target.value)}
                placeholder="e.g., LAX, JFK"
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 placeholder-gray-500 focus:border-success-500"
                maxLength={3}
              />
              <button
                onClick={addOrigin}
                className="px-4 py-2 bg-success-600 hover:bg-success-700 text-white rounded font-medium"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {advancedSettings.frt.throwawayOrigins.map((origin, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-success-500/20 text-success-300 rounded text-sm"
                >
                  <Plane className="h-3 w-3" />
                  {origin}
                  <button
                    onClick={() => removeOrigin(origin)}
                    className="ml-1 text-success-300 hover:text-success-100"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Skiplag Section */}
      {activeSection === 'skiplag' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-blue-400 mb-3">Skiplag Strategy</h3>
            <p className="text-sm text-gray-400 mb-4">
              Book a flight with a layover in your actual destination, then skip the final leg. Save money by not taking the complete journey.
            </p>
          </div>

          {/* Final Destinations */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Final Destinations (Skip These)
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newDestination}
                onChange={(e) => setNewDestination(e.target.value)}
                placeholder="e.g., LAX, JFK"
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 placeholder-gray-500 focus:border-blue-500"
                maxLength={3}
              />
              <button
                onClick={() => addDestination('skiplag')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {advancedSettings.skiplag.destinations.map((dest, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-sm"
                >
                  <MapPin className="h-3 w-3" />
                  {dest}
                  <button
                    onClick={() => removeDestination('skiplag', dest)}
                    className="ml-1 text-blue-300 hover:text-blue-100"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Pinned City */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Pinned City (Your Real Destination)
            </label>
            <input
              type="text"
              value={advancedSettings.skiplag.pinnedCity}
              onChange={(e) => setPinnedCity(e.target.value)}
              placeholder="e.g., CDG"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 placeholder-gray-500 focus:border-blue-500"
              maxLength={3}
            />
            <p className="text-xs text-gray-500 mt-1">
              The city where you actually want to stop (layover city)
            </p>
          </div>
        </div>
      )}

      {/* Aero & Pagination Section */}
      {activeSection === 'aero' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-accent-400 mb-3">Aero Options</h3>
            <p className="text-sm text-gray-400 mb-4">
              Configure advanced search with Aero providers for more results and streaming support.
            </p>
          </div>

          {/* Enable Aero */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={advancedSettings.aero.enabled}
                onChange={(e) => {
                  setAdvancedSettings(prev => ({
                    ...prev,
                    aero: { ...prev.aero, enabled: e.target.checked }
                  }));
                  onSettingsChange({ ...advancedSettings, aero: { ...advancedSettings.aero, enabled: e.target.checked } });
                }}
                className="w-4 h-4 text-accent-600 bg-gray-700 border-gray-600 rounded focus:ring-accent-500"
              />
              <span className="text-sm font-medium text-gray-300">Enable Aero Search (Streaming)</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              Enables streaming results from multiple providers
            </p>
          </div>

          {/* Airlines */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Airlines (comma-separated)
            </label>
            <input
              type="text"
              value={advancedSettings.aero.airlines}
              onChange={(e) => {
                setAdvancedSettings(prev => ({
                  ...prev,
                  aero: { ...prev.aero, airlines: e.target.value }
                }));
              }}
              onBlur={() => onSettingsChange(advancedSettings)}
              placeholder="e.g., AA,UA,DL"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 placeholder-gray-500 focus:border-accent-500 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Filter by specific airline codes
            </p>
          </div>

          {/* Strict Airline Match */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={advancedSettings.aero.strict_airline_match}
                onChange={(e) => {
                  setAdvancedSettings(prev => ({
                    ...prev,
                    aero: { ...prev.aero, strict_airline_match: e.target.checked }
                  }));
                  onSettingsChange({ ...advancedSettings, aero: { ...advancedSettings.aero, strict_airline_match: e.target.checked } });
                }}
                className="w-4 h-4 text-accent-600 bg-gray-700 border-gray-600 rounded focus:ring-accent-500"
              />
              <span className="text-sm font-medium text-gray-300">Strict Airline Matching</span>
            </label>
          </div>

          {/* Time Tolerance */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Code Share Time Tolerance (minutes)
            </label>
            <input
              type="number"
              value={advancedSettings.aero.time_tolerance}
              onChange={(e) => {
                setAdvancedSettings(prev => ({
                  ...prev,
                  aero: { ...prev.aero, time_tolerance: parseInt(e.target.value) || 960 }
                }));
              }}
              onBlur={() => onSettingsChange(advancedSettings)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 focus:border-accent-500 text-sm"
            />
          </div>

          {/* Strict Leg Match */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={advancedSettings.aero.strict_leg_match}
                onChange={(e) => {
                  setAdvancedSettings(prev => ({
                    ...prev,
                    aero: { ...prev.aero, strict_leg_match: e.target.checked }
                  }));
                  onSettingsChange({ ...advancedSettings, aero: { ...advancedSettings.aero, strict_leg_match: e.target.checked } });
                }}
                className="w-4 h-4 text-accent-600 bg-gray-700 border-gray-600 rounded focus:ring-accent-500"
              />
              <span className="text-sm font-medium text-gray-300">Strict Route Matching</span>
            </label>
          </div>

          {/* Summary */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={advancedSettings.aero.summary}
                onChange={(e) => {
                  setAdvancedSettings(prev => ({
                    ...prev,
                    aero: { ...prev.aero, summary: e.target.checked }
                  }));
                  onSettingsChange({ ...advancedSettings, aero: { ...advancedSettings.aero, summary: e.target.checked } });
                }}
                className="w-4 h-4 text-accent-600 bg-gray-700 border-gray-600 rounded focus:ring-accent-500"
              />
              <span className="text-sm font-medium text-gray-300">Fetch ITA Summary</span>
            </label>
          </div>

          {/* Sales City */}
          <div>
            <LocationSearchInputWithCallback
              value={advancedSettings.aero.salesCity}
              onChange={(location) => {
                setAdvancedSettings(prev => ({
                  ...prev,
                  aero: { ...prev.aero, salesCity: location }
                }));
                onSettingsChange({ ...advancedSettings, aero: { ...advancedSettings.aero, salesCity: location } });
              }}
              locationType="SALES_CITIES"
              label="Sales City"
              placeholder="Search sales city..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Point of sale for pricing (affects currency and taxes)
            </p>
          </div>

          {/* Currency */}
          <div>
            <CurrencySearchInput
              value={advancedSettings.aero.currency}
              onChange={(currency) => {
                setAdvancedSettings(prev => ({
                  ...prev,
                  aero: { ...prev.aero, currency }
                }));
                onSettingsChange({ ...advancedSettings, aero: { ...advancedSettings.aero, currency } });
              }}
              label="Currency"
              placeholder="Search currency..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Display prices in selected currency
            </p>
          </div>

          {/* Pagination */}
          <div className="pt-4 border-t border-gray-800">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Pagination</h4>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Page Size
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={advancedSettings.pagination.pageSize}
                  onChange={(e) => {
                    setAdvancedSettings(prev => ({
                      ...prev,
                      pagination: { ...prev.pagination, pageSize: parseInt(e.target.value) || 25 }
                    }));
                  }}
                  onBlur={() => onSettingsChange(advancedSettings)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 focus:border-accent-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Page Number
                </label>
                <input
                  type="number"
                  min="1"
                  value={advancedSettings.pagination.pageNum}
                  onChange={(e) => {
                    setAdvancedSettings(prev => ({
                      ...prev,
                      pagination: { ...prev.pagination, pageNum: parseInt(e.target.value) || 1 }
                    }));
                  }}
                  onBlur={() => onSettingsChange(advancedSettings)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 focus:border-accent-500 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Current Search Info */}
      {searchParams && (
        <div className="mt-8 pt-6 border-t border-gray-800">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Current Search</h4>
          <div className="space-y-2 text-sm text-gray-400">
            <div><strong>Route:</strong> {searchParams.origin} → {searchParams.destination}</div>
            <div><strong>Date:</strong> {new Date(searchParams.departDate).toLocaleDateString()}</div>
            <div><strong>Cabin:</strong> {searchParams.cabin}</div>
            <div><strong>Passengers:</strong> {searchParams.passengers}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedSearchSidebar;