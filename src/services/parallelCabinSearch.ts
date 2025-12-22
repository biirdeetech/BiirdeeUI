/**
 * Parallel cabin search service
 * Launches 4 concurrent searches (one per cabin class) and merges results
 */

import { FlightSearchParams, SearchResponse } from '../types/flight';
import { FlightApi } from './flightApiConfig';

export interface ParallelSearchProgress {
  cabin: string;
  status: 'pending' | 'streaming' | 'complete' | 'error';
  solutionCount?: number;
  receivedCount?: number;
  error?: string;
}

export interface ParallelSearchResult {
  allFlights: any[];
  cabinResults: Record<string, SearchResponse>;
  progress: Record<string, ParallelSearchProgress>;
}

const CABIN_CLASSES = ['COACH', 'PREMIUM-COACH', 'BUSINESS', 'FIRST'] as const;

/**
 * Search all 4 cabin classes in parallel
 */
export async function searchAllCabins(
  baseParams: FlightSearchParams,
  onProgress?: (cabin: string, flight: any) => void,
  onCabinMetadata?: (cabin: string, metadata: any) => void,
  onCabinComplete?: (cabin: string) => void
): Promise<ParallelSearchResult> {
  console.log('🔄 ParallelCabinSearch: Starting parallel searches for 4 cabins');

  const cabinResults: Record<string, SearchResponse> = {};
  const cabinFlights: Record<string, any[]> = {};
  const progress: Record<string, ParallelSearchProgress> = {};

  // Initialize progress tracking
  CABIN_CLASSES.forEach(cabin => {
    progress[cabin] = { cabin, status: 'pending' };
  });

  // Create search params for each cabin
  const cabinSearches = CABIN_CLASSES.map(async (cabin) => {
    try {
      progress[cabin] = { cabin, status: 'streaming' };

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

      // Callbacks for this cabin
      const onCabinProgress = (flight: any) => {
        // Store flight for this cabin
        if (!cabinFlights[cabin]) {
          cabinFlights[cabin] = [];
        }
        cabinFlights[cabin].push(flight);

        // Update progress
        const currentProgress = progress[cabin];
        progress[cabin] = {
          ...currentProgress,
          receivedCount: (currentProgress.receivedCount || 0) + 1
        };

        // Notify caller
        if (onProgress) {
          onProgress(cabin, flight);
        }
      };

      const onCabinMeta = (metadata: any) => {
        // Update progress with metadata
        const currentProgress = progress[cabin];
        progress[cabin] = {
          ...currentProgress,
          solutionCount: metadata.solutionCount
        };

        // Notify caller
        if (onCabinMetadata) {
          onCabinMetadata(cabin, metadata);
        }
      };

      // Execute search
      const result = await FlightApi.searchFlights(
        cabinParams,
        baseParams.aero ? onCabinProgress : undefined,
        baseParams.aero ? onCabinMeta : undefined
      );

      console.log(`✅ ParallelCabinSearch: ${cabin} search complete with ${result.solutionList?.solutions?.length || 0} results`);

      // Store results
      cabinResults[cabin] = result;
      cabinFlights[cabin] = result.solutionList?.solutions || [];

      // Update progress
      progress[cabin] = {
        cabin,
        status: 'complete',
        solutionCount: result.solutionCount,
        receivedCount: result.solutionList?.solutions?.length || 0
      };

      // Notify completion
      if (onCabinComplete) {
        onCabinComplete(cabin);
      }

      return { cabin, result };
    } catch (error) {
      console.error(`❌ ParallelCabinSearch: ${cabin} search failed:`, error);

      progress[cabin] = {
        cabin,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      return { cabin, result: null, error };
    }
  });

  // Wait for all searches to complete
  await Promise.all(cabinSearches);

  // Flatten all flights from all cabins (no merging/grouping)
  console.log('🔄 ParallelCabinSearch: Flattening results from all cabins');
  const allFlights: any[] = [];
  Object.values(cabinFlights).forEach(flights => {
    allFlights.push(...flights);
  });
  console.log(`✅ ParallelCabinSearch: Total ${allFlights.length} flights across all cabins`);

  return {
    allFlights,
    cabinResults,
    progress
  };
}

/**
 * Get cabin-specific search parameters
 */
export function getCabinSearchParams(
  baseParams: FlightSearchParams,
  cabin: string
): FlightSearchParams {
  return {
    ...baseParams,
    cabin: cabin as any,
    slices: baseParams.slices?.map(slice => ({
      ...slice,
      cabin: cabin as any
    }))
  };
}

/**
 * Convert flat flights array back to standard SearchResponse format
 */
export function flatFlightsToResponse(
  flights: any[],
  metadata?: {
    session?: string;
    solutionSet?: string;
    solutionCount?: number;
    pagination?: any;
  }
): SearchResponse {
  return {
    solutionList: {
      solutions: flights
    },
    session: metadata?.session,
    solutionSet: metadata?.solutionSet,
    solutionCount: metadata?.solutionCount || flights.length,
    pagination: metadata?.pagination
  };
}
