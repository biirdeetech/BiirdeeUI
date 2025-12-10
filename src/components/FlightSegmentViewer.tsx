import React from 'react';
import { Plane, Clock, MapPin } from 'lucide-react';

interface Segment {
  carrierCode?: string;
  number?: string;
  departure?: {
    iataCode?: string;
    at?: string;
  };
  arrival?: {
    iataCode?: string;
    at?: string;
  };
  cabin?: string;
  duration?: string;
}

interface Layover {
  airport?: {
    code?: string;
    iataCode?: string;
  };
  durationMinutes?: number;
}

interface FlightSegmentViewerProps {
  segments: Segment[];
  layovers?: Layover[];
  formatTime: (dateStr: string) => string;
  formatDate: (dateStr: string) => string;
  formatDuration?: (duration: string) => string;
  showCabin?: boolean;
  compact?: boolean;
}

const cabinDisplayMap: Record<string, string> = {
  'COACH': 'Economy',
  'ECONOMY': 'Economy',
  'PREMIUM': 'Premium Economy',
  'PREMIUM_ECONOMY': 'Premium Economy',
  'BUSINESS': 'Business',
  'FIRST': 'First'
};

const FlightSegmentViewer: React.FC<FlightSegmentViewerProps> = ({
  segments,
  layovers = [],
  formatTime,
  formatDate,
  formatDuration,
  showCabin = true,
  compact = false
}) => {
  if (!segments || segments.length === 0) {
    return null;
  }

  const isNonstop = segments.length === 1;

  if (compact) {
    // Ultra compact horizontal layout
    return (
      <div className="py-2">
        <div className="flex items-center gap-2 flex-wrap">
          {segments.map((segment, idx) => {
            const layover = layovers[idx];
            const isLast = idx === segments.length - 1;
            const depTime = segment.departure?.at ? formatTime(segment.departure.at) : '';
            const arrTime = segment.arrival?.at ? formatTime(segment.arrival.at) : '';
            const depAirport = segment.departure?.iataCode || '';
            const arrAirport = segment.arrival?.iataCode || '';
            const carrierCode = segment.carrierCode || '';
            const flightNumber = segment.number || '';
            const cabin = segment.cabin || '';
            const cabinDisplay = cabin ? cabinDisplayMap[cabin.toUpperCase()] || cabin : '';

            let segmentDuration = '';
            if (segment.duration && formatDuration) {
              segmentDuration = formatDuration(segment.duration);
            }

            return (
              <React.Fragment key={idx}>
                <div className="flex items-center gap-1.5 text-xs">
                  {carrierCode && (
                    <img
                      src={`https://www.gstatic.com/flights/airline_logos/35px/${carrierCode}.png`}
                      alt={carrierCode}
                      className="h-4 w-4 object-contain"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <span className="font-semibold text-white">{depTime}</span>
                  <span className="text-gray-400">{depAirport}</span>
                  <Plane className="h-3 w-3 text-gray-500" />
                  {segmentDuration && <span className="text-gray-500">{segmentDuration}</span>}
                  <Plane className="h-3 w-3 text-gray-500" />
                  <span className="font-semibold text-white">{arrTime}</span>
                  <span className="text-gray-400">{arrAirport}</span>
                  {showCabin && cabinDisplay && (
                    <span className={`text-[10px] px-1 py-0.5 rounded ${
                      cabin.toUpperCase() === 'BUSINESS' || cabin.toUpperCase() === 'FIRST'
                        ? 'text-purple-300 bg-purple-500/10'
                        : cabin.toUpperCase() === 'PREMIUM' || cabin.toUpperCase() === 'PREMIUM_ECONOMY'
                        ? 'text-blue-300 bg-blue-500/10'
                        : 'text-gray-300 bg-gray-700/30'
                    }`}>
                      {cabinDisplay}
                    </span>
                  )}
                </div>
                {!isLast && layover && (
                  <span className="text-[10px] text-warning-400">
                    {layover.airport?.code || layover.airport?.iataCode || 'N/A'} 
                    {layover.durationMinutes && ` (${Math.floor(layover.durationMinutes / 60)}h ${layover.durationMinutes % 60}m)`}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  }

  // Calculate total duration including layovers
  const calculateTotalDuration = () => {
    let totalMinutes = 0;

    // Sum up all segment durations
    segments.forEach(segment => {
      if (segment.duration) {
        const match = segment.duration.match(/PT(\d+)H(\d+)M/);
        if (match) {
          const hours = parseInt(match[1] || '0');
          const minutes = parseInt(match[2] || '0');
          totalMinutes += hours * 60 + minutes;
        }
      }
    });

    // Add layover times
    layovers.forEach(layover => {
      if (layover.durationMinutes) {
        totalMinutes += layover.durationMinutes;
      }
    });

    if (totalMinutes === 0) return null;

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  const totalDuration = calculateTotalDuration();

  // Full detailed view
  return (
    <div className="space-y-3">
      {segments.map((segment, idx) => {
        const nextSegment = segments[idx + 1];
        const layover = layovers[idx];
        const isLast = idx === segments.length - 1;

        const depTime = segment.departure?.at ? formatTime(segment.departure.at) : '';
        const depDate = segment.departure?.at ? formatDate(segment.departure.at) : '';
        const arrTime = segment.arrival?.at ? formatTime(segment.arrival.at) : '';
        const arrDate = segment.arrival?.at ? formatDate(segment.arrival.at) : '';
        const depAirport = segment.departure?.iataCode || '';
        const arrAirport = segment.arrival?.iataCode || '';
        const carrierCode = segment.carrierCode || '';
        const flightNumber = segment.number || '';
        const cabin = segment.cabin || '';
        const cabinDisplay = cabin ? cabinDisplayMap[cabin.toUpperCase()] || cabin : '';

        let segmentDuration = '';
        if (segment.duration) {
          if (formatDuration) {
            segmentDuration = formatDuration(segment.duration);
          } else {
            const match = segment.duration.match(/PT(\d+)H(\d+)M/);
            if (match) {
              const hours = parseInt(match[1] || '0');
              const minutes = parseInt(match[2] || '0');
              segmentDuration = `${hours}h ${minutes}m`;
            }
          }
        }

        return (
          <div key={idx} className="relative">
            <div className="bg-gray-800/40 rounded-lg border border-gray-700/50 p-3 hover:bg-gray-800/60 transition-colors">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <img
                    src={`https://www.gstatic.com/flights/airline_logos/35px/${carrierCode}.png`}
                    alt={carrierCode}
                    className="h-6 w-6 object-contain"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-white">
                      {carrierCode}{flightNumber}
                    </span>
                    {showCabin && cabinDisplay && (
                      <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                        cabin.toUpperCase() === 'BUSINESS' || cabin.toUpperCase() === 'FIRST'
                          ? 'text-purple-300 bg-purple-500/10 border border-purple-400/30'
                          : cabin.toUpperCase() === 'PREMIUM' || cabin.toUpperCase() === 'PREMIUM_ECONOMY'
                          ? 'text-blue-300 bg-blue-500/10 border border-blue-400/30'
                          : 'text-gray-300 bg-gray-700/30 border border-gray-600/30'
                      }`}>
                        {cabinDisplay}
                      </span>
                    )}
                    {segmentDuration && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {segmentDuration}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-20">
                        <div className="text-sm font-semibold text-white">{depTime}</div>
                        <div className="text-[10px] text-gray-400">{depDate}</div>
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-blue-400" />
                          <span className="text-sm font-medium text-gray-200">{depAirport}</span>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center">
                          <div className="w-full flex items-center">
                            <div className="flex-1 border-t-2 border-dashed border-gray-600"></div>
                            <Plane className={`h-4 w-4 mx-2 ${isNonstop ? 'text-emerald-400' : 'text-gray-500'}`} />
                            <div className="flex-1 border-t-2 border-dashed border-gray-600"></div>
                          </div>
                          {segmentDuration && (
                            <div className="text-[10px] text-gray-500 mt-1">{segmentDuration}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-green-400" />
                          <span className="text-sm font-medium text-gray-200">{arrAirport}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 w-20 text-right">
                        <div className="text-sm font-semibold text-white">{arrTime}</div>
                        <div className="text-[10px] text-gray-400">{arrDate}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {!isLast && layover && (
              <div className="flex items-center justify-center py-2">
                <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg px-3 py-1.5 text-xs text-orange-300 font-medium flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span>Layover at {layover.airport?.code || layover.airport?.iataCode || 'N/A'}</span>
                  {layover.durationMinutes && (
                    <span className="font-bold">
                      • {Math.floor(layover.durationMinutes / 60)}h {layover.durationMinutes % 60}m
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Total Duration Summary */}
      {totalDuration && segments.length > 1 && (
        <div className="pt-3 border-t border-gray-700/50 flex items-center justify-between text-sm">
          <span className="text-gray-400 font-medium">Total Travel Time:</span>
          <span className="font-semibold text-white">{totalDuration}</span>
        </div>
      )}
    </div>
  );
};

export default FlightSegmentViewer;

