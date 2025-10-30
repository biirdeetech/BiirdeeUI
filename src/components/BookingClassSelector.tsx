import React from 'react';
import { X, Info } from 'lucide-react';

interface BookingClassSelectorProps {
  bookingClasses: string[];
  onAdd: (bookingClass: string) => void;
  onRemove: (bookingClass: string) => void;
  label?: string;
  showTooltip?: boolean;
}

const BookingClassSelector: React.FC<BookingClassSelectorProps> = ({
  bookingClasses,
  onAdd,
  onRemove,
  label = 'Booking Classes',
  showTooltip = true
}) => {
  const [showInfo, setShowInfo] = React.useState(false);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <label className="block text-sm font-medium text-gray-300">{label}</label>
        {showTooltip && (
          <div className="relative">
            <button
              type="button"
              onMouseEnter={() => setShowInfo(true)}
              onMouseLeave={() => setShowInfo(false)}
              className="text-gray-400 hover:text-gray-300"
            >
              <Info className="h-4 w-4" />
            </button>
            {showInfo && (
              <div className="absolute left-0 top-6 z-50 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3 text-xs">
                <div className="space-y-2">
                  <div>
                    <p className="font-semibold text-white">First: F, A, P</p>
                    <p className="text-gray-400">Business: J, C, D, I, Z</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Premium Economy: W, R, G, P</p>
                    <p className="text-gray-400">Economy: Y, B, H, M, K, L, etc.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {bookingClasses.map((bookingClass) => (
            <span
              key={bookingClass}
              className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-sm font-mono"
            >
              {bookingClass}
              <button
                type="button"
                onClick={() => onRemove(bookingClass)}
                className="text-purple-300 hover:text-purple-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          placeholder="Add class (e.g., J, C, D)"
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-accent-500 font-mono text-sm"
          maxLength={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const value = e.currentTarget.value.trim().toUpperCase();
              if (value) {
                onAdd(value);
              }
              e.currentTarget.value = '';
            }
          }}
        />
      </div>
    </div>
  );
};

export default BookingClassSelector;
