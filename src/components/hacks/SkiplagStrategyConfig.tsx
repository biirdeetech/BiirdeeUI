import React from 'react';
import { MapPin, X } from 'lucide-react';
import BookingClassSelector from '../BookingClassSelector';

interface SkiplagStrategyConfigProps {
  selectedFinalCities: string[];
  setSelectedFinalCities: (cities: string[]) => void;
  outboundBookingClasses: string[];
  addOutboundBookingClass: (bookingClass: string) => void;
  removeOutboundBookingClass: (bookingClass: string) => void;
}

const SkiplagStrategyConfig: React.FC<SkiplagStrategyConfigProps> = ({
  selectedFinalCities,
  setSelectedFinalCities,
  outboundBookingClasses,
  addOutboundBookingClass,
  removeOutboundBookingClass
}) => {
  const addFinalCity = (city: string) => {
    if (city && city.trim() && !selectedFinalCities.includes(city.trim().toUpperCase())) {
      setSelectedFinalCities([...selectedFinalCities, city.trim().toUpperCase()]);
    }
  };

  const removeFinalCity = (city: string) => {
    setSelectedFinalCities(selectedFinalCities.filter(c => c !== city));
  };

  return (
    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mt-3">
      <div className="space-y-3">
        <h3 className="text-blue-400 font-semibold mb-3">Skiplag Strategy</h3>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Final Cities to Search</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedFinalCities.map((city) => (
              <span key={city} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-sm">
                <MapPin className="h-3 w-3" />
                {city}
                <button
                  onClick={() => removeFinalCity(city)}
                  className="ml-1 text-blue-300 hover:text-blue-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            placeholder="Add city (e.g. LHR)"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 placeholder-gray-500 text-sm"
            maxLength={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addFinalCity(e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
        </div>

        {/* Booking Classes */}
        <div className="pt-3 border-t border-blue-500/20">
          <BookingClassSelector
            bookingClasses={outboundBookingClasses}
            onAdd={addOutboundBookingClass}
            onRemove={removeOutboundBookingClass}
            label="Booking Classes"
          />
        </div>
      </div>
    </div>
  );
};

export default SkiplagStrategyConfig;