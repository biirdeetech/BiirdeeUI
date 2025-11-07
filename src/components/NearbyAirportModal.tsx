import React, { useState, useEffect } from 'react';
import { X, Loader2, MapPin } from 'lucide-react';
import ITAMatrixService, { Location } from '../services/itaMatrixApi';

interface NearbyAirportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAirports: (airports: string[]) => void;
  centerAirportCode: string;
  centerAirportName?: string;
}

const NearbyAirportModal: React.FC<NearbyAirportModalProps> = ({
  isOpen,
  onClose,
  onAddAirports,
  centerAirportCode,
  centerAirportName
}) => {
  const [airports, setAirports] = useState<Location[]>([]);
  const [selectedAirports, setSelectedAirports] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && centerAirportCode) {
      fetchNearbyAirports();
    }
  }, [isOpen, centerAirportCode]);

  const fetchNearbyAirports = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await ITAMatrixService.geoSearch({
        center: centerAirportCode,
        radiusMiles: 400,
        pageSize: 50
      });
      setAirports(result.locations || []);
    } catch (err) {
      console.error('Failed to fetch nearby airports:', err);
      setError('Failed to load nearby airports. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAirport = (code: string) => {
    const newSelected = new Set(selectedAirports);
    if (newSelected.has(code)) {
      newSelected.delete(code);
    } else {
      newSelected.add(code);
    }
    setSelectedAirports(newSelected);
  };

  const handleSelectAll = () => {
    const allCodes = new Set(airports.map(a => a.code));
    setSelectedAirports(allCodes);
  };

  const handleDeselectAll = () => {
    setSelectedAirports(new Set());
  };

  const handleAddSelected = () => {
    onAddAirports(Array.from(selectedAirports));
    onClose();
    setSelectedAirports(new Set());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h3 className="text-xl font-semibold text-white">Find Airports Near {centerAirportCode}</h3>
            {centerAirportName && (
              <p className="text-sm text-gray-400 mt-1">{centerAirportName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 text-accent-500 animate-spin" />
              <p className="text-gray-400">Searching for nearby airports...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-400">{error}</p>
              <button
                onClick={fetchNearbyAirports}
                className="mt-4 px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          ) : airports.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No nearby airports found within 400 miles.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {airports.map((airport) => (
                <label
                  key={airport.code}
                  className="flex items-center gap-3 p-3 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-lg cursor-pointer transition-colors group"
                >
                  <input
                    type="checkbox"
                    checked={selectedAirports.has(airport.code)}
                    onChange={() => handleToggleAirport(airport.code)}
                    className="w-4 h-4 text-accent-600 bg-gray-700 border-gray-600 rounded focus:ring-accent-500 focus:ring-2"
                  />
                  <MapPin className="h-4 w-4 text-accent-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {airport.displayName}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {airport.cityName && `${airport.cityName} • `}
                      {airport.type}
                    </div>
                  </div>
                  <div className="text-xs font-mono bg-accent-500/20 text-accent-300 px-2 py-1 rounded">
                    {airport.code}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isLoading && !error && airports.length > 0 && (
          <div className="p-6 border-t border-gray-700 bg-gray-900/50">
            <div className="flex items-center justify-between gap-4">
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-accent-400 hover:text-accent-300 transition-colors"
                >
                  Select All
                </button>
                <span className="text-gray-600">|</span>
                <button
                  onClick={handleDeselectAll}
                  className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
                >
                  Deselect All
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">
                  {selectedAirports.size} selected
                </span>
                <button
                  onClick={handleAddSelected}
                  disabled={selectedAirports.size === 0}
                  className="px-4 py-2 bg-accent-600 hover:bg-accent-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
                >
                  Add Selected
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NearbyAirportModal;
