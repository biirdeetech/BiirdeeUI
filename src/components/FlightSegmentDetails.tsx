import React from 'react';
import { Plane, Clock, MapPin } from 'lucide-react';
import { FlightSlice } from '../types/flight';

interface FlightSegmentDetailsProps {
  slice: FlightSlice;
  originTimezone?: string;
}

const FlightSegmentDetails: React.FC<FlightSegmentDetailsProps> = ({ slice, originTimezone }) => {
  const formatTime = (dateTime: string) => {
    if (!dateTime) return 'N/A';
    try {
      const date = new Date(dateTime);
      const options: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        ...(originTimezone && { timeZone: originTimezone })
      };
      return date.toLocaleTimeString('en-US', options);
    } catch {
      return dateTime;
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDate = (dateTime: string) => {
    if (!dateTime) return '';
    try {
      const date = new Date(dateTime);
      const options: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
        ...(originTimezone && { timeZone: originTimezone })
      };
      return date.toLocaleDateString('en-US', options);
    } catch {
      return '';
    }
  };

  // If no stops, it's a direct flight
  const isDirect = !slice.stops || slice.stops.length === 0;

  // Build segment array from available data
  const segments = [];

  if (isDirect) {
    // Single segment for direct flight
    segments.push({
      origin: slice.origin,
      destination: slice.destination,
      departure: slice.departure,
      arrival: slice.arrival,
      duration: slice.duration,
      flightNumber: slice.flights[0],
      carrier: slice.segments[0]?.carrier,
      cabin: slice.cabins[0],
      bookingClass: slice.segments[0]?.pricings?.[0]?.bookingClass
    });
  } else {
    // Multiple segments with layovers
    const stops = slice.stops || [];
    const flights = slice.flights || [];

    // First segment
    segments.push({
      origin: slice.origin,
      destination: stops[0],
      departure: slice.departure,
      arrival: null, // We don't have individual segment times from the API
      duration: null,
      flightNumber: flights[0],
      carrier: slice.segments[0]?.carrier,
      cabin: slice.cabins[0],
      bookingClass: slice.segments[0]?.pricings?.[0]?.bookingClass
    });

    // Middle segments
    for (let i = 0; i < stops.length - 1; i++) {
      segments.push({
        origin: stops[i],
        destination: stops[i + 1],
        departure: null,
        arrival: null,
        duration: null,
        flightNumber: flights[i + 1],
        carrier: slice.segments[i + 1]?.carrier,
        cabin: slice.cabins[Math.min(i + 1, slice.cabins.length - 1)],
        bookingClass: slice.segments[i + 1]?.pricings?.[0]?.bookingClass
      });
    }

    // Last segment
    segments.push({
      origin: stops[stops.length - 1],
      destination: slice.destination,
      departure: null,
      arrival: slice.arrival,
      duration: null,
      flightNumber: flights[stops.length],
      carrier: slice.segments[stops.length]?.carrier,
      cabin: slice.cabins[Math.min(stops.length, slice.cabins.length - 1)],
      bookingClass: slice.segments[stops.length]?.pricings?.[0]?.bookingClass
    });
  }

  // Calculate estimated layover times if we have mileageBreakdown
  const layovers: any[] = [];
  if (slice.stops && slice.stops.length > 0) {
    slice.stops.forEach((stop, idx) => {
      layovers.push({
        airport: stop,
        duration: null // We don't have this from the API, could estimate if needed
      });
    });
  }

  return (
    <div className="bg-gray-800/30 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
        <Plane className="h-4 w-4 text-accent-400" />
        <span>Flight Segments</span>
      </div>

      {segments.map((segment, idx) => (
        <div key={idx}>
          {/* Segment */}
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
            <div className="flex items-start justify-between gap-4">
              {/* Left: Route & Times */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {segment.carrier && (
                    <div className="flex items-center gap-2">
                      <img
                        src={`https://www.gstatic.com/flights/airline_logos/35px/${segment.carrier.code}.png`}
                        alt={segment.carrier.shortName}
                        className="h-5 w-5 rounded"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <span className="text-sm font-medium text-white">
                        {segment.flightNumber || 'N/A'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {segment.carrier.shortName || segment.carrier.name}
                      </span>
                    </div>
                  )}
                  {segment.cabin && (
                    <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                      {segment.cabin}
                    </span>
                  )}
                  {segment.bookingClass && (
                    <span className="text-xs bg-gray-700 text-accent-400 font-mono px-2 py-0.5 rounded">
                      {segment.bookingClass}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  {/* Departure */}
                  <div>
                    <div className="text-gray-400 text-xs mb-1">Departure</div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3 text-gray-500" />
                      <span className="font-medium text-white">{segment.origin.code}</span>
                    </div>
                    {segment.origin.name && (
                      <div className="text-gray-500 text-[10px] mt-0.5">
                        {segment.origin.name}
                      </div>
                    )}
                    {segment.departure && (
                      <div className="text-gray-300 text-xs mt-1">
                        {formatDate(segment.departure)} {formatTime(segment.departure)}
                      </div>
                    )}
                  </div>

                  {/* Arrival */}
                  <div>
                    <div className="text-gray-400 text-xs mb-1">Arrival</div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3 text-gray-500" />
                      <span className="font-medium text-white">{segment.destination.code}</span>
                    </div>
                    {segment.destination.name && (
                      <div className="text-gray-500 text-[10px] mt-0.5">
                        {segment.destination.name}
                      </div>
                    )}
                    {segment.arrival && (
                      <div className="text-gray-300 text-xs mt-1">
                        {formatDate(segment.arrival)} {formatTime(segment.arrival)}
                      </div>
                    )}
                  </div>
                </div>

                {segment.duration && (
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
                    <Clock className="h-3 w-3" />
                    <span>Flight Duration: {formatDuration(segment.duration)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Additional segment details */}
            {slice.segments[idx] && (
              <div className="mt-3 pt-3 border-t border-gray-700/50 space-y-2">
                {/* Fare Basis if available */}
                {slice.segments[idx].pricings && slice.segments[idx].pricings.length > 0 && slice.segments[idx].pricings[0].fareBasis && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400">Fare Basis:</span>
                    <span className="font-mono bg-gray-700 px-2 py-0.5 rounded text-gray-200">
                      {slice.segments[idx].pricings[0].fareBasis}
                    </span>
                  </div>
                )}

                {/* Marketing vs Operating Carrier */}
                {slice.segments[idx].marketingCarrier && slice.segments[idx].carrier.code !== slice.segments[idx].marketingCarrier && (
                  <div className="text-xs text-gray-400">
                    <span className="font-medium">Operating Carrier:</span> {slice.segments[idx].carrier.name}
                    <span className="ml-2 text-gray-500">(Marketed by {slice.segments[idx].marketingCarrier})</span>
                  </div>
                )}
              </div>
            )}

            {/* Mileage breakdown if available */}
            {slice.mileageBreakdown && slice.mileageBreakdown[idx] && (
              <div className="mt-3 pt-3 border-t border-gray-700/50">
                <div className="text-xs text-gray-400 space-y-1">
                  <div>
                    <span className="font-medium">Mileage:</span>{' '}
                    {slice.mileageBreakdown[idx].mileage?.toLocaleString() || 'N/A'} miles
                    {slice.mileageBreakdown[idx].matched && (
                      <span className="ml-2 text-green-400">✓ Matched</span>
                    )}
                  </div>
                  {slice.mileageBreakdown[idx].mileagePrice && (
                    <div>
                      <span className="font-medium">Award Cost:</span>{' '}
                      {typeof slice.mileageBreakdown[idx].mileagePrice === 'number'
                        ? `$${slice.mileageBreakdown[idx].mileagePrice.toFixed(2)}`
                        : slice.mileageBreakdown[idx].mileagePrice}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Layover indicator */}
          {idx < segments.length - 1 && layovers[idx] && (
            <div className="flex items-center justify-center py-2">
              <div className="bg-orange-500/20 border border-orange-500/30 rounded px-3 py-1 text-xs text-orange-300">
                <Clock className="h-3 w-3 inline mr-1" />
                Layover at {layovers[idx].airport.code}
                {layovers[idx].duration && ` • ${formatDuration(layovers[idx].duration)}`}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Total flight time */}
      <div className="pt-3 border-t border-gray-700/50 flex items-center justify-between text-sm">
        <span className="text-gray-400">Total Flight Time:</span>
        <span className="font-medium text-white">{formatDuration(slice.duration)}</span>
      </div>
    </div>
  );
};

export default FlightSegmentDetails;
