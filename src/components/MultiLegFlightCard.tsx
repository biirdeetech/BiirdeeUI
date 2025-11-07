import React from 'react';
import { Plane, Clock, MapPin } from 'lucide-react';
import { FlightSolution } from '../types/flight';
import { PREMIUM_CARRIERS } from '../utils/fareClasses';

interface MultiLegFlightCardProps {
  flight: FlightSolution;
}

const MultiLegFlightCard: React.FC<MultiLegFlightCardProps> = ({ flight }) => {
  const { slices, totalAmount, displayTotal, currency, ext } = flight;
  const firstSlice = slices[0];
  const carrier = firstSlice.segments[0]?.carrier || { code: '', name: '', shortName: '' };
  const isPremium = PREMIUM_CARRIERS.includes(carrier.code);
  const isNonstop = slices.every(slice => !slice.stops || slice.stops.length === 0);

  console.log('🚀 MultiLegFlightCard: Rendering multi-leg flight with', slices.length, 'slices');

  const formatMileagePrice = (price: number | string): string => {
    if (typeof price === 'string') {
      return price;
    }
    return `USD ${price.toFixed(2)}`;
  };

  const countMileagePrograms = (breakdown?: any[]): number => {
    if (!breakdown) return 0;
    const uniqueCarriers = new Set<string>();
    breakdown.forEach(bd => {
      if (bd.allMatchingFlights) {
        bd.allMatchingFlights.forEach((flight: any) => {
          const carrier = flight.operatingCarrier || flight.carrierCode;
          if (carrier) uniqueCarriers.add(carrier);
        });
      }
    });
    return uniqueCarriers.size;
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

  const formatDate = (dateTime: string) => {
    const date = new Date(dateTime);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getDayDifference = (departureDateTime: string, arrivalDateTime: string) => {
    const depDate = new Date(departureDateTime);
    const arrDate = new Date(arrivalDateTime);
    
    // Reset time to compare just dates
    const depDay = new Date(depDate.getFullYear(), depDate.getMonth(), depDate.getDate());
    const arrDay = new Date(arrDate.getFullYear(), arrDate.getMonth(), arrDate.getDate());
    
    const diffTime = arrDay.getTime() - depDay.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const formatPrice = (price: number, currencyCode: string) => {
    // Format number with commas
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);

    // Return with currency code prefix
    return `${currencyCode} ${formatted}`;
  };

  const formatPricePerMile = (pricePerMile: number) => {
    return pricePerMile.toFixed(2);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getTotalDuration = () => {
    return slices.reduce((total, slice) => total + slice.duration, 0);
  };

  return (
    <div className="bg-gray-900 border-2 border-gray-800 rounded-lg hover:border-gray-700 transition-all duration-200 shadow-lg hover:shadow-xl">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {carrier.code && (
              <img
                src={`https://www.gstatic.com/flights/airline_logos/35px/${carrier.code}.png`}
                alt={carrier.code}
                className="h-7 w-7 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              isPremium ? 'bg-accent-600 text-white' : 'bg-gray-600 text-white'
            }`}>
              {carrier.code}
            </div>
            <span className="font-semibold text-white">{carrier.shortName}</span>
            {isNonstop && (
              <div className="px-2 py-1 bg-success-500/20 text-success-400 text-xs font-medium rounded">
                All Nonstop
              </div>
            )}
            {isPremium && (
              <div className="px-2 py-1 bg-accent-500/20 text-accent-400 text-xs font-medium rounded">
                Premium
              </div>
            )}
            <div className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-medium rounded flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Multi-City ({slices.length} flights)
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-medium text-neutral-100">
              {formatPrice(displayTotal, currency || 'USD')}
            </div>
            <div className="text-sm text-gray-300">
              ${formatPricePerMile(ext.pricePerMile)}/mile
            </div>
          </div>
        </div>
      </div>

      {/* Route Overview */}
      <div className="px-6 py-4 border-b border-gray-800 bg-gray-850">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-accent-400">Route:</span>
            <div className="flex items-center gap-2">
              {slices.map((slice, index) => (
                <React.Fragment key={index}>
                  <span className="font-mono text-white">{slice.origin.code}</span>
                  {index < slices.length - 1 && (
                    <span className="text-gray-400">→</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="text-sm text-gray-300">
            <Clock className="h-3 w-3 inline mr-1" />
            Total: {formatDuration(getTotalDuration())}
          </div>
        </div>
      </div>

      {/* Flight Legs */}
      <div className="px-6 py-4">
        <div className="space-y-6">
          {slices.map((slice, sliceIndex) => (
            <div key={sliceIndex} className={sliceIndex > 0 ? 'border-t border-gray-700 pt-6' : ''}>
              {/* Leg Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-accent-600 text-white px-3 py-1 rounded font-medium text-sm">
                  Flight {sliceIndex + 1}
                </div>
                <div className="text-sm text-gray-300">
                  {formatDate(slice.departure)}
                </div>
                <div className="flex-1 border-t border-gray-700"></div>
              </div>
              
              {/* Flight Details */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-6 flex-1">
                  <div className="text-center">
                    <div className="text-xl font-semibold text-white">
                      {formatTime(slice.departure)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatDate(slice.departure)}
                    </div>
                    <div className="text-sm font-medium text-gray-200">{slice.origin.code}</div>
                    <div className="text-xs text-gray-400">{slice.origin.name}</div>
                  </div>
                  
                  <div className="flex-1 px-4">
                    <div className="flex items-center gap-2 text-gray-300">
                      <div className="flex-1 border-t-2 border-gray-600"></div>
                      <Plane className="h-3 w-3" />
                      <div className="flex-1 border-t-2 border-gray-600"></div>
                    </div>
                    <div className="text-center text-sm font-medium text-gray-200 mt-2">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {formatDuration(slice.duration)}
                    </div>
                    {slice.stops && slice.stops.length > 0 && (
                      <div className="text-center text-xs text-gray-400 mt-1">
                        {slice.stops.length === 1 ? '1 stop' : `${slice.stops.length} stops`}: {slice.stops.map(stop => stop.code).join(', ')}
                      </div>
                    )}
                    {slice.flights && slice.flights.length > 1 && (
                      <div className="text-center text-[10px] text-gray-500 mt-0.5">
                        Flights: {slice.flights.join(' → ')}
                      </div>
                    )}
                  </div>
                  
                  <div className="text-center">
                    <div className="text-xl font-semibold text-white">
                      {formatTime(slice.arrival)}
                      {(() => {
                        const dayDiff = getDayDifference(slice.departure, slice.arrival);
                        if (dayDiff > 0) {
                          return <span className="text-xs text-accent-400 ml-1">+{dayDiff}</span>;
                        }
                        return null;
                      })()}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatDate(slice.arrival)}
                    </div>
                    <div className="text-sm font-medium text-gray-200">{slice.destination.code}</div>
                    <div className="text-xs text-gray-400">{slice.destination.name}</div>
                  </div>
                </div>
              </div>

              {/* Slice Details */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-sm text-gray-300 gap-3 sm:gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400 font-medium">Flights:</span>
                    <div className="flex gap-2">
                      {slice.flights.map((flight, idx) => (
                        <span key={idx} className="font-mono bg-gray-700 px-2 py-1 rounded text-white font-medium">
                          {flight}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400 font-medium">Class:</span>
                    <div className="flex gap-1">
                      {slice.cabins.map((cabin, idx) => (
                        <span key={idx} className="bg-accent-500/20 text-accent-300 px-2 py-1 rounded text-sm font-medium">
                          {cabin}
                        </span>
                      ))}
                    </div>
                  </div>
                  {slice.segments && slice.segments.length > 0 && slice.segments[0].pricings && slice.segments[0].pricings.length > 0 && slice.segments[0].pricings[0].bookingClass && (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 font-medium">Booking:</span>
                      <span className="font-mono bg-gray-700 px-2 py-1 rounded text-white font-medium text-sm">
                        {slice.segments[0].pricings[0].bookingClass}
                      </span>
                    </div>
                  )}
                  {slice.mileage && slice.mileage > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400 font-medium">Miles:</span>
                        <span className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded text-sm font-medium">
                          {slice.mileage.toLocaleString()} miles + {formatMileagePrice(slice.mileagePrice || 0)}
                        </span>
                      </div>
                      {(() => {
                        const programCount = countMileagePrograms(slice.mileageBreakdown);
                        return programCount > 0 && (
                          <span className="text-xs text-gray-400 bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700">
                            {programCount} {programCount === 1 ? 'program' : 'programs'} available
                          </span>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MultiLegFlightCard;