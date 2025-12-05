import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Link } from 'lucide-react';
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
  const [isCodeShareExpanded, setIsCodeShareExpanded] = useState(false);

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

  // Identify code-share flights (same segments/times but different airlines)
  const getCodeShareFlights = () => {
    // Create a fingerprint for the primary flight based on segments (origin, destination, departure, arrival, stops)
    const createSegmentFingerprint = (flight: FlightSolution | GroupedFlight): string => {
      if ('id' in flight) {
        // For FlightSolution
        return flight.slices.map(slice => {
          const origin = slice.origin?.code || '';
          const destination = slice.destination?.code || '';
          const departure = slice.departure || '';
          const arrival = slice.arrival || '';
          const stops = (slice.stops || []).map(s => s.code).join(',');
          return `${origin}|${destination}|${departure}|${arrival}|${stops}`;
        }).join('||');
      } else {
        // For GroupedFlight
        const outbound = flight.outboundSlice;
        const origin = outbound.origin?.code || '';
        const destination = outbound.destination?.code || '';
        const departure = outbound.departure || '';
        const arrival = outbound.arrival || '';
        const stops = (outbound.stops || []).map(s => s.code).join(',');
        return `${origin}|${destination}|${departure}|${arrival}|${stops}`;
      }
    };

    const getAirlineCode = (flight: FlightSolution | GroupedFlight): string => {
      if ('id' in flight) {
        const firstFlight = flight.slices[0]?.flights?.[0] || '';
        return firstFlight.slice(0, 2);
      } else {
        const firstFlight = flight.outboundSlice.flights?.[0] || '';
        return firstFlight.slice(0, 2);
      }
    };

    const primaryFingerprint = createSegmentFingerprint(primaryFlight);
    const primaryAirline = getAirlineCode(primaryFlight);

    // Find flights with same fingerprint but different airline
    return allFlightsInStopGroup.filter(flight => {
      const flightFingerprint = createSegmentFingerprint(flight);
      const flightAirline = getAirlineCode(flight);

      // Same segments but different airline = code-share
      return flightFingerprint === primaryFingerprint && flightAirline !== primaryAirline;
    });
  };

  const codeShareFlights = getCodeShareFlights();

  // Debug: Log code-share detection
  if (codeShareFlights.length > 0) {
    const primaryAirline = 'id' in primaryFlight
      ? primaryFlight.slices[0]?.flights?.[0]?.slice(0, 2)
      : primaryFlight.outboundSlice.flights?.[0]?.slice(0, 2);
    console.log(`🔗 Code-Share: Found ${codeShareFlights.length} code-share options for ${primaryAirline}:`,
      codeShareFlights.map(f => 'id' in f ? f.slices[0]?.flights?.[0]?.slice(0, 2) : f.outboundSlice.flights?.[0]?.slice(0, 2))
    );
  }

  // If no similar flights, just render the primary flight
  if (similarFlights.length === 0) {
    return (
      <>
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
            codeShareFlights={codeShareFlights}
            codeShareFlightsCount={codeShareFlights.length}
            showCodeShareOptions={codeShareFlights.length > 0}
            onToggleCodeShareOptions={() => setIsCodeShareExpanded(!isCodeShareExpanded)}
            isCodeShareOptionsExpanded={isCodeShareExpanded}
          />
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
            codeShareFlights={codeShareFlights}
            codeShareFlightsCount={codeShareFlights.length}
            showCodeShareOptions={codeShareFlights.length > 0}
            onToggleCodeShareOptions={() => setIsCodeShareExpanded(!isCodeShareExpanded)}
            isCodeShareOptionsExpanded={isCodeShareExpanded}
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

      {/* Code-Share Flights - Expandable - Show ALL code-share flights */}
      {isCodeShareExpanded && codeShareFlights.length > 0 && (
        <div className="ml-4 pl-4 border-l-2 border-blue-800/50 space-y-2">
          <div className="text-xs text-blue-400 font-medium mb-2 flex items-center gap-1">
            <Link className="h-3 w-3" />
            Code-Share Options (same flight, different carriers)
          </div>
          {codeShareFlights.map((flight, index) => (
            <div key={'id' in flight ? flight.id : `codeshare-${index}`}>
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
