import React from 'react';
import { AlertCircle, Check, X, Plane, Clock } from 'lucide-react';

interface SegmentInfo {
  origin: string;
  destination: string;
  flightNumber?: string;
  carrier: string;
  mileage: number;
  price: string | number;
  matched: boolean;
  departure?: string;
  arrival?: string;
  cabin?: string;
  aircraft?: string;
  date?: string;
}

interface MileageSegmentTooltipProps {
  segments: SegmentInfo[];
  totalMileage: number;
  totalPrice: number;
  hasIncompleteSegments: boolean;
}

const MileageSegmentTooltip: React.FC<MileageSegmentTooltipProps> = ({
  segments,
  totalMileage,
  totalPrice,
  hasIncompleteSegments
}) => {
  const formatPrice = (price: string | number) => {
    if (typeof price === 'string') {
      return price;
    }
    return `$${price.toFixed(2)}`;
  };

  const formatTime = (dateTimeStr?: string) => {
    if (!dateTimeStr) return '';
    try {
      const date = new Date(dateTimeStr);
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } catch {
      return '';
    }
  };

  const formatDate = (dateTimeStr?: string) => {
    if (!dateTimeStr) return '';
    try {
      const date = new Date(dateTimeStr);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric'
      });
    } catch {
      return '';
    }
  };

  const formatCabin = (cabin?: string) => {
    if (!cabin) return '';
    const cabinMap: Record<string, string> = {
      'COACH': 'Economy',
      'PREMIUM_COACH': 'Premium Econ',
      'BUSINESS': 'Business',
      'FIRST': 'First'
    };
    return cabinMap[cabin] || cabin;
  };

  return (
    <div className="w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-3 text-xs">
      <div className="font-semibold text-white mb-2 flex items-center justify-between">
        <span>Mileage Breakdown</span>
        {hasIncompleteSegments && (
          <div className="flex items-center gap-1 text-yellow-400">
            <AlertCircle className="w-3 h-3" />
            <span className="text-[10px]">Incomplete</span>
          </div>
        )}
      </div>

      <div className="space-y-2 mb-2">
        {segments.map((segment, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-2 p-2 rounded ${
              segment.matched ? 'bg-green-900/20 border border-green-700/30' : 'bg-red-900/20 border border-red-700/30'
            }`}
          >
            <div className="mt-0.5">
              {segment.matched ? (
                <Check className="w-3 h-3 text-green-400" />
              ) : (
                <X className="w-3 h-3 text-red-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {/* Route */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-white font-semibold truncate">
                  {segment.origin} → {segment.destination}
                </span>
                <span className="text-purple-300 font-semibold whitespace-nowrap">
                  {segment.mileage.toLocaleString()} mi
                </span>
              </div>

              {/* Flight & Date */}
              {segment.matched && (
                <>
                  <div className="flex items-center gap-2 text-gray-300 mb-0.5">
                    <Plane className="w-3 h-3" />
                    <span>
                      {segment.carrier} {segment.flightNumber}
                      {segment.aircraft && <span className="text-gray-500 ml-1">({segment.aircraft})</span>}
                    </span>
                  </div>

                  {/* Times */}
                  {segment.departure && segment.arrival && (
                    <div className="flex items-center gap-2 text-gray-400 mb-0.5">
                      <Clock className="w-3 h-3" />
                      <span>
                        {formatTime(segment.departure)} - {formatTime(segment.arrival)}
                        {segment.date && <span className="ml-1 text-gray-500">• {segment.date}</span>}
                      </span>
                    </div>
                  )}

                  {/* Cabin */}
                  {segment.cabin && (
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded text-gray-300">
                        {formatCabin(segment.cabin)}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Price */}
              <div className="text-gray-400 font-medium">
                {formatPrice(segment.price)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-700 pt-2 space-y-1">
        <div className="flex justify-between text-gray-300">
          <span>Total Mileage:</span>
          <span className="font-semibold">{totalMileage.toLocaleString()} mi</span>
        </div>
        <div className="flex justify-between text-white font-semibold">
          <span>Total Price:</span>
          <span>${totalPrice.toFixed(2)}</span>
        </div>
      </div>

      {hasIncompleteSegments && (
        <div className="mt-2 pt-2 border-t border-gray-700 text-[10px] text-yellow-300">
          <AlertCircle className="w-3 h-3 inline mr-1" />
          Some segments are missing. Use cash + miles combination.
        </div>
      )}
    </div>
  );
};

export default MileageSegmentTooltip;

