import React from 'react';
import { Loader, AlertCircle, Plane } from 'lucide-react';
import FlightCard from './FlightCard';
import MultiLegFlightCard from './MultiLegFlightCard';
import { SearchResponse, FlightSolution, GroupedFlight } from '../types/flight';

interface FlightResultsProps {
  results: SearchResponse | null;
  loading: boolean;
  error: string | null;
  searchParams: any;
  advancedSettings: any;
}

const groupFlightsByOutbound = (flights: FlightSolution[]): (FlightSolution | GroupedFlight)[] => {
  console.log('🔍 FlightResults: Starting grouping with', flights.length, 'flights');
  
  if (flights.length === 0) {
    console.log('⚠️ FlightResults: No flights to group');
    return flights;
  }

  // Log first few flights to understand structure
  console.log('📊 FlightResults: First flight structure:', JSON.stringify(flights[0], null, 2));
  

  const groups = new Map<string, GroupedFlight>();
  const ungroupedFlights: FlightSolution[] = [];

  flights.forEach(flight => {
    console.log('🔄 FlightResults: Processing flight:', flight.id, 'with', flight.slices.length, 'slices');
    
    if (flight.slices.length === 0) {
      console.log('⏭️ FlightResults: Skipping flight with no slices:', flight.id);
      ungroupedFlights.push(flight);
      return;
    }

    const firstSlice = flight.slices[0];
    const groupingKey = `${firstSlice.flights.join(',')}-${firstSlice.departure}-${firstSlice.arrival}`;
    
    console.log('🔑 FlightResults: Grouping key for flight', flight.id, ':', groupingKey);
    console.log('🛫 FlightResults: First slice details:', {
      flights: firstSlice.flights,
      departure: firstSlice.departure,
      arrival: firstSlice.arrival,
      origin: firstSlice.origin.code,
      destination: firstSlice.destination.code
    });

    // Check if we want to group this flight (has common outbound pattern)
    const shouldGroup = flights.filter(f => f.slices.length > 0).some(otherFlight => {
      if (otherFlight.id === flight.id) return false;
      const otherFirstSlice = otherFlight.slices[0];
      const otherGroupingKey = `${otherFirstSlice.flights.join(',')}-${otherFirstSlice.departure}-${otherFirstSlice.arrival}`;
      return otherGroupingKey === groupingKey;
    });

    if (!shouldGroup) {
      console.log('⏭️ FlightResults: No grouping needed for flight:', flight.id);
      ungroupedFlights.push(flight);
      return;
    }

    if (!groups.has(groupingKey)) {
      console.log('🆕 FlightResults: Creating new group for:', groupingKey);
      
      // Try to get carrier from multiple sources
      let carrier = { code: '', name: '', shortName: 'Unknown' };
      
      if (firstSlice.segments && firstSlice.segments[0] && firstSlice.segments[0].carrier) {
        carrier = firstSlice.segments[0].carrier;
        console.log('🏢 FlightResults: Carrier from segments:', carrier);
      } else if (flight.ext && (flight.ext as any).carrier) {
        carrier = (flight.ext as any).carrier;
        console.log('🏢 FlightResults: Carrier from ext:', carrier);
      } else {
        // Try to derive carrier from flight number
        const flightCode = firstSlice.flights[0];
        if (flightCode) {
          const carrierCode = flightCode.replace(/\d+$/, '');
          carrier = { code: carrierCode, name: carrierCode, shortName: carrierCode };
          console.log('🏢 FlightResults: Carrier derived from flight code:', carrier);
        }
      }
      
      groups.set(groupingKey, {
        outboundSlice: firstSlice,
        returnOptions: [],
        carrier: carrier,
        isNonstop: firstSlice.stops === null || firstSlice.stops.length === 0
      });
    } else {
      console.log('📝 FlightResults: Adding to existing group:', groupingKey);
    }

    const group = groups.get(groupingKey)!;
    console.log('➕ FlightResults: Adding return option to group:', groupingKey);
    console.log('✈️ FlightResults: Flight details:', firstSlice.flights, firstSlice.departure, '→', firstSlice.arrival);
    group.returnOptions.push({
      returnSlice: flight.slices[1], // Use the return slice (CDG → SFO)
      totalAmount: flight.totalAmount,
      displayTotal: flight.displayTotal,
      ext: flight.ext,
      originalFlightId: flight.id
    });
  });

  // Sort return options by price within each group
  groups.forEach(group => {
    group.returnOptions.sort((a, b) => a.totalAmount - b.totalAmount);
    console.log(`✅ FlightResults: Group has ${group.returnOptions.length} return options`);
  });

  const groupedResults = Array.from(groups.values());
  
  console.log(`📊 FlightResults: ${groupedResults.length} grouped flights, ${ungroupedFlights.length} ungrouped flights`);
  
  return [...groupedResults, ...ungroupedFlights];
};
const FlightResults: React.FC<FlightResultsProps> = ({
  results,
  loading,
  error,
  searchParams,
  advancedSettings
}) => {
  console.log('🎯 FlightResults: Rendering with results:', results);
  console.log('🎯 FlightResults: Loading state:', loading);
  console.log('🎯 FlightResults: Error state:', error);

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader className="h-8 w-8 text-accent-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-300">Searching for flights...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-4" />
          <p className="text-red-300 mb-2">Search failed</p>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Show empty state if no results
  if (!results || !results.solutionList || !results.solutionList.solutions || results.solutionList.solutions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Plane className="h-8 w-8 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-300 mb-2">No flights found</p>
          <p className="text-gray-400 text-sm">Try adjusting your search criteria</p>
        </div>
      </div>
    );
  }

  // Show results
  const flights = results.solutionList.solutions;
  const processedFlights = groupFlightsByOutbound(flights);

  return (
    <div className="space-y-6">
      {/* Results Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">
          {processedFlights.length} flight{processedFlights.length !== 1 ? 's' : ''} found
        </h2>
        {results.solutionList.minPrice && (
          <div className="text-sm text-gray-400">
            From {results.solutionList.minPrice}
          </div>
        )}
      </div>

      {/* Flight Cards */}
      <div className="space-y-4">
        {processedFlights.map((flight, index) => (
          <React.Fragment key={'id' in flight ? flight.id : `grouped-${index}`}>
            {'id' in flight && flight.slices.length >= 3 ? (
              <MultiLegFlightCard flight={flight} />
            ) : (
              <FlightCard flight={flight} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default FlightResults;