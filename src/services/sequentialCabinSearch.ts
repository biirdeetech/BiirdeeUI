/**
 * Sequential cabin search service
 * Launches cabin searches sequentially (one after another) and merges results
 * Shows progress after each cabin completes
 */

import { FlightSearchParams, SearchResponse } from '../types/flight';
import { FlightApi } from './flightApiConfig';
import { generateFlightSignature, mergeFlightsByCabin, FlightWithCabins } from '../utils/flightSignature';

export interface SequentialSearchProgress {
  cabin: string;
  status: 'pending' | 'streaming' | 'complete' | 'error';
  solutionCount?: number;
  receivedCount?: number;
  error?: string;
}

export interface SequentialSearchResult {
  mergedFlights: Map<string, FlightWithCabins>;
  cabinResults: Record<string, SearchResponse>;
  progress: Record<string, SequentialSearchProgress>;
}

const CABIN_CLASSES = ['COACH', 'PREMIUM-COACH', 'BUSINESS', 'FIRST'] as const;

/**
 * Search all 4 cabin classes sequentially (one after another)
 * Provides progress updates and merged results after each cabin completes
 */
export async function searchAllCabinsSequentially(
  baseParams: FlightSearchParams,
  onProgress?: (cabin: string, flight: any) => void,
  onCabinMetadata?: (cabin: string, metadata: any) => void,
  onCabinComplete?: (cabin: string, mergedFlights: Map<string, FlightWithCabins>) => void,
  onProgressUpdate?: (progress: Record<string, SequentialSearchProgress>) => void
): Promise<SequentialSearchResult> {
  console.log('🔄 SequentialCabinSearch: Starting sequential searches for 4 cabins');

  const cabinResults: Record<string, SearchResponse> = {};
  const cabinFlights: Record<string, any[]> = {};
  const progress: Record<string, SequentialSearchProgress> = {};
  const allFlights: any[] = [];

  // Initialize progress tracking - all pending
  CABIN_CLASSES.forEach(cabin => {
    progress[cabin] = { cabin, status: 'pending' };
  });

  // Notify initial progress
  onProgressUpdate?.(progress);

  // Search each cabin sequentially
  for (const cabin of CABIN_CLASSES) {
    try {
      console.log(`🔍 SequentialCabinSearch: Starting search for ${cabin}`);
      progress[cabin] = { cabin, status: 'streaming' };
      onProgressUpdate?.(progress);

      // Clone params and set cabin
      const cabinParams: FlightSearchParams = {
        ...baseParams,
        cabin: cabin as any,
        // Update slices if they exist
        slices: baseParams.slices?.map(slice => ({
          ...slice,
          cabin: cabin as any
        }))
      };

      // Track received flights for this cabin
      const cabinFlightsList: any[] = [];

      // Streaming progress handler for this cabin
      const cabinProgressHandler = (flight: any) => {
        cabinFlightsList.push(flight);
        progress[cabin] = {
          cabin,
          status: 'streaming',
          receivedCount: cabinFlightsList.length
        };
        onProgress?.(cabin, flight);
      };

      // Metadata handler for this cabin
      const cabinMetadataHandler = (metadata: any) => {
        progress[cabin] = {
          ...progress[cabin],
          solutionCount: metadata.solutionCount
        };
        onCabinMetadata?.(cabin, metadata);
        onProgressUpdate?.(progress);
      };

      // Execute search for this cabin
      const result = await FlightApi.searchFlights(
        cabinParams,
        baseParams.aero ? cabinProgressHandler : undefined,
        baseParams.aero ? cabinMetadataHandler : undefined
      );

      // Store result
      cabinResults[cabin] = result;
      cabinFlights[cabin] = result.solutionList?.solutions || [];
      allFlights.push(...cabinFlights[cabin]);

      // Mark cabin as complete
      progress[cabin] = {
        cabin,
        status: 'complete',
        solutionCount: result.solutionCount,
        receivedCount: cabinFlights[cabin].length
      };

      console.log(`✅ SequentialCabinSearch: ${cabin} search completed with ${cabinFlights[cabin].length} flights`);

      // Merge flights up to this point and notify
      // mergeFlightsByCabin expects Record<cabin, flights[]>
      const mergedFlights = mergeFlightsByCabin(cabinFlights);
      onCabinComplete?.(cabin, mergedFlights);
      onProgressUpdate?.(progress);

    } catch (error) {
      console.error(`❌ SequentialCabinSearch: Error searching ${cabin}:`, error);
      progress[cabin] = {
        cabin,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      onProgressUpdate?.(progress);
      // Continue with next cabin even if this one fails
    }
  }

  // Final merge of all flights
  // mergeFlightsByCabin expects Record<cabin, flights[]>
  const mergedFlights = mergeFlightsByCabin(cabinFlights);

  console.log(`✅ SequentialCabinSearch: All searches completed. Total unique flights: ${mergedFlights.size}`);

  return {
    mergedFlights,
    cabinResults,
    progress
  };
}

/**
 * Convert merged flights back to SearchResponse format
 */
export function mergedFlightsToResponse(
  mergedFlights: Map<string, FlightWithCabins>,
  metadata: {
    session?: string;
    solutionSet?: string;
    solutionCount?: number;
    pagination?: any;
  }
): SearchResponse {
  const flights = Array.from(mergedFlights.values()).map(flight => ({
    ...flight,
    // cabinPrices and baseFlightId are already in flight
  }));

  return {
    session: metadata.session || '',
    solutionSet: metadata.solutionSet || '',
    solutionCount: metadata.solutionCount || flights.length,
    solutionList: {
      solutions: flights
    },
    pagination: metadata.pagination
  };
}
