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

        {/* Expand Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg transition-all shadow-lg"
          title={isExpanded ? 'Hide similar flights' : 'Show similar flights'}
        >
          <span className="text-xs font-medium text-gray-300">
            Similar ({similarFlights.length})
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-300" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-300" />
          )}
        </button>
      </div>

      {/* Similar Flights - Expandable */}
      {isExpanded && (
        <div className="ml-4 pl-4 border-l-2 border-gray-800 space-y-2">
          <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">
            Similar Options (sorted by best value)
          </div>
          {similarFlights.map((flight, index) => (
            <div key={'id' in flight ? flight.id : `similar-${index}`}>
              {'id' in flight && flight.slices.length >= 3 ? (
                <MultiLegFlightCard flight={flight} originTimezone={originTimezone} perCentValue={perCentValue} />
              ) : (
                <FlightCard flight={flight} originTimezone={originTimezone} perCentValue={perCentValue} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FlightCardGroup;
