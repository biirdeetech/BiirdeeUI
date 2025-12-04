import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import FlightCard from './FlightCard';
import MultiLegFlightCard from './MultiLegFlightCard';
import { FlightSolution, GroupedFlight } from '../types/flight';

interface FlightCardGroupProps {
  primaryFlight: FlightSolution | GroupedFlight;
  similarFlights: (FlightSolution | GroupedFlight)[];
  allFlightsInStopGroup?: (FlightSolution | GroupedFlight)[]; // All flights in the same stop group for time option calculation
  originTimezone?: string;
  perCentValue?: number;
  session?: string;
  solutionSet?: string;
  v2EnrichmentData?: Map<string, any[]>;
  onEnrichFlight?: (flight: any, carrierCode: string) => Promise<any>;
  enrichingAirlines?: Set<string>;
}

const FlightCardGroup: React.FC<FlightCardGroupProps> = ({
  primaryFlight,
  similarFlights,
  allFlightsInStopGroup = [],
  originTimezone,
  perCentValue = 0.015,
  session,
  solutionSet,
  v2EnrichmentData = new Map(),
  onEnrichFlight,
  enrichingAirlines = new Set()
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // All flights should be passed to FlightCard for price and time options
  // Use allFlightsInStopGroup if available (for time options across groups), otherwise just similarFlights
  const allFlightsForOptions = allFlightsInStopGroup.length > 0 
    ? allFlightsInStopGroup.filter(f => {
        // Exclude the current primary flight from the options list
        const primaryId = 'id' in primaryFlight ? primaryFlight.id : null;
        const flightId = 'id' in f ? f.id : null;
        return primaryId !== flightId;
      })
    : [...similarFlights];

  // If no similar flights, just render the primary flight
  if (similarFlights.length === 0) {
    return (
      <>
        {'id' in primaryFlight && primaryFlight.slices.length >= 3 ? (
          <MultiLegFlightCard flight={primaryFlight} originTimezone={originTimezone} perCentValue={perCentValue} session={session} solutionSet={solutionSet} v2EnrichmentData={v2EnrichmentData} onEnrichFlight={onEnrichFlight} enrichingAirlines={enrichingAirlines} />
        ) : (
          <FlightCard flight={primaryFlight} originTimezone={originTimezone} perCentValue={perCentValue} session={session} solutionSet={solutionSet} v2EnrichmentData={v2EnrichmentData} onEnrichFlight={onEnrichFlight} enrichingAirlines={enrichingAirlines} similarFlights={allFlightsForOptions} similarFlightsCount={similarFlights.length} />
        )}
      </>
    );
  }

  return (
    <div className="space-y-2">
      {/* Primary Flight Card */}
        {'id' in primaryFlight && primaryFlight.slices.length >= 3 ? (
          <MultiLegFlightCard flight={primaryFlight} originTimezone={originTimezone} perCentValue={perCentValue} session={session} solutionSet={solutionSet} v2EnrichmentData={v2EnrichmentData} onEnrichFlight={onEnrichFlight} enrichingAirlines={enrichingAirlines} />
        ) : (
          <FlightCard 
            flight={primaryFlight} 
            originTimezone={originTimezone} 
            perCentValue={perCentValue} 
            session={session} 
            solutionSet={solutionSet} 
            v2EnrichmentData={v2EnrichmentData} 
            onEnrichFlight={onEnrichFlight} 
            enrichingAirlines={enrichingAirlines} 
            similarFlights={allFlightsForOptions} 
            similarFlightsCount={similarFlights.length}
            showSimilarOptions={similarFlights.length > 0}
            onToggleSimilarOptions={() => setIsExpanded(!isExpanded)}
            isSimilarOptionsExpanded={isExpanded}
          />
        )}

      {/* Similar Flights - Expandable - Show ALL similar flights */}
      {isExpanded && similarFlights.length > 0 && (
        <div className="ml-4 pl-4 border-l-2 border-gray-800/50 space-y-2">
          {similarFlights.map((flight, index) => (
            <div key={'id' in flight ? flight.id : `similar-${index}`}>
              {'id' in flight && flight.slices.length >= 3 ? (
                <MultiLegFlightCard flight={flight} originTimezone={originTimezone} perCentValue={perCentValue} session={session} solutionSet={solutionSet} v2EnrichmentData={v2EnrichmentData} onEnrichFlight={onEnrichFlight} enrichingAirlines={enrichingAirlines} />
              ) : (
                <FlightCard flight={flight} originTimezone={originTimezone} perCentValue={perCentValue} session={session} solutionSet={solutionSet} v2EnrichmentData={v2EnrichmentData} onEnrichFlight={onEnrichFlight} enrichingAirlines={enrichingAirlines} similarFlights={[...allFlightsForOptions, primaryFlight].filter(f => ('id' in f && 'id' in flight ? f.id !== flight.id : true))} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FlightCardGroup;
