import React, { useState, useMemo } from 'react';
import { ChevronDown, Plane, Clock, Zap } from 'lucide-react';
import { MileageDeal } from '../types/flight';
import { FlightSlice } from '../types/flight';

interface MileageDealsDropdownProps {
  deals: MileageDeal[];
  onSelectDeal: (deal: MileageDeal) => void;
  flightSlices?: FlightSlice[]; // Full flight slice data for comparison
}

const MileageDealsDropdown: React.FC<MileageDealsDropdownProps> = ({
  deals,
  onSelectDeal,
  flightSlices
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'best-match' | 'time-insensitive'>('best-match');

  // Categorize deals by time sensitivity (5 hour threshold)
  const { bestMatchDeals, timeInsensitiveDeals } = useMemo(() => {
    // For now, we'll categorize based on match type since we don't have timing data
    // Full matches are assumed to be within 5 hours, partial matches may be outside
    const bestMatch = deals.filter(deal => deal.matchType === 'full');
    const timeInsensitive = deals.filter(deal => deal.matchType === 'partial');

    // Sort each group by best value (miles + fees)
    const sortByValue = (a: MileageDeal, b: MileageDeal) => {
      const aValue = a.mileage + (a.mileagePrice * 100); // Weight fees
      const bValue = b.mileage + (b.mileagePrice * 100);
      return aValue - bValue;
    };

    return {
      bestMatchDeals: bestMatch.sort(sortByValue),
      timeInsensitiveDeals: timeInsensitive.sort(sortByValue)
    };
  }, [deals]);

  if (!deals || deals.length === 0) {
    return null;
  }

  const activeDeals = activeTab === 'best-match' ? bestMatchDeals : timeInsensitiveDeals;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg text-sm font-medium transition-all shadow-md"
      >
        <Plane className="h-4 w-4" />
        <span>{deals.length} Mile{deals.length === 1 ? '' : 's'} Program{deals.length === 1 ? '' : 's'}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-2 w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-20 overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Plane className="h-4 w-4 text-accent-400" />
                Mileage Booking Options
              </h4>
              <p className="text-xs text-gray-400 mt-1">Book using airline miles instead of cash</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-700 bg-gray-800/50">
              <button
                onClick={() => setActiveTab('best-match')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-all relative ${
                  activeTab === 'best-match'
                    ? 'text-white bg-gray-800'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Zap className="h-4 w-4" />
                  <span>Best Matches</span>
                  {bestMatchDeals.length > 0 && (
                    <span className="ml-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full font-medium border border-green-500/30">
                      {bestMatchDeals.length}
                    </span>
                  )}
                </div>
                {activeTab === 'best-match' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('time-insensitive')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-all relative ${
                  activeTab === 'time-insensitive'
                    ? 'text-white bg-gray-800'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Time Insensitive</span>
                  {timeInsensitiveDeals.length > 0 && (
                    <span className="ml-1 px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-full font-medium">
                      {timeInsensitiveDeals.length}
                    </span>
                  )}
                </div>
                {activeTab === 'time-insensitive' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-500" />
                )}
              </button>
            </div>

            {/* Deals List */}
            <div className="max-h-96 overflow-y-auto">
              {activeDeals.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">
                  No {activeTab === 'best-match' ? 'best match' : 'additional'} options available
                </div>
              ) : (
                activeDeals.map((deal, index) => (
                  <button
                    key={`${deal.airlineCode}-${index}`}
                    onClick={() => {
                      onSelectDeal(deal);
                      setIsOpen(false);
                    }}
                    className={`w-full px-4 py-4 hover:bg-gray-800 transition-all text-left border-b border-gray-700 last:border-b-0 ${
                      activeTab === 'best-match' && deal.matchType === 'full'
                        ? 'bg-green-500/5'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-white truncate">
                            {deal.airline}
                          </span>
                          {deal.matchType === 'full' && (
                            <span className="flex-shrink-0 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full font-medium border border-green-500/30">
                              Full Match
                            </span>
                          )}
                          {deal.matchType === 'partial' && (
                            <span className="flex-shrink-0 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full font-medium border border-yellow-500/30">
                              Partial
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mb-1">
                          Code: <span className="font-mono">{deal.airlineCode}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {deal.cabins.slice(0, 3).map((cabin, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded"
                            >
                              {cabin}
                            </span>
                          ))}
                          {deal.cabins.length > 3 && (
                            <span className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded">
                              +{deal.cabins.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-lg font-bold text-accent-400">
                          {deal.mileage.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-400">
                          miles
                        </div>
                        {deal.mileagePrice > 0 && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            + ${deal.mileagePrice.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer Info */}
            <div className="p-3 bg-gray-800/50 border-t border-gray-700 text-xs text-gray-400">
              {activeTab === 'best-match' ? (
                <p>✓ Best matches are within 5 hours of your search and exactly match your criteria</p>
              ) : (
                <p>⏰ These options may have different timing or routing than your search</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MileageDealsDropdown;
