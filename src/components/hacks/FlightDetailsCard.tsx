import React from 'react';
import { Plane, Clock, Plus } from 'lucide-react';

interface FlightDetailsCardProps {
  origin: string;
  destination: string;
  departDate: string;
  cabin: string;
  flightNumber: string;
  price: string;
  flightDetails: any;
  loading: boolean;
  error: string | null;
  onAddToProposal?: () => void;
}

const FlightDetailsCard: React.FC<FlightDetailsCardProps> = ({
  origin,
  destination,
  departDate,
  cabin,
  flightNumber,
  price,
  flightDetails,
  loading,
  error,
  onAddToProposal
}) => {
  const formatPrice = (priceStr: string) => {
    const numPrice = parseFloat(priceStr.replace(/[^\d.]/g, ''));
    if (isNaN(numPrice)) return priceStr;
    return `$${numPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatTime = (dateTime: string) => {
    if (!dateTime) return 'N/A';
    try {
      // Extract time portion directly from ISO string (e.g., "2025-10-05T14:30:00+03:00")
      const timeMatch = dateTime.match(/T(\d{2}):(\d{2})/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        
        // Convert to 12-hour format
        const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const minutesStr = minutes.toString().padStart(2, '0');
        
        return `${hour12}:${minutesStr} ${ampm}`;
      }
      return 'N/A';
    } catch {
      return 'N/A';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCabinDisplay = (cabin: string) => {
    switch (cabin) {
      case 'COACH': return 'Economy';
      case 'PREMIUM_COACH': return 'Premium Economy';
      case 'BUSINESS': return 'Business';
      case 'FIRST': return 'First Class';
      default: return cabin;
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
        <Plane className="h-5 w-5" />
        Flight Details
      </h2>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <div className="text-sm text-gray-400">Route</div>
          <div className="text-lg font-medium text-white">{origin} → {destination}</div>
        </div>
        <div>
          <div className="text-sm text-gray-400">Date</div>
          <div className="text-lg font-medium text-white">{formatDate(departDate)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-400">Class</div>
          <div className="text-lg font-medium text-white">{getCabinDisplay(cabin)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-400">Flight</div>
          <div className="text-lg font-medium text-white">{flightNumber}</div>
        </div>
      </div>

      {flightDetails && flightDetails.bookingDetails && (
        <div className="space-y-6">
          {/* Flight Times */}
          {flightDetails.bookingDetails.itinerary?.slices?.map((slice: any, index: number) => (
            <div key={index} className="bg-gray-850 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-accent-400">Flight Timing</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-400">Departure</div>
                  <div className="text-xl font-semibold text-white">
                    {formatTime(slice.departure)}
                  </div>
                  <div className="text-sm text-gray-300">{slice.origin?.code} - {formatDate(slice.departure)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Arrival</div>
                  <div className="text-xl font-semibold text-white">
                    {formatTime(slice.arrival)}
                  </div>
                  <div className="text-sm text-gray-300">{slice.destination?.code} - {formatDate(slice.arrival)}</div>
                </div>
              </div>
              
              {/* Flight Segments */}
              {slice.segments?.map((segment: any, segIndex: number) => (
                <div key={segIndex} className="mt-4 pt-4 border-t border-gray-700">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400">Flight</div>
                      <div className="text-white font-medium">
                        {segment.carrier?.code} {segment.flight?.number}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Aircraft</div>
                      <div className="text-white font-medium">
                        {segment.legs?.[0]?.aircraft?.shortName || 'Not specified'}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Class</div>
                      <div className="text-white font-medium">
                        {segment.bookingInfos?.[0]?.bookingCode}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Price Breakdown */}
          <div className="bg-gray-850 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-accent-400 mb-3">Price Breakdown</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-gray-400">Total Price</div>
                <div className="text-2xl font-bold text-white">
                  {formatPrice(flightDetails.bookingDetails.displayTotal)}
                </div>
              </div>
              {flightDetails.bookingDetails.tickets?.[0]?.pricings?.[0]?.ext?.taxTotals && (
                <div>
                  <div className="text-sm text-gray-400 mb-2">Tax Breakdown</div>
                  <div className="space-y-1">
                    {flightDetails.bookingDetails.tickets[0].pricings[0].ext.taxTotals.map((tax: any, index: number) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-gray-300">{tax.code} - {tax.tax.name.length > 30 ? tax.tax.name.substring(0, 30) + '...' : tax.tax.name}</span>
                        <span className="text-white font-medium">{formatPrice(tax.totalDisplayPrice)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-4">
          <div className="text-gray-300">Loading flight details...</div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}
    </div>
  );

  {/* Add to Proposal Button */}
  {onAddToProposal && flightDetails && (
    <div className="mb-4">
      <button
        onClick={onAddToProposal}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Add to Proposal
      </button>
    </div>
  )}
};

export default FlightDetailsCard;