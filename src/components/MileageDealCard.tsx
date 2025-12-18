import { Plane, Clock, MapPin, DollarSign, ExternalLink } from 'lucide-react';

interface MileageDealCardProps {
  deal: any;
  formatDuration: (minutes: number) => string;
}

export function MileageDealCard({ deal, formatDuration }: MileageDealCardProps) {
  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all p-4 ${
        deal.matchType === 'full'
          ? 'border-green-500/30 bg-green-500/5'
          : 'border-gray-700 bg-gray-800/30'
      }`}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-accent-500/10 rounded-lg">
              <Plane className="h-5 w-5 text-accent-400" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">{deal.airline}</div>
              <div className="text-xs text-gray-500">Code: {deal.airlineCode}</div>
            </div>
            {deal.matchType === 'full' && (
              <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-medium border border-green-500/30">
                Full Match
              </span>
            )}
            {deal.matchType === 'partial' && (
              <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full font-medium border border-yellow-500/30">
                Partial Match
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-2">
            {deal.cabins.map((cabin: string, i: number) => (
              <span
                key={i}
                className="px-3 py-1 bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg"
              >
                {cabin}
              </span>
            ))}
          </div>

          <div className="text-sm text-gray-400">
            <span className="text-gray-500">Flight: </span>
            <span className="text-white font-medium">{deal.flightNumber}</span>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="text-2xl font-bold text-accent-400">
            {deal.mileage.toLocaleString()}
          </div>
          <div className="text-sm text-gray-400">miles</div>
          {deal.mileagePrice > 0 && (
            <div className="flex items-center justify-end gap-1 mt-1 text-gray-300">
              <DollarSign className="h-3 w-3" />
              <span className="text-sm">+ ${deal.mileagePrice.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Booking URL Button */}
      {deal.bookingUrl && (
        <div className="mb-3">
          <a
            href={deal.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-600 hover:bg-accent-700 text-white rounded-lg transition-colors font-medium text-sm"
          >
            <span>Book on Airline Website</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      )}

      {/* Flight Timeline - Show stops/segments if available */}
      {deal.segments && deal.segments.length > 0 && (
        <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
          <div className="space-y-2">
            {deal.segments.map((segment: any, segIdx: number) => {
              const nextSegment = deal.segments[segIdx + 1];
              let layoverDuration = 0;

              if (nextSegment) {
                const arrivalTime = segment.arrival?.at || segment.arrival;
                const departureTime = nextSegment.departure?.at || nextSegment.departure;
                if (arrivalTime && departureTime) {
                  const arrTime = new Date(arrivalTime).getTime();
                  const depTime = new Date(departureTime).getTime();
                  layoverDuration = Math.round((depTime - arrTime) / (1000 * 60));
                }
              }

              return (
                <div key={segIdx}>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs font-semibold text-blue-300">{segment.flightNumber}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <span className="font-mono text-white">{segment.origin}</span>
                      <div className="flex-1 flex items-center">
                        <div className="flex-1 border-t border-gray-600"></div>
                        <Plane className="h-3 w-3 text-gray-500 mx-1" />
                        <div className="flex-1 border-t border-gray-600"></div>
                      </div>
                      <span className="font-mono text-white">{segment.destination}</span>
                    </div>
                    {segment.duration && (
                      <span className="text-xs text-gray-500">{formatDuration(segment.duration)}</span>
                    )}
                  </div>

                  {nextSegment && layoverDuration > 0 && (
                    <div className="flex items-center justify-center py-1.5">
                      <div className="bg-orange-500/20 border border-orange-500/30 rounded px-2.5 py-1 text-xs">
                        <span className="text-orange-300 flex items-center gap-1.5">
                          <MapPin className="h-3 w-3" />
                          <span>Layover at {segment.destination}</span>
                          <span className="text-orange-400">•</span>
                          <Clock className="h-3 w-3" />
                          <span>{formatDuration(layoverDuration)}</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {deal.duration && (
            <div className="mt-2 pt-2 border-t border-gray-700/50 text-xs text-gray-400 flex items-center justify-between">
              <span>Total Travel Time:</span>
              <span className="text-white font-medium">{formatDuration(deal.duration)}</span>
            </div>
          )}
        </div>
      )}

      {/* Show stops summary if segments not available but stops are */}
      {(!deal.segments || deal.segments.length === 0) && deal.stops && deal.stops.length > 0 && (
        <div className="text-xs text-gray-400">
          <span className="text-orange-400">{deal.stops.length} stop{deal.stops.length > 1 ? 's' : ''}</span>
          <span className="ml-1">({deal.stops.map((s: any) => s.code).join(', ')})</span>
        </div>
      )}
    </div>
  );
}
