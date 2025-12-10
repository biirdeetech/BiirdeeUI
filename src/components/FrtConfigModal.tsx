import React, { useState } from 'react';
import { X, Plus, Trash2, Search, MapPin, Target, Sparkles, Info, Settings } from 'lucide-react';
import LocationSearchInputWithCallback from './LocationSearchInputWithCallback';
import NearbyAirportModal from './NearbyAirportModal';
import { getDefaultBookingClasses, bookingClassesToExt } from '../utils/bookingClasses';

interface FrtConfig {
  returnAirports: string[];
  viaAirports: string[];
  cabinClass: string;
  searchRadius: number;
  includeDirect: boolean;
  includeNearby: boolean;
  useManualAirports: boolean;
  maxStops: number;
  bookingClasses: string[];
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
  const [manualReturnAirports, setManualReturnAirports] = useState<string[]>([]);
  const [viaAirports, setViaAirports] = useState<string[]>(defaultConfig?.viaAirports || []);
  const [cabinClass, setCabinClass] = useState<string>(defaultConfig?.cabinClass || 'COACH');
  const [searchRadius, setSearchRadius] = useState<number>(defaultConfig?.searchRadius || 300);
  const [includeDirect, setIncludeDirect] = useState<boolean>(defaultConfig?.includeDirect !== undefined ? defaultConfig.includeDirect : true);
  const [includeNearby, setIncludeNearby] = useState<boolean>(defaultConfig?.includeNearby !== undefined ? defaultConfig.includeNearby : true);
  const [useManualAirports, setUseManualAirports] = useState<boolean>(false);
  const [maxStops, setMaxStops] = useState<number>(defaultConfig?.maxStops ?? -1);
  const [bookingClassSelection, setBookingClassSelection] = useState<string>('all');
  const [bookingClasses, setBookingClasses] = useState<string[]>(
    defaultConfig?.bookingClasses || (() => {
      const allClasses = [
        ...getDefaultBookingClasses('COACH'),
        ...getDefaultBookingClasses('PREMIUM-COACH'),
        ...getDefaultBookingClasses('BUSINESS'),
        ...getDefaultBookingClasses('FIRST')
      ];
      return [...new Set(allClasses)];
    })()
  );
  const [newViaAirport, setNewViaAirport] = useState<{ code: string; name: string } | null>(null);
  const [newReturnAirport, setNewReturnAirport] = useState<{ code: string; name: string } | null>(null);
  const [showNearbyModal, setShowNearbyModal] = useState<boolean>(false);
  const [newBookingClass, setNewBookingClass] = useState<string>('');

  if (!isOpen) return null;

  const handleAddVia = () => {
    if (newViaAirport?.code && !viaAirports.includes(newViaAirport.code)) {
      setViaAirports([...viaAirports, newViaAirport.code]);
      setNewViaAirport(null);
    }
  };

  const handleRemoveVia = (airport: string) => {
    setViaAirports(viaAirports.filter(a => a !== airport));
  };

  const handleAddReturnAirport = () => {
    if (newReturnAirport?.code && !manualReturnAirports.includes(newReturnAirport.code)) {
      setManualReturnAirports([...manualReturnAirports, newReturnAirport.code]);
      setNewReturnAirport(null);
      setUseManualAirports(true);
    }
  };

  const handleRemoveReturnAirport = (airport: string) => {
    const updated = manualReturnAirports.filter(a => a !== airport);
    setManualReturnAirports(updated);
    if (updated.length === 0) {
      setUseManualAirports(false);
    }
  };

  const handleAddNearbyAirports = (airports: string[]) => {
    const uniqueAirports = [...new Set([...manualReturnAirports, ...airports])];
    setManualReturnAirports(uniqueAirports);
    setUseManualAirports(true);
  };

  const handleCabinClassChange = (newCabin: string) => {
    setCabinClass(newCabin);
  };

  const handleBookingClassSelectionChange = (value: string) => {
    setBookingClassSelection(value);
    if (value === 'all') {
      const allClasses = [
        ...getDefaultBookingClasses('COACH'),
        ...getDefaultBookingClasses('PREMIUM-COACH'),
        ...getDefaultBookingClasses('BUSINESS'),
        ...getDefaultBookingClasses('FIRST')
      ];
      setBookingClasses([...new Set(allClasses)]);
    } else if (value === 'economy') {
      setBookingClasses(getDefaultBookingClasses('COACH'));
    } else if (value === 'premium') {
      setBookingClasses(getDefaultBookingClasses('PREMIUM-COACH'));
    } else if (value === 'business') {
      setBookingClasses(getDefaultBookingClasses('BUSINESS'));
    } else if (value === 'first') {
      setBookingClasses(getDefaultBookingClasses('FIRST'));
    } else if (value === 'business_plus') {
      const businessClasses = getDefaultBookingClasses('BUSINESS');
      const firstClasses = getDefaultBookingClasses('FIRST');
      setBookingClasses([...new Set([...businessClasses, ...firstClasses])]);
    }
  };

  const handleAddBookingClass = () => {
    const upperClass = newBookingClass.toUpperCase().trim();
    if (upperClass && !bookingClasses.includes(upperClass) && /^[A-Z]$/.test(upperClass)) {
      setBookingClasses([...bookingClasses, upperClass]);
      setNewBookingClass('');
    }
  };

  const handleRemoveBookingClass = (bookingClass: string) => {
    setBookingClasses(bookingClasses.filter(bc => bc !== bookingClass));
  };

  const handleSearch = () => {
    const finalReturnAirports = useManualAirports && manualReturnAirports.length > 0
      ? manualReturnAirports
      : returnAirports;

    onSearch({
      returnAirports: finalReturnAirports,
      viaAirports,
      cabinClass,
      searchRadius,
      includeDirect,
      includeNearby: useManualAirports ? false : includeNearby,
      useManualAirports,
      maxStops,
      bookingClasses
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border border-gray-700/50 rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="relative p-6 border-b border-gray-700/50 bg-gradient-to-r from-blue-500/10 via-transparent to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-blue-400" />
                Configure Fake Round Trip
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                Search for return flights from <span className="font-mono text-blue-400">{destinationCode}</span> to unlock cheaper options
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-all hover:rotate-90 duration-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Return Airports - Two Modes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Return Destination Options
            </label>

            {/* Toggle between Auto and Manual */}
            <div className="flex gap-2 mb-4 bg-gray-800/50 p-1 rounded-lg">
              <button
                onClick={() => setUseManualAirports(false)}
                className={`flex-1 px-4 py-2 rounded-md font-medium text-sm transition-all ${
                  !useManualAirports
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Auto (Radius)
              </button>
              <button
                onClick={() => setUseManualAirports(true)}
                className={`flex-1 px-4 py-2 rounded-md font-medium text-sm transition-all ${
                  useManualAirports
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Manual Selection
              </button>
            </div>

            {!useManualAirports ? (
              /* Auto Mode - Use radius */
              <div className="space-y-3">
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
              </div>
            ) : (
              /* Manual Mode - Select specific airports */
              <div className="space-y-3">
                {manualReturnAirports.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {manualReturnAirports.map((airport, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm"
                      >
                        <span className="font-mono text-white">{airport}</span>
                        <button
                          onClick={() => handleRemoveReturnAirport(airport)}
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
                      value={newReturnAirport}
                      onChange={(location) => setNewReturnAirport(location)}
                      placeholder="Add return airport..."
                    />
                  </div>
                  <button
                    onClick={handleAddReturnAirport}
                    disabled={!newReturnAirport?.code}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center gap-2 shadow-lg disabled:shadow-none"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                  <button
                    onClick={() => setShowNearbyModal(true)}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white rounded-lg transition-all flex items-center gap-2 shadow-lg"
                    title="Find nearby airports"
                  >
                    <Target className="h-4 w-4" />
                  </button>
                </div>

                <p className="text-xs text-gray-500">
                  Manually select specific airports or use the target button to find nearby airports
                </p>
              </div>
            )}
          </div>

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
              <div className="flex gap-2" onKeyDown={(e) => {
                if (e.key === 'Enter' && newViaAirport?.code) {
                  e.preventDefault();
                  handleAddVia();
                }
              }}>
                <div className="flex-1">
                  <LocationSearchInputWithCallback
                    value={newViaAirport}
                    onChange={(location) => setNewViaAirport(location)}
                    placeholder="Add VIA airport..."
                  />
                </div>
                <button
                  onClick={handleAddVia}
                  disabled={!newViaAirport?.code}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center gap-2 shadow-lg disabled:shadow-none"
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

          {/* Flight Preferences - Cabin Class, Stops, and Booking Classes */}
          <div className="bg-gradient-to-br from-gray-800/50 to-gray-800/30 border border-gray-700/50 rounded-xl p-6 space-y-6">
            <h4 className="text-lg font-semibold text-white flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-400" />
              Flight Preferences
            </h4>

            {/* Cabin Class and Max Stops Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Cabin Class */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Cabin Class</label>
                <select
                  value={cabinClass}
                  onChange={(e) => handleCabinClassChange(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="COACH">Cheapest Available</option>
                  <option value="PREMIUM-COACH">Premium Economy</option>
                  <option value="BUSINESS">Business Class or Higher</option>
                  <option value="FIRST">First Class</option>
                </select>
              </div>

              {/* Max Stops */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Maximum Stops</label>
                <select
                  value={maxStops}
                  onChange={(e) => setMaxStops(parseInt(e.target.value))}
                  className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="-1">Any number of stops</option>
                  <option value="0">Nonstop only</option>
                  <option value="1">1 stop or fewer</option>
                  <option value="2">2 stops or fewer</option>
                  <option value="3">3 stops or fewer</option>
                </select>
              </div>
            </div>

            {/* Booking Class Selection */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-medium text-gray-300">Booking Class Selection</label>
                <div className="relative group">
                  <Info className="h-4 w-4 text-gray-400 hover:text-gray-300 cursor-help" />
                  <div className="absolute left-0 top-6 z-50 w-96 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 text-xs opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    <div className="space-y-3">
                      <div>
                        <p className="font-semibold text-white mb-1">First Class</p>
                        <p className="text-gray-300">Common letters: F, A, P</p>
                      </div>
                      <div>
                        <p className="font-semibold text-white mb-1">Business Class</p>
                        <p className="text-gray-300">Common letters: J, C, D, I, Z</p>
                      </div>
                      <div>
                        <p className="font-semibold text-white mb-1">Premium Economy</p>
                        <p className="text-gray-300">Common letters: W, R, G, P</p>
                      </div>
                      <div>
                        <p className="font-semibold text-white mb-1">Economy Class</p>
                        <p className="text-gray-300">Common letters: Y, B, H, M, K, L, Q, V</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <select
                value={bookingClassSelection}
                onChange={(e) => handleBookingClassSelectionChange(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all mb-3"
              >
                <option value="all">All</option>
                <option value="economy">Economy</option>
                <option value="premium">Premium Economy</option>
                <option value="business">Business</option>
                <option value="first">First</option>
                <option value="business_plus">Business + First</option>
              </select>

              {/* Booking Class Tags */}
              {bookingClasses.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs text-gray-400 mb-2">Active Booking Classes</div>
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                    {bookingClasses.map((bookingClass, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-blue-500/20 to-blue-400/10 text-blue-300 border border-blue-500/30 rounded-md text-sm font-mono whitespace-nowrap hover:from-blue-500/30 hover:to-blue-400/20 transition-all"
                      >
                        {bookingClass}
                        <button
                          onClick={() => handleRemoveBookingClass(bookingClass)}
                          className="text-blue-300 hover:text-blue-100 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Custom Booking Class */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBookingClass}
                  onChange={(e) => setNewBookingClass(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddBookingClass();
                    }
                  }}
                  placeholder="Add custom class (e.g., J, C, D)"
                  maxLength={1}
                  className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm transition-all"
                />
                <button
                  onClick={handleAddBookingClass}
                  disabled={!newBookingClass.trim()}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center gap-2 font-medium shadow-lg disabled:shadow-none"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Auto-populated based on selection. Add or remove specific fare classes.
              </p>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/30 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="bg-blue-500/20 p-2 rounded-lg">
                <MapPin className="h-5 w-5 text-blue-400 flex-shrink-0" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-blue-300 mb-2">How Fake Round Trip Works</p>
                <p className="text-gray-400 leading-relaxed">
                  We search for return flights from <span className="font-mono text-blue-300 font-medium">{destinationCode}</span> back
                  to your selected destinations. The system automatically finds the cheapest combination to show you
                  the best fake round-trip price. You won't actually fly the return leg.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700/50 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-all font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSearch}
            disabled={(!useManualAirports && !includeDirect && !includeNearby) || (useManualAirports && manualReturnAirports.length === 0)}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center gap-2 font-semibold shadow-lg hover:shadow-blue-500/25 disabled:shadow-none"
          >
            <Search className="h-4 w-4" />
            Search FRT Options
          </button>
        </div>
      </div>

      {/* Nearby Airport Modal */}
      {showNearbyModal && (
        <NearbyAirportModal
          isOpen={showNearbyModal}
          onClose={() => setShowNearbyModal(false)}
          onAddAirports={handleAddNearbyAirports}
          centerAirportCode={originCode}
        />
      )}
    </div>
  );
};

export default FrtConfigModal;
