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

  const isDirect = !slice.stops || slice.stops.length === 0;

  const calculateSegmentTimesAndDurations = () => {
    const stops = slice.stops || [];
    const flights = slice.flights || [];
    const numSegments = stops.length + 1;

    const sliceDepartureTime = new Date(slice.departure).getTime();
    const sliceArrivalTime = new Date(slice.arrival).getTime();
    const totalTripTime = sliceArrivalTime - sliceDepartureTime;

    if (slice.mileageBreakdown && slice.mileageBreakdown.length > 0) {
      const totalMileage = slice.mileageBreakdown.reduce((sum, mb) => sum + (mb.mileage || 0), 0);

      const segmentDetails = slice.mileageBreakdown.map((mb, idx) => {
        const proportion = totalMileage > 0 ? (mb.mileage || 0) / totalMileage : 1 / slice.mileageBreakdown.length;
        const estimatedDuration = Math.round(slice.duration * proportion * 0.85);

        return {
          mileage: mb.mileage,
          duration: estimatedDuration,
          proportion
        };
      });

      return segmentDetails;
    }

    const avgLayoverTime = 60;
    const totalLayoverTime = avgLayoverTime * stops.length;
    const totalFlightTime = slice.duration - totalLayoverTime;
    const avgSegmentDuration = Math.round(totalFlightTime / numSegments);

    return Array(numSegments).fill(null).map(() => ({
      mileage: 0,
      duration: avgSegmentDuration,
      proportion: 1 / numSegments
    }));
  };

  const buildEnhancedSegments = () => {
    const stops = slice.stops || [];
    const flights = slice.flights || [];
    const segmentTimes = calculateSegmentTimesAndDurations();
    const enhancedSegments = [];

    let currentTime = new Date(slice.departure).getTime();
    const avgLayoverTime = 60;

    if (isDirect) {
      enhancedSegments.push({
        origin: slice.origin,
        destination: slice.destination,
        departure: slice.departure,
        arrival: slice.arrival,
        duration: slice.duration,
        flightNumber: slice.flights[0],
        carrier: slice.segments[0]?.carrier,
        cabin: slice.cabins[0],
        bookingClass: slice.segments[0]?.pricings?.[0]?.bookingClass,
        fareBasis: slice.segments[0]?.pricings?.[0]?.fareBasis,
        mileage: slice.mileageBreakdown?.[0]?.mileage
      });
    } else {
      for (let i = 0; i < flights.length; i++) {
        const isFirst = i === 0;
        const isLast = i === flights.length - 1;

        const origin = isFirst ? slice.origin : stops[i - 1];
        const destination = isLast ? slice.destination : stops[i];

        const segmentDuration = segmentTimes[i]?.duration || Math.round(slice.duration / flights.length * 0.7);
        const departureTime = new Date(currentTime);
        const arrivalTime = new Date(currentTime + segmentDuration * 60 * 1000);

        enhancedSegments.push({
          origin,
          destination,
          departure: isFirst ? slice.departure : departureTime.toISOString(),
          arrival: isLast ? slice.arrival : arrivalTime.toISOString(),
          duration: segmentDuration,
          flightNumber: flights[i],
          carrier: slice.segments[i]?.carrier,
          cabin: slice.cabins[Math.min(i, slice.cabins.length - 1)],
          bookingClass: slice.segments[i]?.pricings?.[0]?.bookingClass,
          fareBasis: slice.segments[i]?.pricings?.[0]?.fareBasis,
          mileage: slice.mileageBreakdown?.[i]?.mileage,
          isEstimated: !isFirst && !isLast
        });

        currentTime = arrivalTime.getTime() + (isLast ? 0 : avgLayoverTime * 60 * 1000);
      }
    }

    return enhancedSegments;
  };

  const segments = buildEnhancedSegments();

  const calculateLayoverDuration = (segmentIndex: number) => {
    if (segmentIndex >= segments.length - 1) return null;

    const currentSegment = segments[segmentIndex];
    const nextSegment = segments[segmentIndex + 1];

    if (currentSegment.arrival && nextSegment.departure) {
      const arrivalTime = new Date(currentSegment.arrival).getTime();
      const departureTime = new Date(nextSegment.departure).getTime();
      const layoverMinutes = Math.round((departureTime - arrivalTime) / (1000 * 60));
      return layoverMinutes > 0 ? layoverMinutes : null;
    }

    return 60;
  };

  return (
    <div className="bg-gray-800/30 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
        <Plane className="h-4 w-4 text-accent-400" />
        <span>Flight Segments</span>
        {!isDirect && (
          <span className="text-xs text-gray-500 ml-2">
            ({segments.length} segment{segments.length !== 1 ? 's' : ''})
          </span>
        )}
      </div>

      {segments.map((segment: any, idx: number) => (
        <div key={idx}>
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {segment.carrier && (
                <>
                  <img
                    src={`https://www.gstatic.com/flights/airline_logos/35px/${segment.carrier.code}.png`}
                    alt={segment.carrier.shortName}
                    className="h-5 w-5 rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <span className="text-sm font-semibold text-white">
                    {segment.flightNumber || 'N/A'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {segment.carrier.shortName || segment.carrier.name}
                  </span>
                </>
              )}
              {segment.cabin && (
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                  {segment.cabin}
                </span>
              )}
              {segment.bookingClass && (
                <span className="text-xs bg-gray-700 text-accent-400 font-mono font-semibold px-2 py-0.5 rounded">
                  {segment.bookingClass}
                </span>
              )}
              {segment.isEstimated && (
                <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/30">
                  Times Estimated
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm mb-3">
              <div>
                <div className="text-gray-400 text-[10px] mb-1 uppercase tracking-wide">Departure</div>
                <div className="flex items-center gap-1.5 mb-1">
                  <MapPin className="h-3 w-3 text-gray-500" />
                  <span className="font-semibold text-white">{segment.origin.code}</span>
                </div>
                {segment.origin.name && (
                  <div className="text-gray-500 text-[10px] mb-1.5">
                    {segment.origin.name}
                  </div>
                )}
                {segment.departure && (
                  <>
                    <div className="text-white text-sm font-semibold">
                      {formatTime(segment.departure)}
                    </div>
                    <div className="text-gray-400 text-[10px]">
                      {formatDate(segment.departure)}
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-col items-center justify-center">
                <div className="w-full flex items-center">
                  <div className="flex-1 border-t border-gray-600"></div>
                  <Plane className="h-3 w-3 text-gray-400 mx-2" />
                  <div className="flex-1 border-t border-gray-600"></div>
                </div>
                {segment.duration && (
                  <div className="flex items-center gap-1 text-xs text-gray-300 mt-2 font-medium">
                    <Clock className="h-3 w-3" />
                    <span>{formatDuration(segment.duration)}</span>
                  </div>
                )}
                {segment.mileage && (
                  <div className="text-[10px] text-orange-300 mt-1">
                    {segment.mileage.toLocaleString()} mi
                  </div>
                )}
              </div>

              <div className="text-right">
                <div className="text-gray-400 text-[10px] mb-1 uppercase tracking-wide">Arrival</div>
                <div className="flex items-center justify-end gap-1.5 mb-1">
                  <span className="font-semibold text-white">{segment.destination.code}</span>
                  <MapPin className="h-3 w-3 text-gray-500" />
                </div>
                {segment.destination.name && (
                  <div className="text-gray-500 text-[10px] mb-1.5">
                    {segment.destination.name}
                  </div>
                )}
                {segment.arrival && (
                  <>
                    <div className="text-white text-sm font-semibold">
                      {formatTime(segment.arrival)}
                    </div>
                    <div className="text-gray-400 text-[10px]">
                      {formatDate(segment.arrival)}
                    </div>
                  </>
                )}
              </div>
            </div>

            {(segment.fareBasis || (slice.segments[idx] && slice.segments[idx].marketingCarrier)) && (
              <div className="pt-2 border-t border-gray-700/50 space-y-1.5">
                {segment.fareBasis && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400">Fare Basis:</span>
                    <span className="font-mono bg-gray-700 px-2 py-0.5 rounded text-gray-200 font-semibold">
                      {segment.fareBasis}
                    </span>
                  </div>
                )}

                {slice.segments[idx] && slice.segments[idx].marketingCarrier && slice.segments[idx].carrier.code !== slice.segments[idx].marketingCarrier && (
                  <div className="text-xs text-gray-400">
                    <span className="font-medium">Operating:</span> {slice.segments[idx].carrier.name}
                    <span className="ml-2 text-gray-500">(Marketed by {slice.segments[idx].marketingCarrier})</span>
                  </div>
                )}
              </div>
            )}

            {slice.mileageBreakdown && slice.mileageBreakdown[idx] && slice.mileageBreakdown[idx].matched && (
              <div className="mt-2 pt-2 border-t border-gray-700/50">
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center px-2 py-0.5 bg-green-500/20 text-green-400 rounded border border-green-500/30">
                    ✓ Award Available
                  </span>
                  {slice.mileageBreakdown[idx].mileagePrice && (
                    <span className="text-gray-400">
                      {typeof slice.mileageBreakdown[idx].mileagePrice === 'number'
                        ? `$${slice.mileageBreakdown[idx].mileagePrice.toFixed(2)}`
                        : slice.mileageBreakdown[idx].mileagePrice}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {idx < segments.length - 1 && (() => {
            const layoverDuration = calculateLayoverDuration(idx);
            return (
              <div className="flex items-center justify-center py-2">
                <div className="bg-orange-500/20 border border-orange-500/30 rounded px-3 py-1.5 text-xs text-orange-300 font-medium">
                  <Clock className="h-3 w-3 inline mr-1" />
                  Layover at {segment.destination.code}
                  {layoverDuration && ` • ${formatDuration(layoverDuration)}`}
                </div>
              </div>
            );
          })()}
        </div>
      ))}

      <div className="pt-3 border-t border-gray-700/50 flex items-center justify-between text-sm">
        <span className="text-gray-400 font-medium">Total Travel Time:</span>
        <span className="font-semibold text-white">{formatDuration(slice.duration)}</span>
      </div>
    </div>
  );
};

export default FlightSegmentDetails;
