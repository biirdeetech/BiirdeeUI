import React from 'react';
import { MapPin, X } from 'lucide-react';
import BookingClassSelector from '../BookingClassSelector';

interface FrtStrategyConfigProps {
  frtDates: {
    outbound: string;
    return: string;
    flexibility: number;
  };
  setFrtDates: (dates: any) => void;
  frtReturnOrigins: string[];
  addFrtReturnOrigin: (city: string) => void;
  removeFrtReturnOrigin: (city: string) => void;
  frtReturnDestinations: string[];
  addFrtReturnDestination: (city: string) => void;
  removeFrtReturnDestination: (city: string) => void;
  frtReturnLeg: {
    cabin: string;
  };
  setFrtReturnLeg: (leg: any) => void;
  outboundBookingClasses: string[];
  addOutboundBookingClass: (bookingClass: string) => void;
  removeOutboundBookingClass: (bookingClass: string) => void;
  returnBookingClasses: string[];
  addReturnBookingClass: (bookingClass: string) => void;
  removeReturnBookingClass: (bookingClass: string) => void;
}

const FrtStrategyConfig: React.FC<FrtStrategyConfigProps> = ({
  frtDates,
  setFrtDates,
  frtReturnOrigins,
  addFrtReturnOrigin,
  removeFrtReturnOrigin,
  frtReturnDestinations,
  addFrtReturnDestination,
  removeFrtReturnDestination,
  frtReturnLeg,
  setFrtReturnLeg,
  outboundBookingClasses,
  addOutboundBookingClass,
  removeOutboundBookingClass,
  returnBookingClasses,
  addReturnBookingClass,
  removeReturnBookingClass
}) => {
  return (
    <div className="bg-success-500/10 border border-success-500/20 rounded-lg p-4">
      <div className="space-y-3">
        <h3 className="text-success-400 font-semibold mb-3">Fake Round Trip Strategy</h3>

        {/* Date Configuration */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Return Date</label>
            <input
              type="date"
              value={frtDates.return}
              onChange={(e) => setFrtDates({...frtDates, return: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Return Class</label>
            <select
              value={frtReturnLeg.cabin}
              onChange={(e) => setFrtReturnLeg({...frtReturnLeg, cabin: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100"
            >
              <option value="COACH">Economy</option>
              <option value="PREMIUM_COACH">Premium Economy</option>
              <option value="BUSINESS">Business</option>
              <option value="FIRST">First Class</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Date Flexibility</label>
            <select
              value={frtDates.flexibility}
              onChange={(e) => setFrtDates({...frtDates, flexibility: parseInt(e.target.value)})}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100"
            >
              <option value={2}>±2 Days (1 request)</option>
              <option value={7}>±7 Days (3 requests)</option>
              <option value={12}>±12 Days (5 requests)</option>
            </select>
          </div>
        </div>

        {/* Return Origins and Destinations */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Return Origins</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {frtReturnOrigins.map((city) => (
                <span key={city} className="inline-flex items-center gap-1 px-2 py-1 bg-success-500/20 text-success-300 rounded text-sm">
                  <MapPin className="h-3 w-3" />
                  {city}
                  <button
                    onClick={() => removeFrtReturnOrigin(city)}
                    className="ml-1 text-success-300 hover:text-success-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Add origin (e.g. CDG)"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 placeholder-gray-500 text-sm"
              maxLength={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const value = e.currentTarget.value.trim().toUpperCase();
                  if (value) {
                    addFrtReturnOrigin(value);
                  }
                  e.currentTarget.value = '';
                }
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Return Destinations</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {frtReturnDestinations.map((city) => (
                <span key={city} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-sm">
                  <MapPin className="h-3 w-3" />
                  {city}
                  <button
                    onClick={() => removeFrtReturnDestination(city)}
                    className="ml-1 text-blue-300 hover:text-blue-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Add destination (e.g. SFO)"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 placeholder-gray-500 text-sm"
              maxLength={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const value = e.currentTarget.value.trim().toUpperCase();
                  if (value) {
                    addFrtReturnDestination(value);
                  }
                  e.currentTarget.value = '';
                }
              }}
            />
          </div>
        </div>

        {/* Booking Classes */}
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-success-500/20">
          <BookingClassSelector
            bookingClasses={outboundBookingClasses}
            onAdd={addOutboundBookingClass}
            onRemove={removeOutboundBookingClass}
            label="Outbound Booking Classes"
          />
          <BookingClassSelector
            bookingClasses={returnBookingClasses}
            onAdd={addReturnBookingClass}
            onRemove={removeReturnBookingClass}
            label="Return Booking Classes"
          />
        </div>
      </div>
    </div>
  );
};

export default FrtStrategyConfig;