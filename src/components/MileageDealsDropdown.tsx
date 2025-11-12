import React, { useState } from 'react';
import { ChevronDown, Plane, AlertTriangle, Info } from 'lucide-react';
import { MileageDeal } from '../types/flight';

interface MileageDealsDropdownProps {
  deals: MileageDeal[];
  onSelectDeal: (deal: MileageDeal) => void;
  flightDeparture?: string; // Expected departure time
}

const MileageDealsDropdown: React.FC<MileageDealsDropdownProps> = ({ deals, onSelectDeal, flightDeparture }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Calculate time difference in hours (placeholder - deals don't have time info yet)
  const getTimeDifferenceStyle = (deal: MileageDeal) => {
    // For now, we'll use mileage as a proxy for time difference
    // This will be updated when we have actual time data
    const timeDiffHours = 0; // Placeholder

    if (timeDiffHours > 2) {
      return {
        opacity: 'opacity-50',
        warning: 'Over 2 hours difference',
        bgColor: 'bg-red-500/10 border-red-500/30',
        icon: <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
      };
    } else if (timeDiffHours > 1) {
      return {
        opacity: 'opacity-75',
        warning: `${timeDiffHours.toFixed(1)} hours difference`,
        bgColor: 'bg-yellow-500/10 border-yellow-500/30',
        icon: <Info className="h-3.5 w-3.5 text-yellow-400" />
      };
    }

    return {
      opacity: 'opacity-100',
      warning: null,
      bgColor: '',
      icon: null
    };
  };

  if (!deals || deals.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
      >
        <Plane className="h-4 w-4" />
        <span>{deals.length} {deals.length === 1 ? 'deal' : 'deals'} found</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden">
            <div className="p-3 bg-gray-900 border-b border-gray-700">
              <h4 className="text-sm font-semibold text-white">Alternative Booking Options</h4>
              <p className="text-xs text-gray-400 mt-1">Click to view details</p>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {deals.map((deal, index) => {
                const timeStyle = getTimeDifferenceStyle(deal);
                return (
                  <button
                    key={index}
                    onClick={() => {
                      onSelectDeal(deal);
                      setIsOpen(false);
                    }}
                    className={`w-full px-4 py-3 hover:bg-gray-700 transition-all text-left border-b border-gray-700 last:border-b-0 ${timeStyle.opacity} ${timeStyle.bgColor}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-medium text-white">
                            Book via {deal.airline}
                          </span>
                          {deal.matchType === 'full' && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full font-medium border border-green-500/30">
                              Full Match
                            </span>
                          )}
                          {deal.matchType === 'partial' && (
                            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full font-medium border border-yellow-500/30">
                              Partial
                            </span>
                          )}
                          {timeStyle.warning && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded text-xs">
                              {timeStyle.icon}
                              <span className={timeStyle.opacity === 'opacity-50' ? 'text-red-400' : 'text-yellow-400'}>
                                {timeStyle.warning}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">
                          {deal.cabins.join(', ')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-accent-400">
                          {deal.mileage.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-400">
                          miles {deal.mileagePrice > 0 && `+ $${deal.mileagePrice.toFixed(2)}`}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MileageDealsDropdown;
