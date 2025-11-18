import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import FlightCard from './FlightCard';
import MultiLegFlightCard from './MultiLegFlightCard';
import { FlightSolution, GroupedFlight } from '../types/flight';

interface FlightCardGroupProps {
  primaryFlight: FlightSolution | GroupedFlight;
  similarFlights: (FlightSolution | GroupedFlight)[];
  originTimezone?: string;
  perCentValue?: number;
}

const FlightCardGroup: React.FC<FlightCardGroupProps> = ({
  primaryFlight,
  similarFlights,
  originTimezone,
  perCentValue = 0.015
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // If no similar flights, just render the primary flight
  if (similarFlights.length === 0) {
    return (
      <>
        {'id' in primaryFlight && primaryFlight.slices.length >= 3 ? (
          <MultiLegFlightCard flight={primaryFlight} originTimezone={originTimezone} perCentValue={perCentValue} />
        ) : (
          <FlightCard flight={primaryFlight} originTimezone={originTimezone} perCentValue={perCentValue} />
        )}
      </>
    );
  }

  return (
    <div className="space-y-2">
      {/* Primary Flight Card */}
      <div className="relative">
        {'id' in primaryFlight && primaryFlight.slices.length >= 3 ? (
          <MultiLegFlightCard flight={primaryFlight} originTimezone={originTimezone} perCentValue={perCentValue} />
        ) : (
          <FlightCard flight={primaryFlight} originTimezone={originTimezone} perCentValue={perCentValue} />
        )}

        {/* Expand Button - More Visible with Route Info */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900/95 to-transparent pt-8 pb-3 px-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-all"
            title={isExpanded ? 'Hide alternative options' : 'Show alternative options'}
          >
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-blue-400">
                {similarFlights.length} Alternative{similarFlights.length !== 1 ? 's' : ''}
              </div>
              <div className="text-xs text-gray-400">
                (different times/prices/airlines)
              </div>
            </div>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-blue-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-blue-400" />
            )}
          </button>
        </div>
      </div>

      {/* Similar Flights - Compact Summary View */}
      {isExpanded && (
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-300 mb-3">
            Alternative Options for Same Route
          </div>
          <div className="space-y-2">
            {similarFlights.map((flight, index) => {
              const isRegularFlight = 'id' in flight;
              const firstSlice = isRegularFlight ? flight.slices[0] : flight.outboundSlice;
              const price = isRegularFlight ? flight.displayTotal : flight.returnOptions[0]?.displayTotal;
              const currency = isRegularFlight ? flight.currency : 'USD';

              // Format departure time
              const depTime = new Date(firstSlice.departure);
              const timeStr = depTime.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                ...(originTimezone && { timeZone: originTimezone })
              });

              // Get airline
              const airline = firstSlice.segments[0]?.carrier.code || 'Unknown';

              return (
                <div
                  key={isRegularFlight ? flight.id : `similar-${index}`}
                  className="flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800/70 border border-gray-700/50 rounded-lg transition-colors cursor-default"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={`https://www.gstatic.com/flights/airline_logos/35px/${airline}.png`}
                      alt={airline}
                      className="h-6 w-6 object-contain"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-white">
                        {firstSlice.flights.join(', ')}
                      </div>
                      <div className="text-xs text-gray-400">
                        Departs: {timeStr}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-green-400">
                      {currency} {price}
                    </div>
                    {isRegularFlight && flight.totalMileage && (
                      <div className="text-xs text-orange-400">
                        {flight.totalMileage.toLocaleString()} mi
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FlightCardGroup;
