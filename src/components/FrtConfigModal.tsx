import React, { useState } from 'react';
import { X, Plus, Trash2, Search, MapPin } from 'lucide-react';
import LocationSearchInputWithCallback from './LocationSearchInputWithCallback';

interface FrtConfig {
  returnAirports: string[];
  viaAirports: string[];
  cabinClass: string;
  searchRadius: number;
  includeDirect: boolean;
  includeNearby: boolean;
}

interface FrtConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (config: FrtConfig) => void;
  originCode: string;
  destinationCode: string;
  defaultConfig?: FrtConfig;
}

const FrtConfigModal: React.FC<FrtConfigModalProps> = ({
  isOpen,
  onClose,
  onSearch,
  originCode,
  destinationCode,
  defaultConfig
}) => {
  const [returnAirports, setReturnAirports] = useState<string[]>(defaultConfig?.returnAirports || [originCode]);
  const [viaAirports, setViaAirports] = useState<string[]>(defaultConfig?.viaAirports || []);
  const [cabinClass, setCabinClass] = useState<string>(defaultConfig?.cabinClass || 'COACH');
  const [searchRadius, setSearchRadius] = useState<number>(defaultConfig?.searchRadius || 300);
  const [includeDirect, setIncludeDirect] = useState<boolean>(defaultConfig?.includeDirect !== undefined ? defaultConfig.includeDirect : true);
  const [includeNearby, setIncludeNearby] = useState<boolean>(defaultConfig?.includeNearby !== undefined ? defaultConfig.includeNearby : true);
  const [newViaAirport, setNewViaAirport] = useState<string>('');

  if (!isOpen) return null;

  const handleAddVia = () => {
    if (newViaAirport && !viaAirports.includes(newViaAirport)) {
      setViaAirports([...viaAirports, newViaAirport]);
      setNewViaAirport('');
    }
  };

  const handleRemoveVia = (airport: string) => {
    setViaAirports(viaAirports.filter(a => a !== airport));
  };

  const handleSearch = () => {
    onSearch({
      returnAirports,
      viaAirports,
      cabinClass,
      searchRadius,
      includeDirect,
      includeNearby
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-900 z-10">
          <div>
            <h3 className="text-xl font-semibold text-white">Configure Fake Round Trip</h3>
            <p className="text-sm text-gray-400 mt-1">
              Search for return flights from {destinationCode} to find cheaper round-trip options
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Return Airports */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Return Destination Options
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDirect}
                  onChange={(e) => setIncludeDirect(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-300">
                  Direct return to <span className="font-mono text-blue-400">{originCode}</span>
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeNearby}
                  onChange={(e) => setIncludeNearby(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-300">
                  Nearby airports within {searchRadius}mi of <span className="font-mono text-blue-400">{originCode}</span>
                </span>
              </label>
            </div>
          </div>

          {/* Search Radius */}
          {includeNearby && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Search Radius (miles)
              </label>
              <input
                type="number"
                value={searchRadius}
                onChange={(e) => setSearchRadius(parseInt(e.target.value) || 300)}
                min="50"
                max="500"
                step="50"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Larger radius finds more options but may increase search time
              </p>
            </div>
          )}

          {/* VIA Airports */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              VIA Airports (Optional)
            </label>
            <div className="space-y-3">
              {viaAirports.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {viaAirports.map((airport, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm"
                    >
                      <span className="font-mono text-white">{airport}</span>
                      <button
                        onClick={() => handleRemoveVia(airport)}
                        className="text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <div className="flex-1">
                  <LocationSearchInputWithCallback
                    value={newViaAirport}
                    onSelect={(code) => setNewViaAirport(code)}
                    placeholder="Add VIA airport..."
                  />
                </div>
                <button
                  onClick={handleAddVia}
                  disabled={!newViaAirport}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Add airports you want the return flight to route through
              </p>
            </div>
          </div>

          {/* Cabin Class */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Return Flight Cabin Class
            </label>
            <select
              value={cabinClass}
              onChange={(e) => setCabinClass(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="COACH">Economy (Cheapest)</option>
              <option value="PREMIUM_ECONOMY">Premium Economy</option>
              <option value="BUSINESS">Business</option>
              <option value="FIRST">First</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Select cheapest cabin for best FRT deals
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-300">
                <p className="font-medium text-blue-400 mb-1">How FRT Works</p>
                <p className="text-gray-400">
                  We'll search for return flights from <span className="font-mono text-white">{destinationCode}</span> back
                  to your selected destinations. The system will automatically pick the cheapest combination to show you
                  the best fake round-trip price. You won't actually fly the return leg.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700 bg-gray-900 sticky bottom-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSearch}
            disabled={!includeDirect && !includeNearby}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
          >
            <Search className="h-4 w-4" />
            Search FRT Options
          </button>
        </div>
      </div>
    </div>
  );
};

export default FrtConfigModal;
